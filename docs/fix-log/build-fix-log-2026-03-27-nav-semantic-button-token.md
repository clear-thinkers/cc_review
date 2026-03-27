---
title: Fix Log - 2026-03-27 - Nav Semantic Button Token
---

## Context
After the semantic action button cleanup, one workspace button family was still represented as repeated raw gold token strings. Those buttons were primarily used for pagination, tab switching, page navigation, and other controls that move the user without changing persisted data.

## Root Cause
The gold workspace button look had been preserved during the globals override cleanup, but it never received a semantic class name. That left a common non-mutating control style readable only through raw color tokens instead of intent.

## Changes Applied
- Added `btn-nav` to `src/app/globals.css` as the semantic class for the workspace gold navigation style.
- Replaced repeated gold token strings with `btn-nav` across:
  - `src/app/words/add/AddSection.tsx`
  - `src/app/words/all/AllWordsSection.tsx`
  - `src/app/words/admin/AdminSection.tsx`
  - `src/app/words/prompts/PromptsSection.tsx`
  - `src/app/words/review/fill-test/FillTestReviewSection.tsx`
  - `src/app/words/shared/WordsShell.tsx`
  - `src/app/words/home/HomeFlowSection.tsx`
- Updated `docs/architecture/style-ref.md` so `btn-nav` is documented as the default token for page navigation, pagination, tab switches, viewer close actions, and other non-mutating flow controls.

## Architectural Impact
No layer boundaries changed. This was a workspace styling consolidation only.

## Preventative Rule
When a workspace control primarily changes location, view state, or flow position without mutating persisted content, prefer `btn-nav` instead of repeating the gold workspace token string inline.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
