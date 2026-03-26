# Feature Spec — 2026-03-23 — Child Shop Recipe Unlocks

## Status: Draft

## Problem

Children can currently earn coins through quiz play, but there is no child-facing place to spend those coins on a meaningful collection system.

The requested behavior is:
- Add a new child-only shop page where coins can be spent to unlock food recipes
- Show recipes in a fixed 3x3 icon wall
- Keep locked tiles greyed out by default
- Unlock one recipe per food type, not one per expression/variant image
- Support recipe metadata with optional specialty-ingredient slots that can explain which extra ingredients produce each specialty art variant
- Show a coin bag with the child user's current wallet balance
- Use a single maintainable script for all coin-spend logic instead of scattering hardcoded costs across components
- Store recipe formula data in a new database table

## Scope

- Add a new top-level page at `/words/shop`
- Restrict the page to child users only
- Display a 3x3 recipe wall with 9 fixed slots
- Map the initial recipe catalog from the existing `public/rewards` food art, deduped to one entry per food type
- Persist unlocked recipes per child user
- Spend 25 coins to unlock a recipe
- Display recipe details in a popup after unlock
- Store recipe formulas, special-ingredient slots, and variant rules in a new backend table
- Render recipe metadata in the child user's active app language, with English fallback when a translation is still missing
- Centralize spend rules in a dedicated domain script

## Out of Scope

- Parent-facing shop management UI
- Real-money purchases or payment integration
- Consumable ingredient inventory
- Crafting timers, cooldowns, or production queues
- Drag-and-drop placement, room decoration, or bakery furniture systems
- Admin authoring UI for recipes in v1
- Multi-step cooking gameplay beyond unlock + inspect
- Cross-user sharing of unlocked recipes
- Any change to quiz coin earning rules

## Proposed Behavior

### 0. Reward asset naming and canonical unlock art

- Reward PNG filenames follow this convention:
  - `{food}_{ingredients}_{mood}.png`
  - `food` is the food type token
  - `ingredients` is either `plain` or one or more specialty ingredient tokens joined by `+`
  - `mood` is the baked-in facial expression or mood effect for that final rendered art
- Example:
  - `donut_chocolate+sprinkles_sleep.png`
  - food type: `donut`
  - specialty ingredients: `chocolate`, `sprinkles`
  - mood effect: `sleep`
- Asset filename parsing is a maintenance-time concern only. The app does not scan `public/rewards` at runtime.
- Runtime rendering still reads `shop_recipes.variant_icon_rules` as the source of truth for recipe art.
- Unlocking a recipe unlocks one canonical icon for that food type, not every PNG variant.
- When a `plain` asset exists, that `plain` icon is the canonical unlock art.
- If a food type temporarily has no `plain` asset, the recipe may still stay unlockable if its recipe row explicitly designates a fallback canonical unlock icon.
- Current known exception:
  - `milkshake` is allowed to stay unlockable even while `milkshake_plain.png` is missing.
- Once the recipe is unlocked, the child can open it and view its ingredients.

### 1. Route and access model

- Add a new route: `/words/shop`.
- Only child users can access this route.
- Parent users who navigate directly to `/words/shop` are redirected using the same route-guard pattern already used elsewhere in the words app.
- The sidebar/nav should include `Shop` only when the current profile can access it.

### 2. 3x3 recipe wall

- The main UI is a fixed 3x3 wall with 9 total tiles.
- All 9 tiles always render, even when the current recipe catalog contains fewer than 9 foods.
- Empty future slots remain greyed out placeholders.
- Locked recipe tiles show a grey background and locked state styling.
- Unlocked recipe tiles show the food item's icon.
- Unlocked recipe tiles are clickable and open the recipe popup.
- Locked recipe tiles are not clickable for recipe details.
- Each recipe tile includes an unlock action when the child has enough coins.
- Unlocking a recipe immediately swaps the tile from locked grey state to the unlocked food icon.

### 3. Initial catalog mapping

- Initial catalog entries are deduped to one recipe per food type from the current `public/rewards` assets.
- Expression or mood variants are not separate unlocks.
- Asset food tokens may use hyphenated names such as `bubble-tea` or `rice-ball`.
- Recipe slugs remain stable database ids such as `bubble_tea` and `rice_ball`.
- Maintenance-time sync logic is responsible for translating asset food tokens to recipe slugs.
- The initial food-type catalog for v1 is:
  - `bubble_tea`
  - `bun`
  - `cake`
  - `donut`
  - `milkshake`
  - `ramen`
  - `rice_ball`
  - `tangyuan`
  - `zongzi`
