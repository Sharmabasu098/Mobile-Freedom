# VF-01 Mobile Intent Bug Report & Fix

## Evidence
Mobile screenshots from the deployed Real Intent Test Interface showed:
- `Hello friend` → `unknown`, no suggested tool, low confidence, clarification required.
- `Compress image and merge PDF` → `unknown`, no suggested tool, low confidence, clarification required. The engine did not label the result as multi-intent.
- `Mere phone ka storage kam ho gaya hai` → `file-analysis`, suggested tool `File Analysis`, high confidence, no clarification. This mapping was observed as correct.
- `storage` → `unknown`, no suggested tool, clarification required.
- `Can you merge these things?` → `unknown`, no suggested tool, clarification required.

## Fixes in this branch
- Added explicit `greeting` intent for common English and Hindi greeting phrases.
- Multiple distinct tool matches now return `multi-intent`, with no suggested tool and clarification required. This safely identifies multiple requests without automatically executing either.
- Added a regression test for the exact phone-storage phrase observed in the screenshots and its File Analysis mapping.
- Added greeting and multi-intent regression tests.
- Preserved negative controls for generic `storage`, vague merge, empty, and unrelated input.

## Acceptance cases
| Input | Expected |
|---|---|
| Hello friend | `greeting`, no tool, no clarification |
| Compress image and merge PDF | `multi-intent`, no tool, clarification required |
| Mere phone ka storage kam ho gaya hai | `file-analysis`, `File Analysis`, no clarification |
| storage | `unknown`, no tool, clarification required |
| Can you merge these things? | `unknown`, no tool, clarification required |

## Safety
Classifier-only changes. No tool execution, file modification, or message sending is added.

## Status
Code and regression tests have been committed to the isolated branch. CI/build and deployed mobile re-test are required before PASS. Main is untouched.
