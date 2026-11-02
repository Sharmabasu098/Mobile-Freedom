# M9 Multi-view Matching PoC

## Purpose
Independently evaluate whether the object-matching pipeline recognizes the same physical object across different camera angles, while rejecting visually similar but different objects/scenes.

This PoC is an experiment only. It does not add matching to production and does not approve the Face Embedding PoC.

## Isolation
- Branch: `m9-multiview-matching-poc`
- Base: `main`
- No production imports, UI wiring, or changes to `main`.
- Keep object fixtures, OpenCV/WASM runtime, parameters, tests, and reports inside this PoC.
- Preserve the earlier ORB false-positive controls as negative cases; do not weaken them to improve positive recall.

## Candidate pipeline
Start with the existing OpenCV.js/ORB + Hamming descriptor matching + ratio filtering + RANSAC homography approach, but first prove every OpenCV operation and Embind vector access independently in the browser runtime. Evaluate alternate feature families only as separately labeled experiments. Do not assume planar homography is sufficient for strongly non-planar objects or large viewpoint changes.

## Experimental protocol
1. Build a labeled dataset with multiple views of the same physical object, grouped by object identity and capture session.
2. Include positive pairs across small, medium, and large viewpoint changes; also include scale, crop, resize, and compression changes.
3. Include hard negatives: different objects with similar appearance, different scenes with repeated textures, and the prior A6/A7 false-positive cases.
4. Split by physical object/capture session so near-identical frames cannot leak across calibration and test sets.
5. Log every stage independently: image decode/preprocess, keypoint detection, descriptor generation, matcher creation, match/vector extraction, ratio filtering, homography, RANSAC mask, geometric validation, final decision.
6. Keep parameters and input fixtures identical when comparing implementations.

## Required measurements
- Same-object recall by viewpoint-angle band and transformation type.
- Different-object false-positive rate, precision, and F1.
- Keypoints/descriptors per image; raw matches; ratio-filtered matches; RANSAC inliers and inlier ratio.
- Homography success/failure, reprojection error, projected-boundary validity, and spatial distribution of inliers.
- Per-case latency, memory use, and mobile-browser runtime stability.
- Explicit results for all A1-A7 regression fixtures, including resized/compressed positives and A6/A7 hard negatives.

## Acceptance gate (not yet passed)
Do not mark this PoC PASS until:
- the exact browser/WASM runtime and every required OpenCV operation are proven by executable tests;
- same-object recall is measured across the defined angle bands;
- hard-negative false positives remain within a project-owner-approved limit;
- all A1-A7 regressions pass without hiding failures or relaxing negative controls;
- results are reproducible on the target Android browser.

No numeric accuracy threshold is invented in advance; propose it only after the dataset and intended use are documented. A good result here does not approve any other M9 capability.