- The first 9 wall positions are seeded with those food types in explicit display order.
- In v1, the 9 seeded food types fill the full wall.
- Display order must be stored explicitly in recipe data, not inferred from filesystem order at runtime.
- An inactive recipe in a named wall position renders as a locked placeholder, identical to an empty future slot. Its position is never backfilled by the next active recipe.

### 4. Unlock economy

- Unlocking any recipe costs exactly 25 coins in v1.
- The current wallet balance is shown in a coin bag UI at the top of the page.
- Unlock buttons are disabled when the user has fewer than 25 coins.
- Unlocking a recipe deducts coins from the user's wallet immediately after successful persistence.
- A recipe can only be unlocked once per user.
- Duplicate unlock attempts must be idempotent and must not double-charge coins.
- `shop.ts` reads `unlock_cost_coins` from the recipe row. `25` exists only as a database column default, not as a JS constant anywhere in the codebase.

### 5. Food type vs. variant model

- Unlocks happen at the food-type level.
- Example: `donut` is one unlock, even though multiple donut art variants exist.
- Each unlocked recipe contains:
  - required base ingredients
  - zero, one, or more specialty-ingredient options
  - rules describing how specialty ingredient combinations map to art variants
- Specialty ingredients do not create separate paid unlocks in v1.
- The mood/effect is determined by the final PNG variant and may belong to an ingredient combination rather than to a single ingredient in isolation.
- This means the app should treat mood as metadata on the rendered variant, not as a guaranteed property of one ingredient token by itself.

### 6. Special-ingredient slots

- Each recipe supports `0`, `1`, or more specialty-ingredient options grouped into one or more slots.
- A specialty-ingredient slot represents optional extra ingredients layered on top of base ingredients.
- A rendered specialty variant may require one ingredient or multiple ingredients.
- The data model must support:
  - naming the slot
  - listing allowed ingredient options
  - allowing more than one selection when a food has combination variants
  - describing the option in child-friendly language
- In v1, the recipe popup displays these specialty ingredients as recipe information only.
- In v1, specialty ingredients are descriptive metadata only; there is no inventory or consumption system for them yet.
- The schema must still be ready for future interactive variant selection without redesign.

### 7. Recipe popup

- After a recipe is unlocked, clicking the recipe tile opens a popup/modal.
- The popup displays:
  - the food title
  - a brief intro
  - required base ingredients and quantities
  - optional specialty-ingredient slots and their option notes
- The popup does not need cooking actions in v1.
- The popup is read-only in v1.

### 8. Spend logic centralization

- All recipe coin-spend rules must live in one dedicated script, proposed path: `src/lib/shop.ts`.
- This module is the source of truth for:
  - recipe unlock cost
  - affordability checks
  - unlock request validation
  - duplicate unlock handling
  - success/failure result shapes
- UI components must not hardcode `25` directly.
- Service-layer persistence helpers may still exist, but UI-facing business rules should route through the centralized shop module.

## Data Model

### Table 1: `shop_recipes`

This is the main new recipe-formula table requested for the feature.

Suggested columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `slug` | text | Stable recipe id, e.g. `donut` |
| `title` | text | Display title |
| `title_i18n` | jsonb | `{ en, zh }` localized title content |
| `display_order` | integer | Explicit wall position order |
| `is_active` | boolean | Allows soft-hiding future recipes |
| `variant_icon_rules` | jsonb | Maps specialty-ingredient combos to image paths |
| `intro` | text | Brief food description |
| `intro_i18n` | jsonb | `{ en, zh }` localized intro content |
| `unlock_cost_coins` | integer | Defaults to `25` in v1 |
| `base_ingredients` | jsonb | Array of `{ name, quantity, unit }` |
| `base_ingredients_i18n` | jsonb | `{ en: [...], zh: [...] }` localized ingredient rows |
| `special_ingredient_slots` | jsonb | Array of specialty-ingredient slot descriptors |
| `special_ingredient_slots_i18n` | jsonb | `{ en: [...], zh: [...] }` localized slot labels and notes |
| `created_at` | timestamptz | Audit timestamp |
| `updated_at` | timestamptz | Audit timestamp |

Suggested `special_ingredient_slots` shape:

```json
[
  {
    "slotKey": "specialty_ingredients",
    "label": "Special Ingredients",
    "maxSelections": 2,
    "options": [
      { "key": "chocolate", "label": "Chocolate", "effect": "used in specialty recipes" },
      { "key": "sprinkles", "label": "Sprinkles", "effect": "used in specialty recipes" }
    ]
  }
]
```

