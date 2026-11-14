# M9 — Verification Evidence Archive (Step 1)

**Status:** Evidence archived; M9 is still **NOT PASS** pending the remaining final-verification steps.  
**Scope of this record:** Preserve already observed Genuine Crop and Hard Negative PASS evidence without changing matcher thresholds or weakening tests.

## Repository and safety snapshot

- Repository: `Sharmabasu098/Mobile-Freedom`
- Verification branch: `m9-browser-crop-regression`
- PR: [#17 — M9: add local browser crop regression harness](https://github.com/Sharmabasu098/Mobile-Freedom/pull/17)
- PR state at archive time: Open, Draft, Unmerged; base branch `main`.
- Feature head before this evidence-archive commit: `35c2759bde506118de31cd97223485a6e27e97e3`
- Main base SHA confirmed unchanged: `a76cb20612e38556e199e0c1a5f130e7613dea56`
- No merge, PR status change, or main-branch write was performed.

## A. Automated CI evidence — run #376

- Workflow run: [#376](https://github.com/Sharmabasu098/Mobile-Freedom/actions/runs/43438195755)
- Run ID: `43438195755`
- Tested commit: `35c2759bde506118de31cd97223485a6e27e97e3`
- Result: Success.
- Test files: **10 passed / 10 total**.
- Tests: **134 passed / 134 total**.
- TypeScript/Vite build: Passed.
- Production build: Passed.
- Build artifact verification: Passed.

### Genuine crop positives recorded in CI

The following automated crop regression cases passed:

- Genuine 25% crop.
- Genuine 50% crop.
- Left-edge and right-edge crops.
- Resized genuine crop.
- JPEG-MIME genuine crop.
- Brightness-adjusted genuine crop.
- Portrait and landscape crops.
- Moderate crop.
- Small-resolution crop.
- High-resolution crop.
- Off-center 65% crop using REAL-02 geometry (R02-GEO).

### Hard Negative / False Positive evidence recorded in CI

The following rejection tests passed:

- A7: unrelated scenes with identical whole-image dHashes.
- HN-02-L1: same small logo at the same position.
- HN-02-L2: same small logo at different positions.
- HN-02-L3: same logo at different scales.
- HN-02-L4: same logo at a second scale and offset.
- HN-02-L5: low-resolution unrelated scenes sharing a small logo.
- FP-01: original scene vs unrelated control.
- FP-02: genuine center crop vs unrelated control.
- HN-03: same large textured patch at the same position.
- HN-04: same textured patch at different positions and scales.
- Tiny-detail crop area rejection.

These are automated fixture results. They do not, by themselves, prove every possible real-world image pair is classified correctly.

## B. User-observed browser Genuine Crop evidence

The user supplied Android browser screenshots showing successful single-pair Genuine Crop checks:

1. **Small image pair**
   - Files shown: `01_original_small.jpg` and `02_exact_center_crop_65.jpg`.
   - Browser result: **PASS — SIMILAR single-pair check**.
   - Expected similar pairs: 1; detected similar pairs: 1.
   - Input size shown: 226.0 KiB.
   - Production matcher time shown: 7,356.7 ms.
   - Full diagnostic report time shown: 7,360.2 ms.

2. **Large image pair**
   - Files shown: `01_original_large.jpg` and `02_exact_center_crop_65_large.jpg`.
   - Browser result: **PASS — SIMILAR single-pair check**.
   - Expected similar pairs: 1; detected similar pairs: 1.
   - Input size shown: 2.98 MiB.
   - Production matcher time shown: 6,744.8 ms.
   - Full diagnostic report time shown: 6,755.4 ms.

The browser harness states that files remain on-device and are not uploaded, modified, or deleted. These screenshots are user-provided visual evidence; this archive does not claim an independent replay of those local files.

## C. Evidence limitations — intentionally not overstated

- The CI crop fixtures include REAL-02 crop geometry, but that is not the same as re-running the user's original REAL-01 and REAL-02 photo files.
- The user-observed browser screenshots prove the displayed pairs returned SIMILAR; they do not constitute a full three-photo browser matrix with unrelated controls.
- CI Hard Negative results are preserved as automated test evidence. A separate user-run browser hard-negative matrix is not claimed here.
- Browser heap snapshots are not equivalent to total process RAM or peak native/canvas/decoded-bitmap memory.
- Android performance and the full locked acceptance-criteria checklist remain for the next verification steps.

## Preservation rule

Do not delete, skip, weaken, or loosen any existing Genuine Crop, FP-01/FP-02, A7, HN-02, HN-03, or HN-04 regression tests to obtain a green result. Any future matcher adjustment must preserve these controls and rerun the complete suite.

---

**Step 1 outcome:** Existing Genuine Crop and Hard Negative PASS evidence has been consolidated in this file.  
**M9 milestone status:** **NOT PASS — final verification is still in progress.**
