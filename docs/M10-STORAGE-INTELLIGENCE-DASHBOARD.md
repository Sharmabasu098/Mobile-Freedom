# M10 — Storage Intelligence Dashboard Specification

**Project:** Mobile Freedom — The Essential Mobile Toolkit  
**Milestone:** M10 — Storage Intelligence Dashboard  
**Roadmap:** v1.0 — 23 milestones, LOCKED  
**Branch:** `m10-storage-intelligence-dashboard`  
**Status:** IN PROGRESS — scope baseline drafted; implementation and verification not yet complete

---

## 1. Source of truth and scope boundary

This specification is derived from:
- `ROADMAP.md`, section 8 — Storage Intelligence Development and the locked M10 name/order.
- `PRODUCT_SPEC.md`, section 5.6 — Storage Intelligence Dashboard.
- `PRODUCT_SPEC.md`, sections 3, 8, 9, 13, and 15 — privacy, deletion safety, performance, and milestone verification.
- Existing M8/M9 storage modules on `main`: file metadata analysis, large-file detection, SHA-256 exact-duplicate grouping, and visually similar-photo findings.

This document clarifies implementation and verification for M10. It does not change the locked roadmap, architecture, milestone order, or the scope of M11/M12/M13+.

## 2. M10 objective

Provide a clear, mobile-first dashboard that summarizes storage information from files the user explicitly selects in the website. The dashboard must help the user understand the selected dataset without implying that the website has scanned the whole device.

## 3. Data source and truthful coverage

- The user selects files through the browser file picker.
- All analysis runs locally in the browser using existing supported M8/M9 modules where possible.
- The dashboard reports only the selected files and successfully analyzed results.
- The UI must prominently identify the scope as **Selected files**, not total device storage.
- The website must not claim access to Android device-wide storage, other apps' private directories, or files the user did not select.
- Unsupported files and files that fail analysis must be counted/reported separately; failures must not silently disappear from totals.
- No file contents are uploaded, modified, or deleted by this dashboard.

## 4. Dashboard information

### 4.1 Overview
Show:
- Number of selected files.
- Total size of successfully analyzed selected files.
- Number and size of files that could not be analyzed, when any exist.
- A clear selected-files scope label.

### 4.2 Storage categories
Group selected files by available metadata, using MIME type and/or extension:
- Images
- Videos
- Audio
- Documents
- Other / unknown

Show file count and total size per category. Classification must be deterministic and documented; unknown types must remain visible as Other / unknown rather than being guessed.

