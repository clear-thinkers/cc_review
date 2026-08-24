---
title: Fix Log – 2026-08-23 – Shop Kitchen ingredient labels stayed English under zh locale
---

## Context

Live testing of the new Shop Kitchen page (`/words/shop/kitchen`, roadmap item J, spec `docs/feature-specs/2026-08-23-kitchen-page.md`) in Chinese locale mode: ingredient names in both the Cupboard and the Recipe Book rendered in English regardless of the active locale.

## Root Cause

`KitchenSection.tsx` had five places that read an ingredient's display label by hardcoding `.en` off `ShopIngredientPrice.labelI18n` instead of resolving it against the active locale:

- `CupboardModal`'s ingredient grid (line 101, pre-fix) — and the component didn't even receive a `locale` prop to fix this locally.
- `RecipeBookModal`'s per-recipe required-ingredients line (line 226).
- `RecipeBookModal`'s "Missing: ..." readiness text (line 237).
- The client-side pre-check missing-ingredients notice in `handleCook` (line 379).
- The `insufficient_ingredients` RPC-rejection notice in `handleCook` (line 393).

Recipe *titles* were already locale-correct (`getShopRecipeContentForLocale`, used throughout) — only the separate `shop_ingredient_prices.label_i18n` lookups were wrong. The correct pattern already existed elsewhere in the codebase — the paragraph-quiz ingredient reward panel (`ParagraphQuizReviewSection.tsx`, 2026-08-22 spec) resolves `ingredient.labelI18n` via `resolveShopLocalizedString(..., locale, fallback)` — but the Kitchen spec's implementation didn't reuse it for the ingredient-price lookups.

## Changes Applied

- `src/lib/shop.ts`: added `resolveShopIngredientLabel(record, locale, fallback)`, a thin wrapper around the existing `resolveShopLocalizedString` that also handles a missing/undefined `ShopIngredientPrice` record (the five Kitchen call sites all look up ingredients from a `Map` that can miss). Placed alongside `resolveShopLocalizedString`/`resolveShopLocalizedList` since it's the same family of locale-resolution helpers, reusable outside the Kitchen.
- `src/app/words/shop/kitchen/KitchenSection.tsx`: replaced all five hardcoded `.en` lookups with `resolveShopIngredientLabel(...)`; added a `locale` prop to `CupboardModal` (it previously received `strings` but not `locale`) and passed it through at the call site.
- `src/lib/shop.test.ts`: added a `resolveShopIngredientLabel` describe block (5 cases: zh label, en label, missing record, record with no `labelI18n`, and the existing zh-blank→en→fallback chain) — the closest testable seam per the bug-fix skill's UI test-seam priority (extracted pure helper > subcomponent > smoke test).

## Architectural Impact

None — pure UI/domain-layer fix within existing boundaries (`src/lib/shop.ts` domain helper, `src/app/words/shop/kitchen/` UI). No schema, RPC, or service-layer change; no new strings (`kitchen.strings.ts` was already correct — this was a data-resolution bug, not a missing-copy bug).

## Preventative Rule

Any component reading a `*_i18n`/`labelI18n` field directly (instead of through `resolveShopLocalizedString`/`resolveShopIngredientLabel`/`getShopRecipeContentForLocale`) is very likely a locale bug — `.en` hardcoded as a shortcut is the recurring failure shape. When reviewing a new page that renders shop-adjacent localized content, grep the new file for `\.en\b` before considering it done.

## Docs Updated

- AI_CONTRACT.md: no — no boundary change.
- 0_ARCHITECTURE.md: no — no behavior/rule change (bilingual rendering was already the documented requirement; this fixes an implementation gap against it).
- 0_BUILD_CONVENTIONS.md: no — no convention change.
- 0_PRODUCT_ROADMAP.md: no — item J's row doesn't need a line-item update for a bug fix within an already-tracked in-progress feature.

## Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run src/lib/shop.test.ts src/app/words/shop/kitchen/kitchen.test.ts`: 63/63 pass (5 new).
- `npm test`: 65 files / 850 tests pass.
- `npm run check:encoding`: pass.
- **Not done**: a live in-browser click-through in zh locale — no browser-automation tool was available in this session. The user's own dev server (already running on :3000) will pick up the change via Fast Refresh; recommend confirming visually in zh mode before considering this closed.
