# Feature Spec - 2026-03-25 - Shop Admin Ingredient Management

## Problem

Shop Admin currently mixes recipe editing with a limited ingredient price tool. Admin cannot manage all ingredients in one place, cannot add new ingredients centrally, and cannot attach ingredient icons through the main workflow.

## Scope

- Split Shop Admin into two clear sections:
- Manage Ingredients
- Recipe Management
- Promote the shared ingredient catalog into the authoritative place for ingredient names, icon paths, and prices
- Allow platform admin to add shared ingredients from the Shop Admin page
- Let recipe rows link to shared ingredients for both base and special ingredient slots
- Preserve compatibility with legacy recipe rows that still lack shared ingredient keys

## Out of scope

- Automatic key merge/rename migrations across recipes
- Reward icon creation or upload flows
- Replacing the existing reward icon debug tooling

## Proposed behavior

- Shop Admin renders a lean top-level Manage Ingredients section first
- Manage Ingredients shows every known ingredient in one shared catalog, including seeded base ingredients, centrally managed custom ingredients, and keyed legacy recipe ingredients
- Each ingredient card lets admin edit:
- key for newly added ingredients only
- English name
- Chinese name
- icon path
- shared coin price
- Each ingredient card shows usage badges derived from recipes: Base, Special, or Unused
- Ingredient cards can be deleted directly from the catalog
- If a deleted ingredient is still used by recipes, Shop Admin shows a warning and the save flow removes that ingredient from recipe ingredient rows and variant mappings
- Recipe Management becomes the second section and remains focused on:
- recipe title and intro
- linking base ingredients to a recipe
- linking special ingredients to a recipe
- setting quantities
- configuring variant mappings
- Recipe rows prefer shared ingredient selection; legacy rows without keys can still be repaired in place by linking them to a managed ingredient

## Layer impact

- UI: split Shop Admin into Manage Ingredients and Recipe Management sections
- Domain: expand ingredient catalog shaping to merge seeded, shared, and recipe-referenced ingredients
- Service: extend ingredient catalog reads and writes with `icon_path`
- Service: ingredient catalog save also removes deleted ingredient keys from `shop_recipes`
- DB: add `icon_path` to `shop_ingredient_prices`

## Edge cases

- Ingredient exists in recipes but not yet in `shop_ingredient_prices`
- Ingredient is used in both base and special recipe sections
- Deleting an ingredient may collapse a variant mapping into a duplicate match signature; the earliest surviving rule should win
- Existing recipe row has a name but no ingredient key
- Newly added ingredient has no icon path yet
- Admin changes a shared label and existing recipe rows need to stay aligned on save

## Risks

- Allowing freeform key edits for existing ingredients could break recipe links
- Legacy recipe rows could remain half-migrated if the UI requires a key too aggressively
- Child-facing ingredient icon rendering could drift if runtime still relies on static catalog data only

## Test Plan

- Unit tests for merged ingredient catalog shaping from seeded, shared, and recipe-derived sources
- Unit tests for ingredient usage badges and icon-path precedence
- Unit tests for ingredient draft validation
- Unit tests for removing deleted ingredient keys from localized recipe rows and variant rules
- Regression tests for recipe draft validation with keyed and legacy rows
- Focused verification of Shop Admin save flows for ingredient catalog updates

## Acceptance criteria

- Shop Admin shows two sections: Manage Ingredients and Recipe Management
- Admin can add a new shared ingredient with bilingual names, icon path, and price
- Shared ingredient cards show whether each ingredient is used in base recipes, special recipes, or neither
- Admin can delete an ingredient, and saving removes it from any recipe rows or variant mappings that still reference it
- Recipe base and special rows can link to the shared ingredient catalog
- Existing legacy recipe rows remain editable while cleanup is in progress

## Open questions

- Should deleted ingredient cleanup eventually move into a single DB-side transaction or RPC for stronger atomicity?
