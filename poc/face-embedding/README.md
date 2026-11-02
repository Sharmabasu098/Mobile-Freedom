# M9 Face Embedding PoC — Browser Runtime

## Runtime harness prepared
- Pinned browser runtime: `@vladmandic/human@3.3.6` (IIFE build).
- Backend: TensorFlow.js WASM, pinned to 4.10.0 to align with the Human 3.3.6 runtime line.
- Enabled pipeline: face detector with rotation, face mesh, face description/embedding.
- Disabled unrelated models: body, hand, object, segmentation, emotion, iris, anti-spoof and liveness.
- Pair harness: two local image inputs, explicit ground-truth pair label, embedding dimensions, library similarity/distance, detection timings, JSON export.
- Input guard: image MIME type and 15 MB per-image limit.

## Run
Serve this directory over HTTP(S), for example:
```sh
python3 -m http.server 8080
```
Then open `/poc/face-embedding/` in a modern browser. HTTPS or localhost is required for browser security features. Press **Load face models**, then select two consented test images and compare.

## Network and privacy boundary
The pinned JS runtime, WASM backend files, and model weights are fetched from versioned jsDelivr package URLs. Selected image pixels are passed to the browser runtime and are not uploaded by this PoC. This CDN-backed configuration is not the final offline/privacy-hardened state. The next hardening step is to vendor and checksum-pin the runtime/model assets under the repository and prove that the page runs offline. Model caching may use browser storage.

No image data or embedding vectors are included in the JSON export. The export contains pair label, score, distance, vector dimension, filenames, face confidence metadata and timings only. Filenames can still be identifying; store exports carefully.

## Experimental limits
- This is a runtime smoke-test harness, not a benchmark result.
- A single pair cannot establish accuracy or a decision threshold.
- Do not treat the library's similarity value as a probability.
- Build a consented, session-separated calibration and held-out dataset before reporting FAR, FRR, ROC/AUC or EER.
- No biometric identity verification, access-control, surveillance, or consequential decision use.
- No production integration and no M9 acceptance implied.

## Upstream references
- Human library and browser compatibility: https://github.com/vladmandic/human
- Embedding and similarity API: https://github.com/vladmandic/human/wiki/Embedding
- Versioned package: https://www.npmjs.com/package/@vladmandic/human
