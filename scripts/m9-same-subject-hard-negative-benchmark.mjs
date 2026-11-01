import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { initOpenCV } from '@banou/opencv-wasm'
import { similarity } from './m9-image-similarity-benchmark.mjs'
import { siftSimilarity } from './m9-sift-real-photo-benchmark.mjs'

const ROOT = 'fixtures/same-subject'
async function decode(file) {
  const { data, info } = await sharp(file).rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .greyscale().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}
async function compare(a, b) {
  const [orb, sift] = await Promise.all([similarity(null, a, b), siftSimilarity(a, b)])
  return { orb, sift }
}
async function main() {
  await initOpenCV()
  const results = []

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
  for (const pair of objectPairs) {
    const left = await decode(`${coilDir}/${pair.left}`)
    const right = await decode(`${coilDir}/${pair.right}`)
    results.push({ dataset: 'COIL-20', category: 'object', ...pair, ...(await compare(left, right)) })
  }

  // LFW View 1 development test pairs: labels are pair-level only; names are not emitted in report.
  const pairsText = await (await fetch('https://vis-www.cs.umass.edu/lfw/pairsDevTest.txt')).text()
  const lines = pairsText.trim().split(/\\r?\\n/)
  const counts = lines[0].trim().split(/\\s+/).map(Number)
  assert.ok(counts.length >= 2 && counts[0] >= 20 && counts[1] >= 20, 'LFW pairsDevTest protocol file did not match expected format')
  const positiveLines = lines.slice(1, 1 + 20)
  const negativeLines = lines.slice(1 + counts[0], 1 + counts[0] + 20)
  const faceDir = `${ROOT}/lfw`
  await mkdir(faceDir, { recursive: true })
  const imageCache = new Map()
  async function getFace(person, index) {
    const fileName = `${person}_${String(index).padStart(4, '0')}.jpg`
    const localPath = `${faceDir}/${fileName}`
    if (!imageCache.has(fileName)) {
      const url = `https://vis-www.cs.umass.edu/lfw/${person}/${fileName}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`LFW fixture download failed: HTTP ${response.status} for pair fixture`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      await writeFile(localPath, bytes)
      imageCache.set(fileName, localPath)
    }
    return decode(imageCache.get(fileName))
  }
  function parseSame(line) {
    const [person, a, b] = line.trim().split(/\\s+/)
    return { person, a: Number(a), b: Number(b) }
  }
  function parseDifferent(line) {
    const [personA, indexA, personB, indexB] = line.trim().split(/\\s+/)
    return { personA, indexA: Number(indexA), personB, indexB: Number(indexB) }
  }
  for (const line of positiveLines) {
    const p = parseSame(line)
    const [left, right] = await Promise.all([getFace(p.person, p.a), getFace(p.person, p.b)])
    results.push({ dataset: 'LFW-View1-DevTest', category: 'person', expected: 'same_person_different_photo', ...(await compare(left, right)) })
  }
  for (const line of negativeLines) {
    const p = parseDifferent(line)
    const [left, right] = await Promise.all([getFace(p.personA, p.indexA), getFace(p.personB, p.indexB)])
    results.push({ dataset: 'LFW-View1-DevTest', category: 'person', expected: 'different_people', ...(await compare(left, right)) })
  }
  const expectedCounts = {
    sameObjectDifferentView: objectPairs.filter(p => p.expected === 'same_object_different_view').length,
    differentObject: objectPairs.filter(p => p.expected === 'different_object').length,
    samePersonDifferentPhoto: positiveLines.length,
    differentPeople: negativeLines.length
  }
  assert.deepEqual(expectedCounts, { sameObjectDifferentView: 10, differentObject: 10, samePersonDifferentPhoto: 20, differentPeople: 20 })
  assert.equal(results.length, 60)
  assert.ok(results.every(r => Number.isFinite(r.orb.inliers) && Number.isFinite(r.sift.inliers)))
  const report = {
    benchmark: 'same-object-different-view-and-same-person-different-photo-v1',
    protocol: 'diagnostic-only; no production thresholds; LFW View 1 development test pairs',
    counts: expectedCounts,
    metrics: 'ORB/SIFT RANSAC inliers and matcher diagnostics',
    results
  }
  await writeFile('m9-same-subject-hard-negative-results.json', JSON.stringify(report, null, 2) + '\\n')
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = results.map((r, i) => `| ${i+1} | ${r.dataset} | ${r.expected} | ${r.orb.inliers} | ${r.sift.inliers} |`)
    const summary = ['## M9 Same-Subject Hard-Negative Diagnostic', '', '| # | Dataset | Ground truth | ORB inliers | SIFT inliers |', '|---:|---|---|---:|---:|', ...lines, '', 'Diagnostic only. Similarity is not proof of duplicate identity; no production threshold is selected.', ''].join('\\n')
    const { appendFile } = await import('node:fs/promises')
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  console.log('M9_SAME_SUBJECT_DIAGNOSTIC_PASS', JSON.stringify(expectedCounts))
}
main().catch(error => { console.error('M9_SAME_SUBJECT_DIAGNOSTIC_FAIL'); console.error(error?.stack ?? error); process.exitCode = 1 })
