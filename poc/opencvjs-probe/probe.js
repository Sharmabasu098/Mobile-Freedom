const statusEl = document.querySelector("#status");
const summaryEl = document.querySelector("#summary");
const stagesEl = document.querySelector("#stages");
const outputEl = document.querySelector("#output");
const runButton = document.querySelector("#run");
const canvasA = document.querySelector("#imageA");
const canvasB = document.querySelector("#imageB");

let cv = null;
let runtimeReady = false;
const CONFIG = Object.freeze({
  seedOriginal: 87321,
  unrelatedSeeds: [99217, 33109, 77123, 44017, 61891],
  width: 640,
  height: 480,
  cropAreaPercents: [50, 65, 80],
  cropPositions: ["center", "top_left", "top_right", "bottom_left", "bottom_right"],
  repeatRuns: 3,
  sameObjectPhotoSeeds: [18431, 29471],
  orbFeatures: 1600,
  loweRatio: 0.75,
  ransacReprojectionThreshold: 3.0,
  spatialGrid: 4,
  rngSeed: 20261103,
  exploratoryRatioThresholds: [0.5, 0.6, 0.7, 0.8],
  exploratoryMinInliers: [8, 20, 40],
  exploratoryMinSpatialCoverage: [0.25, 0.5]
});

function setStatus(label, kind) {
  statusEl.textContent = label;
  statusEl.className = "badge " + kind;
}
function writeOutput(value) {
  outputEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function addStage(label, state, detail = "") {
  const li = document.createElement("li");
  li.className = state;
  li.textContent = (state === "pass" ? "PASS — " : state === "error" ? "ERROR — " : "INFO — ") + label + (detail ? ": " + detail : "");
  stagesEl.append(li);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CONFIG.width;
  canvas.height = CONFIG.height;
  return canvas;
}
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function drawDeterministicScene(seed, label) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rand = seededRandom(seed);
  ctx.fillStyle = "#eee9dc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 32) {
    for (let x = 0; x < canvas.width; x += 32) {
      const v = 205 + Math.floor(rand() * 42);
      ctx.fillStyle = `rgb(${v},${Math.max(0,v-8)},${Math.max(0,v-20)})`;
      ctx.fillRect(x + 1, y + 1, 29, 29);
    }
  }
  for (let i = 0; i < 520; i++) {
    const x = Math.floor(rand() * canvas.width);
    const y = Math.floor(rand() * canvas.height);
    const size = 4 + Math.floor(rand() * 27);
    const shade = 12 + Math.floor(rand() * 220);
    ctx.fillStyle = `rgb(${shade},${(shade * 0.79) | 0},${(shade * 0.57) | 0})`;
    if (i % 4 === 0) {
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (i % 4 === 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * Math.PI);
      ctx.fillRect(-size / 2, -size / 2, size, Math.max(2, size / 3)); ctx.restore();
    } else {
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.strokeStyle = "#102b58";
  ctx.lineWidth = 5;
  for (let i = 0; i < 15; i++) {
    ctx.beginPath(); ctx.moveTo(8 + i * 43, 4); ctx.lineTo(25 + i * 39, canvas.height - 5); ctx.stroke();
  }
  ctx.fillStyle = "#14284b";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(label, 24, 65);
  ctx.font = "20px sans-serif";
  ctx.fillText("M9 DETERMINISTIC FEATURE FIXTURE", 24, canvas.height - 24);
  return canvas;
}
function makePositionedCrop(source, retainedAreaPercent, position) {
  const scale = Math.sqrt(retainedAreaPercent / 100);
  const cropWidth = Math.round(source.width * scale);
  const cropHeight = Math.round(source.height * scale);
  const xPositions = { left: 0, center: (source.width - cropWidth) / 2, right: source.width - cropWidth };
  const yPositions = { top: 0, center: (source.height - cropHeight) / 2, bottom: source.height - cropHeight };
  const [vertical, horizontal] = position === "center" ? ["center", "center"] : position.split("_");
  const sx = Math.round(xPositions[horizontal]);
  const sy = Math.round(yPositions[vertical]);
  const crop = makeCanvas();
  crop.getContext("2d", { willReadFrequently: true }).drawImage(
    source, sx, sy, cropWidth, cropHeight, 0, 0, crop.width, crop.height
  );
  return {
    canvas: crop,
    geometry: { retainedAreaPercent, position, cropX: sx, cropY: sy, cropWidth, cropHeight }
  };
}
function drawSharedObjectPhoto(backgroundSeed, label, transform) {
  const canvas = drawDeterministicScene(backgroundSeed, label);
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scale, transform.scale);
  // The same distinctive illustrated object appears in both photos, but at a
  // different location/scale/rotation and against an independently generated background.
  ctx.fillStyle = "#f7f1d5";
  ctx.strokeStyle = "#151515";
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(-92, -72, 184, 144, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#b52e37";
  ctx.beginPath(); ctx.arc(-42, -18, 25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#174b83";
  ctx.fillRect(8, -43, 60, 18);
  ctx.fillStyle = "#d48a22";
  ctx.beginPath(); ctx.moveTo(-50, 48); ctx.lineTo(0, 8); ctx.lineTo(50, 48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-65, -50); ctx.lineTo(65, 55); ctx.moveTo(65, -50); ctx.lineTo(-65, 55); ctx.stroke();
  ctx.restore();
  return canvas;
}
function imageData(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
}
function symbolCheck() {
  const required = [
    "Mat", "matFromImageData", "ORB", "KeyPointVector", "BFMatcher",
    "DMatchVectorVector", "findHomography", "cvtColor",
    "COLOR_RGBA2GRAY", "NORM_HAMMING", "RANSAC", "CV_32FC2"
  ];
  const missing = required.filter(name => !(name in cv));
  if (missing.length) throw new Error("Missing OpenCV symbols: " + missing.join(", "));
  return required;
}
function spatialCoverage(points, width, height, gridSize) {
  if (!points.length) return { occupiedCells: 0, totalCells: gridSize * gridSize, occupiedCellRatio: 0, boundingBoxAreaRatio: 0 };
  const cells = new Set();
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (const [x, y] of points) {
    const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(x / width * gridSize)));
    const gy = Math.min(gridSize - 1, Math.max(0, Math.floor(y / height * gridSize)));
    cells.add(gy * gridSize + gx);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const bbox = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  return {
    occupiedCells: cells.size,
    totalCells: gridSize * gridSize,
    occupiedCellRatio: Number((cells.size / (gridSize * gridSize)).toFixed(4)),
    boundingBoxAreaRatio: Number((bbox / (width * height)).toFixed(4))
  };
}
function analyzePair(label, canvasAInput, canvasBInput, caseType, cropGeometry, repeatIndex) {
  const owned = [];
  const metrics = {
    label, caseType, cropGeometry, repeatIndex,
    parameters: {
      orbFeatures: CONFIG.orbFeatures,
      loweRatio: CONFIG.loweRatio,
      ransacReprojectionThreshold: CONFIG.ransacReprojectionThreshold,
      spatialGrid: CONFIG.spatialGrid,
      rngSeed: CONFIG.rngSeed
    }
  };
  try {
    const matA = cv.matFromImageData(imageData(canvasAInput));
    const matB = cv.matFromImageData(imageData(canvasBInput));
    const grayA = new cv.Mat(), grayB = new cv.Mat();
    const maskA = new cv.Mat(), maskB = new cv.Mat();
    const keypointsA = new cv.KeyPointVector(), keypointsB = new cv.KeyPointVector();
    const descriptorsA = new cv.Mat(), descriptorsB = new cv.Mat();
    const orb = new cv.ORB(CONFIG.orbFeatures);
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    const matches = new cv.DMatchVectorVector();
    owned.push(matA, matB, grayA, grayB, maskA, maskB, keypointsA, keypointsB, descriptorsA, descriptorsB, orb, matcher, matches);

    cv.cvtColor(matA, grayA, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(matB, grayB, cv.COLOR_RGBA2GRAY);
    orb.detectAndCompute(grayA, maskA, keypointsA, descriptorsA);
    orb.detectAndCompute(grayB, maskB, keypointsB, descriptorsB);
    metrics.orb = {
      keypointsA: keypointsA.size(), keypointsB: keypointsB.size(),
      descriptorRowsA: descriptorsA.rows, descriptorRowsB: descriptorsB.rows,
      descriptorsAvailable: !descriptorsA.empty() && !descriptorsB.empty()
    };
    if (!metrics.orb.descriptorsAvailable) {
      metrics.pipelineStatus = "NO_DESCRIPTORS";
      return metrics;
    }

    matcher.knnMatch(descriptorsA, descriptorsB, matches, 2);
    const accepted = [];
    let groupsWithTwo = 0;
    for (let i = 0; i < matches.size(); i++) {
      const group = matches.get(i);
      try {
        if (group.size() < 2) continue;
        groupsWithTwo++;
        const best = group.get(0), second = group.get(1);
        if (best.distance < CONFIG.loweRatio * second.distance) {
          const pA = keypointsA.get(best.queryIdx), pB = keypointsB.get(best.trainIdx);
          accepted.push({ source: [pA.pt.x, pA.pt.y], target: [pB.pt.x, pB.pt.y], distance: best.distance });
        }
      } finally { group.delete(); }
    }
    metrics.matching = {
      knnGroups: matches.size(), groupsWithTwo, loweAccepted: accepted.length,
      loweAcceptanceRate: Number((accepted.length / Math.max(1, groupsWithTwo)).toFixed(4))
    };
    if (accepted.length < 4) {
      metrics.ransac = { attempted: false, reason: "Fewer than four Lowe-ratio correspondences.", inliers: 0, inlierRatio: 0 };
      metrics.spatialCoverage = {
        source: spatialCoverage([], CONFIG.width, CONFIG.height, CONFIG.spatialGrid),
        target: spatialCoverage([], CONFIG.width, CONFIG.height, CONFIG.spatialGrid)
      };
      metrics.pipelineStatus = "INSUFFICIENT_MATCHES";
      return metrics;
    }

    const src = new cv.Mat(accepted.length, 1, cv.CV_32FC2);
    const dst = new cv.Mat(accepted.length, 1, cv.CV_32FC2);
    const inlierMask = new cv.Mat();
    owned.push(src, dst, inlierMask);
    accepted.forEach((match, i) => {
      src.data32F[i * 2] = match.source[0]; src.data32F[i * 2 + 1] = match.source[1];
      dst.data32F[i * 2] = match.target[0]; dst.data32F[i * 2 + 1] = match.target[1];
    });
    if (typeof cv.setRNGSeed === "function") cv.setRNGSeed(CONFIG.rngSeed);
    const homography = cv.findHomography(src, dst, cv.RANSAC, CONFIG.ransacReprojectionThreshold, inlierMask);
    if (homography) owned.push(homography);
    const maskValues = Array.from(inlierMask.data || []);
    const inlierMatches = accepted.filter((_, i) => maskValues[i] !== 0);
    const inliers = inlierMatches.length;
    metrics.ransac = {
      attempted: true, homographyFound: !!homography && !homography.empty(),
      inliers, correspondences: accepted.length,
      inlierRatio: Number((inliers / accepted.length).toFixed(4))
    };
    metrics.spatialCoverage = {
      source: spatialCoverage(inlierMatches.map(m => m.source), CONFIG.width, CONFIG.height, CONFIG.spatialGrid),
      target: spatialCoverage(inlierMatches.map(m => m.target), CONFIG.width, CONFIG.height, CONFIG.spatialGrid)
    };
    metrics.pipelineStatus = metrics.ransac.homographyFound ? "RANSAC_COMPLETED" : "HOMOGRAPHY_NOT_FOUND";
    return metrics;
  } catch (error) {
    metrics.pipelineStatus = "ERROR";
    metrics.error = error?.message || String(error);
    return metrics;
  } finally {
    for (const item of owned.reverse()) {
      try { item.delete(); } catch (error) {
        metrics.cleanupErrors = metrics.cleanupErrors || [];
        metrics.cleanupErrors.push(error?.message || String(error));
      }
    }
    metrics.cleanup = metrics.cleanupErrors ? "REVIEW_REQUIRED" : "OWNED_OBJECTS_RELEASED";
  }
}
function buildCases() {
  const original = drawDeterministicScene(CONFIG.seedOriginal, "ORIGINAL SCENE A");
  const cases = [];
  for (const percent of CONFIG.cropAreaPercents) {
    for (const position of CONFIG.cropPositions) {
      const crop = makePositionedCrop(original, percent, position);
      cases.push({
        label: "crop_" + percent + "_area_" + position,
        caseType: "genuine_crop",
        positiveLabel: true,
        a: original, b: crop.canvas, geometry: crop.geometry
      });
    }
  }
  CONFIG.unrelatedSeeds.forEach((seed, index) => {
    cases.push({
      label: "unrelated_control_" + (index + 1),
      caseType: "unrelated_negative_control",
      positiveLabel: false,
      a: original, b: drawDeterministicScene(seed, "UNRELATED " + (index + 1)),
      geometry: null
    });
  });
  const photoA = drawSharedObjectPhoto(15031, "OBJECT PHOTO A", { x: 190, y: 235, scale: 1.0, rotation: -0.08 });
  CONFIG.sameObjectPhotoSeeds.forEach((seed, index) => {
    const photoB = drawSharedObjectPhoto(seed, "OBJECT PHOTO B" + (index + 1), {
      x: index === 0 ? 438 : 390, y: index === 0 ? 170 : 320,
      scale: index === 0 ? 0.72 : 0.88, rotation: index === 0 ? 0.31 : -0.24
    });
    cases.push({
      label: "same_object_different_photo_" + (index + 1),
      caseType: "same_object_different_photo_negative",
      positiveLabel: false,
      a: photoA, b: photoB, geometry: null
    });
  });
  return { original, previewCrop: makePositionedCrop(original, 50, "center").canvas, cases };
}
function candidateThresholdSweep(records) {
  const configs = [];
  for (const ratioThreshold of CONFIG.exploratoryRatioThresholds) {
    for (const minInliers of CONFIG.exploratoryMinInliers) {
      for (const minSpatialCoverage of CONFIG.exploratoryMinSpatialCoverage) {
        configs.push({ ratioThreshold, minInliers, minSpatialCoverage });
      }
    }
  }
  return configs.map(config => {
    const counts = { tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const item of records) {
      const spatial = Math.min(
        item.spatialCoverage?.source?.occupiedCellRatio ?? 0,
        item.spatialCoverage?.target?.occupiedCellRatio ?? 0
      );
      const predictedCrop = (item.ransac?.inlierRatio ?? 0) >= config.ratioThreshold &&
        (item.ransac?.inliers ?? 0) >= config.minInliers &&
        spatial >= config.minSpatialCoverage;
      if (predictedCrop && item.positiveLabel) counts.tp++;
      else if (predictedCrop && !item.positiveLabel) counts.fp++;
      else if (!predictedCrop && !item.positiveLabel) counts.tn++;
      else counts.fn++;
    }
    const precision = counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null;
    const recall = counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null;
    return {
      ...config, ...counts,
      precision: precision === null ? null : Number(precision.toFixed(4)),
      recall: recall === null ? null : Number(recall.toFixed(4)),
      falsePositiveRate: counts.fp + counts.tn ? Number((counts.fp / (counts.fp + counts.tn)).toFixed(4)) : null,
      note: "Exploratory diagnostic only; not an approved production threshold."
    };
  });
}
function summarizeRepeatability(records, cases) {
  return cases.map(testCase => {
    const runs = records.filter(row => row.label === testCase.label);
    const ratios = runs.map(row => row.ransac?.inlierRatio ?? 0);
    const inliers = runs.map(row => row.ransac?.inliers ?? 0);
    const spatial = runs.map(row => Math.min(
      row.spatialCoverage?.source?.occupiedCellRatio ?? 0,
      row.spatialCoverage?.target?.occupiedCellRatio ?? 0
    ));
    return {
      label: testCase.label, caseType: testCase.caseType, expectedCrop: testCase.positiveLabel,
      repeatCount: runs.length,
      inlierRatioByRun: ratios,
      inlierRatioRange: ratios.length ? Number((Math.max(...ratios) - Math.min(...ratios)).toFixed(4)) : null,
      inliersByRun: inliers,
      minSpatialCoverageByRun: spatial,
      pipelineStatuses: runs.map(row => row.pipelineStatus),
      cleanupStatuses: runs.map(row => row.cleanup)
    };
  });
}
async function runProbe() {
  runButton.disabled = true;
  stagesEl.replaceChildren();
  const result = {
    benchmark: "M9 expanded deterministic crop-vs-hard-negative benchmark",
    benchmarkVersion: "2.0.0",
    package: "@haoking/opencvjs",
    runtime: "browser",
    syntheticInput: true,
    productionAcceptance: false,
    productionThresholdSelected: false,
    config: CONFIG,
    repeatability: {
      repeatRuns: CONFIG.repeatRuns,
      deterministicFixtures: true,
      fixedParameters: true,
      rngSeedAppliedWhenSupported: typeof cv.setRNGSeed === "function"
    },
    records: []
  };
  try {
    assert(runtimeReady && cv, "OpenCV runtime is not ready.");
    const symbols = symbolCheck();
    result.symbols = { ok: true, checked: symbols };
    addStage("Required OpenCV symbols", "pass", symbols.length + " present");
    const fixtures = buildCases();
    canvasA.getContext("2d").drawImage(fixtures.original, 0, 0, canvasA.width, canvasA.height);
    canvasB.getContext("2d").drawImage(fixtures.previewCrop, 0, 0, canvasB.width, canvasB.height);
    addStage("Fixture generation", "pass", fixtures.cases.length + " cases; 3 repeats each");

    for (let repeat = 1; repeat <= CONFIG.repeatRuns; repeat++) {
      for (const testCase of fixtures.cases) {
        const metrics = analyzePair(
          testCase.label, testCase.a, testCase.b, testCase.caseType, testCase.geometry, repeat
        );
        metrics.positiveLabel = testCase.positiveLabel;
        result.records.push(metrics);
      }
      addStage("Repeat " + repeat, "pass", fixtures.cases.length + " pair evaluations");
    }
    const cleanups = result.records.filter(row => row.cleanup !== "OWNED_OBJECTS_RELEASED");
    const errors = result.records.filter(row => row.pipelineStatus === "ERROR");
    result.caseSummary = summarizeRepeatability(result.records, fixtures.cases);
    result.exploratoryThresholdSweep = candidateThresholdSweep(result.records);
    result.summary = {
      uniqueCases: fixtures.cases.length,
      totalEvaluations: result.records.length,
      repeatRuns: CONFIG.repeatRuns,
      genuineCropCases: fixtures.cases.filter(row => row.positiveLabel).length,
      unrelatedNegativeControls: fixtures.cases.filter(row => row.caseType === "unrelated_negative_control").length,
      sameObjectDifferentPhotoHardNegatives: fixtures.cases.filter(row => row.caseType === "same_object_different_photo_negative").length,
      executionErrors: errors.length,
      cleanupReviewRequired: cleanups.length,
      falsePositiveFalseNegativeAnalysis: "Exploratory threshold sweep emitted; no production threshold selected."
    };
    result.status = errors.length === 0 && cleanups.length === 0
      ? "EXPANDED_BENCHMARK_EXECUTED"
      : "EXPANDED_BENCHMARK_REVIEW_REQUIRED";
    result.note = "A completed benchmark is not proof of classification accuracy. Threshold sweep is diagnostic only. Synthetic same-object scenes are hard negatives for crop detection, not real-world validation.";
    setStatus(result.status === "EXPANDED_BENCHMARK_EXECUTED" ? "Expanded benchmark executed" : "Benchmark needs review",
      result.status === "EXPANDED_BENCHMARK_EXECUTED" ? "ok" : "fail");
    summaryEl.textContent = result.summary.totalEvaluations + " deterministic evaluations completed. Review confusion matrices, repeatability and per-case metrics.";
  } catch (error) {
    result.status = "EXPANDED_BENCHMARK_ERROR";
    result.error = { message: error?.message || String(error), stack: error?.stack || null };
    setStatus("Benchmark failed", "fail");
    summaryEl.textContent = "The expanded benchmark could not complete. Diagnostics are recorded below.";
    addStage("Benchmark execution", "error", error?.message || String(error));
  } finally {
    writeOutput(result);
    runButton.disabled = !runtimeReady;
  }
}


function loadLocalImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = makeCanvas();
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const x = Math.floor((canvas.width - width) / 2);
      const y = Math.floor((canvas.height - height) / 2);
      context.drawImage(image, x, y, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve({
        canvas,
        dimensions: { width: image.naturalWidth, height: image.naturalHeight },
        normalizedDimensions: { width: canvas.width, height: canvas.height }
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Selected image could not be decoded by this browser."));
    };
    image.src = objectUrl;
  });
}
function getDeviceDiagnostics() {
  const memory = performance.memory;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: navigator.deviceMemory || null,
    screen: { width: screen.width, height: screen.height, pixelRatio: devicePixelRatio || 1 },
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType || null,
      downlink: navigator.connection.downlink || null
    } : null,
    jsHeap: memory ? {
      usedBeforeBytes: memory.usedJSHeapSize,
      totalBeforeBytes: memory.totalJSHeapSize,
      limitBytes: memory.jsHeapSizeLimit,
      measurementAvailable: true
    } : { measurementAvailable: false, note: "This browser does not expose performance.memory." }
  };
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}
async function runLocalPhotoValidation() {
  const fileA = document.querySelector("#photoA").files[0];
  const fileB = document.querySelector("#photoB").files[0];
  const truth = document.querySelector("#photoTruth").value;
  const button = document.querySelector("#runPhotoValidation");
  const downloadButton = document.querySelector("#downloadPhotoReport");
  const localStatus = document.querySelector("#photoStatus");
  const photoOutput = document.querySelector("#photoOutput");
  if (!fileA || !fileB) {
    localStatus.textContent = "Select both photos first.";
    return;
  }
  if (!fileA.type.startsWith("image/") || !fileB.type.startsWith("image/")) {
    localStatus.textContent = "Please select supported image files.";
    return;
  }
  if (fileA.size > 25 * 1024 * 1024 || fileB.size > 25 * 1024 * 1024) {
    localStatus.textContent = "Each image must be 25 MiB or smaller for this device test.";
    return;
  }
  button.disabled = true;
  downloadButton.disabled = true;
  localStatus.textContent = "Processing locally in this browser…";
  const device = getDeviceDiagnostics();
  const report = {
    benchmark: "M9 local real-photo validation and device performance",
    version: "1.0.0",
    localOnly: true,
    imagesUploaded: false,
    productionAcceptance: false,
    productionThresholdSelected: false,
    expectedPairType: truth,
    inputFiles: [
      { mimeType: fileA.type, sizeBytes: fileA.size },
      { mimeType: fileB.type, sizeBytes: fileB.size }
    ],
    device,
    parameters: {
      repeats: 3,
      maxInputBytesPerImage: 25 * 1024 * 1024,
      normalizedWidth: CONFIG.width,
      normalizedHeight: CONFIG.height,
      orbFeatures: CONFIG.orbFeatures,
      loweRatio: CONFIG.loweRatio,
      ransacReprojectionThreshold: CONFIG.ransacReprojectionThreshold,
      spatialGrid: CONFIG.spatialGrid,
      rngSeed: CONFIG.rngSeed
    },
    runs: []
  };
  try {
    const [imageA, imageB] = await Promise.all([loadLocalImage(fileA), loadLocalImage(fileB)]);
    report.inputFiles[0].originalDimensions = imageA.dimensions;
    report.inputFiles[1].originalDimensions = imageB.dimensions;
    const canvasContextA = canvasA.getContext("2d");
    const canvasContextB = canvasB.getContext("2d");
    canvasContextA.drawImage(imageA.canvas, 0, 0, canvasA.width, canvasA.height);
    canvasContextB.drawImage(imageB.canvas, 0, 0, canvasB.width, canvasB.height);
    for (let repeat = 1; repeat <= 3; repeat++) {
      const started = performance.now();
      const metrics = analyzePair("local_photo_pair", imageA.canvas, imageB.canvas, truth, null, repeat);
      metrics.processingTimeMs = Number((performance.now() - started).toFixed(2));
      report.runs.push(metrics);
      localStatus.textContent = "Completed run " + repeat + " of 3…";
    }
    const times = report.runs.map(row => row.processingTimeMs);
    const heapAfter = performance.memory ? performance.memory.usedJSHeapSize : null;
    report.performance = {
      processingTimeMsByRun: times,
      averageProcessingTimeMs: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)),
      medianProcessingTimeMs: median(times),
      minProcessingTimeMs: Math.min(...times),
      maxProcessingTimeMs: Math.max(...times),
      jsHeapUsedAfterBytes: heapAfter,
      jsHeapDeltaBytes: heapAfter === null ? null : heapAfter - device.jsHeap.usedBeforeBytes,
      note: "Browser timing includes image feature extraction, matching and RANSAC; JS heap is an optional browser estimate, not total WASM/native memory."
    };
    report.summary = {
      completedRuns: report.runs.length,
      pipelineErrors: report.runs.filter(row => row.pipelineStatus === "ERROR").length,
      cleanupIssues: report.runs.filter(row => row.cleanup !== "OWNED_OBJECTS_RELEASED").length,
      allRunsHaveRansac: report.runs.every(row => !!row.ransac),
      classificationDecision: "NOT MADE — inspect evidence and compare against independently labelled ground truth."
    };
    report.status = report.summary.pipelineErrors === 0 && report.summary.cleanupIssues === 0
      ? "LOCAL_PHOTO_VALIDATION_EXECUTED"
      : "LOCAL_PHOTO_VALIDATION_REVIEW_REQUIRED";
    photoOutput.textContent = JSON.stringify(report, null, 2);
    localStatus.textContent = report.status + " — all processing stayed on this device.";
    downloadButton.disabled = false;
    downloadButton.onclick = () => {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "m9-local-photo-validation.json";
      anchor.click();
      URL.revokeObjectURL(url);
    };
  } catch (error) {
    report.status = "LOCAL_PHOTO_VALIDATION_ERROR";
    report.error = error?.message || String(error);
    photoOutput.textContent = JSON.stringify(report, null, 2);
    localStatus.textContent = "Validation failed: " + report.error;
  } finally {
    button.disabled = false;
  }
}

