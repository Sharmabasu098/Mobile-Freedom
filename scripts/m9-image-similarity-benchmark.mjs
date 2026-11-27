import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { appendFile, writeFile } from 'node:fs/promises'
import {
  BFMatcher,
  CV_8UC1,
  CV_32FC2,
  DMatchVectorVector,
  KeyPointVector,
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

async function describe(cv, fixture, side = 'unknown') {
  const mark = (stage, details = {}) => console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ side, stage, ...details }))
  let image, mask, keypoints, descriptors, orb
  try {
    mark('toMat_start', { width: fixture.width, height: fixture.height, bytes: fixture.data?.length })
    image = toMat(cv, fixture)
    mark('toMat_complete', { rows: image.rows, cols: image.cols, type: image.type() })
    mask = new Mat()
    keypoints = new (await import('@banou/opencv-wasm')).KeyPointVector()
    descriptors = new Mat()
    orb = ORB_create(1200)
    mark('detectAndCompute_start', { nfeatures: 1200, inputType: image.type() })
    orb.detectAndCompute(image, mask, keypoints, descriptors)
    mark('detectAndCompute_complete', { keypoints: keypoints.size(), descriptorRows: descriptors.rows, descriptorCols: descriptors.cols, descriptorType: descriptors.type() })
    const points = []
    for (let index = 0; index < keypoints.size(); index++) {
      const point = keypoints.get(index)
      try { points.push({ x: point.pt.x, y: point.pt.y }) }
      finally { point.delete?.() }
    }
    mark('keypoint_vector_read_complete', { points: points.length })
    const cloned = descriptors.mat_clone()
    mark('descriptor_clone_complete', { rows: cloned.rows, cols: cloned.cols, type: cloned.type() })
    return { keypoints: keypoints.size(), points, descriptors: cloned }
  } catch (error) {
    mark('error', { name: error?.name, message: String(error?.message ?? error), stack: error?.stack })
    throw error
  } finally {
    mark('cleanup_start')
    orb?.delete()
    keypoints?.delete()
    mask?.delete()
    image?.delete()
    descriptors?.delete()
    mark('cleanup_complete')
  }
}

export async function similarity(cv, leftFixture, rightFixture) {
  const left = await describe(cv, leftFixture, 'left')
  const right = await describe(cv, rightFixture, 'right')
  const matcher = new BFMatcher(NORM_HAMMING, false)
  const knnMatches = new DMatchVectorVector()
  try {
    console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ stage: 'matcher_start', norm: NORM_HAMMING, crossCheck: false, k: 2, leftRows: left.descriptors.rows, rightRows: right.descriptors.rows }))
    // OpenCV DescriptorMatcher::knnMatch(query, train, matches, k).
    // Keep k=2 so Lowe's ratio test can compare the nearest and second-nearest candidate.
    matcher.knnMatch(left.descriptors, right.descriptors, knnMatches, 2)
    console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ stage: 'matcher_complete', queryCount: knnMatches.size() }))
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
    // fromPoints is a flat [x,y,...] array: 8 numbers = 4 point pairs.
    // OpenCV findHomography requires at least four correspondences.
    const correspondenceCount = fromPoints.length / 2
    console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ stage: 'homography_gate', correspondenceCount, required: 4 }))
    if (correspondenceCount >= 4) {
      const fromMat = new Mat(correspondenceCount, 1, CV_32FC2)
      const toMat = new Mat(correspondenceCount, 1, CV_32FC2)
      const inlierMask = new Mat()
      let homography
      try {
        fromMat.data32F.set(fromPoints)
        toMat.data32F.set(toPoints)
        console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ stage: 'homography_start', count: fromPoints.length / 2, threshold: 4 }))
        homography = findHomography(fromMat, toMat, RANSAC, 4, inlierMask)
        console.log('M9_ORB_SIMILARITY_STAGE', JSON.stringify({ stage: 'homography_complete', empty: !homography || homography.empty(), maskBytes: inlierMask.data.length }))
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