### 4.3 Large files
- Reuse the existing large-file threshold behavior (default 100 MiB unless the existing UI's user-selected threshold is carried through).
- Show large-file count and total size.
- Show a ranked list of the largest selected files (maximum 10 in the initial dashboard).
- Label the threshold and units clearly.
- Do not call a file “large” without applying the displayed threshold.

### 4.4 Exact duplicate findings
- Use only verified exact-duplicate groups from the existing SHA-256 engine.
- Clearly label these as **Exact duplicates**.
- Show duplicate group count, involved file count, and estimated potential savings from the duplicate groups.
- Savings are an estimate based on retaining one largest copy per exact-hash group; do not report it as actual freed storage.
- Hash failures and files excluded by existing safety/eligibility rules must be disclosed.
- Similar-photo findings must never be counted as exact duplicates.

### 4.5 Visually similar photo findings
- Display M9 visually similar pairs separately from exact duplicates.
- Label them **Visually similar — not identical**.
- Do not include similar-photo pairs in duplicate savings calculations.
- Respect M9 supported input formats, file-size limits, and existing error reporting.
- Similarity is informational only and never authorizes deletion.

### 4.6 Estimates versus measurements
- File sizes and counts are measured from the selected File objects.
- Duplicate potential savings are estimated from exact duplicate groups.
- Similarity percentages are matcher estimates, not proof of identity.
- No dashboard card may imply that estimated savings have already been freed.

## 5. Explicit M10 exclusions

These remain outside M10 and must not be implemented as hidden scope expansion:
- AI explanations or conversational recommendations — M11.
- Historical storage trend charts, forecasts, or predictions — M12.
- Android device-wide storage scanning or app-private storage access — later Android milestones and platform permissions.
- Cleanup, deletion, or automatic file modification — later safe-cleanup scope; M10 is read-only.
- Video similarity analysis — not currently implemented/verified by M9 and not claimed by M10.
- Remote upload, cloud analysis, or persistent server storage of selected file data.
- New similarity algorithms or changes to M9 matcher thresholds.

## 6. Privacy, safety, and UX requirements

- Local processing only for this dashboard.
- No network upload of selected file contents.
- No destructive controls in M10.
- Never delete, move, rename, or modify a selected file.
- Do not retain selected File objects or private metadata beyond the active page/session unless separately specified and approved.
- Provide clear loading, empty, partial-success, failure, and completed states.
- Prevent duplicate submissions while analysis is running.
- Keep the dashboard usable on narrow mobile screens and with keyboard/screen-reader semantics.
- Support the existing English/Hindi language toggle and light/dark theme.
- Use text-safe DOM rendering for file names; do not inject file names as HTML.

## 7. Proposed implementation sequence

1. Build a pure, independently tested dashboard aggregation module over M8/M9 results.
2. Define and test category classification and size aggregation.
3. Add large-file ranking and exact-duplicate savings aggregation.
4. Integrate similar-photo results as a separate, explicitly non-identical section.
5. Add the mobile-first dashboard UI and connect it to user-selected files.
6. Add failure/partial-result states and verify local-only/no-modification behavior.
7. Run focused tests, full CI, production build, and browser verification.

No existing M8/M9 tests or regression controls may be removed, weakened, or reinterpreted to make M10 pass.

## 8. Acceptance criteria

M10 may be marked PASS only when all applicable criteria below have verification evidence.

| ID | Acceptance criterion | Required evidence |
|---|---|---|
| M10-AC-01 | Dashboard processes only user-selected files and labels the dataset accurately. | Browser test showing selected-files scope; no device-wide claim. |
| M10-AC-02 | Overview file count and total size are correct. | Unit tests for empty, single, multiple, and mixed-size inputs. |
| M10-AC-03 | Category counts and sizes are correct, including unknown types. | Unit tests for images, videos, audio, documents, other/unknown, and MIME/extension edge cases. |
| M10-AC-04 | Large-file count, total size, threshold, and top-10 ranking are correct. | Boundary tests at threshold−1, threshold, threshold+1; ordering and tie tests. |
| M10-AC-05 | Exact duplicates are distinct from visually similar photos. | Tests using exact-hash duplicate groups and M9 similar-pair fixtures. |
| M10-AC-06 | Potential duplicate savings are calculated only from exact duplicates and are labelled as estimates. | Unit tests for group size, one retained largest file, multiple groups, and no-duplicate cases. |
| M10-AC-07 | Partial analysis/hash/decode failures are visible and do not corrupt successful totals. | Failure-injection tests and browser partial-success case. |
| M10-AC-08 | Similar-photo findings are shown separately and do not contribute to duplicate savings. | Browser/unit evidence with a genuine crop pair and unrelated controls. |
| M10-AC-09 | No upload, modification, deletion, or automatic cleanup occurs. | Code review and browser verification; no destructive action exposed. |
| M10-AC-10 | Mobile layout, English/Hindi, and light/dark modes work. | Responsive browser checks and interaction tests. |
| M10-AC-11 | Empty, loading, completed, and error states are understandable and accessible. | Automated/UI tests and manual browser checks. |
| M10-AC-12 | Existing M8/M9 behavior and regression suite remain intact. | Full CI, typecheck, production build, and unchanged relevant regression assertions. |

## 9. Known limitations to disclose

- Dashboard totals represent only the files the user selected.
- Browser file pickers do not grant unrestricted access to device storage.
- Category labels depend on file MIME type and extension metadata and may be unknown or imperfect.
- Duplicate savings are potential savings, not actual freed space.
- Visually similar photos are not identical-file proof.
- Video similarity is not supported/claimed.
- No historical trend or prediction is provided in M10.

## 10. Current baseline inspection

At M10 start, the `main` branch contains:
- `src/tools/storage/fileAnalysis.ts`: file metadata, large-file detection, total selected-file size.
- `src/tools/storage/batchFileAnalysis.ts`: sequential batch metadata analysis.
- `src/tools/storage/fileHash.ts`: local SHA-256 with a 50 MiB per-file safety limit.
- `src/tools/storage/findDuplicates.ts`: exact SHA-256 duplicate groups and potential savings.
- `src/tools/storage/mediaFiles.ts`: photo/video classification by MIME type and known extensions.
- `src/tools/storage/similarPhotos.ts`: M9 visually similar photo pairs with supported-format/size restrictions and diagnostics.
- `src/main.ts`: existing File Analysis screen with metadata, large files, exact duplicates, and similar-photo actions.

No dedicated M10 dashboard or pure dashboard aggregation module was found in the inspected storage source tree. Existing M8/M9 capabilities should be reused rather than reimplemented.

## 11. Status

**M10:** IN PROGRESS — specification drafted on the isolated M10 branch.  
**Implementation:** NOT STARTED.  
**Verification:** NOT STARTED.  
**PASS:** NOT authorized.

The next implementation task is M10-01: create and test the pure dashboard aggregation module without changing existing M8/M9 behavior.
