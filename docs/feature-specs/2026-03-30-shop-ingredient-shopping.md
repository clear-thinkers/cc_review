# Feature Spec — 2026-03-30 — Ingredient Shopping for Kids (Row F)

## Status: Draft

---

## Problem

Children can unlock recipes and view ingredient lists, but there is no way to act on that information in-app. The shop currently ends at "unlock + inspect." Kids have no spending goal for coins beyond recipe unlocks, and there is no sense of collection progress or completion.

The requested behavior is:
- Let kids spend coins to virtually "collect" ingredients directly from the ingredient detail view inside a recipe
- Track collected ingredients in a per-user inventory, scoped to the recipe they were purchased for
- Mark a recipe as visually "ready" when all of its base ingredients have been collected in the required quantities
- Provide a child-facing inventory page to review purchased ingredients, filterable by recipe and sortable by date

---

## Scope

- Add a "Buy" action to the ingredient detail sub-modal inside the recipe popup on `/words/shop`
- Only allow ingredient purchases for recipes the child has already unlocked
- Prices are set by the platform admin in the existing shop admin page (`shop_ingredient_prices` table)
- Track purchases in a new `shop_ingredient_purchases` table (one row per purchase event)
- Record each purchase in the existing `shop_coin_transactions` table under a new `purchase_ingredient` action type
- Add a child-only inventory page at `/words/shop/inventory`
- Show a "recipe ready" visual indicator on the recipe tile and inside the recipe modal when all base ingredients meet their required quantities
- Ingredient quantities are purchased one unit at a time; buying 3 eggs means tapping Buy three times

---

## Out of Scope

- Purchasing special/specialty ingredients (base ingredients only in v1)
- Consuming or depleting inventory after a recipe is "cooked"
- Parent-facing visibility into the child's ingredient inventory
- Cross-recipe ingredient pooling (purchases are scoped to the recipe they were bought for)
- Bulk purchase (multi-quantity in one tap)
- Refunds or ingredient returns
- Any new top-level route outside the `/words/shop` section
- Changes to coin earning rules

---

## Proposed Behavior

### 1. Ingredient detail sub-modal — Buy action

- The existing ingredient detail sub-modal currently shows: large icon, ingredient name, quantity needed.
- Add the following to the modal:
  - **Coin cost badge**: shows `{costCoins} coins` pulled from `shop_ingredient_prices` for this `ingredientKey`
  - **"Buy" button**: spends coins and records the purchase
  - **Owned count**: shows how many of this ingredient the child has already collected for this recipe (e.g., `You have: 2`)
  - **Progress indicator**: shows `{owned} / {required}` against the recipe's `base_ingredients` quantity for this ingredient
- The Buy button is **disabled** when:
  - The child's wallet has fewer coins than the ingredient's `cost_coins`
  - The ingredient has no `ingredientKey` (unpriced ingredient — cannot be purchased)
- If an ingredient has no `ingredientKey`, the sub-modal shows only the existing icon + name + quantity view with no purchase UI.
- Tapping Buy calls the `purchase_shop_ingredient` RPC (see §Data Model).
- On success: wallet balance updates, owned count increments, and the progress indicator updates immediately in the same open modal. No page reload required.
- On failure: show an inline error string (insufficient coins, ingredient unavailable, recipe not unlocked).

### 2. Recipe-ready visual indicator

- A recipe is considered **ready** when, for every ingredient in `base_ingredients` that has an `ingredientKey`, the child has purchased at least the required quantity for that recipe.
- Ingredients without an `ingredientKey` are excluded from the readiness calculation (they are informational only).
- When ready, show a visual badge or glow on:
  - The recipe tile on the wall (e.g., a small checkmark or star overlay)
  - The recipe modal header (e.g., a "Ready to Cook!" label or banner)
- "Ready" is a purely visual cue — it does not gate any further action in v1.
- Readiness is computed client-side from the loaded inventory data; no separate RPC is needed.

### 3. Ingredient inventory page — `/words/shop/inventory`

- Child-only route, access-controlled by the existing `RouteGuard` pattern.
- Add to `RouteGuard` / `permissions.ts` alongside the existing `/words/shop` entry.
- Displays all ingredients the child has ever purchased, with:
  - Ingredient icon (from `shop_ingredient_prices.icon_path` via the existing icon resolver)
  - Ingredient name (localized via `shopIngredients` catalog)
  - **Total quantity purchased** for the active filter scope (see filtering below)
- **Filter by recipe**: a dropdown or tab strip showing only the child's unlocked recipes (not all recipes). Default: "All Recipes" (aggregate across all purchases). When a recipe is selected, only purchases made in that recipe's context are shown, and each ingredient's count reflects that recipe only.
- **Sort**: by purchase date, most recent first. This is the only sort option in v1.
- Empty state: show a friendly prompt directing the child to the shop to start collecting.
- No purchase action from this page — it is view-only.

