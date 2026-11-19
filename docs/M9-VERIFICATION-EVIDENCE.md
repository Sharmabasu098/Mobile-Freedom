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
| REAL-01 and REAL-02 original photo files | User-supplied Android Chrome screenshots in Section F show the exact REAL-01 and REAL-02 original/crop pairs each returning PASS — SIMILAR, with full pair diagnostics and no decode errors. | **PASS — user-observed browser validation** |
| Similar video analysis, where technically appropriate | The current M9 matcher and regression harness are image-file based. No video-frame extraction, frame matching, video resource lifecycle, or video regression suite exists. For this milestone, video similarity is judged not technically appropriate to add safely to the image matcher without a separate design and validation effort. | **SCOPE DECISION COMPLETE — video similarity deferred; M9 does not claim video support** |
| No automatic deletion based only on similarity | Browser harness explicitly states files are not uploaded, modified, or deleted; existing storage tests include a no-modification assertion. | **PASS for the tested flows** |
| Privacy-first local processing | Browser harness processes selected files locally and reports no upload; user screenshots show this notice and successful local execution. | **PASS for browser harness flow** |
| Performance on Android/browser | Two successful timing observations are archived in Section D. They are single-session observations, not a repeatable benchmark matrix. | **PARTIAL** |
| Peak process RAM / native memory | REAL-01 has 30 sampled process readings (Section I). REAL-02 has 30 Chrome process readings (Section J), but the screenshots do not conclusively establish that sampling overlapped active image processing. Neither run isolates native/canvas/GPU peaks or guarantees an instantaneous absolute peak. | **PARTIAL — sampled process RSS/PSS recorded; peak timing and native/canvas/GPU peak remain unverified** |
| CI, typecheck, production build, artifact | Run #376: 10/10 test files, 134/134 tests, typecheck/build/artifact verification all passed on code commit `35c2759...`. Subsequent commits only added this documentation. | **PASS for tested code commit** |
| Main branch protection / isolated work | PR #17 remains open, Draft, and unmerged; base SHA remains `a76cb20612e38556e199e0c1a5f130e7613dea56`. | **PASS** |

### Final blockers before M9 can be marked PASS

1. Run the exact REAL-01 and REAL-02 original/crop pairs in the browser harness and preserve their complete pair diagnostics. If the original files are unavailable, record that limitation rather than substituting a synthetic fixture.
2. Complete the remaining Android performance pass with repeatable image-size runs. REAL-01 has 30 sampled process-RSS/PSS readings in Section I. REAL-02 has 30 process-memory readings in Section J, but the available screenshots do not prove that sampling overlapped active image processing. Both are sampled observations, not guaranteed instantaneous peaks or separate native/canvas/GPU allocation measurements.
3. Video scope decision: **resolved**. Video similarity is deferred from this image-focused M9 deliverable because a safe implementation requires a separate frame-sampling, matching, resource-management, and regression design. No video capability is claimed. This does not rename, remove, or skip any locked roadmap milestone; video work remains a separately tracked follow-up for roadmap planning.
4. Complete the repeatable Android performance and peak-memory assessment to the extent available on the user's Android-only setup. If credible peak process RAM cannot be measured, preserve it as an explicit limitation and do not claim peak-RAM compliance.
5. Re-run/confirm the complete CI suite on the final code revision after any code change. Documentation-only commits do not alter matcher behavior, but they must not be confused with a new matcher test run.

### Final decision

- Genuine crop fixture evidence: **PASS**.
- Recorded hard-negative regression evidence: **PASS**.
- User-observed small/large browser crop pairs: **PASS**.
- Exact real-photo validation: **PASS based on the user-observed REAL-01 and REAL-02 browser runs in Section F**.
- Video scope: **DECIDED — deferred from M9; no video support claimed**.
- Peak process-memory evidence: **PARTIAL — REAL-01 sampled process RSS recorded; native/canvas/GPU peak remains unmeasured**.
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


## H. M9 video-scope decision — 2026-11-14

**Decision: Defer video similarity from the current M9 deliverable.**

