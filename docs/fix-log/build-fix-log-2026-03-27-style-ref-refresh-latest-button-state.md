---
title: Fix Log - 2026-03-27 - Style Reference Refresh for Latest Button State
---

## Context
`docs/architecture/style-ref.md` needed a small refresh so its summary language and rules matched the latest consolidation state across the workspace button system.

## Root Cause
The reference file had already absorbed the underlying button changes, but its top-level summary and a few guidance notes had not been tightened up after the latest results migration, teal toggle token extraction, and flashcard reveal-button remap.

## Changes Applied
- Updated the `style-ref.md` header summary to reflect the current semantic token rollout state.
- Added a note that `btn-nav` is often paired with a local hover utility for stronger navigation affordance.
- Added an explicit rule that `/words/results` now uses the shared semantic button tokens instead of a separate CSS-module button system.

## Architectural Impact
No code behavior changed. This was documentation maintenance only.

## Preventative Rule
When a styling consolidation step lands, refresh the style reference summary and rules in the same pass so the document communicates the current state without relying on historical context.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
