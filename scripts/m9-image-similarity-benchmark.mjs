import assert from 'node:assert/strict'
import { appendFile, writeFile } from 'node:fs/promises'
import {
  BFMatcher,
  CV_8UC1,
  CV_32FC2,
  DMatchVectorVector,
  Mat,
  NORM_HAMMING,
  ORB_create,
  RANSAC,
  countNonZero,
  findHomography,
  initOpenCV
} from '@banou/opencv-wasm'

const WIDTH = 320
const HEIGHT = 240
const clamp = value => Math.max(0, Math.min(255, Math.round(value)))

function scene(seed = 1) {
  const data = new Uint8Array(WIDTH * HEIGHT)
  let state = seed >>> 0
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state >>> 24
  }
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      data[y * WIDTH + x] = (x * 17 + y * 31 + ((x * y) % 97) + random()) & 255
    }
  }
  // Deterministic, spatially distributed landmarks.
  for (let y = 20; y < HEIGHT - 12; y += 32) {
    for (let x = 20; x < WIDTH - 12; x += 32) {
      const radius = 4 + ((x + y + seed) % 5)
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const px = x + dx
            const py = y + dy
            data[py * WIDTH + px] = ((dx + dy + seed) & 1) ? 255 : 0
          }
        }
      }
    }
  }
  return { width: WIDTH, height: HEIGHT, data }
}

function resizeNearest(source, width, height, quantize = 1) {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, Math.floor(x * source.width / width))
      const sy = Math.min(source.height - 1, Math.floor(y * source.height / height))
      const value = source.data[sy * source.width + sx]
      data[y * width + x] = quantize > 1 ? Math.round(value / quantize) * quantize : value
    }
  }
  return { width, height, data }
}

function crop(source, left, top, width, height) {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = source.data[(top + y) * source.width + left + x]
    }
  }
  return { width, height, data }
}

function rotate90(source) {
  const width = source.height
  const height = source.width
  const data = new Uint8Array(width * height)
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      data[x * width + (source.height - 1 - y)] = source.data[y * source.width + x]
    }
  }
  return { width, height, data }
}

function repeatedTexture(seed) {
  const tile = scene(seed)
  const width = WIDTH
  const height = HEIGHT
  const data = new Uint8Array(width * height)
  const tileW = 40
  const tileH = 40
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tx = x % tileW
      const ty = y % tileH
      const sx = (tx * tile.width / tileW) | 0
      const sy = (ty * tile.height / tileH) | 0
      data[y * width + x] = tile.data[sy * tile.width + sx]
    }
  }
  return { width, height, data }
}

function convexHullAreaFraction(points, width, height) {
  if (points.length < 3) return 0
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (origin, a, b) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
  const lower = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper = []
  for (const point of sorted.slice().reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  const hull = lower.concat(upper)
  if (hull.length < 3) return 0
  let twiceArea = 0
  for (let index = 0; index < hull.length; index++) {
    const current = hull[index]
    const next = hull[(index + 1) % hull.length]
    twiceArea += current.x * next.y - next.x * current.y
  }
  return Number((Math.abs(twiceArea) / 2 / (width * height)).toFixed(4))
}

function spatialCoverage(points, width, height) {
  if (!points.length) {
    return {
      pointCount: 0,
      bboxAreaFraction: 0,
      occupiedGridCells: 0,
      occupiedQuadrants: 0,
      centroidX: null,
      centroidY: null,
      spreadX: 0,
      spreadY: 0
    }
  }

  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const meanX = xs.reduce((sum, value) => sum + value, 0) / points.length
  const meanY = ys.reduce((sum, value) => sum + value, 0) / points.length
  const varianceX = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0) / points.length
  const varianceY = ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0) / points.length
  const gridCells = new Set()
  const quadrants = new Set()

  for (const point of points) {
    const cellX = Math.min(3, Math.max(0, Math.floor(point.x / width * 4)))
    const cellY = Math.min(3, Math.max(0, Math.floor(point.y / height * 4)))
    gridCells.add(cellY * 4 + cellX)
    quadrants.add((point.x >= width / 2 ? 1 : 0) + (point.y >= height / 2 ? 2 : 0))
  }

  return {
    pointCount: points.length,
    bboxAreaFraction: Number((((maxX - minX) * (maxY - minY)) / (width * height)).toFixed(4)),
    occupiedGridCells: gridCells.size,
    occupiedQuadrants: quadrants.size,
    centroidX: Number((meanX / width).toFixed(4)),
    centroidY: Number((meanY / height).toFixed(4)),
    spreadX: Number((Math.sqrt(varianceX) / width).toFixed(4)),
    spreadY: Number((Math.sqrt(varianceY) / height).toFixed(4))
  }
}

