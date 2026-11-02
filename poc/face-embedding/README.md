# M9 Face Embedding PoC

## Purpose
Independently evaluate whether an on-device face-embedding pipeline separates:
- different images of the same consenting test participant (genuine pairs);
- images of different consenting participants (impostor pairs).

This PoC is an experiment only. It does not add face matching to production and does not approve the Multi-view Matching PoC.

## Isolation
- Branch: `m9-face-embedding-poc`
- Base: `main`
- No production imports, UI wiring, or changes to `main`.
- Keep face-specific dependencies, fixtures, tests, thresholds, and reports inside this PoC.
- No face images or embeddings may be uploaded to a remote service. Use only consented, locally held test images; do not commit real face images or biometric embeddings.

## Candidate pipeline
Evaluate a browser-compatible embedding runtime separately from OpenCV ORB. Initial candidate for investigation: `@vladmandic/human` face description/embedding in browser WASM/WebGL. Verify actual model loading, descriptor generation, deterministic output, and mobile-browser execution before considering it viable. Compare against an ArcFace ONNX + ONNX Runtime Web route only if the first candidate fails or evidence warrants it.

## Experimental protocol
1. Use a consented, labeled dataset with multiple sessions/conditions per participant; split by capture session, not random near-duplicate frames.
2. Generate genuine pairs (same participant, different captures) and impostor pairs (different participants).
3. Record face-detection failure separately from embedding/matching failure.
4. Normalize embeddings consistently and calculate cosine similarity and/or the runtime's documented distance.
5. Sweep thresholds on a calibration split; report results on a held-out split. Never choose a threshold from the test split.
6. Include varied lighting, pose, expression, image quality, scale, and occlusion; report each condition separately.

## Required measurements
- Genuine-pair and impostor-pair counts.
- Detection/embedding success rate.
- Genuine and impostor score distributions, including overlap.
- ROC curve / AUC and equal-error rate (EER).
- False Acceptance Rate (FAR), False Rejection Rate (FRR), and True Acceptance Rate at explicitly stated FAR operating points.
- Per-condition results, latency, memory use, and mobile-browser runtime stability.
- Confusion matrix at the selected calibration threshold.

## Acceptance gate (not yet passed)
Do not mark this PoC PASS until:
- the runtime and model load locally in the target browser;
- all metrics above are produced from a reproducible held-out test;
- a threshold is selected from calibration data and independently evaluated;
- the project owner approves the measured operating point and privacy constraints.

No numeric accuracy threshold is invented in advance; propose it only after dataset size, intended use, and measured score distributions are documented. A good result here does not approve any other M9 capability.
