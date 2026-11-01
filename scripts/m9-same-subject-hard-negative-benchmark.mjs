import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import sharp from 'sharp'
import { initOpenCV } from '@banou/opencv-wasm'
import { similarity } from './m9-image-similarity-benchmark.mjs'
import { siftSimilarity } from './m9-sift-real-photo-benchmark.mjs'

const ROOT = 'fixtures/same-subject'
const results = []

function errorDetails(error) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack }
  return { name: typeof error, message: String(error), value: error }
}

async function decode(file) {
  const { data, info } = await sharp(file).rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .greyscale().raw().toBuffer({ resolveWithObject: true })
  if (!info.width || !info.height || data.length !== info.width * info.height) {
    throw new Error(`Invalid decoded image dimensions/data: ${info.width}x${info.height}, bytes=${data.length}`)
  }
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

async function runAlgorithm(name, fn, left, right, pairLabel) {
  console.log('M9_PAIR_STAGE', JSON.stringify({ pair: pairLabel, stage: `${name}_start`, left: [left.width, left.height], right: [right.width, right.height] }))
  try {
    const value = await fn(left, right)
    const result = { status: 'ok', ...value }
    console.log('M9_PAIR_STAGE', JSON.stringify({ pair: pairLabel, stage: `${name}_complete`, inliers: result.inliers, keypointsLeft: result.leftKeypoints ?? result.keypointsLeft, keypointsRight: result.rightKeypoints ?? result.keypointsRight }))
    return result
  } catch (error) {
    const details = errorDetails(error)
    console.error('M9_PAIR_ALGORITHM_ERROR', JSON.stringify({ pair: pairLabel, algorithm: name, ...details }))
    return { status: 'error', error: details }
  }
}

async function compare(left, right, pairLabel) {
  const [orb, sift] = await Promise.all([
    runAlgorithm('ORB', async (a, b) => similarity(null, a, b), left, right, pairLabel),
    runAlgorithm('SIFT', siftSimilarity, left, right, pairLabel)
  ])
  return { orb, sift }
}

async function processPair(meta, loadLeft, loadRight, pairLabel) {
  console.log('M9_PAIR_START', JSON.stringify({ pair: pairLabel, ...meta }))
  try {
    console.log('M9_PAIR_STAGE', JSON.stringify({ pair: pairLabel, stage: 'decode_start' }))
    const [left, right] = await Promise.all([loadLeft(), loadRight()])
    console.log('M9_PAIR_STAGE', JSON.stringify({ pair: pairLabel, stage: 'decode_complete', left: [left.width, left.height], right: [right.width, right.height] }))
    const measured = await compare(left, right, pairLabel)
    const record = { ...meta, pairLabel, imageStatus: 'ok', ...measured }
    results.push(record)
    console.log('M9_PAIR_COMPLETE', JSON.stringify({ pair: pairLabel, orb: record.orb.status, sift: record.sift.status }))
    return record
  } catch (error) {
    const details = errorDetails(error)
    console.error('M9_PAIR_IMAGE_ERROR', JSON.stringify({ pair: pairLabel, ...details }))
    const record = {
      ...meta, pairLabel, imageStatus: 'error', imageError: details,
      orb: { status: 'not_run', reason: 'image_decode_failed' },
      sift: { status: 'not_run', reason: 'image_decode_failed' }
    }
    results.push(record)
    return record
  }
}

async function main() {
  await initOpenCV()

  // COIL-20: same physical object photographed at different viewing angles.
  const coilDir = `${ROOT}/coil-20-proc`
  const objectPairs = []
  for (const objectId of [1, 2, 3, 4, 5]) {
    objectPairs.push({ objectId, left: `obj${objectId}__0.png`, right: `obj${objectId}__18.png`, expected: 'same_object_different_view' })
    objectPairs.push({ objectId, left: `obj${objectId}__0.png`, right: `obj${objectId}__36.png`, expected: 'same_object_different_view' })
  }
  for (const [leftId, rightId] of [[1,2],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5],[3,4],[3,5],[4,5]]) {
    objectPairs.push({ objectId: null, left: `obj${leftId}__0.png`, right: `obj${rightId}__0.png`, expected: 'different_object' })
  }
  for (let index = 0; index < objectPairs.length; index++) {
    const pair = objectPairs[index]
    const label = `COIL-${String(index + 1).padStart(2, '0')}`
    await processPair(
      { dataset: 'COIL-20', category: 'object', ...pair },
      () => decode(`${coilDir}/${pair.left}`),
      () => decode(`${coilDir}/${pair.right}`),
      label
    )
  }

  // LFW View 1 development test pairs. Person names are used only to fetch fixtures and never logged.
  const pairsResponse = await fetch('https://vis-www.cs.umass.edu/lfw/pairsDevTest.txt')
  if (!pairsResponse.ok) throw new Error(`LFW pair protocol download failed: HTTP ${pairsResponse.status}`)
  const pairsText = await pairsResponse.text()
  const lines = pairsText.trim().split(/\r?\n/)
  const counts = lines[0].trim().split(/\s+/).map(Number)
  assert.ok(counts.length >= 2 && counts[0] >= 20 && counts[1] >= 20, 'LFW pairsDevTest protocol file did not match expected format')
  const positiveLines = lines.slice(1, 1 + 20)
  const negativeLines = lines.slice(1 + counts[0], 1 + counts[0] + 20)
  assert.equal(positiveLines.length, 20, 'LFW same-person pair count mismatch')
  assert.equal(negativeLines.length, 20, 'LFW different-person pair count mismatch')

  const faceDir = `${ROOT}/lfw`
  await mkdir(faceDir, { recursive: true })
  const imageCache = new Map()
  async function getFace(person, index) {
    const fileName = `${person}_${String(index).padStart(4, '0')}.jpg`
    const localPath = `${faceDir}/${fileName}`
    if (!imageCache.has(fileName)) {
      const url = `https://vis-www.cs.umass.edu/lfw/${person}/${fileName}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`LFW image download failed: HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      await writeFile(localPath, bytes)
      imageCache.set(fileName, localPath)
    }
    return decode(imageCache.get(fileName))
  }
  function parseSame(line) {
    const [person, a, b] = line.trim().split(/\s+/)
    return { person, a: Number(a), b: Number(b) }
  }
  function parseDifferent(line) {
    const [personA, indexA, personB, indexB] = line.trim().split(/\s+/)
    return { personA, indexA: Number(indexA), personB, indexB: Number(indexB) }
  }

  for (let index = 0; index < positiveLines.length; index++) {
    const p = parseSame(positiveLines[index])
    const label = `LFW-SAME-${String(index + 1).padStart(2, '0')}`
    await processPair(
      { dataset: 'LFW-View1-DevTest', category: 'person', expected: 'same_person_different_photo' },
      () => getFace(p.person, p.a),
      () => getFace(p.person, p.b),
      label
    )
  }
  for (let index = 0; index < negativeLines.length; index++) {
    const p = parseDifferent(negativeLines[index])
    const label = `LFW-DIFFERENT-${String(index + 1).padStart(2, '0')}`
    await processPair(
      { dataset: 'LFW-View1-DevTest', category: 'person', expected: 'different_people' },
      () => getFace(p.personA, p.indexA),
      () => getFace(p.personB, p.indexB),
      label
    )
  }

  const expectedCounts = {
    sameObjectDifferentView: objectPairs.filter(p => p.expected === 'same_object_different_view').length,
    differentObject: objectPairs.filter(p => p.expected === 'different_object').length,
    samePersonDifferentPhoto: positiveLines.length,
    differentPeople: negativeLines.length
  }
  assert.deepEqual(expectedCounts, { sameObjectDifferentView: 10, differentObject: 10, samePersonDifferentPhoto: 20, differentPeople: 20 })
  assert.equal(results.length, 60, 'Expected all 60 pair records, including diagnostic failures')

  const statusCounts = {
    imageErrors: results.filter(r => r.imageStatus !== 'ok').length,
    orbErrors: results.filter(r => r.orb.status === 'error').length,
    siftErrors: results.filter(r => r.sift.status === 'error').length,
    orbNotRun: results.filter(r => r.orb.status === 'not_run').length,
    siftNotRun: results.filter(r => r.sift.status === 'not_run').length
  }
  const report = {
    benchmark: 'same-object-different-view-and-same-person-different-photo-v2-diagnostic',
    protocol: 'diagnostic-only; no production thresholds; LFW View 1 development test pairs',
    counts: expectedCounts,
    statusCounts,
    metrics: 'ORB/SIFT RANSAC inliers and matcher diagnostics; per-algorithm failures retained',
    results
  }
  await writeFile('m9-same-subject-hard-negative-results.json', JSON.stringify(report, null, 2) + '\n')

  const rows = results.map((r, i) =>
    `| ${i + 1} | ${r.pairLabel} | ${r.dataset} | ${r.expected} | ${r.imageStatus} | ${r.orb.status} | ${r.orb.inliers ?? '—'} | ${r.sift.status} | ${r.sift.inliers ?? '—'} |`
  )
  const summary = [
    '## M9 Same-Subject Hard-Negative Diagnostic',
    '',
    '> Diagnostic only; no production thresholds. A failed ORB run does not suppress SIFT, and vice versa. Image/pair failures are retained in the JSON report.',
    '',
    `Pair records: ${results.length}/60. Image errors: ${statusCounts.imageErrors}; ORB errors: ${statusCounts.orbErrors}; SIFT errors: ${statusCounts.siftErrors}.`,
    '',
    '| # | Pair | Dataset | Ground truth | Image | ORB | ORB inliers | SIFT | SIFT inliers |',
    '|---:|---|---|---|---|---|---:|---|---:|',
    ...rows,
    '',
    'A recorded algorithm error is diagnostic evidence, not a successful similarity result. Review JSON error details before interpreting accuracy.',
    ''
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)

  const algorithmFailures = statusCounts.imageErrors + statusCounts.orbErrors + statusCounts.siftErrors
  console.log('M9_SAME_SUBJECT_DIAGNOSTIC_COMPLETE', JSON.stringify({ expectedCounts, statusCounts, algorithmFailures }))
}

main().catch(error => {
  console.error('M9_SAME_SUBJECT_DIAGNOSTIC_FATAL')
  if (error instanceof Error) console.error(error.stack ?? error.message)
  else console.error(JSON.stringify(error), String(error))
  process.exitCode = 1
})
