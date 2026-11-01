# M9 — @haoking/opencvjs isolated runtime PoC

## Purpose

Evaluate `@haoking/opencvjs@4.0.0` as a candidate OpenCV/WebAssembly runtime without adding it to Mobile Freedom's dependency graph or changing production code.

Candidate upstream documentation says it is built from OpenCV 5.0.0, exposes ORB among its feature detectors, and provides a Promise-based `loadOpenCV()` entry point. Those statements are candidate-selection evidence only; this PoC must verify the actual installed runtime.

- Upstream repository: https://github.com/haoking/opencvjs
- Candidate package: `@haoking/opencvjs@4.0.0`
- Runtime: Node.js 22 in an isolated temporary directory on GitHub Actions.
- Application dependencies, lockfile, source code, and main branch are not modified.

## Runtime gates

1. **WASM readiness:** await the package loader and verify `cv.Mat`.
2. **ORB:** construct the detector and run `detectAndCompute` against a deterministic synthetic image; require non-empty descriptors and matching keypoint/descriptor counts.
3. **BFMatcher:** construct a Hamming matcher and run actual descriptor self-matching; require non-empty matches.
4. **RANSAC homography:** run `findHomography` with `cv.RANSAC` on known translated point pairs plus one deliberate outlier; require a valid homography and at least seven inliers from eight points.
5. **Memory discipline:** explicitly delete every created Mat, vector, matcher, and detector.

The workflow fails if any runtime gate fails. A package install or symbol listing alone is not a PASS.

## Explicitly not proven by this PoC

- Browser/Vite dynamic import and true on-demand lazy loading.
- Browser asset resolution, local/offline WASM loading, or absence of network requests during image processing.
- Mobile Android browser memory, speed, thermal behaviour, or large-file stability.
- M9 genuine crop positives, A1–A7 and repeated-texture negative controls, false-positive rate, or spatial-distribution acceptance.
- Video similarity.

Those are separate gates. This PoC cannot by itself approve the candidate for production or mark M9 complete.

## Decision rule

- **PASS:** all three algorithm runtime tests and WASM readiness pass. This only qualifies the candidate for the next browser/mobile feasibility stage.
- **FAIL:** any required API or real operation is unavailable or fails. Do not patch around missing algorithms or report a pass.
- No production dependency, source integration, PR merge, or main-branch change is authorized by this PoC.
