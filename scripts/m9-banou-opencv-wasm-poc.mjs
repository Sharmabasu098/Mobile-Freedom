import assert from 'node:assert/strict'
import {
  BFMatcher,
  CV_8UC1,
  CV_32FC2,
  DMatchVector,
  KeyPointVector,
  Mat,
  NORM_HAMMING,
  ORB_create,
  RANSAC,
  countNonZero,
  findHomography,
  initOpenCV
} from '@banou/opencv-wasm'

function makePattern(width = 320, height = 240) {
  const image = new Mat(height, width, CV_8UC1)
  const pixels = image.data
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = (x * 17 + y * 31 + ((x * y) % 97)) % 256
    }
  }
  // Add deterministic corners and circles to ensure repeatable local features.
  for (let y = 24; y < height - 16; y += 32) {
    for (let x = 24; x < width - 16; x += 32) {
      for (let dy = -5; dy <= 5; dy += 1) {
        for (let dx = -5; dx <= 5; dx += 1) {
          if (Math.abs(dx) === 5 || Math.abs(dy) === 5) {
            pixels[(y + dy) * width + x + dx] = 255
          }
        }
      }
    }
  }
  return image
}

async function main() {
  const cv = await initOpenCV()
  assert.ok(cv, 'initOpenCV() did not return a runtime instance')
  console.log('WASM_RUNTIME_READY', JSON.stringify({
    runtime: 'initialized',
    wasmExports: typeof ORB_create,
    matcherExport: typeof BFMatcher,
    homographyExport: typeof findHomography,
    ransac: RANSAC
  }))

  // Gate 1: real ORB detector construction and feature extraction.
  const image = makePattern()
  const emptyMask = new Mat()
  const keypoints = new KeyPointVector()
  const descriptors = new Mat()
  const orb = ORB_create(800)
  assert.ok(orb, 'ORB_create returned null')
  try {
    orb.detectAndCompute(image, emptyMask, keypoints, descriptors)
    assert.ok(keypoints.size() >= 4, `ORB keypoints too few: ${keypoints.size()}`)
    assert.ok(!descriptors.empty(), 'ORB descriptors are empty')
    assert.equal(descriptors.rows, keypoints.size(), 'ORB keypoint/descriptor row mismatch')
    console.log('ORB_RUNTIME_PASS', JSON.stringify({
      keypoints: keypoints.size(),
      descriptorRows: descriptors.rows,
      descriptorColumns: descriptors.cols
    }))

    // Gate 2: actual Hamming BFMatcher execution on produced ORB descriptors.
    const matcher = new BFMatcher(NORM_HAMMING, true)
    const matches = new DMatchVector()
    try {
      matcher.match(descriptors, descriptors, matches)
      assert.ok(matches.size() > 0, 'BFMatcher returned no matches')
      console.log('BFMATCHER_RUNTIME_PASS', JSON.stringify({ matches: matches.size() }))
    } finally {
      matches.delete()
      matcher.delete()
    }
  } finally {
    orb.delete()
    descriptors.delete()
    keypoints.delete()
    emptyMask.delete()
    image.delete()
  }

  // Gate 3: actual RANSAC homography fit with seven consistent pairs + one outlier.
  const from = new Mat(8, 1, CV_32FC2)
  const to = new Mat(8, 1, CV_32FC2)
  const inlierMask = new Mat()
  let homography
  try {
    from.data32F.set([
      10,10, 80,10, 80,80, 10,80,
      40,20, 65,55, 25,60, 95,45
    ])
    to.data32F.set([
      30,25, 100,25, 100,95, 30,95,
      60,35, 85,70, 45,75, 300,5
    ])
    homography = findHomography(from, to, RANSAC, 3, inlierMask)
    assert.ok(homography && !homography.empty(), 'RANSAC returned empty homography')
    const inliers = countNonZero(inlierMask)
    assert.ok(inliers >= 7, `RANSAC inlier count too low: ${inliers}/8`)
    console.log('RANSAC_HOMOGRAPHY_RUNTIME_PASS', JSON.stringify({
      inliers,
      totalPoints: 8,
      homographyRows: homography.rows,
      homographyColumns: homography.cols
    }))
  } finally {
    homography?.delete()
    inlierMask.delete()
    to.delete()
    from.delete()
  }
  console.log('BANOU_CANDIDATE_RUNTIME_POC_PASS')
}

main().catch((error) => {
  console.error('BANOU_CANDIDATE_RUNTIME_POC_FAIL')
  console.error(error?.stack ?? error)
  process.exitCode = 1
})
