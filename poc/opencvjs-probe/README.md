# Isolated OpenCV.js Expanded Crop Benchmark

This experiment is restricted to the `m9-multiview-matching-poc` branch. It does not change production code or the locked roadmap.

## Safety and interpretation

- All fixtures are generated deterministically in the browser; no personal photos are uploaded or required.
- No automatic deletion or production integration is performed.
- The benchmark reports evidence only. No production threshold is selected and no M9 PASS is declared.
- The root application dependencies are not changed by this isolated probe.
- Same-object/different-photo cases are hard negatives for **crop detection**: the same illustrated object is rendered into different scenes at different locations, scales and rotations. They are synthetic stress fixtures, not real-world photographs.

## Registered test matrix

### Genuine crops
A single deterministic original scene is compared with crops retaining 50%, 65%, and 80% of the original image area. Each retained-area level is tested at five positions: center, top-left, top-right, bottom-left, and bottom-right. This creates 15 positive crop cases.

### Negative controls
- Five unrelated deterministic scenes, each generated with a separate fixed seed.
- Two same-object/different-photo hard negatives. The same distinctive illustrated object is placed into independently generated scenes with different position, scale, and rotation.

There are 22 unique image-pair cases in total. Every case is evaluated three times (66 evaluations).

## Fixed parameters

- Image size: 640×480
- ORB maximum features: 1600
- Lowe ratio: 0.75
- RANSAC reprojection threshold: 3.0
- Spatial grid: 4×4
- Fixed fixture seeds and OpenCV RNG seed (where supported)

## Metrics and error analysis

Each evaluation records ORB keypoints/descriptors, KNN groups, Lowe accepted matches, RANSAC homography/inliers/inlier ratio, source/target spatial coverage, cleanup status, and errors.

An exploratory threshold sweep emits confusion counts (TP/FP/TN/FN), precision, recall, and false-positive rate across a grid of inlier-ratio, inlier-count, and spatial-coverage cutoffs. These configurations are diagnostic probes only. They must not be selected as production thresholds from this synthetic dataset.

Repeatability output reports per-case values across three runs and the observed inlier-ratio range.

## What a successful workflow means

A successful workflow means the test matrix executed and diagnostics were produced. It does not establish correct real-world classification, acceptable false-positive/false-negative rates, Android performance, or M9 acceptance. Results must be reviewed and then validated with the project's broader A1–A7 and Android evidence.

## Browser execution

The isolated GitHub Actions workflow installs the pinned package, starts Vite, runs Chromium, and uploads the JSON diagnostics and screenshot as an artifact.
