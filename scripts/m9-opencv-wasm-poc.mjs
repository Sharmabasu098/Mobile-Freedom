import assert from "node:assert/strict";

let importCount = 0;
let cachedRuntime;

async function loadOpenCvOnDemand() {
  if (!cachedRuntime) {
    importCount += 1;
    cachedRuntime = (async () => {
      const module = await import("@techstark/opencv-js");
      return await module.default;
    })();
  }
  return cachedRuntime;
}

// Import must not happen until the loader is called.
assert.equal(importCount, 0, "OpenCV must not load at module evaluation time");
const cv = await loadOpenCvOnDemand();
assert.equal(importCount, 1, "OpenCV should load exactly once on first request");
assert.equal(await loadOpenCvOnDemand(), cv, "Runtime should be cached after first load");

const required = ["Mat", "ORB_create", "BFMatcher", "findHomography", "RANSAC", "CV_8UC1", "CV_32FC2"];
for (const key of required) {
  assert.ok(cv[key] !== undefined, `Missing required OpenCV runtime symbol: ${key}`);
}

const allocated = [];
const own = value => (allocated.push(value), value);
try {
  const orb = own(cv.ORB_create(500));
  const matcher = own(new cv.BFMatcher(cv.NORM_HAMMING, false));

  // Deterministic synthetic grayscale texture; no user files or network inputs.
  const image = own(new cv.Mat(240, 320, cv.CV_8UC1));
  for (let y = 0; y < image.rows; y += 1) {
    for (let x = 0; x < image.cols; x += 1) {
      image.ucharPtr(y, x)[0] = ((x * 37 + y * 71 + ((x * y) % 251)) & 255);
    }
  }

  const keypoints = own(new cv.KeyPointVector());
  const descriptors = own(new cv.Mat());
  orb.detectAndCompute(image, new cv.Mat(), keypoints, descriptors);
  assert.ok(keypoints.size() > 0, "ORB should detect features in synthetic texture");
  assert.ok(!descriptors.empty(), "ORB should produce descriptors");

  // Exercise BFMatcher on the descriptors against themselves.
  const matches = own(new cv.DMatchVectorVector());
  matcher.knnMatch(descriptors, descriptors, matches, 2);
  assert.ok(matches.size() > 0, "BFMatcher should produce descriptor matches");

  // Exercise RANSAC homography using a known translation of four non-collinear points.
  const src = own(new cv.Mat(4, 1, cv.CV_32FC2));
  const dst = own(new cv.Mat(4, 1, cv.CV_32FC2));
  const points = [[10, 10], [100, 10], [100, 100], [10, 100]];
  points.forEach(([x, y], index) => {
    src.data32F[index * 2] = x;
    src.data32F[index * 2 + 1] = y;
    dst.data32F[index * 2] = x + 7;
    dst.data32F[index * 2 + 1] = y + 13;
  });
  const mask = own(new cv.Mat());
  const homography = own(cv.findHomography(src, dst, cv.RANSAC, 3, mask));
  assert.ok(!homography.empty(), "RANSAC homography should be estimated");
  assert.equal(mask.rows * mask.cols, 4, "RANSAC should return an inlier mask for all four points");

  console.log(JSON.stringify({
    result: "PASS",
    runtime: "OpenCV WASM initialized",
    symbols: required,
    orbKeypoints: keypoints.size(),
    descriptorRows: descriptors.rows,
    matcherRows: matches.size(),
    homography: "RANSAC estimated known translation",
    lazyLoad: "one import on first request; cached thereafter",
    note: "Node/WASM API smoke test only; not browser bundle, local network, crop accuracy, or Android performance proof."
  }, null, 2));
} finally {
  for (const item of allocated.reverse()) {
    if (item && typeof item.delete === "function") item.delete();
  }
}
