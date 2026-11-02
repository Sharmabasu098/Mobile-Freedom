# M9 Face Embedding PoC — Browser Runtime

## Runtime harness prepared
- Pinned browser runtime: `@vladmandic/human@3.3.6` (IIFE build).
- Backend: TensorFlow.js WASM, pinned to 4.22.0 to align with the Human 3.3.6 runtime line.
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

## Browser runtime evidence — one test pair
A browser run was completed in the isolated `m9-face-embedding-poc` branch. The on-page runtime status and exported JSON showed:

| Check / measurement | Observed result |
| --- | --- |
| Human runtime | Loaded; version `3.3.6` |
| TensorFlow.js backend | `wasm` (reported as verified by the harness) |
| Face detection | Both images detected a face; face scores `1` and `1` |
| Embedding | Non-empty embedding comparison completed; vector dimension `1024` |
| Similarity | `1.000000` |
| Distance | `26.76` |
| Detection A / B | `1180.2 ms` / `1178.7 ms` |
| Total measured time | `1181.4 ms` |
| Pair label | `same` |

The exported measurement timestamp was `2026-11-02T02:23:59.772Z`.

**Technical smoke-test outcome:** the five required runtime operations were exercised successfully in this run: (1) Human runtime/model initialization, (2) WASM backend initialization, (3) face detection on both inputs, (4) 1024-dimensional embedding extraction, and (5) similarity/distance calculation.

This is evidence of one successful browser execution only. It is not a repeatability study, benchmark, accuracy evaluation, or proof of a safe identity threshold. The similarity score is not a probability. A score of `1.0` for this pair does not establish general matching accuracy.

## Network and privacy boundary
The pinned JS runtime, WASM backend files, and model weights are fetched from versioned jsDelivr package URLs. Selected image pixels are passed to the browser runtime and are not uploaded by this PoC. This CDN-backed configuration is not the final offline/privacy-hardened state. The next hardening step is to vendor and checksum-pin the runtime/model assets under the repository and prove that the page runs offline. Model caching may use browser storage.

No image data or embedding vectors are included in the JSON export. The export contains pair label, score, distance, vector dimension, filenames, face confidence metadata and timings only. Filenames can still be identifying; store exports carefully.

## Experimental limits and status
- This is a runtime smoke-test harness, not a benchmark result.
- Only one pair has been exercised; a single pair cannot establish accuracy, repeatability, generalization, or a decision threshold.
- Do not treat the library's similarity value as a probability.
- Build a consented, session-separated calibration and held-out dataset before reporting FAR, FRR, ROC/AUC or EER.
- No biometric identity verification, access-control, surveillance, or consequential decision use.
- No production integration. These runtime checks do **not** constitute M9 milestone acceptance.
- Multi-view Matching remains on hold pending explicit review and approval of this evidence and its next test plan.

## Upstream references
- Human library and browser compatibility: https://github.com/vladmandic/human
- Embedding and similarity API: https://github.com/vladmandic/human/wiki/Embedding
- Versioned package: https://www.npmjs.com/package/@vladmandic/human
