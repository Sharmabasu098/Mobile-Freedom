# M9 False-Positive Verification Plan (A1–A7)

**Scope:** PR #9 crop/similar-photo detection only.  
**Status:** Test plan prepared; execution evidence is pending.  
**Safety:** This plan does not modify, upload, overwrite, or delete selected user photos. Image analysis must remain local in the browser.

## Objective

Verify that unrelated images are not reported as similar, including the difficult case where two unrelated images have the same whole-image difference hash (dHash). Genuine crop positives are covered separately by `M9_CROP_DETECTION_TEST_SPEC.md` and `similarPhotos.crop.test.ts`.

## Test setup and rules

1. Run each pair as an isolated check with exactly two image files selected.
2. Use valid PNG or JPEG files, each non-empty and below the 20 MiB limit.
3. Record the exact filenames, dimensions, MIME types, and file sizes for every run.
4. Do not use two files that are actually crops, resized copies, re-encodes, or edits of the same source in a negative test.
5. Expected result for every A1–A7 test: **0 similar-photo pairs**.
6. Record the app's result count and any failed-image count. A decoding failure is not a pass; both files must be successfully checked.
7. Repeat each manual pair three times. The result must remain 0 pairs on all runs.

## Negative-control matrix

| ID | Pair to test | Dataset requirements | Expected |
|---|---|---|---|
| A1 | Two unrelated natural scenes | Different source photographs and different scenes, e.g. forest vs. beach | 0 pairs |
| A2 | Two unrelated portraits | Different people/subjects and independently captured photos; avoid same-session burst images | 0 pairs |
| A3 | Two unrelated landscapes | Different locations or clearly different scene layouts | 0 pairs |
| A4 | Similar dominant colours, unrelated content | Choose images with similar overall colour palette but different objects/composition | 0 pairs |
| A5 | Similar background, unrelated foreground/content | Similar plain wall/sky/background, but different subjects and independently captured images | 0 pairs |
| A6 | Original plus tiny detail crop | Use a crop containing only a small detail from the original; confirm the crop area ratio is below the engine's 8% minimum | 0 pairs |
| A7 | Unrelated images with identical whole-image dHash | Use a deterministic generated fixture pair whose full-image dHash values are exactly equal, while the scenes and sampled local regions are unrelated | 0 pairs |

## A7 — mandatory dHash-only rejection test

A7 is not satisfied by choosing two random photographs that happen to look different. It must prove the exact hash condition:

- Calculate the whole-image dHash of fixture A and fixture B using the same production 9×8 sampling and grayscale conversion.
- Assert that the two 64-bit whole-image hashes are exactly equal.
- Assert that the images are independently generated/unrelated and are not crop derivatives of one another.
- Run `findSimilarPhotos([fixtureA, fixtureB])`.
- Assert that the result contains **0 pairs**.
- Also assert that neither image failed to decode.

The fixture should be deterministic and committed as generated pixel data or generated in the test. Do not weaken the assertion or silently skip A7 if a fixture does not satisfy the equal-hash precondition.

## Evidence record

Complete this table after each run. Use the GitHub Actions run URL for automated evidence and screenshots for real-device evidence.

| ID | Files / fixture IDs | Full dHashes equal? | Images checked | Similar pairs | Failed images | Result / evidence |
|---|---|---:|---:|---:|---:|---|
| A1 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A2 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A3 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A4 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A5 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A6 | Pending | N/A | Pending | Pending | Pending | NOT RUN |
| A7 | Pending | Must be YES | Pending | Pending | Pending | NOT RUN |

## Pass criteria

- A1–A7 each return exactly 0 similar-photo pairs.
- Both files are successfully decoded in every test.
- A7 proves equality of the two whole-image dHashes before testing the pair.
- Automated tests pass in GitHub Actions.
- Manual A1–A7 checks pass on the Android device using the PR preview/build under test.
- No production code or threshold is changed merely to make this negative suite pass; all genuine crop regression tests must continue to pass.

**Important:** Passing this negative suite alone does not make M9 PASS. Genuine crop positives, production build, and real-device verification remain required. PR #9 must remain unmerged until the project owner explicitly approves merging.