export async function diagnoseCoil03(leftFixture, rightFixture) {
  const stages = []
  const run = async (name, fn) => {
    try { const details = await fn(); stages.push({ stage: name, status: 'ok', ...details }); console.log('M9_COIL03_STAGE', JSON.stringify(stages.at(-1))); return true }
    catch (error) { stages.push({ stage: name, status: 'error', name: error?.name, message: String(error?.message ?? error), stack: error?.stack }); console.error('M9_COIL03_STAGE', JSON.stringify(stages.at(-1))); return false }
  }
  let a,b,ma,mb,ka,kb,da,db,orb,matcher,matches
  const detected = await run('feature_detection_and_descriptor_generation', async () => {
    a=toMat(null,leftFixture); b=toMat(null,rightFixture); ma=new Mat(); mb=new Mat()
    ka=new KeyPointVector(); kb=new KeyPointVector(); da=new Mat(); db=new Mat(); orb=ORB_create(1200)
    orb.detect(a,ka,ma); orb.detect(b,kb,mb)
    const detectedCounts=[ka.size(),kb.size()]
    orb.compute(a,ka,da); orb.compute(b,kb,db)
    return { detectedCounts, descriptorRows:[da.rows,db.rows], descriptorCols:[da.cols,db.cols], descriptorTypes:[da.type(),db.type()] }
  })
  if (detected) {
    const matched = await run('bfmatcher_knn', async () => {
      matcher=new BFMatcher(NORM_HAMMING,false); matches=new DMatchVectorVector()
      matcher.knnMatch(da,db,matches,2)
      return { queryCount: matches.size() }
    })
    if (matched) {
      const filtered = await run('lowe_ratio_filter', async () => {
        const from=[],to=[]; let candidates=0,accepted=0
        for(let i=0;i<matches.size();i++){const pair=matches.get(i);try{if(pair.size()<2)continue;const best=pair.get(0),second=pair.get(1);try{candidates++;if(best.distance<.9*second.distance){accepted++;const p=ka.get(best.queryIdx),q=kb.get(best.trainIdx);try{from.push(p.pt.x,p.pt.y);to.push(q.pt.x,q.pt.y)}finally{p.delete?.();q.delete?.()}}}finally{second.delete?.();best.delete?.()}}finally{pair.delete?.()}}
        return { candidates, accepted, from, to }
      })
      if(filtered) await run('ransac_homography', async () => {
        const {from,to,candidates,accepted}=stages.find(x=>x.stage==='lowe_ratio_filter')
        if(from.length<8)return { skipped:true,reason:'fewer than four correspondences',candidates,accepted }
        const x=new Mat(from.length/2,1,CV_32FC2),y=new Mat(to.length/2,1,CV_32FC2),mask=new Mat();let h
        try{x.data32F.set(from);y.data32F.set(to);h=findHomography(x,y,RANSAC,4,mask);return { homographyCreated:!!h&&!h.empty(),inliers:h&&!h.empty()?countNonZero(mask):0,maskBytes:mask.data.length,candidates,accepted }}
        finally{h?.delete();mask.delete();y.delete();x.delete()}
      })
    }
  }
  await run('native_object_disposal',async()=>{matches?.delete();matcher?.delete();orb?.delete();db?.delete();da?.delete();kb?.delete();ka?.delete();mb?.delete();ma?.delete();b?.delete();a?.delete();return {disposed:true}})
  await run('allocation_disposal_stress_5_cycles',async()=>{const cycles=[];for(let i=0;i<5;i++){const x=toMat(null,leftFixture),y=toMat(null,rightFixture),m1=new Mat(),m2=new Mat(),k1=new KeyPointVector(),k2=new KeyPointVector(),d1=new Mat(),d2=new Mat(),o=ORB_create(300);try{o.detectAndCompute(x,m1,k1,d1);o.detectAndCompute(y,m2,k2,d2);cycles.push({cycle:i+1,left:k1.size(),right:k2.size(),rows:[d1.rows,d2.rows]})}finally{o.delete();d2.delete();d1.delete();k2.delete();k1.delete();m2.delete();m1.delete();y.delete();x.delete()}}return {cycles}})
  return { stages: stages.map(({stage,status,...detail})=>({stage,status,...detail})), failedStages:stages.filter(x=>x.status==='error').map(x=>x.stage) }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('M9_IMAGE_BENCHMARK_DIAGNOSTIC_FAIL')
    console.error(error?.stack ?? error)
    process.exitCode = 1
  })
}
