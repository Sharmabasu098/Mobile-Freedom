# M9 — @banou/opencv-wasm isolated runtime PoC

## Candidate rationale

Candidate: `@banou/opencv-wasm@0.0.6`, upstream repository https://github.com/banou26/opencv-wasm.

Upstream documentation describes OpenCV 5.0.0 plus opencv_contrib compiled to WASM, generated native bindings, explicit ORB factories, BFMatcher and RANSAC homography usage, and real Node/Chromium execution tests. Its published execution inventory specifically includes ORB descriptors and a package-consumer Vite/Chromium test. These claims justify testing this candidate; they do not replace our independent runtime checks.

## Isolation

The workflow installs the exact package version in `$RUNNER_TEMP/m9-banou-poc`. It does not modify the Mobile Freedom package manifest, lockfile, source code, or main branch.

## Runtime gates

1. Await `initOpenCV()` and verify the initialized runtime.
2. Call `ORB_create(800)`, execute `detectAndCompute` on deterministic synthetic pixels, and require non-empty descriptors with one row per keypoint.
3. Execute `BFMatcher(NORM_HAMMING, true).match` on those real descriptors and require matches.
4. Execute `findHomography(..., RANSAC, ...)` on seven known translated correspondences plus one outlier; require a valid homography and at least seven inliers.
5. Explicitly dispose native resources.

The workflow fails on any failed gate. Export presence alone is not sufficient.

## Not established by this PoC

Browser lazy-loading in Mobile Freedom/Vite, browser asset URL configuration, offline/local-only operation, Android memory/performance, genuine crop positive/negative accuracy (including A1–A7 and repeated textures), production privacy behaviour, or video similarity.

## Decision

A full runtime PASS only qualifies this candidate for a separate browser/Vite and mobile feasibility stage. It does not authorize production integration, PR merge, or M9 completion. Any failure rejects the tested package version until independently resolved and retested.
