---
title: Fix Log - 2026-03-27 - Home Flow Badge Btn Neutral
---

## Context
The Home flow step-number badge was still using the old gold workspace palette directly even after the rest of the workspace had been consolidated onto shared semantic button colors.

## Root Cause
The step-number badge is decorative rather than interactive, so it was left behind while button-focused cleanup work moved the actual controls onto semantic classes.

## Changes Applied
- Replaced the Home flow step-number badge color styling in `src/app/words/home/HomeFlowSection.tsx` with the shared `btn-neutral` semantic class.
- Removed the stale Home flow badge inconsistency note from `docs/architecture/style-ref.md`.

## Architectural Impact
No layer boundaries changed. This was a visual consistency cleanup only.

## Preventative Rule
If a decorative chip or badge intentionally shares the workspace action palette, prefer an existing semantic color class over repeating raw color tokens.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
