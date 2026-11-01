import assert from 'node:assert/strict'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import sharp from 'sharp'
import {
  BFMatcher, DMatchVectorVector, KeyPointVector, Mat, NORM_L2,
  RANSAC, SIFT_create, CV_32FC2, countNonZero, findHomography, initOpenCV
} from '@banou/opencv-wasm'

async function decodePhoto(buffer) {
  const { data, info } = await sharp(buffer).rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .greyscale().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

function makeMat(fixture) {
  const mat = new Mat(fixture.height, fixture.width, 0)
  mat.data.set(fixture.data)
  return mat
}

async function describeSift(fixture) {
  const image = makeMat(fixture)
  const mask = new Mat()
  const keypoints = new KeyPointVector()
  const descriptors = new Mat()
  const sift = SIFT_create(1600)
  try {
    sift.detectAndCompute(image, mask, keypoints, descriptors)
    const points = []
    for (let i = 0; i < keypoints.size(); i++) {
      const kp = keypoints.get(i)
      try { points.push({ x: kp.pt.x, y: kp.pt.y }) } finally { kp.delete?.() }
    }
    return { points, descriptors: descriptors.mat_clone(), keypointCount: keypoints.size() }
  } finally {
    sift.delete(); descriptors.delete(); keypoints.delete(); mask.delete(); image.delete()
  }
}

async function siftSimilarity(leftFixture, rightFixture) {
  const left = await describeSift(leftFixture)
  const right = await describeSift(rightFixture)
  const matcher = new BFMatcher(NORM_L2, false)
  const knn = new DMatchVectorVector()
  try {
    matcher.knnMatch(left.descriptors, right.descriptors, knn, 2)
    const from = [], to = []
    let accepted = 0, candidates = 0, distanceTotal = 0
    for (let i = 0; i < knn.size(); i++) {
      const pair = knn.get(i)
      try {
        if (pair.size() < 2) continue
        const best = pair.get(0), second = pair.get(1)
        try {
          candidates++
          if (!(best.distance < 0.78 * second.distance)) continue
          accepted++; distanceTotal += best.distance
          const a = left.points[best.queryIdx], b = right.points[best.trainIdx]
          if (a && b) { from.push(a.x, a.y); to.push(b.x, b.y) }
        } finally { second.delete?.(); best.delete?.() }
      } finally { pair.delete?.() }
    }
    let inliers = 0, inlierRatio = 0
    if (from.length >= 8) {
      const a = new Mat(from.length / 2, 1, CV_32FC2)
      const b = new Mat(to.length / 2, 1, CV_32FC2)
      const mask = new Mat()
      let h
      try {
        a.data32F.set(from); b.data32F.set(to)
        h = findHomography(a, b, RANSAC, 4, mask)
        if (h && !h.empty()) {
          inliers = countNonZero(mask)
          inlierRatio = inliers / (from.length / 2)
        }
      } finally { h?.delete(); mask.delete(); b.delete(); a.delete() }
    }
    return {
      keypointsLeft: left.keypointCount, keypointsRight: right.keypointCount,
      ratioAccepted: accepted, ratioCandidates: candidates,
      meanBestDistance: accepted ? Number((distanceTotal / accepted).toFixed(3)) : null,
      inliers, inlierRatio: Number(inlierRatio.toFixed(4)),
      inlierScore: Number((inliers / Math.max(1, Math.min(left.keypointCount, right.keypointCount))).toFixed(4))
    }
  } finally { knn.delete(); matcher.delete(); left.descriptors.delete(); right.descriptors.delete() }
}

async function main() {
  await initOpenCV()
  assert.equal(typeof SIFT_create, 'function', 'SIFT_create export unavailable')
  assert.equal(typeof NORM_L2, 'number', 'NORM_L2 export unavailable')
  const source = await readFile('fixtures/real-photos/western-ghats-1102826.jpg')
  const source2 = await readFile('fixtures/real-photos/western-ghats-968078.jpg')
  const source3 = await readFile('fixtures/real-photos/sahyadri-1020298.jpg')
  const source4 = await readFile('fixtures/real-photos/forest-1017099.jpg')
  const base = await decodePhoto(source)
  const baseB = await decodePhoto(source2)
  const baseC = await decodePhoto(source3)
  const baseD = await decodePhoto(source4)
  const resized = await decodePhoto(await sharp(source).rotate().resize({ width: Math.round(base.width * .72) }).jpeg({ quality: 88 }).toBuffer())
  const compressed = await decodePhoto(await sharp(source).rotate().jpeg({ quality: 28, mozjpeg: true }).toBuffer())
  const cw = Math.floor(base.width * .82), ch = Math.floor(base.height * .82)
  const cropped = await decodePhoto(await sharp(source).rotate().extract({
    left: Math.floor((base.width - cw) / 2), top: Math.floor((base.height - ch) / 2), width: cw, height: ch
  }).jpeg({ quality: 90 }).toBuffer())
  const cases = [
    ['P1_real_same_photo_resized', base, resized, 'positive'],
    ['P2_real_same_photo_jpeg_q28', base, compressed, 'positive'],
    ['P3_real_same_photo_center_crop', base, cropped, 'positive'],
    ['N1_real_different_similar_landscapes', base, baseB, 'negative'],
    ['N2_real_different_forest_landscapes', baseC, baseD, 'negative']
  ]
  const results = []
  for (const [name, left, right, expected] of cases) {
    const result = { name, expected, algorithm: 'SIFT+BFMatcher(NORM_L2)+KNN ratio 0.78+RANSAC', ...await siftSimilarity(left, right) }
    results.push(result)
    console.log('M9_SIFT_REAL_PHOTO_CASE', JSON.stringify(result))
  }
  assert.equal(results.length, 5)
  assert.ok(results.every(r => Number.isFinite(r.inlierScore)))
  const payload = { benchmark: 'sift-real-photo-comparison-diagnostic-v1', classification: 'diagnostic-only-no-production-threshold', siftNorm: NORM_L2, results }
  await writeFile('m9-sift-real-photo-results.json', JSON.stringify(payload, null, 2) + '\n')
  const summary = [
    '## M9 SIFT Real-Photo Comparison',
    '',
    '> SIFT uses L2 descriptor distance, KNN Lowe ratio 0.78 and RANSAC. Diagnostic only; no production threshold or M9 acceptance.',
    '',
    '| Case | Expected | Keypoints L/R | Ratio accepted | RANSAC inliers | Inlier ratio | Score |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...results.map(r => `| ${r.name} | ${r.expected} | ${r.keypointsLeft}/${r.keypointsRight} | ${r.ratioAccepted}/${r.ratioCandidates} | ${r.inliers} | ${r.inlierRatio} | ${r.inlierScore} |`),
    '',
    'Compare these rows with the ORB artifact from the same workflow run. Small sample; do not infer general accuracy.',
    ''
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log('M9_SIFT_REAL_PHOTO_DIAGNOSTIC_PASS')
}
main().catch(error => { console.error('M9_SIFT_REAL_PHOTO_DIAGNOSTIC_FAIL'); console.error(error?.stack ?? error); process.exitCode = 1 })
