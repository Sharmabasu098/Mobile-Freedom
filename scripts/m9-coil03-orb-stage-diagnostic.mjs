import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import {
  BFMatcher, CV_32FC2, DMatchVectorVector, KeyPointVector, Mat,
  NORM_HAMMING, ORB_create, RANSAC, countNonZero, findHomography, initOpenCV
} from '@banou/opencv-wasm'

const OUT = 'm9-coil03-orb-stage-diagnostic.json'
const results = []
function log(stage, status, details = {}) {
  const row = { stage, status, ...details }
  results.push(row)
  console.log('M9_COIL03_STAGE', JSON.stringify(row))
}
function errorInfo(error) {
  return { name: error?.name ?? typeof error, message: String(error?.message ?? error), stack: error?.stack }
}
async function stage(name, fn) {
  try { const details = await fn(); log(name, 'ok', details); return { ok: true, details } }
  catch (error) { log(name, 'error', errorInfo(error)); return { ok: false, error } }
}
async function decode(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}
function makeMat(f) {
  const m = new Mat(f.height, f.width, 0)
  m.data.set(f.data)
  return m
}
async function main() {
  await initOpenCV()
  const left = await decode('fixtures/coil-20-proc/obj2__0.png')
  const right = await decode('fixtures/coil-20-proc/obj2__18.png')
  log('fixture_decode', 'ok', { left: [left.width,left.height], right: [right.width,right.height], bytesLeft:left.data.length, bytesRight:right.data.length })

  let imageL, imageR, maskL, maskR, kpL, kpR, descL, descR, orb
  const detect = await stage('feature_detection_and_descriptor_generation', async () => {
    imageL = makeMat(left); imageR = makeMat(right)
    maskL = new Mat(); maskR = new Mat()
    kpL = new KeyPointVector(); kpR = new KeyPointVector()
    descL = new Mat(); descR = new Mat()
    orb = ORB_create(1200)
    orb.detect(imageL, kpL, maskL)
    const leftDetected = kpL.size()
    orb.detect(imageR, kpR, maskR)
    const rightDetected = kpR.size()
    orb.compute(imageL, kpL, descL)
    const leftComputed = descL.rows
    orb.compute(imageR, kpR, descR)
    const rightComputed = descR.rows
    return { leftDetected, rightDetected, leftComputed, rightComputed, leftDescriptorCols:descL.cols, rightDescriptorCols:descR.cols, leftType:descL.type(), rightType:descR.type() }
  })
  let matches, matcher
  if (detect.ok) {
    const match = await stage('bfmatcher_knn', async () => {
      matcher = new BFMatcher(NORM_HAMMING, false)
      matches = new DMatchVectorVector()
      matcher.knnMatch(descL, descR, matches, 2)
      return { queryCount:matches.size() }
    })
    if (match.ok) {
      const ratio = await stage('lowe_ratio_filter', async () => {
        const from=[], to=[]
        let candidates=0, accepted=0
        for(let i=0;i<matches.size();i++){
          const pair=matches.get(i)
          try {
            if(pair.size()<2) continue
            const best=pair.get(0), second=pair.get(1)
            try {
              candidates++
              if(best.distance < 0.9*second.distance){
                accepted++
                const a=kpL.get(best.queryIdx), b=kpR.get(best.trainIdx)
                try { from.push(a.pt.x,a.pt.y); to.push(b.pt.x,b.pt.y) }
                finally { a.delete?.(); b.delete?.() }
              }
            } finally { second.delete?.(); best.delete?.() }
          } finally { pair.delete?.() }
        }
        return { candidates, accepted, correspondenceCount:from.length/2, from, to }
      })
      if (ratio.ok) {
        const {from,to,candidates,accepted}=ratio.details
        await stage('ransac_homography', async () => {
          if(from.length<8) return { skipped:true, reason:'fewer than four correspondences', candidates, accepted }
          const a=new Mat(from.length/2,1,CV_32FC2), b=new Mat(to.length/2,1,CV_32FC2), inlierMask=new Mat()
          let h
          try {
            a.data32F.set(from); b.data32F.set(to)
            h=findHomography(a,b,RANSAC,4,inlierMask)
            return { homographyCreated:!!h&&!h.empty(), inliers:h&&!h.empty()?countNonZero(inlierMask):0, maskLength:inlierMask.data.length, candidates, accepted }
          } finally { h?.delete(); inlierMask.delete(); b.delete(); a.delete() }
        })
      }
    }
  }
  await stage('native_object_disposal', async () => {
    matches?.delete(); matcher?.delete()
    orb?.delete(); descR?.delete(); descL?.delete()
    kpR?.delete(); kpL?.delete()
    maskR?.delete(); maskL?.delete()
    imageR?.delete(); imageL?.delete()
    return { disposed:true }
  })
  // Fresh allocation/disposal cycles can reveal leaks or stale Embind handles.
  await stage('allocation_disposal_stress_5_cycles', async () => {
    const cycles=[]
    for(let i=0;i<5;i++){
      const a=makeMat(left), b=makeMat(right), k1=new KeyPointVector(), k2=new KeyPointVector(), d1=new Mat(), d2=new Mat(), m1=new Mat(), m2=new Mat(), detector=ORB_create(300)
      try {
        detector.detectAndCompute(a,m1,k1,d1); detector.detectAndCompute(b,m2,k2,d2)
        cycles.push({cycle:i+1,leftKeypoints:k1.size(),rightKeypoints:k2.size(),leftRows:d1.rows,rightRows:d2.rows})
      } finally { detector.delete(); d2.delete(); d1.delete(); k2.delete(); k1.delete(); m2.delete(); m1.delete(); b.delete(); a.delete() }
    }
    return {cycles}
  })
  const failed=results.filter(x=>x.status==='error')
  const report={benchmark:'COIL-03 isolated ORB stage diagnostic',fixture:'COIL-20 obj2__0.png vs obj2__18.png',diagnosticOnly:true,results,failedStages:failed.map(x=>x.stage)}
  await writeFile(OUT,JSON.stringify(report,null,2)+'\n')
  console.log('M9_COIL03_DIAGNOSTIC_COMPLETE',JSON.stringify({failedStages:report.failedStages,stageCount:results.length}))
  if(failed.length) process.exitCode=1
}
main().catch(error=>{console.error('M9_COIL03_DIAGNOSTIC_FATAL',errorInfo(error));process.exitCode=1})
