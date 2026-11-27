import assert from 'node:assert/strict'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import sharp from 'sharp'
import { initOpenCV } from '@banou/opencv-wasm'
import { similarity } from './m9-image-similarity-benchmark.mjs'

async function decodePhoto(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

async function main() {
  await initOpenCV()
  const files = {
    westGhatsA: await readFile('fixtures/real-photos/western-ghats-1102826.jpg'),
    westGhatsB: await readFile('fixtures/real-photos/western-ghats-968078.jpg'),
    sahyadriC: await readFile('fixtures/real-photos/sahyadri-1020298.jpg'),
    forestD: await readFile('fixtures/real-photos/forest-1017099.jpg')
  }
  const baseA = await decodePhoto(files.westGhatsA)
  const baseB = await decodePhoto(files.westGhatsB)
  const baseC = await decodePhoto(files.sahyadriC)
  const baseD = await decodePhoto(files.forestD)

  const resizedBuffer = await sharp(files.westGhatsA)
    .rotate()
    .resize({ width: Math.round(baseA.width * 0.72) })
    .jpeg({ quality: 88 })
    .toBuffer()
  const compressedBuffer = await sharp(files.westGhatsA).rotate().jpeg({ quality: 28, mozjpeg: true }).toBuffer()
  const cropWidth = Math.floor(baseA.width * 0.82)
  const cropHeight = Math.floor(baseA.height * 0.82)
  const cropBuffer = await sharp(files.westGhatsA)
    .rotate()
    .extract({
      left: Math.floor((baseA.width - cropWidth) / 2),
      top: Math.floor((baseA.height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  const cases = [
    ['P1_real_same_photo_resized', baseA, await decodePhoto(resizedBuffer), 'positive'],
    ['P2_real_same_photo_jpeg_q28', baseA, await decodePhoto(compressedBuffer), 'positive'],
    ['P3_real_same_photo_center_crop', baseA, await decodePhoto(cropBuffer), 'positive'],
    ['N1_real_different_similar_landscapes', baseA, baseB, 'negative'],
    ['N2_real_different_forest_landscapes', baseC, baseD, 'negative']
  ]

  const results = []
  for (const [name, left, right, expected] of cases) {
    const measured = await similarity(null, left, right)
    const result = {
      name,
      expected,
      ...measured,
      sourceDimensions: [left.width, left.height],
      targetDimensions: [right.width, right.height]
    }
    results.push(result)
    console.log('M9_REAL_PHOTO_CASE', JSON.stringify(result))
  }

  assert.equal(results.length, 5)
  assert.ok(results.every(result => Number.isFinite(result.score)))
  await writeFile('m9-real-photo-results.json', JSON.stringify({
    benchmark: 'real-photo-diagnostic-v1',
    dataset: 'PxHere CC0 public-domain landscape photographs; transformations generated locally during CI',
    classification: 'diagnostic-only-no-production-threshold',
    results
  }, null, 2) + '\n')

  const summary = [
    '## M9 Real-Photo Diagnostic',
    '',
    '> Four public-domain CC0 photographs from PxHere. Same-source resized/JPEG/crop variants are positive pairs; distinct landscape photographs are hard-negative pairs. Diagnostic only; no production classification threshold.',
    '',
    '| Case | Expected | Inliers | Inlier ratio | Source hull fraction | Target hull fraction |',
    '|---|---|---:|---:|---:|---:|',
    ...results.map(r => '| ' + r.name + ' | ' + r.expected + ' | ' + r.inliers + ' | ' + r.inlierRatio + ' | ' + (r.ransacInlierSourceCoverage?.convexHullAreaFraction ?? 'n/a') + ' | ' + (r.ransacInlierTargetCoverage?.convexHullAreaFraction ?? 'n/a') + ' |'),
    '',
    'No production threshold or M9 acceptance is implied by this run.',
    ''
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log('M9_REAL_PHOTO_DIAGNOSTIC_PASS')
}

main().catch(error => {
  console.error('M9_REAL_PHOTO_DIAGNOSTIC_FAIL')
  console.error(error?.stack ?? error)
  process.exitCode = 1
})
