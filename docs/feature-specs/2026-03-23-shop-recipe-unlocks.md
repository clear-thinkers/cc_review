# Feature Spec — 2026-03-23 — Child Shop Recipe Unlocks

## Status: Draft

## Problem

Children can currently earn coins through quiz play, but there is no child-facing place to spend those coins on a meaningful collection system.

The requested behavior is:
- Add a new child-only shop page where coins can be spent to unlock food recipes
- Show recipes in a fixed 3x3 icon wall
- Keep locked tiles greyed out by default
- Unlock one recipe per food type, not one per expression/variant image
- Support recipe metadata with 1-2 optional special-ingredient slots that can affect the resulting facial expression or special effect of the food item
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
- `trouphy_1.png` is excluded because it is not a food recipe.
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
  - zero, one, or two special-ingredient slots
  - rules describing how special ingredients affect the resulting art variant
- Special ingredients do not create separate paid unlocks in v1.
- Special ingredients are recipe metadata that explain why one food type may appear with different facial expressions or effects.

### 6. Special-ingredient slots

- Each recipe supports `0`, `1`, or `2` special-ingredient slots.
- A special-ingredient slot represents an optional modifier layer on top of base ingredients.
- Special ingredients can influence:
  - facial expression
  - mood
  - decorative effect
  - other future visual traits
- The data model must support naming the slot, listing allowed options, and describing the visual effect of each option.
- In v1, the recipe popup displays these optional slots as part of recipe information.
- In v1, special ingredients are descriptive metadata only; there is no inventory or consumption system for them yet.
- The schema must still be ready for future interactive variant selection without redesign.

### 7. Recipe popup

- After a recipe is unlocked, clicking the recipe tile opens a popup/modal.
- The popup displays:
  - the food title
  - a brief intro
  - required base ingredients and quantities
  - optional special-ingredient slots and their possible effect notes
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
| `display_order` | integer | Explicit wall position order |
| `is_active` | boolean | Allows soft-hiding future recipes |
| `variant_icon_rules` | jsonb | Maps special-ingredient combos to image paths |
| `intro` | text | Brief food description |
| `unlock_cost_coins` | integer | Defaults to `25` in v1 |
| `base_ingredients` | jsonb | Array of `{ name, quantity, unit }` |
| `special_ingredient_slots` | jsonb | Array of 0-2 slot descriptors |
| `created_at` | timestamptz | Audit timestamp |
| `updated_at` | timestamptz | Audit timestamp |

Suggested `special_ingredient_slots` shape:

```json
[
  {
    "slotKey": "expression",
    "label": "Expression Boost",
    "maxSelections": 1,
    "options": [
      { "key": "smile_syrup", "label": "Smile Syrup", "effect": "smile face" },
      { "key": "sleepy_cream", "label": "Sleepy Cream", "effect": "sleepy face" }
    ]
  }
]
```

Suggested `variant_icon_rules` shape:

```json
[
  {
    "match": [],
    "iconPath": "/rewards/donut_smile_1.png"
  },
  {
    "match": ["sleepy_cream"],
    "iconPath": "/rewards/donut_sleep_1.png"
  },
  {
    "match": ["spark_pop"],
    "iconPath": "/rewards/donut_excited_1.png"
  }
]
```

Rendering rule:

- `match: []` is the canonical default icon rule.
- Rendering uses one lookup path only: find all rules whose `match` array is a subset of the currently active special ingredients.
- When multiple rules match, the most specific rule wins, defined as the rule with the longest `match` array.
- This removes the need for a separate `base_icon_path` column.

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
- Variant icon rule is missing for a listed special ingredient combo.
- Parent opens direct link to `/words/shop`.
- Old users have a wallet row but no unlock rows yet.

## Risks

- If unlock spend and unlock insert are not transactional, duplicate charges are possible.
- If display order is inferred from files instead of persisted data, future asset additions will silently reshuffle the wall.
- If the UI treats each image file as a unique unlock, the model will drift from the requested one-food-type design.
- If special-ingredient slots are modeled too narrowly, future variant rules will require a schema rewrite.
- If shop balance is derived from quiz history instead of wallet state, the child could see incorrect spendable coins.

## Test Plan

- Service tests:
  - list recipes returns explicit display order
  - unlock succeeds with sufficient wallet balance
  - unlock fails with insufficient coins
  - duplicate unlock does not double-charge
  - inactive recipe cannot be unlocked
  - wallet balance decreases by exactly 25 on success
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
- Permission tests:
  - parent direct route access is blocked
  - child unlock writes only to their own `user_id`

## Implementation Sequence

1. Add route, nav, and page-shell support for `/words/shop`.
2. Add database migration for `shop_recipes` and `shop_recipe_unlocks`.
3. Seed the initial 9 food-type recipes with explicit display order.
4. Add `src/lib/shop.ts` as the single spend-logic entry point and define the unlock contracts/result shapes with the backend path design.
5. Add the transactional unlock backend path to implement that contract.
6. Build the 3x3 wall and coin bag UI.
7. Add unlocked recipe popup.
8. Add tests for permissions, spend logic, and wall rendering.

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
- Each recipe can describe up to two optional special-ingredient slots.
- All coin-spend rules are maintained through one centralized shop logic script rather than UI hardcoding.