### 4. Coin history integration

- Ingredient purchases appear in the existing coin history modal (the coin bag button on `/words/shop`).
- History rows for ingredient purchases display: ingredient name + recipe name (e.g., "Bought Egg for Cake").
- This requires extending the history modal to resolve ingredient names from `ingredient_key` in addition to the existing recipe-name resolution.

### 5. Navigation

- Add an "Inventory" link or tab accessible from the `/words/shop` page (e.g., a button near the coin bag or below the recipe wall).
- The link navigates to `/words/shop/inventory`.
- Do not add a top-level nav item; inventory is reachable from the shop page only.

---

## Data Model

### New table: `shop_ingredient_purchases`

Tracks each ingredient purchase event per child per recipe.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `users.id` ON DELETE CASCADE |
| `family_id` | uuid | Denormalized for RLS |
| `recipe_id` | uuid | FK → `shop_recipes.id` ON DELETE CASCADE — which recipe context the purchase was made for |
| `ingredient_key` | text | FK → `shop_ingredient_prices.ingredient_key` — the purchased ingredient |
| `quantity` | integer | Units purchased in this event (1 in v1, constrained ≥ 1) |
| `coins_spent` | integer | Coins deducted at purchase time (server-authored from `shop_ingredient_prices.cost_coins`) |
| `purchased_at` | timestamptz | Server timestamp |

Constraints:
- `quantity >= 1`
- `coins_spent >= 0`
- No unique constraint on `(user_id, recipe_id, ingredient_key)` — the same ingredient can be purchased multiple times

Indexes:
- `(user_id, purchased_at DESC)` — inventory page default sort
- `(user_id, recipe_id)` — filter-by-recipe query
- `(family_id)` — RLS family-scoped admin queries

RLS:
- **select**: `user_id = current_user_id()` or `is_platform_admin()`
- **insert**: via RPC only (no direct client insert policy needed)
- **update / delete**: disallowed

### Extend `shop_coin_transactions`

Two changes required (new migration):

1. **Add column**: `ingredient_key text references shop_ingredient_prices(ingredient_key)` — nullable; set only for `purchase_ingredient` actions, null for `unlock_recipe`.
2. **Extend `action_type` check constraint**: drop and recreate to include `'purchase_ingredient'`.

> **Scope boundary (AI_CONTRACT §2):** These are schema migrations. Confirm **"authorized"** before implementation begins.

### New RPC: `purchase_shop_ingredient`

Signature:
```sql
purchase_shop_ingredient(p_recipe_id uuid, p_ingredient_key text)
returns jsonb
```

Atomic steps (follow the same pattern as `unlock_shop_recipe`):
1. Resolve `current_user_id()` and `current_family_id()` — return `forbidden` if null.
2. Verify caller is `child` or `is_platform_admin()` — return `forbidden` otherwise.
3. Verify `p_ingredient_key` exists in `shop_ingredient_prices` — return `ingredient_not_available` if not found.
4. Verify `p_recipe_id` exists in `shop_recipes` and `is_active = true` — return `recipe_not_available` if not.
5. Verify the child has an unlock row in `shop_recipe_unlocks` for `p_recipe_id` — return `recipe_not_unlocked` if not.
6. Lock the wallet row `FOR UPDATE`.
7. Verify `wallet.total_coins >= price.cost_coins` — return `insufficient_coins` if not.
8. Insert into `shop_ingredient_purchases` (`quantity = 1`, `coins_spent = price.cost_coins`).
9. Deduct `cost_coins` from `wallets`.
10. Insert into `shop_coin_transactions` (`action_type = 'purchase_ingredient'`, `ingredient_key = p_ingredient_key`, `recipe_id = p_recipe_id`).
11. Return success with `remainingCoins` and `coinsSpent`.

Error codes returned in JSON:
| Code | Meaning |
|------|---------|
| `forbidden` | Not a child account |
| `ingredient_not_available` | `ingredient_key` not in price catalog |
| `recipe_not_available` | Recipe inactive or missing |
| `recipe_not_unlocked` | Child has not unlocked this recipe |
| `insufficient_coins` | Wallet below `cost_coins` |

---

## Service Layer

New functions in `src/lib/supabase-service.ts`:

- `purchaseShopIngredient(recipeId, ingredientKey)` — calls RPC, returns normalized result
- `listIngredientPurchases(targetUserId?)` — returns all purchases for the current user, ordered by `purchased_at DESC`

Normalize RPC result in `src/lib/shop.ts`:
- `normalizePurchaseShopIngredientResult(raw)` — mirrors the existing `normalizeUnlockShopRecipeResult` shape