Suggested `variant_icon_rules` shape:

```json
[
  {
    "match": [],
    "iconPath": "/rewards/donut_plain.png"
  },
  {
    "match": ["strawberry"],
    "iconPath": "/rewards/donut_strawberry_ambitious.png"
  },
  {
    "match": ["chocolate", "sprinkles"],
    "iconPath": "/rewards/donut_chocolate+sprinkles_sleep.png"
  }
]
```

Rendering rule:

- `match: []` is the canonical default icon rule when a plain or explicit fallback unlock icon is available.
- Rendering uses one lookup path only: find all rules whose `match` array is a subset of the currently active special ingredients.
- When multiple rules match, the most specific rule wins, defined as the rule with the longest `match` array.
- This removes the need for a separate `base_icon_path` column.

### Recipe data ownership

- `base_ingredients` is authored manually and is not inferred from filenames.
- `intro`, `title`, `unlock_cost_coins`, and `display_order` are authored manually.
- Localized child-facing recipe metadata is stored in the `*_i18n` columns and resolved from the active app locale.
- English remains the compatibility baseline in `title`, `intro`, `base_ingredients`, and `special_ingredient_slots`.
- When the active locale is `zh` but a translation is blank, the child UI falls back to English for that field.
- `variant_icon_rules` should be generated or refreshed from `public/rewards` filenames during maintenance, then persisted to `shop_recipes`.
- `special_ingredient_slots` may be generated from asset ingredient tokens as a baseline, then refined manually for child-friendly labels and notes.

### Asset sync maintenance flow

- The app must not infer shop art directly from the filesystem at runtime.
- Instead, maintain a sync script that:
  - scans `public/rewards`
  - parses filenames using the current naming convention
  - groups assets by food type
  - emits SQL updates for `shop_recipes.variant_icon_rules`
  - emits a baseline `special_ingredient_slots` structure from the parsed ingredient tokens
- This script is the preferred maintenance path when new PNGs are added later.
- Hand-authored recipe metadata such as `base_ingredients` remains in `shop_recipes` and is maintained separately from asset sync.

### Table 2: `shop_recipe_unlocks`

Tracks which recipes each child has unlocked.

Suggested columns:

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to `users.id` |
| `family_id` | uuid | Denormalized for RLS |
| `recipe_id` | uuid | FK to `shop_recipes.id` |
| `coins_spent` | integer | Usually `25` in v1 |
| `unlocked_at` | timestamptz | Server-authored timestamp |

Constraints:

- Primary key or unique constraint on `(user_id, recipe_id)`
- Child unlock data is user-scoped, not family-shared
- `coins_spent` is set by the server from the recipe row's `unlock_cost_coins` value at unlock time. It is not accepted from the client.

## Persistence and transaction model

- Wallet balance remains the source of truth for spendable coins.
- Recipe unlocks must not derive from quiz-session totals.
- `src/lib/shop.ts` should define the unlock result contract, validation rules, and affordability semantics before or alongside the backend unlock implementation.
- Unlocking a recipe should happen as one atomic backend operation:
  - verify recipe exists and is active
  - verify user has not already unlocked it
  - verify wallet has enough coins
  - deduct coins
  - insert unlock record
- set `coins_spent` from the server-side `unlock_cost_coins` value
- This should be implemented as a database RPC or equivalent transactional server-side path.
- The client-side shop module should call that single operation and normalize the result for the UI.

## RLS and role rules

- `shop_recipes`
  - read: allowed to all family members
  - write: platform admin or migration/seed only in v1
- `shop_recipe_unlocks`
  - read: family-scoped read is acceptable if parent visibility is desired later
  - insert: only current user for their own `user_id`
  - update/delete: disallowed in normal client flow
- UI still enforces child-only shop access regardless of broader read permissions.

## UI Structure

### New files

- `src/app/words/shop/page.tsx`
- `src/app/words/shop/ShopPage.tsx`
- `src/app/words/shop/ShopSection.tsx`
- `src/app/words/shop/RecipeModal.tsx`
- `src/app/words/shop/shop.types.ts`
- `src/app/words/shop/shop.strings.ts` or additions to `words.strings.ts`
- `src/lib/shop.ts`

### Existing integration points

- Add `/words/shop` to route permissions
- Add `shop` to shared shell/nav page types
- Add navigation label strings
- Extend shared words workspace rendering to include the new shop section

