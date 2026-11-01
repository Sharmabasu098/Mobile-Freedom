# M9 Spatial Verification — Technical Decision

**Status:** Design decision / implementation gate  
**Scope:** M9 similar-photo false-positive protection  
**Production status:** Not implemented; no similarity result may be described as spatially verified yet.

## 1. Problem confirmed in current implementation

The current multi-scale perceptual-hash matcher uses dHash, average hash, and aspect-ratio filtering. It computes spatially independent candidate windows for diagnostics, but the acceptance path still chooses `candidates[0]` and returns a match when only one region qualifies. The independent-region count is not an acceptance condition. Perceptual hashes are useful candidate filters, not geometric proof.

The existing crop regression suite must remain unchanged and passing. Its synthetic raster fixtures cover 25%, 50%, left-edge, right-edge, resized, JPEG-MIME, and brightness-adjusted crops. A7 asserts an exact whole-image dHash collision between unrelated generated fixtures and expects no pair.

## 2. Decision

Use a two-stage design:

1. **Candidate stage:** retain the existing multi-scale perceptual hashes as a cheap candidate generator. Hash agreement alone must never produce a final "similar" result.
2. **Verification stage:** use local keypoint/descriptor correspondences and robust geometric estimation (ORB + descriptor ratio filtering + RANSAC homography, or an equivalent validated implementation). Verify inlier count/ratio, spatial distribution, reprojection error, and projected crop geometry before accepting a pair.

A crop is verified by mapping the crop's matched features into a coherent region of the source image. Do not require two non-overlapping hash windows: that heuristic can reject valid crops and is not geometric verification.

If there are too few features, degenerate geometry, poor spatial coverage, or unstable transformation, return an explicit insufficient-evidence outcome internally and do not report a positive pair.

## 3. Runtime and dependency feasibility findings

The repository currently uses Vite 6, TypeScript 5.8, and has no computer-vision dependency. The npm package `@opencvjs/web` exposes a browser loader and TypeScript declarations, but the inspected npm metadata reports an unpacked package size of 11.4 MB and only 163 weekly downloads at the time of review. This is a material mobile-first bundle/runtime risk and is not enough evidence of reliable Android browser performance.

Other OpenCV.js distributions surfaced in research also ship multi-megabyte JavaScript/WASM assets. Loading OpenCV from a remote CDN at runtime is not acceptable because M9 analysis must remain local and must not depend on network access after the app loads.

**Go/no-go:** Do not add an OpenCV package to production dependencies yet. First run a bounded proof-of-concept in an isolated feature branch or test harness to establish:
- exact ORB, descriptor matcher, and RANSAC APIs available in the selected build;
- WASM asset size and actual production bundle impact;
- lazy-loading behavior (load only when similar-photo analysis is requested);
- deterministic browser testability;
- Android browser decode/compute/memory behavior using a small, controlled sample;
- all processing remains local, with no upload or external runtime fetch.

If the package cannot meet the bundle and mobile constraints, evaluate a smaller maintained implementation or a custom narrowly-scoped WASM build. Do not replace geometric verification with a weaker hash-window heuristic.

## 4. Required verification rules

A candidate must pass all of the following, with thresholds calibrated on fixtures rather than guessed:
- enough descriptor correspondences after a nearest-neighbour ratio test;
- robust RANSAC model estimation with a non-degenerate transform;
- sufficient inlier count and inlier ratio;
- inliers distributed across multiple spatial cells in both images (not concentrated in one repeated texture patch);
- acceptable reprojection error;
- projected crop polygon lies within the source bounds and has plausible area/aspect geometry;
- deterministic output for the same input pair.

A single small matching patch, repeated texture, similar colours, or a dHash collision must not be enough.

## 5. Regression gate

All existing crop positives must continue to pass:
- original + 25% crop;
- original + 50% crop;
- original + left-edge crop;
- original + right-edge crop;
- resized crop;
- brightness-adjusted crop;
- JPEG decode/encode fixture with real compression artifacts.

All negative controls must return no verified pair:
- unrelated natural scenes, portraits, and landscapes;
- similar palette but unrelated content;
- similar background with unrelated foreground;
- tiny detail crop below the configured evidence threshold;
- A7 exact whole-image dHash collision;
- repeated-pattern / accidental-feature-match fixtures.

Tests must also cover insufficient/degenerate features and per-file decode errors without aborting the batch.

## 6. Performance, privacy, and safety

- Process selected image pixels locally only.
- Do not upload images, hashes, descriptors, or thumbnails.
- Do not log filenames, image hashes, descriptors, or personal image metadata.
- Bound decoded dimensions, keypoint count, per-pair work, and memory.
- Release OpenCV/WASM matrices and image bitmaps in `finally` blocks.
- Lazy-load the verification engine; avoid blocking the main UI thread where feasible.
- No automatic deletion or modification of selected files.
- Similarity remains a review candidate, never proof of identity.

## 7. Completion criteria

This design document is not an implementation and does not make M9 PASS. Implementation may be considered only after the runtime feasibility gate is met. M9 remains incomplete while video similarity is also absent from the product scope.