New helper in `src/lib/shop.ts`:
- `computeRecipeReadiness(recipe, purchases)` — takes a recipe and the user's purchases for that recipe; returns `{ isReady: boolean, ingredientProgress: Record<ingredientKey, { owned: number, required: number }> }`

---

## Strings

All new strings go in `src/app/words/words.strings.ts` under `shop.modal` and a new `shop.inventory` key.

Additions to `shop.modal`:
```
ingredientBuy: "Buy"
ingredientCost: "{coins} coins"
ingredientOwned: "You have: {count}"
ingredientProgress: "{owned} / {needed}"
ingredientNoPriceAvailable: "Not available to purchase."
buySuccess: "Bought {name}."
buyFailed: "Could not buy this ingredient."
recipeNotUnlocked: "Unlock this recipe first."
recipeReady: "Ready to Cook!"
```

New `shop.inventory` key:
```
pageTitle: "My Ingredients"
filterAllRecipes: "All Recipes"
filterLabel: "Filter by Recipe"
sortLabel: "Sort by Date"
empty: "No ingredients yet. Go to the shop to start collecting!"
quantityLabel: "x{count}"
```

Both English and Chinese strings required. Chinese strings follow the existing `zh` locale pattern in the same file.

---

## Layer Impact

### UI (`src/app/words/shop/`)

- `ShopSection.tsx` — extend ingredient detail sub-modal (Buy button, cost badge, progress)
- `ShopSection.tsx` — extend recipe tile to show "ready" badge when readiness condition is met
- `ShopSection.tsx` — extend recipe modal header with "Ready to Cook!" banner
- `ShopSection.tsx` — extend coin history modal to resolve `ingredient_key` → ingredient name
- New file: `src/app/words/shop/inventory/page.tsx` (server wrapper)
- New file: `src/app/words/shop/inventory/InventorySection.tsx` (client component)

### Domain (`src/lib/shop.ts`)

- `computeRecipeReadiness(recipe, purchases)` — readiness calculation
- `normalizePurchaseShopIngredientResult(raw)` — RPC result normalizer
- Ingredient name resolution from `shopIngredients` catalog (already exists; reuse)

### Service (`src/lib/supabase-service.ts`)

- `purchaseShopIngredient(recipeId, ingredientKey)` — calls new RPC
- `listIngredientPurchases(targetUserId?)` — reads `shop_ingredient_purchases`

### Database

- New table: `shop_ingredient_purchases` with RLS, indexes
- Alter `shop_coin_transactions`: add `ingredient_key` column, extend `action_type` check
- New RPC: `purchase_shop_ingredient`

### Permissions (`src/lib/permissions.ts`)

- Add `/words/shop/inventory` as child-only route

---

## Edge Cases

- Ingredient has no `ingredientKey` (price not set) — Buy UI is hidden; sub-modal shows read-only view.
- Child has exactly enough coins for one ingredient — buy succeeds; wallet shows 0; Buy button disables immediately.
- Child tries to buy more than the required quantity — allowed; owned count exceeds required; progress shows `5 / 3` (over-collecting is valid in v1).
- Child double-taps Buy quickly — RPC is atomic; wallet lock prevents double-spend; second tap returns `insufficient_coins` or succeeds if balance allowed two purchases.
- Child opens ingredient detail sub-modal with wallet at 0 — Buy button is disabled on load; no RPC call.
- Recipe has base ingredients where some have `ingredientKey` and some do not — readiness only counts ingredients with `ingredientKey`; ingredients without are excluded from the progress check.
- All of a recipe's base ingredients lack `ingredientKey` — recipe is never considered "ready" (no progress is computable); recipe ready badge is not shown.
- Child navigates away mid-purchase (network drops after RPC call but before UI update) — RPC is atomic; purchase is recorded; next page load reflects the purchase.
- Inventory page with no purchases — shows empty state string.
- Filter set to a recipe that has no purchases yet — shows empty state for that filter.
- Parent opens `/words/shop/inventory` directly — RouteGuard redirects; same behavior as `/words/shop`.
- `shop_ingredient_prices` row for an ingredient is deleted after purchase records exist — `ingredient_key` FK uses `ON DELETE RESTRICT` or `SET NULL` (TBD at migration time); coin history should degrade gracefully to a generic label if `ingredient_key` cannot be resolved.

---

## Risks

