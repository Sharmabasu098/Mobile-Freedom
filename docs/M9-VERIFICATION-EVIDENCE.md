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


## D. Android/browser performance record — Step 2

**Measurement type:** User-observed browser harness measurements from supplied Android screenshots. These are observations, not a controlled benchmark across multiple devices or repeated runs.

### Captured device/browser context

- Device platform shown in the browser user-agent: Android 10.
- Browser: Chrome 151 (Android WebKit user-agent string).
- Logical CPU cores reported by the browser: 8.
- Device RAM reported by the browser: 8 GiB (browser estimate, not a hardware-level measurement).

### Observed runs

| Case | Input files total | Production matcher (decode + matching) | Full regression + diagnostic report |
|---|---:|---:|---:|
| Small original + 65% center crop | 226.0 KiB | 7,356.7 ms | 7,360.2 ms |
| Large original + 65% center crop | 2.98 MiB | 6,744.8 ms | 6,755.4 ms |

Both screenshots displayed **PASS — SIMILAR single-pair check**, with 1 expected similar pair and 1 detected similar pair.

### Memory readings and their limits

The supplied small-image screenshot reported:

- JS heap before matcher: 9.5 MiB.
- JS heap after matcher: 9.5 MiB.
- Browser-reported JS heap limit: 1,964.6 MiB.

These readings are optional JavaScript heap snapshots. They do **not** measure peak total Android process RAM and may exclude native image-decoder allocations, decoded bitmap storage, canvas backing memory, GPU memory, and other browser-process overhead. Therefore:

- **Peak RAM: NOT MEASURED.**
- **Native/canvas/decoded-bitmap peak memory: NOT MEASURED.**
- The unchanged 9.5 MiB JS heap reading must not be presented as proof of low total memory use.

### Performance interpretation

- The observed matcher completed both supplied image pairs successfully.
- The measured times are several seconds per pair on this browser/device session. They are recorded as a baseline, not as proof that a predefined latency target has been met.
- The screenshots represent one observed run per image-size case; repeatability, thermal throttling, background load, and other Android devices have not been characterized.
- The 20 MiB per-file safety limit is enforced by the implementation. The observed 2.98 MiB pair is below that per-file limit; this does not validate performance at the 20 MiB boundary.

### Step 2 outcome

Android/browser timing observations are now recorded, and the memory-measurement limitation is explicit. Peak process RAM remains an open measurement item; no claim of peak-RAM compliance is made. The locked M9 acceptance checklist remains for Step 3.


## E. Locked M9 acceptance checklist — Step 3

**Decision: M9 is NOT PASS yet.** The checklist below separates verified evidence from open acceptance gates. A green automated suite is necessary, but it is not treated as proof of every real-world requirement.

| Locked requirement / safety condition | Current evidence | Final status |
|---|---|---|
| Exact duplicate identification | Existing SHA-256 exact-duplicate engine and its tests are part of the previously completed M8 verification. M8 is not being re-run or reopened. | **Previously verified in M8** |
| Visually similar / genuine crop detection | 134/134 CI tests pass, including the listed crop geometries; user browser screenshots show small- and large-image genuine crop pairs returning SIMILAR. | **PASS for recorded fixtures and shown browser pairs; real-photo coverage still incomplete** |
| Reliable distinction between similar and unrelated photos | FP-01/FP-02, A7, HN-02 L1–L5, HN-03 and HN-04 all pass in CI. | **PASS for recorded hard-negative fixtures; full real-photo browser matrix still open** |
| REAL-01 and REAL-02 original photo files | REAL-02 crop geometry fixture passes; the exact original REAL-01/REAL-02 binary photo pairs have not been independently replayed in the browser during this final session. | **OPEN** |
| Similar video analysis, where technically appropriate | Current M9 browser regression and matcher evidence reviewed here is image/crop-focused. No verified video-frame similarity implementation or video regression suite has been established in this evidence set. | **OPEN — capability/scope decision required; do not claim video support** |
| No automatic deletion based only on similarity | Browser harness explicitly states files are not uploaded, modified, or deleted; existing storage tests include a no-modification assertion. | **PASS for the tested flows** |
| Privacy-first local processing | Browser harness processes selected files locally and reports no upload; user screenshots show this notice and successful local execution. | **PASS for browser harness flow** |
| Performance on Android/browser | Two successful timing observations are archived in Section D. They are single-session observations, not a repeatable benchmark matrix. | **PARTIAL** |
| Peak process RAM / native memory | JS heap snapshots are not total process memory; no peak process/native/canvas memory measurement is available. | **OPEN** |
| CI, typecheck, production build, artifact | Run #376: 10/10 test files, 134/134 tests, typecheck/build/artifact verification all passed on code commit `35c2759...`. Subsequent commits only added this documentation. | **PASS for tested code commit** |
| Main branch protection / isolated work | PR #17 remains open, Draft, and unmerged; base SHA remains `a76cb20612e38556e199e0c1a5f130e7613dea56`. | **PASS** |

