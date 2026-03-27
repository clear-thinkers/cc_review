---
title: Fix Log - 2026-03-27 - Teal Toggle Semantic Button
---

## Context
The testing-inclusion toggle in Content Admin was still using a raw teal utility triplet for its active state even after the rest of the workspace button system had been consolidated into named semantic classes.

## Root Cause
The include-for-testing control had a clear semantic meaning, but its on-state color was left as an inline class string instead of being promoted into the shared button token layer.

## Changes Applied
- Added `btn-toggle-on` to `src/app/globals.css` with the existing teal toggle styling:
  - `border-teal-600`
  - `bg-teal-50`
  - `text-teal-700`
- Replaced the row-level include-for-testing on-state in `src/app/words/admin/AdminSection.tsx` with `btn-toggle-on`.
- Replaced the batch include-in-test-bank toolbar button in `src/app/words/admin/AdminSection.tsx` with `btn-toggle-on`.
- Updated `docs/architecture/style-ref.md` to document `btn-toggle-on` as a shared semantic token.

## Architectural Impact
No layer boundaries changed. This was a shared styling token cleanup only.

## Preventative Rule
If a toggle state represents a stable shared intent and already appears in more than one place, promote it into a named semantic class instead of leaving it as a raw utility string.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
