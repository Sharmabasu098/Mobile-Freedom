# M12 — Storage Trend & Prediction Plan

**Milestone:** M12 — Storage Trend & Prediction  
**Status:** Planning / IN PROGRESS (implementation gated by M11 completion)  
**Roadmap:** v1.0 LOCKED; no scope or order changes  
**Branch:** `m12-storage-trend-prediction`

## Purpose
Use storage snapshots explicitly supplied or saved by the user to show storage history, trend, low-space warnings, and a cautious estimate of when space may run low. The website must not claim continuous device monitoring.

## Scope
- Store timestamped storage snapshots (used/total or used/available, with source and units).
- Display historical snapshots and the direction/rate of change.
- Explain the trend window and how much data supports it.
- Show a low-space warning when the latest measured snapshot crosses a defined threshold.
- Estimate time-to-low-space only when the data is sufficient and trend is reasonably stable.
- Show uncertainty and limitations; otherwise state that prediction is unavailable.
- Allow users to remove their history; keep storage local by default.
- Android monitoring is out of scope for M12 and belongs to later Android milestones.

## Data boundaries
- Website uses user-entered or otherwise explicitly provided snapshots and information actually available to it.
- No background, continuous, or device-wide storage monitoring claim.
- No fabricated or extrapolated snapshot values.
- Each snapshot records timestamp, total capacity, used/available capacity, units, and source/method.
- Handle missing, invalid, duplicate-timestamp, inconsistent-capacity, and out-of-order samples safely.

## Proposed prediction guardrails (review before implementation)
These are proposed conservative defaults, not locked product policy:
- Require at least 3 valid snapshots across at least 7 days before showing a time-to-low-space estimate.
- Use a robust trend calculation; do not extrapolate from a single interval.
- Suppress prediction if samples are too sparse, usage changes are highly inconsistent, or estimated growth is zero/negative.
- Forecast only to a clearly defined low-space threshold; display the observed period and the estimate as approximate.
- Avoid false precision: round estimates to coarse time units and show a confidence/quality label based on data sufficiency.
- Low-space warning is based on the latest measured snapshot only and must be clearly distinguished from a prediction.
- Initial candidate warning threshold: 10% available capacity. This requires owner review and can be adjusted without changing milestone scope.

## Planned UI
- Storage history list/chart (accessible text summary alongside chart).
- Latest snapshot summary.
- Observed trend (e.g., average daily change) with units.
- Low-space warning state.
- Prediction card with estimate, data period, sample count, and limitation text—or an explicit “Not enough data to predict yet” state.
- Snapshot add/import and history-clear controls with clear confirmation for history deletion.

## Safety and privacy
- Do not delete or modify user files.
- Keep snapshot history local to the browser/device where practical.
- No remote transfer of snapshots unless a separately disclosed and consented feature is approved.
- Never describe a forecast as guaranteed or continuously monitored.
- Do not present estimates as measured facts.

## Acceptance criteria (M12 PASS requires evidence)
1. Snapshot creation/validation works and records timestamp and capacity values.
2. History is persisted and can be viewed after reload.
3. Trend calculations are correct for known test datasets and units.
4. Low-space warning uses the latest measured snapshot and threshold is documented.
5. Prediction is withheld when data is insufficient or unstable.
6. Prediction uses only recorded snapshots; method, period, sample count, and limitations are shown.
7. Tests cover empty history, 1–2 samples, valid sufficient history, no growth, declining usage, inconsistent samples, invalid input, unit conversion, threshold boundaries, and date/order edge cases.
8. Users can clear history and receive clear confirmation; no files are touched.
9. Mobile layout and accessibility states are manually verified.
10. Build, automated tests, security checks, and deployment are verified.
11. No continuous storage monitoring is claimed by the website.

## Dependency and milestone order
M11.5 Safety Regression must be completed and verified before M12 implementation proceeds. M12 planning may be prepared in parallel, but this does not skip, merge, or mark M11.5 complete.

## Status
**IN PROGRESS — planning only.** Implementation and PASS are not yet claimed.