try {
  globalThis.Module = globalThis.Module || {};
  globalThis.Module.locateFile = (path, prefix) =>
    path.endsWith(".wasm") ? "/opencv_js.wasm" : prefix + path;
  const { default: loadOpenCV } = await import("@haoking/opencvjs");
  const started = performance.now();
  cv = await loadOpenCV();
  assert(typeof cv.Mat === "function", "OpenCV loaded but cv.Mat is unavailable.");
  runtimeReady = true;
  const elapsedMs = Math.round(performance.now() - started);
  setStatus("WASM runtime ready", "ok");
  summaryEl.textContent = "OpenCV loaded in " + elapsedMs + " ms. Run the expanded deterministic benchmark.";
  writeOutput({
    status: "WASM_RUNTIME_READY", package: "@haoking/opencvjs", elapsedMs,
    matAvailable: typeof cv.Mat === "function",
    note: "Runtime readiness is not a benchmark or M9 acceptance result."
  });
  addStage("Browser WebAssembly runtime load", "pass", elapsedMs + " ms");
  runButton.disabled = false;
} catch (error) {
  setStatus("WASM load failed", "fail");
  summaryEl.textContent = "The package could not initialize in this browser.";
  writeOutput({ status: "WASM_LOAD_ERROR", message: error?.message || String(error), stack: error?.stack || null });
  addStage("Browser WebAssembly runtime load", "error", error?.message || String(error));
}
runButton.addEventListener("click", runProbe);

const localPhotoButton = document.querySelector("#runPhotoValidation");
const photoAInput = document.querySelector("#photoA");
const photoBInput = document.querySelector("#photoB");
function refreshLocalPhotoButton() {
  if (localPhotoButton) localPhotoButton.disabled = !runtimeReady || !photoAInput.files.length || !photoBInput.files.length;
}
if (photoAInput) photoAInput.addEventListener("change", refreshLocalPhotoButton);
if (photoBInput) photoBInput.addEventListener("change", refreshLocalPhotoButton);
if (localPhotoButton) localPhotoButton.addEventListener("click", runLocalPhotoValidation);

refreshLocalPhotoButton();