## Layer Impact

### UI

- New child-facing shop page and modal
- New coin bag summary display
- New 3x3 wall rendering logic
- Locked/unlocked tile states

### Shared state

- Load recipe catalog + unlocked state on page load
- Load current wallet balance
- Refresh wall and balance after successful unlock
- Render the canonical unlock icon from persisted recipe data, not from live filename parsing in the browser

### Domain layer

- New `src/lib/shop.ts` module for all spend logic
- Avoid hardcoded coin costs in React components

### Service layer

- Add functions to:
  - list recipes
  - list unlocks for current user
  - fetch wallet balance
  - unlock a recipe through one atomic action

### Database

- Add `shop_recipes`
- Add `shop_recipe_unlocks`
- Add indexes and RLS policies
- Seed initial recipe rows for the 9 current food types
- Add a maintenance script that can regenerate asset-driven recipe art mappings when reward PNGs change

## Edge Cases

- Child has exactly 25 coins and unlocks one recipe.
- Child has fewer than 25 coins.
- Child double-clicks unlock rapidly.
- Same recipe unlock request is retried after a slow network response.
- Recipe exists in wall order but is marked inactive.
- Catalog has fewer than 9 active recipes.
- Recipe has no special-ingredient slots.
- Recipe has one special-ingredient slot.
- Recipe has two special-ingredient slots.
- Recipe has a specialty variant requiring two ingredients joined by `+`.
- Variant icon rule is missing for a listed special ingredient combo.
- Recipe has no `plain` asset but is intentionally kept unlockable through an explicit fallback rule.
- Parent opens direct link to `/words/shop`.
- Old users have a wallet row but no unlock rows yet.

## Risks

- If unlock spend and unlock insert are not transactional, duplicate charges are possible.
- If display order is inferred from files instead of persisted data, future asset additions will silently reshuffle the wall.
- If the UI treats each image file as a unique unlock, the model will drift from the requested one-food-type design.
- If special-ingredient slots assume one ingredient always maps to one mood, future combo variants will produce misleading metadata.
- If shop balance is derived from quiz history instead of wallet state, the child could see incorrect spendable coins.

## Test Plan

- Service tests:
  - list recipes returns explicit display order
  - unlock succeeds with sufficient wallet balance
  - unlock fails with insufficient coins
  - duplicate unlock does not double-charge
  - inactive recipe cannot be unlocked
  - wallet balance decreases by exactly 25 on success
  - canonical unlock icon selection prefers `plain` when present
  - explicit fallback unlock icon works for foods without a `plain` asset
- UI tests:
  - child sees `Shop` nav item
  - parent does not see `Shop` nav item
  - locked tile renders grey state
  - unlocked tile renders recipe icon
  - coin bag shows current balance
  - unlock button disables when balance < 25
  - unlocked tile opens popup
  - popup shows intro and ingredient quantities
  - popup shows special-ingredient slot labels when configured
  - combo-ingredient variants resolve to the most specific icon rule
- Permission tests:
  - parent direct route access is blocked
  - child unlock writes only to their own `user_id`

## Implementation Sequence

1. Add route, nav, and page-shell support for `/words/shop`.
2. Add database migration for `shop_recipes` and `shop_recipe_unlocks`.
3. Seed the initial 9 food-type recipes with explicit display order.
4. Add `src/lib/shop.ts` as the single spend-logic entry point and define the unlock contracts/result shapes with the backend path design.
5. Add the transactional unlock backend path to implement that contract.
6. Add an asset sync maintenance script for reward PNG parsing and SQL generation.
7. Build the 3x3 wall and coin bag UI.
8. Add unlocked recipe popup.
9. Add tests for permissions, spend logic, and wall rendering.

## Acceptance Criteria

- A child user can open `/words/shop`.
- A parent user cannot use `/words/shop`.
- The shop page shows a 3x3 wall with 9 visible positions.
- The initial 9 food types appear in fixed order and fill the wall.
- Locked recipes render greyed out.
- Unlocking a recipe costs 25 coins.
- The coin bag shows the user's current wallet balance.
- After unlock, the tile shows the food icon and becomes clickable.
- Clicking an unlocked recipe opens a popup with intro and ingredient quantities.
- Each recipe can describe specialty-ingredient options, including multi-ingredient combinations.
- All coin-spend rules are maintained through one centralized shop logic script rather than UI hardcoding.
- Reward PNG additions can be incorporated through a maintenance sync flow instead of manual runtime inference.
