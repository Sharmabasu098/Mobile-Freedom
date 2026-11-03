
const statusEl = document.querySelector("#status");
const summaryEl = document.querySelector("#summary");
const stagesEl = document.querySelector("#stages");
const outputEl = document.querySelector("#output");
const runButton = document.querySelector("#run");
const canvasA = document.querySelector("#imageA");
const canvasB = document.querySelector("#imageB");

let cv = null;
let runtimeReady = false;

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

function makeSyntheticImages() {
  const ctx = canvasA.getContext("2d");
  ctx.fillStyle = "#f2f0e8";
  ctx.fillRect(0, 0, canvasA.width, canvasA.height);
  let seed = 87321;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(rand() * canvasA.width);
    const y = Math.floor(rand() * canvasA.height);
    const size = 5 + Math.floor(rand() * 24);
    const shade = 20 + Math.floor(rand() * 210);
    ctx.fillStyle = `rgb(${shade},${(shade * 0.83) | 0},${(shade * 0.61) | 0})`;
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.strokeStyle = "#182b54";
  ctx.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(12 + i * 37, 8);
    ctx.lineTo(20 + i * 31, 230);
    ctx.stroke();
  }
  ctx.fillStyle = "#17294a";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("M9 TEST 2026", 32, 118);

  const cropCtx = canvasB.getContext("2d");
  cropCtx.drawImage(canvasA, 42, 30, 238, 178, 0, 0, canvasB.width, canvasB.height);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function symbolCheck() {
  const required = [
    "Mat", "matFromImageData", "ORB", "KeyPointVector",
    "BFMatcher", "DMatchVectorVector", "findHomography",
    "cvtColor", "COLOR_RGBA2GRAY", "NORM_HAMMING", "RANSAC"
  ];
  const missing = required.filter(name => !(name in cv));
  if (missing.length) throw new Error("Missing OpenCV symbols: " + missing.join(", "));
  return required;
}

