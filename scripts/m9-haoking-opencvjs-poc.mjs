import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function makePattern(cv, width = 320, height = 240) {
  const image = new cv.Mat(height, width, cv.CV_8UC1);
  // Deterministic high-frequency pattern with geometric structure; no user files.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const grid = ((x * 17 + y * 31 + ((x * y) % 97)) % 256);
      image.ucharPtr(y, x)[0] = grid;
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const center = new cv.Point(20 + i * 23, 25 + ((i * 37) % 180));
    cv.circle(image, center, 7 + (i % 5), new cv.Scalar(255 - i * 13), 2);
  }
  return image;
}

function createOrb(cv) {
  if (cv.ORB && typeof cv.ORB.create === "function") return cv.ORB.create(800);
  if (typeof cv.ORB_create === "function") return cv.ORB_create(800);
  throw new Error("ORB factory missing: expected cv.ORB.create or cv.ORB_create");
}

function run() {
  const loadOpenCV = require("@haoking/opencvjs");
  assert.equal(typeof loadOpenCV, "function", "package entry must export loadOpenCV()");
  return loadOpenCV().then((cv) => {
    assert.equal(typeof cv.Mat, "function", "OpenCV WASM runtime is not ready");
    console.log("RUNTIME_READY", JSON.stringify({
      mat: typeof cv.Mat,
      orbClass: typeof cv.ORB,
      orbCreate: typeof cv.ORB?.create,
      orbCreateLegacy: typeof cv.ORB_create,
      bfMatcher: typeof cv.BFMatcher,
      findHomography: typeof cv.findHomography,
      ransac: cv.RANSAC,
      simdSupported: loadOpenCV.detectSimd()
    }));

    // ORB: actual detector construction + keypoint and descriptor extraction.
    const image = makePattern(cv);
    const mask = new cv.Mat();
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    const orb = createOrb(cv);
    try {
      orb.detectAndCompute(image, mask, keypoints, descriptors);
      assert.ok(keypoints.size() >= 4, `ORB returned too few keypoints: ${keypoints.size()}`);
      assert.ok(!descriptors.empty(), "ORB returned empty descriptors");
      assert.equal(descriptors.rows, keypoints.size(), "descriptor/keypoint count mismatch");
      console.log("ORB_RUNTIME_PASS", JSON.stringify({
        keypoints: keypoints.size(), descriptorRows: descriptors.rows,
        descriptorCols: descriptors.cols, descriptorType: descriptors.type()
      }));

      // BFMatcher: perform real Hamming descriptor matching (not symbol-only).
      const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
      const matches = new cv.DMatchVector();
      try {
        matcher.match(descriptors, descriptors, matches);
        assert.ok(matches.size() > 0, "BFMatcher produced no self-matches");
        console.log("BFMATCHER_RUNTIME_PASS", JSON.stringify({ matches: matches.size() }));
      } finally {
        matches.delete();
        matcher.delete();
      }
    } finally {
      orb.delete();
      descriptors.delete();
      keypoints.delete();
      mask.delete();
      image.delete();
    }

    // RANSAC homography: known translation + one deliberately incorrect point.
    assert.equal(typeof cv.findHomography, "function", "findHomography is missing");
    assert.equal(typeof cv.RANSAC, "number", "cv.RANSAC enum is missing");
    const source = [
      10, 10,  80, 10,  80, 80,  10, 80,
      40, 20,  65, 55,  25, 60,  95, 45
    ];
    const target = [
      30, 25, 100, 25, 100, 95,  30, 95,
      60, 35,  85, 70,  45, 75, 300, 5
    ];
    const src = cv.matFromArray(8, 1, cv.CV_32FC2, source);
    const dst = cv.matFromArray(8, 1, cv.CV_32FC2, target);
    const inlierMask = new cv.Mat();
    let homography;
    try {
      homography = cv.findHomography(src, dst, cv.RANSAC, 3, inlierMask);
      assert.ok(homography && !homography.empty(), "RANSAC homography is empty");
      let inliers = 0;
      for (let row = 0; row < inlierMask.rows; row += 1) {
        for (let col = 0; col < inlierMask.cols; col += 1) {
          if (inlierMask.ucharPtr(row, col)[0] !== 0) inliers += 1;
        }
      }
      assert.ok(inliers >= 7, `RANSAC accepted too few known inliers: ${inliers}`);
      console.log("RANSAC_HOMOGRAPHY_RUNTIME_PASS", JSON.stringify({
        inliers, totalPoints: 8, method: cv.RANSAC,
        homographyRows: homography.rows, homographyCols: homography.cols
      }));
    } finally {
      homography?.delete();
      inlierMask.delete();
      dst.delete();
      src.delete();
    }
    console.log("CANDIDATE_RUNTIME_POC_PASS");
  });
}

run().catch((error) => {
  console.error("CANDIDATE_RUNTIME_POC_FAIL");
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
