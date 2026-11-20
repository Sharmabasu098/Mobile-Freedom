# M10 — Storage Intelligence Dashboard Plan

**Milestone:** M10 — Storage Intelligence Dashboard  
**Status:** IN PROGRESS — planning baseline  
**Branch:** `m10-storage-dashboard-foundation`  
**Roadmap:** Locked v1.0; M8 and M9 remain closed and are not reopened by this work.

## Goal

Provide a mobile-first dashboard that summarizes only file data actually selected and analyzed by the user. The dashboard must clearly distinguish calculated values, estimates, and actions that have not occurred.

## Scope

1. **M10.1 — Data Foundation**
   - Aggregate the total size of the current analyzed/selected file set.
   - Calculate per-file-type totals and counts from the same source set.
   - Identify large files using a documented, deterministic rule.
   - Calculate duplicate-related potential savings only from duplicate groups and their known file sizes.
   - Keep data provenance and completeness visible; do not silently mix stale, partial, or unrelated analyses.

2. **M10.2 — File-Type Intelligence**
   - Show category totals and proportions for available types: images, videos, documents, audio, archives, other, and unknown.
   - Use MIME type when available and extension fallback when MIME is missing/unknown.
   - Unknown or unclassified file types must be retained in an explicit category rather than omitted.
   - Keep category counts and byte totals reconciled to the supplied analyzed file set.

3. **M10.3 — Large Files**
   - Show the largest analyzed files with name/type/size where those fields are available.
   - Sorting must be deterministic (size descending; stable tie-breaker).

4. **M10.4 — Duplicate Potential Savings**
   - Present potential savings as an estimate, not actual freed storage.
   - No delete action is initiated by this dashboard.
   - Exact duplicates and visually similar groups must remain conceptually separate; similarity alone is not deletion eligibility.

5. **M10.5 — Dashboard UI**
   - Mobile-first, responsive, accessible and consistent with existing site theme.
   - Clear empty, loading, partial-data, and error states.
   - No fabricated sample numbers in the live dashboard.

6. **M10.6 — Verification**
   - Unit tests for totals, type aggregation, large-file ordering, duplicate savings and edge cases.
   - Regression tests for empty input, unknown types, zero-byte files, mixed sizes, and incomplete analysis.
   - Run repository CI and record evidence before declaring PASS.

## Safety and data rules

- Only use data available from the current user-selected/analyzed files.
- Clearly label estimates and potential savings.
- Never imply storage was freed unless a separate verified operation actually freed it.
- Never auto-delete files.
- Do not infer device-wide storage usage from browser-selected files.
- Preserve privacy-first, local processing expectations and existing safeguards.

## Acceptance criteria

- Total size matches the sum of included file sizes.
- Type counts and totals reconcile to the analyzed file set.
- Large-file list follows the documented threshold and ordering.
- Duplicate potential savings calculation is documented and tested, with no double-counting.
- Incomplete or unavailable data is clearly disclosed.
- Dashboard remains usable on mobile.
- CI, typecheck, build and relevant tests pass.
- M10 is not marked PASS until acceptance criteria are verified.

## Work sequence

Begin with M10.1 data model/aggregation functions and tests. Integrate the UI only after the calculations are independently testable. Keep all work on this feature branch and open a PR for review; do not push changes directly to `main`.
