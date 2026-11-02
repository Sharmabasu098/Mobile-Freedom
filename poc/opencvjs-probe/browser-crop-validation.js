import loadOpenCV from "@haoking/opencvjs";

const originalInput = document.querySelector("#original");
const cropInput = document.querySelector("#crop");
const runButton = document.querySelector("#run");
const output = document.querySelector("#output");

function log(value) {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({
        mat: cv.matFromImageData(context.getImageData(0, 0, canvas.width, canvas.height)),
        width: canvas.width,
        height: canvas.height
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode selected image: " + file.name));
    };
    image.src = url;
  });
}

let cv;
let ready = false;
let busy = false;

function updateButton() {
  runButton.disabled = !ready || !originalInput.files?.length || !cropInput.files?.length || busy;
}

Promise.resolve(loadOpenCV()).then(module => {
  cv = module;
  ready = true;
  log("OpenCV WASM ready. Select original + matching crop.");
  updateButton();
}).catch(error => {
  log({ status: "OPENCV_LOAD_ERROR", message: error.message });
});

originalInput.addEventListener("change", updateButton);
cropInput.addEventListener("change", updateButton);

function computeCoverage(points, width, height) {
  if (!points.length) return { bboxCoverage: 0, occupiedGridCells: 0, minPairDistance: null };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const bboxCoverage =
    ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) /
    (width * height);
  const cells = new Set(points.map(p =>
    Math.min(3, Math.floor(p.x / width * 4)) + "," +
    Math.min(3, Math.floor(p.y / height * 4))
  ));
  let minPairDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      minPairDistance = Math.min(minPairDistance,
        Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return {
    bboxCoverage: Number(bboxCoverage.toFixed(4)),
    occupiedGridCells: cells.size,
    minPairDistance: Number.isFinite(minPairDistance) ? Number(minPairDistance.toFixed(2)) : null
  };
}

runButton.addEventListener("click", async () => {
  if (busy || !ready) return;
  busy = true;
  updateButton();
  const owned = [];
  let orb, matcher, keypointsA, keypointsB, descriptorsA, descriptorsB, matches;
  try {
    log("Loading selected images locally…");
    const [a, b] = await Promise.all([
      loadImage(originalInput.files[0]),
      loadImage(cropInput.files[0])
    ]);
    owned.push(a.mat, b.mat);

    const grayA = new cv.Mat();
    const grayB = new cv.Mat();
    owned.push(grayA, grayB);
    cv.cvtColor(a.mat, grayA, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(b.mat, grayB, cv.COLOR_RGBA2GRAY);

    orb = cv.ORB.create(1500);
    keypointsA = new cv.KeyPointVector();
    keypointsB = new cv.KeyPointVector();
    descriptorsA = new cv.Mat();
    descriptorsB = new cv.Mat();
    matches = new cv.DMatchVectorVector();
    matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    owned.push(orb, keypointsA, keypointsB, descriptorsA, descriptorsB, matches, matcher);

    const emptyMaskA = new cv.Mat();
    const emptyMaskB = new cv.Mat();
    owned.push(emptyMaskA, emptyMaskB);
    orb.detectAndCompute(grayA, emptyMaskA, keypointsA, descriptorsA);
    orb.detectAndCompute(grayB, emptyMaskB, keypointsB, descriptorsB);

    const keypointCountA = keypointsA.size();
    const keypointCountB = keypointsB.size();
    if (descriptorsA.empty() || descriptorsB.empty()) {
      log({
        status: "REVIEW_REQUIRED",
        reason: "ORB returned empty descriptors for one or both images.",
        keypointCountA, keypointCountB
      });
      return;
    }

    matcher.knnMatch(descriptorsA, descriptorsB, matches, 2);
    const ratioThreshold = 0.75;
    const sourcePoints = [];
    const targetPoints = [];
    let ratioPairsTested = 0;
    let ratioAccepted = 0;

    for (let i = 0; i < matches.size(); i++) {
      const group = matches.get(i);
      try {
        if (group.size() < 2) continue;
        const best = group.get(0);
        const second = group.get(1);
        ratioPairsTested++;
        if (best.distance < ratioThreshold * second.distance) {
          const keypointA = keypointsA.get(best.queryIdx);
          const keypointB = keypointsB.get(best.trainIdx);
          try {
            sourcePoints.push({ x: keypointA.pt.x, y: keypointA.pt.y });
            targetPoints.push({ x: keypointB.pt.x, y: keypointB.pt.y });
          } finally {
            keypointA.delete();
            keypointB.delete();
          }
          ratioAccepted++;
        }
      } finally {
        group.delete();
      }
    }

    if (sourcePoints.length < 4) {
      log({
        status: "REVIEW_REQUIRED",
        reason: "Fewer than four ratio-test correspondences; homography cannot be estimated reliably.",
        keypointCountA, keypointCountB, ratioPairsTested, ratioAccepted
      });
      return;
    }

    const src = new cv.Mat(sourcePoints.length, 1, cv.CV_32FC2);
    const dst = new cv.Mat(targetPoints.length, 1, cv.CV_32FC2);
    const mask = new cv.Mat();
    owned.push(src, dst, mask);

    sourcePoints.forEach((p, i) => {
      src.data32F[i * 2] = p.x;
      src.data32F[i * 2 + 1] = p.y;
      dst.data32F[i * 2] = targetPoints[i].x;
      dst.data32F[i * 2 + 1] = targetPoints[i].y;
    });

    const homography = cv.findHomography(src, dst, cv.RANSAC, 3.0, mask);
    if (homography) owned.push(homography);
    const maskValues = Array.from(mask.data);
    const inlierSource = sourcePoints.filter((_, i) => maskValues[i] !== 0);
    const inlierTarget = targetPoints.filter((_, i) => maskValues[i] !== 0);
    const inlierCount = inlierSource.length;

    const result = {
      status: "MEASURED — NOT AN AUTOMATIC ACCEPTANCE",
      files: {
        original: originalInput.files[0].name,
        crop: cropInput.files[0].name
      },
      imageDimensions: {
        original: [a.width, a.height],
        crop: [b.width, b.height]
      },
      orb: {
        keypointsOriginal: keypointCountA,
        keypointsCrop: keypointCountB,
        descriptorRowsOriginal: descriptorsA.rows,
        descriptorRowsCrop: descriptorsB.rows
      },
      matching: {
        ratioThreshold,
        ratioPairsTested,
        ratioAccepted,
        inliers: inlierCount,
        inlierRatio: Number((inlierCount / Math.max(1, ratioAccepted)).toFixed(4))
      },
      spatialCoverageOriginalInlierCoordinates: computeCoverage(inlierSource, a.width, a.height),
      spatialCoverageCropInlierCoordinates: computeCoverage(inlierTarget, b.width, b.height),
      homographyAvailable: !!homography && !homography.empty(),
      limitations: [
        "A single genuine crop pair is a smoke test, not an accuracy benchmark.",
        "RANSAC verifies geometric consistency, not semantic identity.",
        "Thresholds remain provisional; do not use this output to auto-delete files."
      ]
    };
    log(result);
  } catch (error) {
    log({ status: "TEST_ERROR", message: error.message, stack: error.stack });
  } finally {
    for (const item of owned.reverse()) {
      try { item.delete(); } catch {}
    }
    busy = false;
    updateButton();
  }
});
