import assert from 'node:assert/strict'
import { appendFile, writeFile } from 'node:fs/promises'
import {
  BFMatcher,
  CV_8UC1,
  Mat,
  NORM_HAMMING,
  ORB_create,
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
    return { keypoints: keypoints.size(), descriptors: descriptors.mat_clone() }
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
  const matcher = new BFMatcher(NORM_HAMMING, true)
  const matches = new (await import('@banou/opencv-wasm')).DMatchVector()
  try {
    matcher.match(left.descriptors, right.descriptors, matches)
    let accepted = 0
    for (let index = 0; index < matches.size(); index++) {
      const match = matches.get(index)
      try {
        if (match.distance <= 48) accepted++
      } finally {
        match.delete?.()
      }
    }
    return {
      score: accepted / Math.max(1, Math.min(left.keypoints, right.keypoints)),
      acceptedMatches: accepted,
      leftKeypoints: left.keypoints,
      rightKeypoints: right.keypoints
    }
  } finally {
    matches.delete()
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
  await writeFile('m9-image-similarity-results.json', JSON.stringify({
    benchmark: 'synthetic-diagnostic-v1',
    generatedAt: new Date().toISOString(),
    results
  }, null, 2) + '\n')
  const rows = results.map(result =>
    '| ' + result.name + ' | ' + result.expected + ' | ' + result.score.toFixed(4) + ' | ' + result.acceptedMatches + ' | ' + result.leftKeypoints + '/' + result.rightKeypoints + ' |'
  )
  const summary = [
    '## M9 A1-A7 Image Similarity Diagnostic',
    '',
    '> Synthetic diagnostic only. These scores are not a production duplicate threshold and do not establish M9 acceptance.',
    '',
    '| Case | Expected | Score | Accepted matches | Keypoints L/R |',
    '|---|---|---:|---:|---:|',
    ...rows,
    '',
    'Real-photo and Android validation remain required.',
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
