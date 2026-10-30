# M9 Crop Detection — Test Specification

**Project:** Mobile Freedom — The Essential Mobile Toolkit  
**Milestone:** M9 — Duplicate Photo & Video Analyzer  
**Branch:** `m9-crop-detection-tests`  
**Status:** Multi-scale region hashing implemented; positive crop regression cases are enforced as normal tests. CI verification pending.

## Purpose

Define reproducible tests for detecting candidate photos derived from an original image after cropping and common image transformations. These tests use synthetic images only. Similarity is a candidate signal, not proof that two files are identical or depict the same real-world subject.

## Synthetic fixture set

The automated crop regression tests now generate deterministic in-memory rasters and derive each crop by copying a real rectangle from the same source pixel buffer. The downloadable ZIP remains a separate manual test set.

- `01_original_scene.png` — reference image.
- `02_crop_25_percent.png` — moderate crop.
- `03_crop_50_percent.png` — stronger crop around the central subject.
- `04_crop_left_edge.png` — left-biased crop.
- `05_crop_right_edge.png` — right-biased crop.
- `06_resized_crop.png` — resized crop.
- `07_compressed_crop.jpg` — JPEG-compressed crop (manual fixture; automated test currently checks the JPEG MIME path with a geometry-preserving raster mock, not actual JPEG encoder artifacts).
- `08_brightness_crop.png` — brightened crop.
- `09_unrelated_scene.png` — negative control.
- `10_tiny_detail_crop.png` — very small detail crop / conservative edge case.

The fixture images are procedurally generated. No personal photos or external images are used.

## Functional test cases

| ID | Input pair / scenario | Expected behavior |
|---|---|---|
| M9-CROP-001 | Original + 25% crop | Return a similar-photo candidate. |
| M9-CROP-002 | Original + 50% crop | Return a candidate when enough shared visual content remains. |
| M9-CROP-003 | Original + left-edge crop | Return a candidate when shared content is sufficient. |
| M9-CROP-004 | Original + right-edge crop | Return a candidate when shared content is sufficient. |
| M9-CROP-005 | Original + resized crop | Return a candidate. |
| M9-CROP-006 | Original + compressed crop | Return a candidate. |
| M9-CROP-007 | Original + brightness-adjusted crop | Return a candidate if visual overlap remains sufficient. |
| M9-CROP-008 | Original + unrelated scene | Do not return a candidate. |
| M9-CROP-009 | Original + tiny detail crop | Do not force a match; classify as insufficient evidence / no confident candidate. |
| M9-CROP-010 | Batch containing valid images and one invalid/unsupported image | Report the invalid file and continue processing valid files. |
| M9-CROP-011 | Multiple crop variants from the same original | Return expected original-to-variant candidates without requiring every variant-to-variant pair. |
| M9-CROP-012 | Same inputs processed repeatedly | Results must be deterministic. |

## Safety and regression tests

1. All image analysis remains local in the browser; no upload/network transfer is introduced.
2. The analyzer never deletes, renames, or modifies selected files.
3. A failed image does not stop processing of the remaining valid images.
4. Existing exact duplicate detection (SHA-256) behavior remains unchanged.
5. Existing non-crop similar-photo behavior and error handling remain covered by the current test suite.
6. Invalid thresholds and unsupported image formats continue to be rejected safely.
7. Similarity output must be described as an estimate/candidate, never proof of identity.

## Acceptance criteria for this test work

- Every functional case above is represented by an automated test or a clearly documented manual-only limitation.
- Positive crop cases pass without making the unrelated negative control pass.
- The tiny-crop case does not produce an overconfident match.
- Existing storage tests and the full configured CI test command pass.
- No milestone PASS status is implied by preparing this specification alone.

## Current known baseline

The current `similarPhotos.ts` implementation creates one 64-bit dHash from a 9 × 8 downscaled image and compares global hash Hamming distance. It does not currently perform region/patch matching, so cropped variants may not match the original. This is the gap the tests are intended to expose and guide.

## Next implementation stage

Validate the multi-scale matcher against every positive crop case and the negative controls in CI. Then add browser-level JPEG encode/decode coverage; the current Vitest mock validates pixel geometry and JPEG MIME handling but does not simulate JPEG quantization. The current Vitest mock validates source/crop pixel geometry and resize/brightness transformations, but does not simulate JPEG quantization. Preserve the current API or document any necessary API change before integration.