function toMat(cv, fixture) {
  const mat = new Mat(fixture.height, fixture.width, CV_8UC1)
  mat.data.set(fixture.data)
  return mat
}

async function describe(cv, fixture) {
  const image = toMat(cv, fixture)
  const mask = new Mat()
  const keypoints = new (await import('@banou/opencv-wasm')).KeyPointVector()
  const descriptors = new Mat()
  const orb = ORB_create(1200)
  try {
    orb.detectAndCompute(image, mask, keypoints, descriptors)
    const points = []
    for (let index = 0; index < keypoints.size(); index++) {
      const point = keypoints.get(index)
      try {
        points.push({ x: point.pt.x, y: point.pt.y })
      } finally {
        point.delete?.()
      }
    }
    return { keypoints: keypoints.size(), points, descriptors: descriptors.mat_clone() }
  } finally {
    orb.delete()
    keypoints.delete()
    mask.delete()
    image.delete()
    descriptors.delete()
  }
}

async function similarity(cv, leftFixture, rightFixture) {
  const left = await describe(cv, leftFixture)
  const right = await describe(cv, rightFixture)
  const matcher = new BFMatcher(NORM_HAMMING, false)
  const knnMatches = new DMatchVectorVector()
  try {
    // OpenCV DescriptorMatcher::knnMatch(query, train, matches, k).
    // Keep k=2 so Lowe's ratio test can compare the nearest and second-nearest candidate.
    matcher.knnMatch(left.descriptors, right.descriptors, knnMatches, 2)
    let accepted = 0
    let ratioCandidates = 0
    let bestDistanceTotal = 0
    const fromPoints = []
    const toPoints = []

    for (let index = 0; index < knnMatches.size(); index++) {
      const pair = knnMatches.get(index)
      try {
        if (pair.size() < 2) continue
        const best = pair.get(0)
        const second = pair.get(1)
        try {
          ratioCandidates++
          // Lowe's ratio test: accept only an unambiguous nearest neighbour.
          if (!(best.distance < 0.9 * second.distance)) continue
          accepted++
          bestDistanceTotal += best.distance
          const from = left.points[best.queryIdx]
          const to = right.points[best.trainIdx]
          if (from && to) {
            fromPoints.push(from.x, from.y)
            toPoints.push(to.x, to.y)
          }
        } finally {
          second.delete?.()
          best.delete?.()
        }
      } finally {
        pair.delete?.()
      }
    }

    let inliers = 0
    let inlierRatio = 0
    const inlierFromPoints = []
    const inlierToPoints = []
    if (fromPoints.length >= 4) {
      const fromMat = new Mat(fromPoints.length / 2, 1, CV_32FC2)
      const toMat = new Mat(toPoints.length / 2, 1, CV_32FC2)
      const inlierMask = new Mat()
      let homography
      try {
        fromMat.data32F.set(fromPoints)
        toMat.data32F.set(toPoints)
        homography = findHomography(fromMat, toMat, RANSAC, 4, inlierMask)
        if (homography && !homography.empty()) {
          inliers = countNonZero(inlierMask)
          inlierRatio = inliers / (fromPoints.length / 2)
          // OpenCV's RANSAC mask is one byte per candidate correspondence.
          for (let index = 0; index < inlierMask.data.length; index++) {
            if (!inlierMask.data[index]) continue
            inlierFromPoints.push({ x: fromPoints[index * 2], y: fromPoints[index * 2 + 1] })
            inlierToPoints.push({ x: toPoints[index * 2], y: toPoints[index * 2 + 1] })
          }
        }
      } finally {
        homography?.delete()
        inlierMask.delete()
        toMat.delete()
        fromMat.delete()
      }
    }
    return {
      score: inliers / Math.max(1, Math.min(left.keypoints, right.keypoints)),
      inliers,
      inlierRatio: Number(inlierRatio.toFixed(4)),
      ratioMatchSourceCoverage: spatialCoverage(
        Array.from({ length: fromPoints.length / 2 }, (_, index) => ({ x: fromPoints[index * 2], y: fromPoints[index * 2 + 1] })),
        leftFixture.width, leftFixture.height
      ),
      ratioMatchTargetCoverage: spatialCoverage(
        Array.from({ length: toPoints.length / 2 }, (_, index) => ({ x: toPoints[index * 2], y: toPoints[index * 2 + 1] })),
        rightFixture.width, rightFixture.height
      ),
      ransacInlierSourceCoverage: {
        ...spatialCoverage(inlierFromPoints, leftFixture.width, leftFixture.height),
        convexHullAreaFraction: convexHullAreaFraction(inlierFromPoints, leftFixture.width, leftFixture.height)
      },
      ransacInlierTargetCoverage: {
        ...spatialCoverage(inlierToPoints, rightFixture.width, rightFixture.height),
        convexHullAreaFraction: convexHullAreaFraction(inlierToPoints, rightFixture.width, rightFixture.height)
      },
      ratioAcceptedMatches: accepted,
      ratioCandidates,
      meanBestDistance: accepted ? Number((bestDistanceTotal / accepted).toFixed(2)) : null,
      leftKeypoints: left.keypoints,
      rightKeypoints: right.keypoints
    }
  } finally {
    knnMatches.delete()
    matcher.delete()
    left.descriptors.delete()
    right.descriptors.delete()
  }
}

