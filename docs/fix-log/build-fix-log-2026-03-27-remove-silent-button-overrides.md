---
title: Fix Log - 2026-03-27 - Remove Silent Button Overrides
---

## Context
The app designer flagged the `/words` workspace button system as hard to maintain because two global selectors in `src/app/globals.css` silently changed the meaning of `bg-black` and bare `border` on buttons inside `.kids-page`.

## Root Cause
Shared button visuals were being applied indirectly through element selectors instead of explicit button classes or explicit utility tokens at the callsite. That made JSX class strings misleading and caused new buttons to pick up unexpected styles.

## Changes Applied
- Replaced the hidden `button.bg-black` styling hook with an explicit `.btn-primary-action` class in [globals.css](/d:/Documents/coding/cc_review/src/app/globals.css).
- Removed the `button.border:not(.admin-toolbar-button)` override blocks from [globals.css](/d:/Documents/coding/cc_review/src/app/globals.css).
- Replaced `bg-black` button usage with `btn-primary-action` in [AddSection.tsx](/d:/Documents/coding/cc_review/src/app/words/add/AddSection.tsx) and [FillTestReviewSection.tsx](/d:/Documents/coding/cc_review/src/app/words/review/fill-test/FillTestReviewSection.tsx).
- Replaced bare-border button usage with explicit workspace-neutral tokens in [AddSection.tsx](/d:/Documents/coding/cc_review/src/app/words/add/AddSection.tsx), [AllWordsSection.tsx](/d:/Documents/coding/cc_review/src/app/words/all/AllWordsSection.tsx), [AdminSection.tsx](/d:/Documents/coding/cc_review/src/app/words/admin/AdminSection.tsx), [PromptsSection.tsx](/d:/Documents/coding/cc_review/src/app/words/prompts/PromptsSection.tsx), [FillTestReviewSection.tsx](/d:/Documents/coding/cc_review/src/app/words/review/fill-test/FillTestReviewSection.tsx), and [WordsShell.tsx](/d:/Documents/coding/cc_review/src/app/words/shared/WordsShell.tsx).
- Updated [style-ref.md](/d:/Documents/coding/cc_review/docs/architecture/style-ref.md) to document the explicit replacement patterns.

## Architectural Impact
UI-only styling consolidation. No data flow, API, schema, scheduler, or layer boundary behavior changed.

## Preventative Rule
Do not use global element selectors to reinterpret Tailwind utility tokens on buttons. Shared visuals must be expressed as a named class or as explicit border/background/text utilities where the button is declared.

## Docs Updated
- AI_CONTRACT.md: no - no agent-policy change
- 0_ARCHITECTURE.md: no - no architecture boundary change
- 0_BUILD_CONVENTIONS.md: no - existing styling guidance still applies
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
