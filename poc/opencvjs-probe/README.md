# Isolated OpenCV.js Crop Benchmark

This experiment is restricted to the `m9-multiview-matching-poc` branch. It does not change production code or the locked roadmap.

## Safety boundaries

- All fixtures are generated deterministically in the browser; no personal photos are uploaded or required.
- No automatic deletion or production integration is performed.
- The benchmark reports evidence and metrics only. It does not choose a production threshold or declare M9 PASS.
- The root application dependencies are not changed by this isolated probe.

## Repeatable benchmark cases

One deterministic original scene is compared with three center crops made from that exact scene. The percentages mean **retained image area**, not the amount removed:

- 50% retained area
- 65% retained area
- 80% retained area

A fourth case compares the original scene with a separately generated deterministic unrelated scene as the negative control.

The generated scenes use fixed seeds, dimensions, and fixture-generation logic. ORB feature count, Lowe ratio, RANSAC reprojection threshold, and spatial grid are recorded in every run. The OpenCV RNG seed is applied before each RANSAC call when the runtime exposes `setRNGSeed`.

## Metrics recorded per case

- ORB keypoint counts and descriptor availability
- KNN group count and Lowe-ratio accepted correspondences
- RANSAC homography result, inlier count, and inlier ratio
- 4×4 spatial grid occupancy and inlier bounding-box area for source and target points
- Cleanup status and per-case errors

## Interpretation

A clean workflow means the benchmark executed and produced diagnostics. It does **not** mean genuine crops were correctly classified, unrelated images were rejected, or the M9 acceptance criteria passed. Results must be reviewed across repeated runs and later validated against the project's A1–A7 and Android test evidence.

## Browser run

The isolated GitHub Actions workflow installs the pinned package, starts Vite, runs Chromium, and uploads the JSON diagnostics and screenshot as a workflow artifact.