Reasoning:
- M9's implemented and tested pipeline accepts image files and performs image/crop comparisons.
- The repository evidence reviewed for this decision contains no verified video-frame extraction, frame-sampling policy, temporal/frame matching algorithm, video decode/resource lifecycle, or video-specific regression suite.
- Adding a superficial frame sampler without defined sampling, temporal coverage, memory bounds, cancellation, decoder cleanup, and hard-negative tests would create an unverified feature and could destabilize the image matcher.
- The user's current development workflow is Android-only, and no external Android process profiler is available for measuring peak native memory. Introducing video decoding now would increase memory and stability risk without a way to validate it adequately.

Therefore, video similarity is **deferred as separate future work** and is not claimed as an M9 capability. This decision does not delete, rename, merge, or skip any of the locked roadmap's 23 milestones; any future video work must be placed through the roadmap's normal planning process.

**Step 3 video-scope subtask: COMPLETE.**  
**M9 overall status: NOT PASS — peak process RAM remains unmeasured and the final acceptance checklist still has open performance limitations.**


## I. REAL-01 Android Chrome process-memory sampling — 2026-11-18

The user confirmed that the REAL-01 browser regression was run on the Android phone while the laptop collected 30 consecutive Android Debug Bridge process-memory samples at approximately one-second intervals. The screenshots show the Chrome process PID `24624` and the sampling command querying that PID with `dumpsys meminfo`.

**Observed sample summary (30 readings):**

| Metric | Observed value |
|---|---:|
| Sample count | 30 |
| Sampling interval | Approximately 1 second |
| Process | Chrome, PID `24624` |
| Highest sampled RSS | **330,521 KB (about 322.8 MiB)** |
| Lowest sampled RSS | **312,341 KB (about 305.0 MiB)** |
| Highest sampled PSS | **211,914 KB (about 207.0 MiB)** |
| Lowest sampled PSS | **206,418 KB (about 201.6 MiB)** |

**Interpretation and limits:**

- These are process-level RSS/PSS readings captured during the user-confirmed REAL-01 browser test, not the phone's total RAM usage.
- The highest value is the maximum among the 30 observed samples. Because sampling is discrete, a brief peak between samples may have been missed; do not describe 330,521 KB as a guaranteed absolute peak.
- RSS includes resident shared pages; PSS apportions shared pages. They are different accounting measures and must not be added together.
- This sampling does not separately identify canvas, decoded bitmap, GPU, or other native allocation peaks.
- The 30 readings show RSS decreasing from the first observed sample and then remaining around 312–319 MB for the later samples. This one run is useful evidence, but it is not a repeatability study across image sizes or devices.

**Step outcome:** REAL-01 process RSS sampling is now recorded. The peak-RAM evidence is upgraded from “not measured” to **sampled process RSS observed**; absolute peak and native/canvas/GPU-specific peak remain unmeasured.

**M9 overall status remains: NOT PASS.** The remaining performance acceptance work and all other locked acceptance gates must still be satisfied.


## J. REAL-02 Android Chrome process-memory sampling — 2026-11-18

The user supplied screenshots showing the REAL-02 browser regression result and a completed 30-reading Android Debug Bridge dumpsys meminfo capture for Chrome PID `23575`. The 30 numbered readings are visible in the saved text-file output. The browser result screenshot separately shows the REAL-02 original/crop pair returning **PASS — SIMILAR**, with one expected pair and one detected pair, estimated similarity 91%, dHash distance 6/64, production matcher time 6,558.8 ms, and full diagnostic report time 6,564.7 ms.

**Observed sample summary (30 readings):**

| Metric | Observed value |
|---|---:|
| Sample count | 30 |
| Sampling interval | Approximately 1 second (as configured by the command) |
| Process | Chrome, PID `23575` |
| Highest sampled RSS | **299,941 KB (about 292.91 MiB)** |
| Lowest sampled RSS | **282,504 KB (about 275.88 MiB)** |
| Highest sampled PSS | **193,673 KB (about 189.13 MiB)** |
| Lowest sampled PSS | **176,378 KB (about 172.24 MiB)** |

**Interpretation and limits:**

