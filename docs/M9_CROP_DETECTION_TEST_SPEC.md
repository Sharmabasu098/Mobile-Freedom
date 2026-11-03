# M9 Crop Detection — Test Specification

**Project:** Mobile Freedom — The Essential Mobile Toolkit  
**Milestone:** M9 — Duplicate Photo & Video Analyzer  
**Branch:** `m9-crop-detection-tests`  
**Status:** Multi-scale region hashing implemented; positive crop regression cases and an equal-whole-image-dHash negative control are represented in automated tests. Full CI, actual JPEG encoder coverage, manual A1–A7 evidence, and Android verification remain separate acceptance items.

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

The fixture images are procedurally generated. No personal photos or external images are used. The JPEG-named automated fixture currently exercises the JPEG MIME path with a raster mock; it is not a true JPEG encode/decode test.

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

The current `similarPhotos.ts` implementation creates a whole-image 64-bit dHash and average-threshold hash, then samples multi-scale regions from each decoded image. It compares a candidate image against source-image regions using dHash distance, average-hash distance, and relative aspect geometry. The implementation also computes spatially independent candidate regions, but currently accepts a direction based on its single best matching region; the independent-region count is diagnostic rather than an acceptance gate. This is a known false-positive risk that must be resolved against genuine-crop positives and negative controls before production use.




## Single-region hard-negative stress experiment — 2026-11-03

**CI run:** `41667454247` — SUCCESS  
**Automated suite:** 10 test files, 125 tests passed.

Five additional deterministic, independently generated hard-negative pairs were processed through the production descriptor generation and candidate filters:

| Hard-negative scenario | Matching candidate regions | Current one-region decision |
|---|---:|---|
| Similar dominant colours, different texture | 0 | Reject |
| Same broad background, different foreground subjects | 0 | Reject |
| Different stylized portraits | 0 | Reject |
| Same object class (mug), different synthetic compositions | 0 | Reject |
| Unrelated scenes with a small shared local texture patch | 0 | Reject |

**Observed result:** 0/5 hard-negative pairs were accepted by the current single-region rule. Both directions had zero matching regions in all five pairs.

**Interpretation and limitations:** This is a useful synthetic stress result, not a real-photo false-positive rate. The scenes are generated 96×72 rasters and the portrait/object cases are stylized approximations. The shared patch test checks a small repeated local texture but does not represent every possible coincidental region. Real camera photographs, diverse image sizes, compression, blur, rotation, and a broader hard-negative corpus remain untested here. Do not extrapolate 0/5 to a production accuracy guarantee.

**Decision:** Keep the current single-region rule and threshold unchanged for now. The prior positive experiment showed all 7/7 genuine synthetic crop fixtures have only one independent matching region, so a strict two-region rule would reject all those positives. The new 5/5 synthetic hard negatives were rejected even under the current rule. Continue expanding difficult controls and validating the real-photo A1–A7 evidence before considering any classification change.

## Controlled spatial acceptance experiment — 2026-11-03

**CI run:** `41666038672` — SUCCESS  
**Automated suite:** 10 test files, 124 tests passed.

The experiment uses the exact production descriptor generation, candidate filters, geometry checks, and IoU-based spatial non-maximum suppression. It reports the current one-region decision and a counterfactual two-independent-region decision without changing production acceptance.

| Pair | Current one-region rule | Independent matching regions | Counterfactual ≥2 rule |
|---|---:|---:|---:|
| Genuine 25%-named crop fixture | Accept | 1 | Reject |
| Genuine 50%-named crop fixture | Accept | 1 | Reject |
| Genuine left-edge crop | Accept | 1 | Reject |
| Genuine right-edge crop | Accept | 1 | Reject |
| Genuine resized crop | Accept | 1 | Reject |
| JPEG-MIME raster mock crop | Accept | 1 | Reject |
| Brightness-adjusted crop | Accept | 1 | Reject |
| Unrelated generated scene | Reject | 0 | Reject |
| Tiny detail crop | Reject | 0 | Reject |
| A7 equal-whole-image-dHash collision | Reject | 0 | Reject |

**Observed result:** 7/7 synthetic genuine positives have exactly one independent matching region in the current fixture set. The three automated negative controls have zero matching regions; no accidental one-region negative candidate was observed in these controls.

**Decision:** Do not introduce a two-independent-region acceptance requirement. On the current positive fixture set, that rule would reject all 7 genuine positives (7 false negatives). The experiment does not prove that one-region matching is safe in general: only three synthetic negative controls were measured, and real-photo A1–A6 evidence remains separate. Keep the current acceptance behavior unchanged while expanding difficult negative controls and real-photo evidence.

The diagnostic API `analyzeCropPairSpatialEvidence` is measurement-only. It exposes candidate counts and counterfactual decisions for tests; it does not modify `findSimilarPhotos` behavior, thresholds, or selected files.

## Latest automated verification evidence

**Run:** M9 Storage Regression Suite, commit `8bfb763cf325f975f862b198ab5d4fcc7dbc7221`  
**Result:** SUCCESS

- Vitest: 10 test files passed; 122 tests passed.
- TypeScript and production build: passed.
- Production artifact check: passed.
- Spatial diagnostic tests: overlapping windows collapse to one evidence cluster; separated windows remain independent; mixed windows produce two clusters.
- Chromium real-JPEG test: source PNG encoded at 105,599 bytes; browser-generated JPEG crop encoded at 16,875 bytes; MIME `image/jpeg`; decoded dimensions 240×180; no decode errors; engine returned one candidate with dHash distance 1 (98% score).

The browser test uses actual Chromium Canvas JPEG encoding and `createImageBitmap` decoding, so it covers JPEG quantization for this deterministic synthetic crop. It does not establish accuracy across arbitrary camera photos, devices, JPEG qualities, rotations, noise, or repeated recompression.

The spatial tests verify the independent-region selector's clustering behavior in isolation. They do **not** show that spatial independence currently affects the production classification decision: the matcher still selects `candidates[0]` and returns `matches: 1`. The helper is diagnostic only; acceptance logic and thresholds were not changed.

## Next implementation stage

Validate the multi-scale matcher against every positive crop case and the negative controls in CI. Then add browser-level JPEG encode/decode coverage; the current Vitest mock validates pixel geometry and JPEG MIME handling but does not simulate JPEG quantization. The current Vitest mock validates source/crop pixel geometry and resize/brightness transformations, but does not simulate JPEG quantization. Preserve the current API or document any necessary API change before integration.