async function main() {
  await initOpenCV()
  const original = scene(7)
  const cases = [
    ['A1_exact_duplicate', original, { ...original, data: original.data.slice() }, 'positive'],
    ['A2_resized', original, resizeNearest(original, 240, 180), 'positive'],
    ['A3_compressed_like', original, resizeNearest(original, WIDTH, HEIGHT, 16), 'positive'],
    ['A4_cropped', original, crop(original, 24, 18, 272, 204), 'positive'],
    ['A5_rotated_90', original, rotate90(original), 'positive'],
    ['A6_different_scene', original, scene(91), 'negative'],
    ['A7_repeated_texture', repeatedTexture(13), repeatedTexture(29), 'negative']
  ]

  const results = []
  for (const [name, left, right, expected] of cases) {
    const measured = await similarity(null, left, right)
    results.push({ name, expected, ...measured })
    console.log('M9_IMAGE_CASE', JSON.stringify(results.at(-1)))
  }

  // This first benchmark is intentionally diagnostic, not a production threshold.
  // It must expose scores for calibration; it does not approve M9 or merge the engine.
  assert.equal(results.length, 7)
  assert.ok(results.every(result => Number.isFinite(result.score)))
  const resizedCase = results.find(result => result.name === 'A2_resized')
  const repeatedTextureCase = results.find(result => result.name === 'A7_repeated_texture')
  // Fixture-specific regression guard only: this is not a production classification threshold.
  assert.ok(
    resizedCase.ransacInlierTargetCoverage.occupiedGridCells >
      repeatedTextureCase.ransacInlierTargetCoverage.occupiedGridCells,
    'A2 resized fixture should retain broader target inlier distribution than A7 repeated texture'
  )
  assert.ok(
    resizedCase.ransacInlierTargetCoverage.convexHullAreaFraction >
      repeatedTextureCase.ransacInlierTargetCoverage.convexHullAreaFraction * 3,
    'A2 resized fixture should have materially broader target inlier hull than A7 repeated texture'
  )
  await writeFile('m9-image-similarity-results.json', JSON.stringify({
    benchmark: 'synthetic-diagnostic-v1',
    generatedAt: new Date().toISOString(),
    results
  }, null, 2) + '\n')
  const rows = results.map(result =>
    '| ' + result.name + ' | ' + result.expected + ' | ' + result.score.toFixed(4) + ' | ' + result.ratioAcceptedMatches + '/' + result.ratioCandidates + ' | ' + result.inliers + ' (' + result.inlierRatio.toFixed(4) + ') | ' + result.leftKeypoints + '/' + result.rightKeypoints + ' |'
  )
  const summary = [
    '## M9 A1-A7 Image Similarity Diagnostic',
    '',
    '> Synthetic exploratory diagnostic only. ORB KNN (k=2) matches pass Lowe ratio 0.9 before RANSAC geometry verification; values are not production thresholds and do not establish M9 acceptance.',
    '',
    '| Case | Expected | RANSAC score | Ratio accepted / candidates | RANSAC inliers (ratio) | Keypoints L/R |',
    '|---|---|---:|---:|---:|---:|',
    ...rows,
    '',
    'RANSAC is an exploratory geometry signal, not a production decision. Real-photo and Android validation remain required.',
    ''
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log('M9_IMAGE_BENCHMARK_DIAGNOSTIC_PASS')
}

main().catch(error => {
  console.error('M9_IMAGE_BENCHMARK_DIAGNOSTIC_FAIL')
  console.error(error?.stack ?? error)
  process.exitCode = 1
})
