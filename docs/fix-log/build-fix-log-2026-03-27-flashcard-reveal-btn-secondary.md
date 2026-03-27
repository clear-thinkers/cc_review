---
title: Fix Log - 2026-03-27 - Flashcard Reveal Button Secondary Token
---

## Context
The flashcard reveal/hide control on `/words/review/flashcard` was still using a one-off blue utility string instead of the shared semantic button token layer documented in `style-ref.md`.

## Root Cause
The reveal/hide action had not been revisited during the earlier semantic token consolidation, so it retained a bespoke blue style even though its usage matched the shared secondary-action pattern.

## Changes Applied
- Replaced the flashcard reveal/hide button styling in `src/app/words/review/flashcard/FlashcardReviewSection.tsx` with `btn-secondary`.
- Updated `docs/architecture/style-ref.md` so the toggle-state table documents the reveal/hide control as `btn-secondary`.

## Architectural Impact
No architecture or layer boundaries changed. This was a workspace styling consistency update only.

## Preventative Rule
If a workspace button represents an existing semantic intent, map it to the shared `btn-*` class for that intent instead of leaving a bespoke color triplet at the callsite.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
