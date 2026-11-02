/* M9 Face Embedding PoC — browser-only experimental harness */
const status = document.querySelector("#runtime-status");
const detail = document.querySelector("#runtime-detail");
const loadButton = document.querySelector("#load-models");
const compareButton = document.querySelector("#compare");
const exportButton = document.querySelector("#export");
const imageA = document.querySelector("#image-a");
const imageB = document.querySelector("#image-b");
const previewA = document.querySelector("#preview-a");
const previewB = document.querySelector("#preview-b");
const measurementsNode = document.querySelector("#measurements");
const compareStatus = document.querySelector("#compare-status");
const resultNode = document.querySelector("#result");

let human = null;
let modelReady = false;
let objectUrls = [];
const measurements = [];

const config = {
  backend: "wasm",
  wasmPath: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/",
  modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/",
  cacheModels: true,
  debug: true,
  warmup: "face",
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 1, minConfidence: 0.3 },
    mesh: { enabled: true },
    description: { enabled: true },
    emotion: { enabled: false },
    iris: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
};

function setStatus(message, extra = "") {
  status.textContent = message;
  detail.textContent = extra;
}

function updateCompareEnabled() {
  compareButton.disabled = !modelReady || !imageA.files?.[0] || !imageB.files?.[0];
}

function bindPreview(input, preview, message) {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.textContent = "Rejected: selected file is not an image.";
      input.value = "";
      updateCompareEnabled();
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      message.textContent = "Rejected: image exceeds the 15 MB PoC safety limit.";
      input.value = "";
      updateCompareEnabled();
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    preview.src = url;
    preview.hidden = false;
    message.textContent = file.name + " · " + (file.size / 1024).toFixed(1) + " KB";
    updateCompareEnabled();
  });
}

bindPreview(imageA, previewA, document.querySelector("#status-a"));
bindPreview(imageB, previewB, document.querySelector("#status-b"));

loadButton.addEventListener("click", async () => {
  loadButton.disabled = true;
  setStatus("Loading pinned Human runtime and face models…", "WASM backend selected. Model files are downloaded from the pinned CDN path.");
  try {
    const HumanCtor = typeof window.Human === "function" ? window.Human : window.Human?.Human;
    if (typeof HumanCtor !== "function") throw new Error("Human global constructor is unavailable; CDN runtime did not load.");
    human = new HumanCtor(config);
    await human.init();
    const activeBackend = human.tf?.getBackend?.();
    if (activeBackend !== "wasm") throw new Error("Requested WASM backend, but active backend is " + String(activeBackend));
    setStatus("WASM backend initialized.", "Loading face detector, mesh and description models…");
    await human.load();
    modelReady = true;
    setStatus("Runtime and configured models loaded.", "Verified backend: " + activeBackend + " · Human version: " + (human.version ?? "not exposed"));
    compareStatus.textContent = "Ready. Select two consented test images.";
    updateCompareEnabled();
  } catch (error) {
    modelReady = false;
    human = null;
    setStatus("Runtime/model initialization failed.", error instanceof Error ? error.message : String(error));
  } finally {
    loadButton.disabled = false;
  }
});

async function detectEmbedding(img) {
  const start = performance.now();
  const result = await human.detect(img);
  const elapsedMs = performance.now() - start;
  const face = result.face?.[0];
  if (!face) throw new Error("No face detected in this image.");
  if (!Array.isArray(face.embedding) || face.embedding.length === 0) {
    throw new Error("Face detected, but no embedding vector was returned.");
  }
  return { embedding: face.embedding, elapsedMs, faceScore: face.faceScore ?? null, boxScore: face.boxScore ?? null };
}

compareButton.addEventListener("click", async () => {
  if (!modelReady) return;
  compareButton.disabled = true;
  resultNode.hidden = true;
  compareStatus.textContent = "Detecting faces and extracting embeddings locally…";
  const started = performance.now();
  try {
    const [a, b] = await Promise.all([
      detectEmbedding(previewA),
      detectEmbedding(previewB),
    ]);
    if (a.embedding.length !== b.embedding.length) throw new Error("Embedding dimensions do not match.");
    const similarity = human.match.similarity(a.embedding, b.embedding);
    const record = {
      pairLabel: document.querySelector("#pair-label").value,
      similarity,
      distance: human.match.distance(a.embedding, b.embedding),
      dimensions: a.embedding.length,
      imageA: imageA.files[0].name,
      imageB: imageB.files[0].name,
      detectMsA: Number(a.elapsedMs.toFixed(2)),
      detectMsB: Number(b.elapsedMs.toFixed(2)),
      totalMs: Number((performance.now() - started).toFixed(2)),
      faceScoreA: a.faceScore,
      faceScoreB: b.faceScore,
      timestamp: new Date().toISOString(),
    };
    measurements.push(record);
    resultNode.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Pair result";
    const score = document.createElement("p");
    score.textContent = "Human library similarity: " + Number(similarity).toFixed(6);
    const distance = document.createElement("p");
    distance.textContent = "Distance: " + Number(record.distance).toFixed(6);
    const dimensions = document.createElement("p");
    dimensions.textContent = "Embedding dimensions: " + record.dimensions;
    const timing = document.createElement("p");
    timing.textContent = "Detection A: " + record.detectMsA + " ms · Detection B: " + record.detectMsB + " ms · Total: " + record.totalMs + " ms";
    resultNode.append(heading, score, distance, dimensions, timing);
    resultNode.hidden = false;
    compareStatus.textContent = "Embedding extraction and comparison completed. This score is not a verified identity decision or an approved threshold.";
    measurementsNode.textContent = JSON.stringify(measurements, null, 2);
    exportButton.disabled = false;
  } catch (error) {
    compareStatus.textContent = "Comparison failed: " + (error instanceof Error ? error.message : String(error));
  } finally {
    updateCompareEnabled();
  }
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ experiment: "M9 Face Embedding PoC", runtime: "@vladmandic/human@3.3.6", backend: "wasm", measurements }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "face-embedding-poc-measurements.json";
  anchor.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("beforeunload", () => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  try { human?.tf?.disposeVariables?.(); } catch { /* best-effort cleanup */ }
});
