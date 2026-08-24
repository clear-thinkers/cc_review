---
title: Fix Log – 2026-08-23 – Shop Kitchen Recipe Book shows no recipes
---

## Context

Live QA of the newly-built Shop Kitchen feature (`docs/feature-specs/2026-08-23-kitchen-page.md`, roadmap item J) reported: recipes already unlocked via `/words/shop` do not appear in the Kitchen's Recipe Book.

## Root Cause

**Not a code defect.** Queried the dev Supabase project directly (service-role read, bypassing RLS) and confirmed every row in `shop_recipes` has `cook_method = null` — no platform admin has yet used the new Shop Admin "Cook Method" field (`ShopAdminSection.tsx`) to opt any recipe into the Kitchen.

`KitchenSection.tsx`'s Recipe Book intentionally renders only `recipes.filter(r => r.cookMethod !== null)` (spec: "never appears in the Recipe Book" until `cook_method` is set). With zero recipes cookable, the book is correctly empty — including for recipes that *are* unlocked in `shop_recipe_unlocks` (verified several recent unlocks exist for two test users, dated 2026-08-24 and 2026-03-24/25). Unlock state was never the problem; cookability state was never set.

Traced the full write path to rule out a silent-failure alternative (e.g. the admin field appearing to save but not persisting): `ShopAdminSection.tsx handleRecipeSave` → `PATCH /api/shop-admin/recipes` → `normalizeShopRecipeAdminDraft` → `shop_recipes.update({ cook_method: ... })` (`src/app/api/shop-admin/recipes/route.ts:300`) → response mapped back through `normalizeShopCookMethod`. All of this is wired correctly; the field has simply never been used yet in this dev project.

## Changes Applied

None. No code, schema, or data was changed — this is expected behavior for a freshly-migrated column that defaults to `null`, not a bug.

**Action needed to see recipes in the Kitchen:** go to `/words/shop-admin`, select a recipe, set "Cook Method (Shop Kitchen)" to Stove or Oven, and save. That recipe will then appear in the Recipe Book (locked or ready depending on the viewing child's unlock state).

## Documentation gap found while diagnosing (raised per `AI_CONTRACT.md`'s "never silently reconcile")

`0_PRODUCT_ROADMAP.md`'s item J row currently reads: *"Not yet done: `supabase db push` (... migration file is checked in but unapplied), `scripts/verify-rls.ts` new sections for the two new tables (written into the plan but not yet added to the script or run)..."* Both claims are now false:
- `npx supabase migration list` shows `20260823000000` present in both the Local and **Remote** columns — the migration is applied to the dev project.
- `scripts/verify-rls.ts` already contains `shop_cooked_dishes`/`shop_ingredient_consumptions` sections (39 matching occurrences), not absent as the roadmap states.

Did not edit the roadmap row myself — whether it should now read "shipped" still depends on whether `verify-rls.ts` has actually been *run* successfully and the full live-QA checklist completed, neither of which this investigation confirmed. Flagging for whoever closes out item J to update the row rather than leaving it silently wrong.

## Architectural Impact

None — no layer boundaries touched.

## Preventative Rule

When a newly-shipped admin-configurable field defaults to a "nothing works yet" state (here: `cook_method IS NULL` disables cooking entirely), the feature spec's Acceptance Criteria or Test Plan should include an explicit "seed at least one recipe via Shop Admin before live-QA'ing the Kitchen" step, so live QA doesn't mistake unconfigured data for a broken feature.

## Docs Updated

- AI_CONTRACT.md: no — no boundary/convention change.
- 0_ARCHITECTURE.md: no — no behavior change.
- 0_BUILD_CONVENTIONS.md: no — no convention change.
- 0_PRODUCT_ROADMAP.md: no — flagged the staleness above but left the row for whoever closes out item J, since shipped-status also depends on unconfirmed verify-rls/live-QA completion.
