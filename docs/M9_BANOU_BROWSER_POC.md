# M9 — Browser/Vite feasibility PoC for @banou/opencv-wasm

## Purpose

This isolated consumer checks whether the previously successful Node/WASM candidate can also run in a real Chromium browser through a production Vite bundle. It is deliberately separate from the Mobile Freedom application dependency graph.

## Checks

1. Vite builds a minimal consumer with the pinned `@banou/opencv-wasm@0.0.6` candidate.
2. Chromium opens the page and verifies no WASM request occurs before the user presses the explicit Run button.
3. The package is dynamically imported only after that action.
4. The initialized runtime performs ORB feature extraction against deterministic in-memory pixels and requires non-empty descriptors.
5. The browser test verifies a local WASM request occurs, no external-origin request occurs, and no page runtime error is reported.

## Isolation and privacy

The workflow installs the package only under `$RUNNER_TEMP/m9-banou-browser`. The app package manifest, lockfile, production source, and main branch are not modified. The fixture uses synthetic pixels; it does not read user files, upload data, or contact external services at runtime.

## Limits

A passing CI job proves only this minimal Chromium/Vite runtime and lazy-load path. It does not establish Android browser performance, offline cache behaviour, robust crop geometry, false-positive/negative accuracy, memory limits, production integration, or video similarity. Those remain separate M9 gates. No dependency is approved for production by this PoC.
