# M11 — AI Storage Assistant

**Milestone:** M11 — AI Storage Assistant  
**Status:** IN PROGRESS — implementation foundation  
**Branch:** `m11-ai-storage-assistant`  
**Roadmap:** v1.0 LOCKED; milestone order and scope are unchanged.

## Goal

Help users understand the storage analysis they actually supplied and offer safe, user-reviewed next steps. The assistant must be grounded in current analysis results, disclose limitations, and never initiate deletion.

## Approved scope

- Explain user-provided storage information.
- Interpret supported file-analysis results.
- Identify and explain large files.
- Explain exact duplicate findings separately from visually similar photos.
- Estimate potential savings only when exact-duplicate scan results are available.
- Provide review-first cleanup suggestions.
- Explain risks, uncertainty, and unavailable information.
- Interpret trends only when sufficient trend data is provided (trend/prediction is primarily M12).

## M11 implementation sequence

1. **M11.1 — Evidence-grounded assistant core:** deterministic insight generation from typed, verified analysis context; bilingual English/Hindi; no fabricated data; no remote requests.
2. **M11.2 — Context and safety guards:** explicitly represent completed/pending scans and prevent unsupported statements.
3. **M11.3 — Assistant UI integration:** user can ask for an explanation of the current selected-file analysis; mobile-first and accessible.
4. **M11.4 — Privacy/AI service decision:** evaluate any remote model only after disclosure, minimization, consent, architecture, and failure behavior are documented. No remote AI is enabled by this foundation.
5. **M11.5 — Verification:** unit, integration, bilingual, empty/partial-data, stale-context, safety and mobile manual checks.

## Safety and privacy rules

- Use only current user-selected/analyzed data passed into the assistant.
- Never imply device-wide storage access from selected files.
- Do not invent file counts, sizes, scan results, savings, or predictions.
- Clearly label potential duplicate savings as estimates.
- Exact duplicates and visually similar photos are different concepts.
- Similarity alone is never deletion eligibility.
- No delete action, file mutation, or background scanning is initiated by the assistant.
- Remote processing is not used by the M11.1 foundation.

## Acceptance criteria (not yet PASS)

- Responses are grounded only in supplied analysis context.
- Missing, incomplete, or pending data is disclosed.
- Large-file and duplicate explanations are correct.
- Exact duplicates are distinguished from visually similar photos.
- Recommendations are review-first, non-destructive, and never auto-executed.
- English and Hindi output is accurate and consistent.
- Empty data and invalid inputs are handled safely.
- Assistant UI is accessible and mobile usable.
- Relevant tests, typecheck, build, CI, and manual checks pass.
- Privacy behavior and any remote-AI boundary are verified.

M11 must remain IN PROGRESS until all criteria are verified.