- These are Chrome process-level RSS/PSS readings, not total phone RAM usage.
- The highest values are maxima among the 30 observed samples. Discrete sampling can miss brief peaks between readings; do not describe these values as guaranteed absolute peaks.
- RSS includes resident shared pages; PSS apportions shared pages. They are different accounting measures and must not be added together.
- The user confirms that the 30-reading REAL-02 sampling was performed while the browser test's image processing was active. This supports recording the samples as an active-processing observation for this run. The readings still represent approximately one-second snapshots, so a brief peak between samples may have been missed; they do not establish a guaranteed instantaneous peak or isolate native/canvas/GPU allocations.
- The readings do not separately identify canvas, decoded bitmap, GPU, or other native allocation peaks.
- This is one observed run, not a repeatability study across image sizes or devices.

**Step outcome:** REAL-02's 30 Chrome process-memory readings are archived as user-confirmed active-processing samples. They provide sampled process-memory evidence during this run, but do not establish an instantaneous peak. Native/canvas/GPU-specific peak remains unmeasured.

**M9 overall status remains: NOT PASS.** The remaining performance acceptance work and all other locked acceptance gates must still be satisfied.


## K. User confirmation — three-photo real-browser matrix — 2026-11-19

The user explicitly confirmed that the complete three-photo browser matrix described in the final-verification discussion has already been run. The matrix consists of the genuine original photo, its genuine crop, and an unrelated control photo, with the expected classifications:

- Original + genuine crop: **SIMILAR**.
- Original + unrelated control: **NOT SIMILAR**.
- Genuine crop + unrelated control: **NOT SIMILAR**.

This section records the user's confirmation that all three checks were completed. The underlying result screenshots or raw directional diagnostic export were not re-attached with this confirmation, so this is recorded as **user-confirmed execution/result**, not an independently replayed or newly inspected raw artifact. No test was re-run and no matcher threshold or test assertion was changed for this documentation update.

### Updated evidence interpretation

- The earlier statement in Sections C and E that a user-run three-photo browser hard-negative matrix was not claimed is superseded by this dated confirmation.
- The real-photo browser matrix is now recorded as **user-confirmed complete with the expected classifications**.
- Automated hard-negative coverage remains supported by the CI tests recorded above; this user confirmation adds the browser matrix evidence.
- Android process sampling remains as recorded in Sections I and J. The latest 60-second top sampling session discussed on 2026-11-19 is an additional process observation, but its peak RES value is not interchangeable with dumpsys meminfo RSS/PSS, and it does not independently prove native/canvas/GPU peak memory or repeatability across runs.
- The available evidence does not define a numeric performance or memory acceptance threshold against which these observations can be judged. No such threshold is invented here.

**Step K outcome:** Three-photo real-browser matrix — **USER-CONFIRMED COMPLETE**.  
**M9 overall status:** **NOT PASS pending final performance acceptance criteria/measurement limits being explicitly resolved.** This update does not authorize merging PR #17 or changing its Draft status.


## L. Latest-commit CI confirmation — 2026-11-19

The documentation update that recorded Section K was itself checked by GitHub Actions on the current branch head.

