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

## HN-01 — Spatially Independent Evidence diagnostics

The browser probe now records per-RANSAC-inlier source/target coordinates, ORB keypoint scale and orientation, and descriptor distance. For each side it reports:

- Occupied-cell metrics at 4×4, 8×8 and 16×16 resolutions.
- Bounding-box area ratio and median nearest-neighbour distance.
- A diagnostic spatial-cluster count using a 24 px connectivity radius.
- Close-pair ratio within 12 px and overlapping-keypoint-window pair ratio based on keypoint scale.
- An inlier coordinate overlay on both hard-negative fixture images.
- The same diagnostics in the local-only real-photo JSON report when enough matches exist to estimate a homography.

These measurements help determine whether a high RANSAC inlier count is concentrated around one small shared logo. They do not prove statistical independence: cluster radius and overlap heuristics are diagnostic only. No grid size, minimum cluster count, or production classification threshold is selected automatically. Review the actual coordinate overlays and compare them with independently labelled ground truth before changing the matcher.

## What a successful workflow means

A successful workflow means the test matrix executed and diagnostics were produced. It does not establish correct real-world classification, acceptable false-positive/false-negative rates, Android performance, or M9 acceptance. Results must be reviewed and then validated with the project's broader A1–A7 and Android evidence.

## Browser execution

The isolated GitHub Actions workflow installs the pinned package, starts Vite, runs Chromium, and uploads the JSON diagnostics and screenshot as an artifact.

## Real-photo and Android-device validation

The page also provides a manual **local-only** photo pair test for a real Android/browser device.

1. Open the isolated browser probe on the Android phone after the CI workflow succeeds.
2. Select Photo A and Photo B from the device using the file picker.
3. Choose the independently known relationship: genuine crop, unrelated photos, or same object/different photo.
4. Tap **Run local validation ×3**.
5. Download the JSON diagnostics and share that JSON report for analysis. The report omits file names and image bytes.

Privacy guarantees for this experimental page:
- The selected files are read by the browser using local object URLs and decoded into in-memory canvases.
- No image upload endpoint, network request, or server storage is used for the selected photos.
- Only aggregate image metadata (MIME type, byte size, dimensions) and algorithm metrics are included in the downloadable JSON. File names and image contents are excluded.
- Each image is limited to 25 MiB and normalized in memory to 640×480 before analysis.
- Do not select sensitive/private photos if you are not comfortable testing them on the device. Synthetic images remain an option.

### Android performance evidence

The local report records three processing durations, average/median/min/max, browser/device capability hints, and JS heap readings only when the browser exposes them. Browser timing includes ORB feature extraction, KNN/Lowe matching, and RANSAC. JS heap readings are not total WASM/native memory and are not a substitute for OS-level memory profiling.

Record the Android phone model and Android/browser version separately when reporting results; user-agent/device hints may not reliably identify the exact model. Run the test after a fresh page load, and avoid other heavy apps if possible. Do not compare timings across different devices as if they were equivalent.

### Ground-truth discipline

Only label a pair as a genuine crop when Photo B was actually cropped from Photo A. For negative controls, use genuinely unrelated photos or the same object photographed separately. A manually chosen relationship label is ground truth supplied by the tester, not an algorithm prediction. The tool intentionally does not classify or approve the pair; it reports metrics for review.

Real-photo testing on the user's device is a manual step. CI success validates the harness only, not the user's private photo results or Android performance.