async function runProbe() {
  runButton.disabled = true;
  stagesEl.replaceChildren();
  const owned = [];
  const result = {
    package: "@haoking/opencvjs",
    runtime: "browser",
    stages: {},
    syntheticInput: true,
    productionAcceptance: false
  };

  try {
    assert(runtimeReady && cv, "OpenCV runtime is not ready.");
    const symbols = symbolCheck();
    result.stages.symbols = { ok: true, checked: symbols };
    addStage("Required OpenCV symbols", "pass", symbols.length + " present");

    const matA = cv.matFromImageData(canvasA.getContext("2d").getImageData(0, 0, canvasA.width, canvasA.height));
    const matB = cv.matFromImageData(canvasB.getContext("2d").getImageData(0, 0, canvasB.width, canvasB.height));
    const grayA = new cv.Mat();
    const grayB = new cv.Mat();
    const maskA = new cv.Mat();
    const maskB = new cv.Mat();
    const keypointsA = new cv.KeyPointVector();
    const keypointsB = new cv.KeyPointVector();
    const descriptorsA = new cv.Mat();
    const descriptorsB = new cv.Mat();
    const orb = cv.ORB.create(1200);
    const matches = new cv.DMatchVectorVector();
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    owned.push(matA, matB, grayA, grayB, maskA, maskB, keypointsA, keypointsB, descriptorsA, descriptorsB, orb, matches, matcher);
    result.stages.embindAllocation = { ok: true, matType: matA.type(), rows: matA.rows, cols: matA.cols };
    addStage("Embind allocation", "pass", "Mat, vectors, ORB and BFMatcher created");

    cv.cvtColor(matA, grayA, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(matB, grayB, cv.COLOR_RGBA2GRAY);
    orb.detectAndCompute(grayA, maskA, keypointsA, descriptorsA);
    orb.detectAndCompute(grayB, maskB, keypointsB, descriptorsB);
    const countA = keypointsA.size();
    const countB = keypointsB.size();
    assert(!descriptorsA.empty() && !descriptorsB.empty(), "ORB produced an empty descriptor matrix.");
    result.stages.orb = {
      ok: true,
      keypointsA: countA,
      keypointsB: countB,
      descriptorShapeA: [descriptorsA.rows, descriptorsA.cols],
      descriptorShapeB: [descriptorsB.rows, descriptorsB.cols],
      descriptorTypeA: descriptorsA.type(),
      descriptorTypeB: descriptorsB.type()
    };
    addStage("ORB detectAndCompute", "pass", countA + " / " + countB + " keypoints");

    matcher.knnMatch(descriptorsA, descriptorsB, matches, 2);
    const ratioThreshold = 0.75;
    const source = [];
    const target = [];
    let groupsWithTwo = 0;
    let ratioAccepted = 0;
    for (let i = 0; i < matches.size(); i++) {
      const group = matches.get(i);
      try {
        if (group.size() < 2) continue;
        groupsWithTwo++;
        const best = group.get(0);
        const second = group.get(1);
        if (best.distance < ratioThreshold * second.distance) {
          const pointA = keypointsA.get(best.queryIdx);
          const pointB = keypointsB.get(best.trainIdx);
          try {
            source.push([pointA.pt.x, pointA.pt.y]);
            target.push([pointB.pt.x, pointB.pt.y]);
          } finally {
            pointA.delete();
            pointB.delete();
          }
          ratioAccepted++;
        }
      } finally {
        group.delete();
      }
    }
    result.stages.knn = {
      ok: true,
      knnGroups: matches.size(),
      groupsWithTwo,
      ratioThreshold,
      ratioAccepted
    };
    addStage("BFMatcher KNN + Lowe ratio", "pass", ratioAccepted + " accepted correspondences");

    if (source.length >= 4) {
      const src = new cv.Mat(source.length, 1, cv.CV_32FC2);
      const dst = new cv.Mat(target.length, 1, cv.CV_32FC2);
      const inlierMask = new cv.Mat();
      owned.push(src, dst, inlierMask);
      source.forEach((p, i) => {
        src.data32F[i * 2] = p[0];
        src.data32F[i * 2 + 1] = p[1];
        dst.data32F[i * 2] = target[i][0];
        dst.data32F[i * 2 + 1] = target[i][1];
      });
      const homography = cv.findHomography(src, dst, cv.RANSAC, 3.0, inlierMask);
      if (homography) owned.push(homography);
      const inliers = Array.from(inlierMask.data).filter(v => v !== 0).length;
      result.stages.ransac = {
        ok: !!homography && !homography.empty(),
        inliers,
        correspondences: source.length,
        inlierRatio: Number((inliers / source.length).toFixed(4))
      };
      addStage("RANSAC homography", result.stages.ransac.ok ? "pass" : "error", inliers + " / " + source.length + " inliers");
      assert(result.stages.ransac.ok, "Homography was not produced.");
    } else {
      result.stages.ransac = {
        ok: false,
        skipped: true,
        reason: "Fewer than four ratio-test correspondences.",
        correspondences: source.length
      };
      addStage("RANSAC homography", "error", "only " + source.length + " correspondences");
      throw new Error("Not enough correspondences to test RANSAC.");
    }

    result.status = "RUNTIME_PIPELINE_PASS";
    result.note = "Synthetic smoke test only. This does not establish crop-detection accuracy or M9 acceptance.";
    setStatus("Runtime pipeline passed", "ok");
    summaryEl.textContent = "All probe stages completed. Review the detailed metrics below; this is not production approval.";
  } catch (error) {
    result.status = "RUNTIME_PIPELINE_ERROR";
    result.error = { message: error?.message || String(error), stack: error?.stack || null };
    setStatus("Probe needs review", "fail");
    summaryEl.textContent = "A runtime stage failed. The exact failing stage and error are recorded below.";
    addStage("Probe execution", "error", error?.message || String(error));
  } finally {
    for (const item of owned.reverse()) {
      try { item.delete(); } catch (error) {
        result.cleanupError = result.cleanupError || [];
        result.cleanupError.push(error?.message || String(error));
      }
    }
    result.cleanup = result.cleanupError ? "REVIEW_REQUIRED" : "delete() attempted for all owned objects";
    writeOutput(result);
    runButton.disabled = !runtimeReady;
  }
}

makeSyntheticImages();

try {
  // Initialize Emscripten before importing the package. Vite serves the
  // package's optimized glue and its matching WASM asset from the same
  // dependency directory, so preserve the prefix supplied by Emscripten.
  // Do not hard-code "/opencv_js.wasm": that URL is handled by Vite's SPA
  // fallback and returns index.html instead of the binary.
  globalThis.Module = globalThis.Module || {};
  globalThis.Module.locateFile = (path, prefix) => {
    if (path.endsWith(".wasm")) {
      assert(
        typeof prefix === "string" && prefix.length > 0,
        "OpenCV did not provide a WASM asset directory; refusing an unsafe root-level fallback."
      );
    }
    return prefix + path;
  };

  const { default: loadOpenCV } = await import("@haoking/opencvjs");

  const started = performance.now();
  cv = await loadOpenCV();
  assert(typeof cv.Mat === "function", "OpenCV loaded but cv.Mat is unavailable.");
  runtimeReady = true;
  const elapsedMs = Math.round(performance.now() - started);
  setStatus("WASM runtime ready", "ok");
  summaryEl.textContent = "OpenCV loaded in " + elapsedMs + " ms. Run the synthetic ORB + KNN + RANSAC probe.";
  writeOutput({
    status: "WASM_RUNTIME_READY",
    package: "@haoking/opencvjs",
    elapsedMs,
    matAvailable: typeof cv.Mat === "function",
    note: "Package loading alone is not a passing pipeline test."
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