- If `purchase_shop_ingredient` is not atomic, rapid taps could spend more coins than intended. Wallet `FOR UPDATE` lock is required.
- If readiness excludes ingredients without `ingredientKey` silently, the child may see a "Ready to Cook!" badge on a recipe that still has ingredients they cannot buy. Mitigate by only showing the badge when all price-tagged ingredients are collected AND noting that un-priced ingredients exist with a visible caveat (e.g., "Some ingredients are not available to collect yet").
- `shop_coin_transactions.action_type` check constraint must be dropped and recreated — this is a brief table lock in production. Schedule during low-traffic window or confirm the table size is small enough to be safe.
- Coin history modal currently only expects `recipe_id` for label resolution. Extending it to handle `ingredient_key` without a recipe context or with a missing ingredient catalog entry must be tested for graceful fallback.

---

## Test Plan

**RPC / service:**
- `purchase_shop_ingredient` succeeds with sufficient coins and an unlocked recipe
- `purchase_shop_ingredient` fails with `insufficient_coins` when wallet is short
- `purchase_shop_ingredient` fails with `recipe_not_unlocked` when child hasn't unlocked the recipe
- `purchase_shop_ingredient` fails with `forbidden` when called as parent role
- `purchase_shop_ingredient` fails with `ingredient_not_available` for unknown ingredient key
- Wallet deducts exactly `cost_coins` on success
- `shop_coin_transactions` row is inserted with correct `action_type = 'purchase_ingredient'` and `ingredient_key`
- Rapid duplicate calls do not double-spend beyond available balance
- `listIngredientPurchases` returns rows ordered by `purchased_at DESC`

**Domain:**
- `computeRecipeReadiness` returns `isReady: true` when all priced ingredients meet required quantity
- `computeRecipeReadiness` returns `isReady: false` when any priced ingredient is short
- `computeRecipeReadiness` excludes ingredients without `ingredientKey` from the readiness gate
- `computeRecipeReadiness` handles a recipe with no priced ingredients (never ready)

**UI:**
- Ingredient sub-modal shows Buy button and cost badge when `ingredientKey` is present
- Ingredient sub-modal hides Buy UI when `ingredientKey` is absent
- Buy button disables when wallet < `cost_coins`
- Buy button disables when wallet = 0
- Tapping Buy updates owned count and progress indicator in the open modal without closing it
- Recipe tile shows ready badge after all priced ingredients are collected
- Recipe modal shows "Ready to Cook!" banner after all priced ingredients are collected
- Inventory page lists purchases with correct quantities
- Inventory page filter by recipe shows only purchases for that recipe
- Inventory page empty state renders correctly when no purchases exist

**Permissions:**
- `/words/shop/inventory` is inaccessible to parent role (RouteGuard redirects)
- Child can only read their own `shop_ingredient_purchases` rows (RLS)

---

## Implementation Sequence

1. Migration: create `shop_ingredient_purchases` table with RLS and indexes.
2. Migration: add `ingredient_key` column to `shop_coin_transactions`; extend `action_type` check constraint.
3. Migration: create `purchase_shop_ingredient` RPC.
4. Domain: add `computeRecipeReadiness` and `normalizePurchaseShopIngredientResult` to `src/lib/shop.ts`.
5. Service: add `purchaseShopIngredient` and `listIngredientPurchases` to `src/lib/supabase-service.ts`.
6. Strings: add all new strings to `words.strings.ts` (EN + ZH).
7. UI: extend ingredient detail sub-modal with Buy button, cost badge, progress, and owned count.
8. UI: add recipe-ready badge to recipe tile and modal.
9. UI: extend coin history modal to resolve ingredient purchase rows.
10. Permissions: add `/words/shop/inventory` to `permissions.ts`.
11. UI: build `InventorySection.tsx` and `page.tsx` for the inventory route.
12. UI: add "Inventory" navigation link from the shop page.
13. Tests: RPC, domain, UI, permissions.

---

## Acceptance Criteria

- [ ] A child can tap an ingredient in the recipe modal and see its coin price.
- [ ] A child can tap "Buy" to spend coins and collect one unit of that ingredient.
- [ ] The owned count and progress indicator update immediately in the open modal after a purchase.
- [ ] The Buy button is disabled when the wallet has fewer coins than the ingredient's price.
- [ ] Ingredients without a price set (`ingredientKey` absent) show no Buy UI.
- [ ] Purchasing an ingredient only works for recipes the child has already unlocked.
- [ ] A recipe tile and modal show a "ready" indicator when all priced base ingredients are collected in required quantities.
- [ ] Purchases appear in the coin history modal with ingredient name and recipe name.
- [ ] `/words/shop/inventory` is accessible to child users only.
- [ ] The inventory page lists all purchased ingredients with total quantities.
- [ ] The inventory page can be filtered by unlocked recipe.
- [ ] The inventory page sorts by most-recent purchase by default.
- [ ] The inventory empty state renders when no purchases exist.
- [ ] All coin mutations go through the `purchase_shop_ingredient` RPC — no direct client writes.