### Final blockers before M9 can be marked PASS

1. Run the exact REAL-01 and REAL-02 original/crop pairs in the browser harness and preserve their complete pair diagnostics. If the original files are unavailable, record that limitation rather than substituting a synthetic fixture.
2. Complete an Android performance pass with a repeatable set of image sizes and a credible peak process-memory measurement. If the platform cannot expose peak process RAM, explicitly define an accepted alternative measurement and its limitations before claiming compliance.
3. Resolve the video-analysis acceptance scope: either implement and test a technically appropriate video-frame similarity path, or obtain an explicit project-scope decision that video similarity is deferred from M9. Until then, video capability is not verified.
4. Re-run/confirm the complete CI suite on the final code revision after any code change. Documentation-only commits do not alter matcher behavior, but they must not be confused with a new matcher test run.

### Final decision

- Genuine crop fixture evidence: **PASS**.
- Recorded hard-negative regression evidence: **PASS**.
- User-observed small/large browser crop pairs: **PASS**.
- Exact real-photo validation, peak-memory evidence, and video scope: **OPEN**.
- **M9 milestone: NOT PASS — do not mark complete, merge PR #17, or change PR draft status yet.**

This decision preserves the locked rule: M9 cannot pass until genuine-crop positives and unrelated hard negatives are reliably distinguished and every in-scope acceptance item is accounted for.


## F. Final real-photo Android browser validation — 2026-11-14

The user supplied Android Chrome screenshots from the deployed M9 browser regression harness for the exact REAL-01 and REAL-02 source/crop pairs. Both displayed **PASS — SIMILAR single-pair check**.

| Case | Input files | Production matcher (decode + matching) | Full diagnostic report | Similarity result |
|---|---:|---:|---:|---|
| REAL-01 original + REAL-01-CROP65 | 456.0 KiB | 7,366.6 ms | 7,371.3 ms | SIMILAR; distance 8/64; estimated similarity 88% |
| REAL-02 original + REAL-02-CROP65 | 350.7 KiB | 9,065.6 ms | 9,067.0 ms | SIMILAR; distance 6/64; estimated similarity 91% |

Both browser result panels showed one expected similar pair and one detected similar pair. The diagnostics reported no decode errors and that the page remained responsive. These are user-observed single runs, not a multi-run latency benchmark.

The screenshots also reported JS heap before/after of 9.5 MiB and a JS heap limit of 1,964.6 MiB. These are not process-RAM measurements.

## G. Peak Android process-memory measurement decision

The in-page browser harness reads Chromium's optional `performance.memory` values (`usedJSHeapSize`, `totalJSHeapSize`, and `jsHeapSizeLimit`) when available. The standard page context does not expose a trustworthy peak Android Chrome process-RAM or native bitmap/canvas/GPU-memory counter. A before/after JS heap snapshot cannot be relabeled as peak RAM.

**Peak total Android process RAM: NOT MEASURED.**  
**Peak native image/canvas/GPU memory: NOT MEASURED.**

A credible measurement requires external Android process profiling (for example, Android Studio Memory Profiler or Android Debug Bridge process-memory sampling) while repeating the defined image test. The browser page alone cannot complete this measurement. Android Settings' general memory estimates or `navigator.deviceMemory` are not substitutes for a per-process peak measurement.

**Step outcome:** Browser-side memory telemetry has been reviewed and its limit is documented. No peak-RAM compliance claim is made. To close this item with an actual number, an external Android profiling session is required; otherwise the acceptance record must retain Peak RAM as unmeasured/open.
