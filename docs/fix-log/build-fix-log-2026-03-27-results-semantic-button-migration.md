---
title: Fix Log - 2026-03-27 - Results Semantic Button Migration
---

## Context
The results page still had its destructive and dialog buttons styled through local CSS-module button rules even after the rest of the workspace button system had been consolidated around the shared semantic classes.

## Root Cause
`SessionHistoryTable.tsx` and `ClearHistoryDialog.tsx` were left behind as a small styling island inside the results feature. Their button roles already mapped directly to the shared semantic palette, but the code had not been migrated.

## Changes Applied
- Replaced the `Clear History` button in `src/app/words/results/SessionHistoryTable.tsx` with a shared `btn-destructive` button class.
- Replaced the dialog cancel/confirm buttons in `src/app/words/results/ClearHistoryDialog.tsx` with shared `btn-neutral` and `btn-destructive` button classes.
- Removed the obsolete button-only CSS-module rules from `src/app/words/results/results.module.css`:
  - `clearHistoryButton`
  - `dialogButton`
  - `dialogButtonCancel`
  - `dialogButtonDelete`
- Updated `docs/architecture/style-ref.md` so results buttons are documented as semantic-token usages instead of a remaining inconsistency.

## Architectural Impact
No layer boundaries changed. This was a workspace styling migration only.

## Preventative Rule
When a results-page action matches an existing shared semantic button intent, use the shared `btn-*` class directly instead of creating a CSS-module button style.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
