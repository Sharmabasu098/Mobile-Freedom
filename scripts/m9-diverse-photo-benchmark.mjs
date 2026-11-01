import assert from 'node:assert/strict'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import sharp from 'sharp'
import { initOpenCV } from '@banou/opencv-wasm'
import { similarity } from './m9-image-similarity-benchmark.mjs'
import { siftSimilarity } from './m9-sift-real-photo-benchmark.mjs'

async function decode(buffer) {
  const { data, info } = await sharp(buffer).rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .greyscale().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

async function centerCrop(buffer, fraction) {
  const meta = await sharp(buffer).rotate().metadata()
  const width = Math.max(16, Math.floor(meta.width * fraction))
  const height = Math.max(16, Math.floor(meta.height * fraction))
  const { data, info } = await sharp(buffer).rotate().extract({
    left: Math.floor((meta.width - width) / 2),
    top: Math.floor((meta.height - height) / 2),
    width, height
  }).greyscale().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

async function main() {
  await initOpenCV()
  const categories = {
    portrait: ['portrait-1238926.jpg', 'portrait-947420.jpg'],
    objects: ['object-camera-1449339.jpg', 'object-perfume-746054.jpg'],
    documents: ['document-desk-971343.jpg', 'document-notebook-546963.jpg'],
    indoor: ['indoor-room-1235207.jpg', 'indoor-room-559753.jpg'],
    outdoor: ['outdoor-western-ghats-1102826.jpg', 'outdoor-street-90475.jpg', 'outdoor-rocky-mountains-489986.jpg', 'outdoor-lake-mountains-1161018.jpg']
  }
  const originals = new Map()
  for (const [category, names] of Object.entries(categories)) {
    for (const name of names) originals.set(name, {
      category, buffer: await readFile(`fixtures/diverse-photos/${name}`),
      fixture: await decode(await readFile(`fixtures/diverse-photos/${name}`))
    })
  }
  const results = []
  for (const [name, source] of originals) {
    for (const fraction of [0.5, 0.6, 0.7, 0.8]) {
      const cropped = await centerCrop(source.buffer, fraction)
      const [orb, sift] = await Promise.all([
        similarity(null, source.fixture, cropped),
        siftSimilarity(source.fixture, cropped)
      ])
      results.push({
        case: 'center_crop', category: source.category, source: name,
        retainedWidthHeightFraction: fraction, expected: 'positive', orb, sift
      })
    }
  }
  const pairs = []
  for (const [category, categoryNames] of Object.entries(categories)) {
    for (let i = 0; i < categoryNames.length; i++) {
      for (let j = i + 1; j < categoryNames.length; j++) {
        pairs.push({ category, left: categoryNames[i], right: categoryNames[j], pairType: 'same_category_hard_negative' })
      }
    }
  }
  const names = [...originals.keys()]
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (originals.get(names[i]).category !== originals.get(names[j]).category) {
        pairs.push({ category: 'cross_category', left: names[i], right: names[j], pairType: 'cross_category_negative' })
      }
    }
  }
  for (const pair of pairs) {
    const left = originals.get(pair.left), right = originals.get(pair.right)
    const [orb, sift] = await Promise.all([
      similarity(null, left.fixture, right.fixture),
      siftSimilarity(left.fixture, right.fixture)
    ])
    results.push({ case: 'different_photos', ...pair, expected: 'negative', orb, sift })
  }
  const cropResults = results.filter(r => r.case === 'center_crop')
  const negativeResults = results.filter(r => r.case === 'different_photos')
  assert.equal(cropResults.length, 40)
  assert.equal(negativeResults.length, 66, 'Expected all 66 unique negative pairs for 12 distinct photos')
  assert.ok(results.every(r => Number.isFinite(r.orb.inliers) && Number.isFinite(r.sift.inliers)))
  const summary = {
    benchmark: 'diverse-real-photo-orb-sift-v2',
    categories: Object.fromEntries(Object.entries(categories).map(([k,v]) => [k,v.length])),
    cropFractions: [0.5,0.6,0.7,0.8],
    totalCropCases: cropResults.length,
    totalNegativeCases: negativeResults.length,
    classification: 'diagnostic-only; no production threshold',
    results
  }
  await writeFile('m9-diverse-photo-results.json', JSON.stringify(summary, null, 2) + '\n')
  const rows = results.map(r => r.case === 'center_crop'
    ? `| crop | ${r.category} | ${r.source} | ${r.retainedWidthHeightFraction} | ${r.orb.inliers} | ${r.sift.inliers} | positive |`
    : `| negative | ${r.category} | ${r.left} vs ${r.right} | — | ${r.orb.inliers} | ${r.sift.inliers} | negative |`)
  const report = [
    '## M9 Diverse Real-Photo ORB vs SIFT Diagnostic',
    '',
    '> 5 categories, 12 CC0 photos including a four-image outdoor landscape hard-negative group, center crop retention ratios 50/60/70/80%, exhaustive same-category and cross-category negatives. Inlier counts are diagnostics, not a production classifier.',
    '',
    '| Test | Category | Pair / Source | Crop retained | ORB inliers | SIFT inliers | Expected |',
    '|---|---|---|---:|---:|---:|---|', ...rows,
    '', 'Review false-positive and false-negative candidates using calibrated, validated rules; this run does not set a production threshold.', ''
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report)
  console.log('M9_DIVERSE_PHOTO_DIAGNOSTIC_PASS', JSON.stringify({ cropCases: cropResults.length, negativeCases: negativeResults.length }))
}
main().catch(error => { console.error('M9_DIVERSE_PHOTO_DIAGNOSTIC_FAIL'); console.error(error?.stack ?? error); process.exitCode = 1 })