- Workflow: **Mobile Freedom Build**
- Run: [#386](https://github.com/Sharmabasu098/Mobile-Freedom/actions/runs/44522038132)
- Tested commit: `d2de28a65e6f0600a2abe170a2bdf48ce2477062`
- Result: **SUCCESS**
- Job: TypeScript and Vite Build — completed successfully.
- Test files: **10 passed / 10 total**.
- Tests: **134 passed / 134 total**.
- TypeScript typecheck: **PASS**.
- Vite production build: **PASS**.
- Build artifact check (`dist/index.html` exists and is non-empty): **PASS**.
- The log again reports a 537.46 kB minified main JS chunk, above Vite's 500 kB advisory warning. This is a warning, not a build failure. Node 20 action deprecation warning is also non-blocking.

This run confirms the latest branch head, including the documentation-only Section K update, still passes the full automated suite. The matcher source and regression assertions were not changed by that documentation-only commit.

### Remaining performance gate — precise disposition

The existing evidence includes successful real-device browser timings and 30-sample Android process RSS/PSS observations for both REAL-01 and REAL-02 while image processing was active. It does **not** define a previously approved maximum latency, maximum sampled process memory, repeat-count requirement, or device matrix. It also does not isolate canvas/decoded-bitmap/GPU/native peak memory.

Those missing acceptance limits cannot responsibly be invented after the measurements, and the observed sample maxima cannot be relabeled as guaranteed absolute peaks. Therefore the remaining item is not a failed matcher test; it is an **unresolved performance acceptance decision**. To close it, the project owner must approve explicit limits and the exact measurement method (including whether sampled RSS/PSS is sufficient or native/canvas/GPU profiling is mandatory), then compare the already-recorded measurements against those limits and run only any additional measurements that the approved criteria require.

**Step L outcome:** Latest-commit CI — **PASS (10/10 files, 134/134 tests, typecheck/build/artifact PASS)**.  
**M9 overall status:** **NOT PASS — performance acceptance limits/method remain unresolved; no unsupported peak-memory compliance claim is made.**


## M. Owner-approved Android performance acceptance criteria — 2026-11-19

**Decision:** The project owner explicitly approved the following M9 Android performance limits and repeat count on 2026-11-19. These are now the acceptance criteria for the remaining repeatability verification.

| Metric | Approved acceptance limit | Measurement rule |
|---|---:|---|
| Chrome process RSS | **Maximum sampled RSS ≤ 360 MiB** | Record 30 dumpsys meminfo samples at approximately one-second intervals during active image processing for each run. |
| Chrome process PSS | **Maximum sampled PSS ≤ 240 MiB** | Use the same 30 active-processing samples; compare the maximum observed PSS. |
| Processing time | **≤ 10,000 ms per image pair** | Record the production matcher time (decode + matching) for each run. |
| Repeatability | **3 runs per real-photo case** | Complete three measured runs for REAL-01 and three for REAL-02. Every run must satisfy all applicable limits. |

### Required test matrix

- REAL-01 original + its genuine crop: 3 measured runs.
- REAL-02 original + its genuine crop: 3 measured runs.
- For every run, capture the browser classification and production matcher time.
- For every run, capture 30 approximately one-second Chrome process RSS/PSS samples while image processing is active.
- Expected browser classification for both genuine pairs: **SIMILAR**.
- Preserve the already-verified unrelated-photo controls: original + unrelated = **NOT SIMILAR**; crop + unrelated = **NOT SIMILAR**. Do not weaken or remove FP-01/FP-02, A7, HN-02 L1-L5, HN-03, or HN-04.

### Pass/fail rule

A REAL-01 or REAL-02 performance case passes only when all three runs:
1. Return the expected **SIMILAR** result without crash or decode error.
2. Complete production matching in **10 seconds or less**.
3. Have maximum sampled Chrome process RSS **≤ 360 MiB**.
4. Have maximum sampled Chrome process PSS **≤ 240 MiB**.

Any single run exceeding a limit, failing classification, crashing, or producing a decode error means that case is **NOT PASS** pending investigation and a repeat after the cause is addressed. Do not change matcher thresholds or weaken regression controls merely to pass performance criteria.

### Measurement interpretation — limits of this approval

- RSS and PSS are separate process-accounting metrics; do not add them together.
- These limits apply to the maximum among the 30 observed samples, not a guaranteed instantaneous absolute peak. A short peak between one-second samples may be missed.
- This method measures Chrome process RSS/PSS. It does not separately isolate GPU, canvas, decoded-bitmap, or every native allocation peak. No claim of absolute device-wide or native/GPU peak-memory compliance is authorized by these criteria.
- The previously recorded REAL-01 and REAL-02 measurements are baseline evidence. They do not by themselves establish the required three-run repeatability.

### Next execution step

Run the six measured cases in the matrix above (three REAL-01 and three REAL-02), retaining per-run timing, classification, and 30-sample RSS/PSS summaries. A concise evidence table must list each run separately and identify the maximum sampled RSS and PSS. Then compare every run against the approved limits and update the final gate disposition.

**Approval recorded:** RSS 360 MiB; PSS 240 MiB; processing time 10 seconds; 3 runs per photo.  
**M9 overall status:** **NOT PASS — approved criteria are recorded; the six-run repeatability verification remains to be completed.** PR #17 remains Draft and unmerged.
