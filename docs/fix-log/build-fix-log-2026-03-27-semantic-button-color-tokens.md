---
title: Fix Log - 2026-03-27 - Semantic Button Color Tokens
---

## Context
The workspace button palette had drifted into repeated inline Tailwind color triplets, including duplicate amber button families (`amber-400` and `amber-500`) and duplicate destructive families (`rose` and `red`). After the globals override cleanup, the next consolidation step was to make button intent readable from the class names again.

## Root Cause
Button colors were being expressed ad hoc at each callsite instead of through a shared semantic layer. That made it easy for near-duplicate tones to accumulate and left no single source of truth for which color family mapped to save, caution, confirm, neutral, or destructive actions.

## Changes Applied
- Added six semantic button color classes in `src/app/globals.css`:
  - `btn-primary`
  - `btn-secondary`
  - `btn-caution`
  - `btn-confirm`
  - `btn-neutral`
  - `btn-destructive`
- Replaced repeated workspace button color triplets with those semantic classes across:
  - `src/app/words/admin/AdminSection.tsx`
  - `src/app/words/all/AllWordsSection.tsx`
  - `src/app/words/prompts/PromptsSection.tsx`
  - `src/app/words/debug/DebugSection.tsx`
  - `src/app/words/review/DueReviewSection.tsx`
  - `src/app/words/review/flashcard/FlashcardReviewSection.tsx`
  - `src/app/words/review/fill-test/FillTestReviewSection.tsx`
  - `src/app/words/add/AddSection.tsx`
  - `src/app/words/home/HomeFlowSection.tsx`
  - `src/app/words/shared/WordsShell.tsx`
- Collapsed caution actions to the amber-400 family and destructive actions to the rose family for workspace buttons.
- Removed the old `.btn-primary-action` gradient class and moved add / submit actions onto the shared `btn-primary` token.
- Updated `docs/architecture/style-ref.md` to document the new semantic token layer and the remaining exceptions.

## Architectural Impact
No layer boundaries changed. This was a UI styling consolidation inside the existing `/words` workspace.

## Preventative Rule
New workspace buttons should declare semantic intent through a shared class name first (`btn-primary`, `btn-secondary`, `btn-caution`, `btn-confirm`, `btn-neutral`, `btn-destructive`) instead of repeating raw color triplets at each callsite.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
