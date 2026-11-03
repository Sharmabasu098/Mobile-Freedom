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
  seedUnrelated: 99217,
  width: 640,
  height: 480,
  cropAreaPercents: [50, 65, 80],
  orbFeatures: 1600,
  loweRatio: 0.75,
  ransacReprojectionThreshold: 3.0,
  spatialGrid: 4,
  rngSeed: 20261103
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
function drawDeterministicScene(seed, label) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
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
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (i % 4 === 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.fillRect(-size / 2, -size / 2, size, Math.max(2, size / 3));
      ctx.restore();
    } else {
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.strokeStyle = "#102b58";
  ctx.lineWidth = 5;
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(8 + i * 43, 4);
    ctx.lineTo(25 + i * 39, canvas.height - 5);
    ctx.stroke();
  }
  ctx.fillStyle = "#14284b";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(label, 24, 65);
  ctx.font = "20px sans-serif";
  ctx.fillText("M9 DETERMINISTIC FEATURE FIXTURE", 24, canvas.height - 24);
  return canvas;
}
function makeCenterCrop(source, retainedAreaPercent) {
  const scale = Math.sqrt(retainedAreaPercent / 100);
  const cropWidth = Math.round(source.width * scale);
  const cropHeight = Math.round(source.height * scale);
  const sx = Math.floor((source.width - cropWidth) / 2);
  const sy = Math.floor((source.height - cropHeight) / 2);
  const crop = makeCanvas();
  crop.getContext("2d", { willReadFrequently: true }).drawImage(
    source, sx, sy, cropWidth, cropHeight, 0, 0, crop.width, crop.height
  );
  return { canvas: crop, geometry: { retainedAreaPercent, cropX: sx, cropY: sy, cropWidth, cropHeight } };
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
function analyzePair(label, canvasAInput, canvasBInput, caseType, cropGeometry = null) {
  const owned = [];
  const metrics = {
    label, caseType, cropGeometry,
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
      keypointsA: keypointsA.size(),
      keypointsB: keypointsB.size(),
      descriptorRowsA: descriptorsA.rows,
      descriptorRowsB: descriptorsB.rows,
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
        const best = group.get(0);
        const second = group.get(1);
        if (best.distance < CONFIG.loweRatio * second.distance) {
          const pA = keypointsA.get(best.queryIdx);
          const pB = keypointsB.get(best.trainIdx);
          accepted.push({ source: [pA.pt.x, pA.pt.y], target: [pB.pt.x, pB.pt.y], distance: best.distance });
        }
      } finally {
        group.delete();
      }
    }
    metrics.matching = {
      knnGroups: matches.size(),
      groupsWithTwo,
      loweAccepted: accepted.length,
      loweAcceptanceRate: Number((accepted.length / Math.max(1, groupsWithTwo)).toFixed(4))
    };
    if (accepted.length < 4) {
      metrics.ransac = { attempted: false, reason: "Fewer than four Lowe-ratio correspondences.", inliers: 0 };
      metrics.spatialCoverage = spatialCoverage([], CONFIG.width, CONFIG.height, CONFIG.spatialGrid);
      metrics.pipelineStatus = "INSUFFICIENT_MATCHES";
      return metrics;
    }

    const src = new cv.Mat(accepted.length, 1, cv.CV_32FC2);
    const dst = new cv.Mat(accepted.length, 1, cv.CV_32FC2);
    const inlierMask = new cv.Mat();
    owned.push(src, dst, inlierMask);
    accepted.forEach((match, i) => {
      src.data32F[i * 2] = match.source[0];
      src.data32F[i * 2 + 1] = match.source[1];
      dst.data32F[i * 2] = match.target[0];
      dst.data32F[i * 2 + 1] = match.target[1];
    });
    if (typeof cv.setRNGSeed === "function") cv.setRNGSeed(CONFIG.rngSeed);
    const homography = cv.findHomography(src, dst, cv.RANSAC, CONFIG.ransacReprojectionThreshold, inlierMask);
    if (homography) owned.push(homography);
    const maskValues = Array.from(inlierMask.data || []);
    const inlierMatches = accepted.filter((_, i) => maskValues[i] !== 0);
    const inlierSourcePoints = inlierMatches.map(match => match.source);
    const inlierTargetPoints = inlierMatches.map(match => match.target);
    const inliers = inlierMatches.length;
    metrics.ransac = {
      attempted: true,
      homographyFound: !!homography && !homography.empty(),
      inliers,
      correspondences: accepted.length,
      inlierRatio: Number((inliers / accepted.length).toFixed(4))
    };
    metrics.spatialCoverage = {
      source: spatialCoverage(inlierSourcePoints, CONFIG.width, CONFIG.height, CONFIG.spatialGrid),
      target: spatialCoverage(inlierTargetPoints, CONFIG.width, CONFIG.height, CONFIG.spatialGrid)
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
function makeBenchmarkCases() {
  const original = drawDeterministicScene(CONFIG.seedOriginal, "ORIGINAL SCENE A");
  const unrelated = drawDeterministicScene(CONFIG.seedUnrelated, "UNRELATED SCENE B");
  const cases = CONFIG.cropAreaPercents.map(percent => {
    const crop = makeCenterCrop(original, percent);
    return {
      label: "genuine_crop_" + percent + "_percent",
      type: "genuine_crop",
      a: original,
      b: crop.canvas,
      geometry: crop.geometry
    };
  });
  cases.push({
    label: "negative_unrelated_control",
    type: "negative_control",
    a: original,
    b: unrelated,
    geometry: null
  });
  return { original, previewCrop: makeCenterCrop(original, 50).canvas, cases };
}
async function runProbe() {
  runButton.disabled = true;
  stagesEl.replaceChildren();
  const result = {
    benchmark: "M9 deterministic crop-vs-unrelated benchmark",
    benchmarkVersion: "1.0.0",
    package: "@haoking/opencvjs",
    runtime: "browser",
    syntheticInput: true,
    productionAcceptance: false,
    accuracyThresholdsApplied: false,
    repeatability: {
      deterministicFixtureSeeds: [CONFIG.seedOriginal, CONFIG.seedUnrelated],
      fixedParameters: CONFIG,
      rngSeedAppliedWhenSupported: typeof cv.setRNGSeed === "function"
    },
    cases: []
  };
  try {
    assert(runtimeReady && cv, "OpenCV runtime is not ready.");
    const symbols = symbolCheck();
    result.symbols = { ok: true, checked: symbols };
    addStage("Required OpenCV symbols", "pass", symbols.length + " present");

    const fixtures = makeBenchmarkCases();
    canvasA.getContext("2d").drawImage(fixtures.original, 0, 0, canvasA.width, canvasA.height);
    canvasB.getContext("2d").drawImage(fixtures.previewCrop, 0, 0, canvasB.width, canvasB.height);
    addStage("Deterministic fixtures", "pass", "3 genuine crops + 1 unrelated control");
    for (const testCase of fixtures.cases) {
      const metrics = analyzePair(testCase.label, testCase.a, testCase.b, testCase.type, testCase.geometry);
      result.cases.push(metrics);
      const detail = metrics.ransac
        ? metrics.ransac.inliers + " inliers / " + (metrics.matching?.loweAccepted ?? 0) + " Lowe matches"
        : metrics.pipelineStatus;
      addStage(testCase.label, metrics.pipelineStatus === "ERROR" ? "error" : "pass", detail);
    }
    result.summary = {
      totalCases: result.cases.length,
      genuineCropCases: result.cases.filter(item => item.caseType === "genuine_crop").length,
      negativeControlCases: result.cases.filter(item => item.caseType === "negative_control").length,
      completedCases: result.cases.filter(item => item.pipelineStatus !== "ERROR").length,
      errorCases: result.cases.filter(item => item.pipelineStatus === "ERROR").length
    };
    result.status = result.summary.errorCases === 0 && result.summary.completedCases === result.summary.totalCases
      ? "CROP_BENCHMARK_EXECUTED"
      : "CROP_BENCHMARK_REVIEW_REQUIRED";
    result.note = "Execution status only. No match threshold or M9 acceptance decision is inferred from these synthetic fixtures.";
    setStatus(result.status === "CROP_BENCHMARK_EXECUTED" ? "Benchmark executed" : "Benchmark needs review",
      result.status === "CROP_BENCHMARK_EXECUTED" ? "ok" : "fail");
    summaryEl.textContent = "Four deterministic cases executed. Inspect per-case metrics; no production threshold has been approved.";
  } catch (error) {
    result.status = "CROP_BENCHMARK_ERROR";
    result.error = { message: error?.message || String(error), stack: error?.stack || null };
    setStatus("Benchmark failed", "fail");
    summaryEl.textContent = "The benchmark could not complete. Diagnostics are recorded below.";
    addStage("Benchmark execution", "error", error?.message || String(error));
  } finally {
    writeOutput(result);
    runButton.disabled = !runtimeReady;
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
  summaryEl.textContent = "OpenCV loaded in " + elapsedMs + " ms. Run the deterministic crop benchmark.";
  writeOutput({
    status: "WASM_RUNTIME_READY",
    package: "@haoking/opencvjs",
    elapsedMs,
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
