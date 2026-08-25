# Feature Spec — 2026-08-23 — Kitchen Page

## Status: Shipped — 2026-08-25

**Genuinely new — not in `0_PRODUCT_ROADMAP.md` at all (unlisted, not deferred).** No roadmap row, no prior spec, and no code anywhere in `src/app/words/` implemented a "kitchen," a consumable ingredient inventory, or a cooking action before this. Flagged per `AI_CONTRACT.md §3` step 1 when first drafted; authorized and built the same day.

**Fully shipped 2026-08-25.** The remaining open items from the Test Plan/Acceptance Criteria below — the manual live-QA checklist against a dev Supabase project (cook past the countertop cap, Organize, a matched and an unmatched special-ingredient cook, hotspot alignment in an actual browser) and a re-run of `scripts/verify-rls.ts` Section 10 against the currently deployed schema — both passed. See `0_PRODUCT_ROADMAP.md` item J.

A visual mockup of this page was built and iterated on as an Artifact earlier in the same conversation (cupboard → ingredient grid, side-by-side stovetop + oven, a countertop recipe book, and four color-coded drag-to-organize shelves), using placeholder emoji art and invented demo data. **That mockup's interaction model is now superseded** — see Revision below — once a real kitchen illustration (`public/kitchen/full-kitchen.png`) was supplied and the shelf-organizing mechanic was redirected from child drag-and-drop to admin-preassigned food categories.

**Two things this spec depends on, called out up front:**

1. **Builds directly on `shop_ingredient_rewards`**, the append-only per-ingredient reward ledger shipped 2026-08-22 (`docs/feature-specs/2026-08-22-paragraph-quiz-ingredient-reward.md`). **Documentation gap found while researching this spec:** that table and its `reward_random_ingredients` RPC were not present anywhere in `0_ARCHITECTURE.md`'s Data Schema section (§3) even though the roadmap (§4) recorded it as shipped — since fixed, `0_ARCHITECTURE.md` now carries a `shop_ingredient_rewards` entry alongside this feature's own tables.
2. **The "purchased" half of the fridge originally depended on roadmap item F** ("Ingredient shopping for kids"). Item F has since been built in parallel with this feature (`shop_ingredient_purchases`, `purchase_shop_ingredient` RPC) and its ledger is already wired into the Kitchen's availability aggregation alongside rewards — see Proposed Behavior → Fridge.

**Design decisions resolved 2026-08-23 (original draft, before the illustration existed):**

1. **Route & nav**: `/words/shop/kitchen`, nav-labeled "Shop Kitchen," inserted immediately after "Recipe Shop" and before "Recipe Shop Admin" in `getNavItems()`. Child + platform-admin only, parents route-blocked, matching `/words/shop`.
2. **Cooking gate**: reuses `shop_recipe_unlocks` as-is — a recipe's cookable-and-unlocked state in the Kitchen is entirely decided by whatever is already unlocked on `/words/shop`.
3. **Ingredient economy**: duplicates allowed (not "collect each once") — the precondition the whole consumption mechanic depends on.
4. **Re-cook limits**: no cap on how many times a recipe may be cooked (ingredient availability is the only limit).
5. ~~**Drag-and-drop**: must work by touch, not mouse-only.~~ **Superseded by the Revision below** — there is no more child drag-and-drop to make touch-friendly; see Revision item 1.
6. **Parent visibility**: none.

## Revision — 2026-08-23 (same day), by explicit answer, once the illustration existed

The original draft (Scope/Proposed Behavior as first written) modeled the shelf as **four child-draggable categories** (a default/unsorted shelf plus Drinks/Desserts/Hot Meals the child sorted dishes into by hand, via `move_shop_cooked_dish(dishId, shelfCategory)`, implemented with a Pointer Events drag interaction). Once `public/kitchen/full-kitchen.png` was supplied (a fridge, a stove-over-oven appliance, a recipe book, an open shelf unit, and an island countertop) and the actual shelf-organizing behavior was specified against that picture, the design changed in four ways, confirmed by explicit answer before implementation:

1. **Shelf sorting is fully automatic, not child-driven.** A recipe's shelf category (**food type**: Drinks / Hot Meal / Desserts) is now an admin-configured property of the *recipe* (`shop_recipes.food_type`, alongside the existing `cook_method`) — never a per-dish choice the child makes. This **removes the drag-and-drop mechanic entirely** (`move_shop_cooked_dish` and its Pointer Events implementation are gone, not just touch-enabled) and replaces it with:
2. **A capacity-limited countertop plus one bulk "Organize" action.** Every newly-cooked dish lands on a **countertop** (`shop_cooked_dishes.location`, replacing the old `shelf_category` column — now `'countertop' | 'shelf'`), capped at **`SHOP_KITCHEN_COUNTERTOP_CAPACITY = 6`** dishes. Cooking is **blocked** once the countertop is full (`cook_shop_recipe` now returns a `countertop_full` code) until the child clicks **Organize**, which calls a new `organize_shop_kitchen_countertop()` RPC that bulk-moves *every* countertop dish to the shelf in one call — there is no per-dish variant.
3. **The shelf is a popup with three tabs, not four visible shelves.** Clicking the shelf hotspot opens a modal with **Drinks / Hot Meal / Desserts** tabs; each tab lists the child's shelved dishes whose *recipe's* `food_type` matches, derived at read time (`buildShelfTilesByFoodType` in `kitchen.types.ts`) — never stored per dish.
4. **The whole UI is now hotspots over the real illustration, not a card grid.** `full-kitchen.png` renders as the scene's background; clickable regions (approximate percentage boxes, `SceneHotspot` in `KitchenSection.tsx`) sit over the fridge (ingredients — renamed from "Cupboard"), the recipe book, the top half of the stove/oven appliance (stovetop) and its bottom half (oven), and the shelf unit. The countertop's tiles + capacity counter + Organize button render as a labeled panel directly under the scene (not overlaid on the artwork itself, for legibility — see Risks).

Everything else from the original draft (cooking gate reuses `shop_recipe_unlocks`, no coin cost to cook, no re-cook cap, no parent visibility, `security definer` on both RPCs) is unchanged and still applies below.

## Revision 2 — 2026-08-24, special-ingredient variants

Bug/feature report against the shipped Revision-1 kitchen: recipes can already define **special ingredient slots** and **variant icon rules** in Shop Admin (a dormant feature — `shop_recipes.special_ingredients`/`variant_icon_rules` and the matching algorithm `resolveShopRecipeIconPath` in `shop.ts` already existed, used only by `ShopSection.tsx`'s recipe-wall display, never wired into cooking). The Kitchen now lets a child actually cook a variant:

1. **After picking a recipe in the Recipe Book, a second popup offers special ingredients — but only if the child has enough of at least one.** `SpecialIngredientsModal` (new, `KitchenSection.tsx`) opens automatically right after `handleSelectRecipeFromBook` closes the book, listing every slot from the recipe's `special_ingredients` that the child currently has enough of (`resolveAvailableSpecialIngredients`, new in `kitchen.types.ts`) — a slot the child can't afford is left out entirely, not shown disabled. If no slot is affordable, the modal is skipped and the flow behaves exactly as before. The child can reopen this picker any time before cooking via a status pill under the recipe selection.
2. **Selection is free-form; matching is exact and server-side.** The child may toggle any combination of the offered ingredients — there's no client-side validation against `variant_icon_rules`. `cook_shop_recipe` (redefined again, in a **third** forward migration — see Migration history note, `20260823020000` had already reached dev by the time this revision was written) validates the submitted keys against the recipe's own slots (silently dropping anything invalid), computes total requirements as the **union** of base ingredients plus the selected special ingredients, and consumes both sets atomically on success. **Every selected special ingredient is consumed regardless of whether the combination matches a defined variant rule** — an unmatched combination still spends the ingredients and produces the plain-icon dish, per the user's explicit requirement ("if it isn't matched, the cooking creates the plain version and special ingredients are still consumed").
3. **Which icon a dish shows is resolved, not stored.** `shop_cooked_dishes` gains `special_ingredient_keys jsonb` — the raw facts of what was used, recorded once at cook time. Which picture a dish renders as is computed at read/aggregation time via the pre-existing `resolveShopRecipeIconPath(recipe.variantIconRules, dish.specialIngredientKeys)`, falling back to the plain-icon rule (`match: []`, which always matches) when nothing else does — the same "store raw facts, derive display later" pattern `food_type`→shelf-tab already established in Revision 1. No new matching logic was written; the dormant `ShopSection.tsx` algorithm is reused as-is.
4. **Tile aggregation now keys on recipe *and* resolved icon, not recipe alone.** Two dishes of the same recipe that resolve to different icons (e.g. plain vs. strawberry donut) must render and count as separate tiles on the countertop and shelf; two dishes that both fall back to the same icon (e.g. two different unmatched combinations) correctly stack together. This required threading `recipesById` into `buildCountertopTiles`/`buildShelfTilesByFoodType` (a signature change) so tile-building can resolve each dish's icon before grouping.

**New schema (this revision):** `shop_cooked_dishes.special_ingredient_keys jsonb not null default '[]'::jsonb`. `cook_shop_recipe` gains a second parameter, `p_special_ingredient_keys jsonb default '[]'::jsonb`, and its success payload gains `specialIngredientKeys`. No new RPC, no new table.

**Out of scope (this revision):** any UI hint telling the child which combination produces which named variant (Shop Admin's variant rules stay admin-only information, matching the existing `ShopSection.tsx` treatment); preventing or warning on an unmatched combination before cooking; a way to remove a single selected special ingredient without reopening the picker (toggling it off again in the picker covers this).

**Migration history note.** `20260823000000_shop_kitchen.sql` (the original migration) was already applied to dev by the time the countertop/food-type revision was scoped — confirmed via `db:status`, and `scripts/verify-rls.ts` Section 10 was run against it for the first time, which caught a real, since-fixed gap: `shop_ingredient_consumptions` had a caller-scoped INSERT policy copied from `shop_ingredient_rewards`' own defense-in-depth pattern, but that pattern only earns its keep for a `security invoker` RPC that needs an RLS policy to write through (`reward_random_ingredients`) — `cook_shop_recipe` is `security definer` and needs no such policy, so the policy was pure unnecessary attack surface (a child could INSERT arbitrary consumption rows directly, though only self-depleting their own available count — low severity, but a real contradiction of "the RPC is the only writer"). Because the original migration was already live, that revision's schema changes went into a second forward migration, `20260823020000_shop_kitchen_countertop_redesign.sql`, which drops the stray policy, renames `shelf_category` to `location`, adds `food_type`, drops `move_shop_cooked_dish`, and redefines `cook_shop_recipe`/adds `organize_shop_kitchen_countertop` — also fixing a client/server consistency gap found while writing it: the original `cook_shop_recipe` never counted `shop_ingredient_purchases` (item F, built in parallel and shipped the same day) toward availability, even though the Kitchen UI's own readiness display already did.
>
> **A real deployment-tracking gap surfaced while building this Revision 2.** `20260823020000` was pushed to dev (`db push`) partway through this session, *before* the special-ingredient work below was added to that same still-git-untracked file — Supabase CLI tracks applied migrations by version/filename, not content, so the later in-place edits to that file (the `special_ingredient_keys` column, the 2-arg `cook_shop_recipe`) were silently never deployed even though the file on disk had them. This wasn't caught until the child actually tried to cook with a special ingredient selected and PostgREST returned `Could not find the function public.cook_shop_recipe(p_recipe_id, p_special_ingredient_keys) in the schema cache`. Diagnosed by querying the live schema directly (`supabase db query --linked`, `pg_get_functiondef`) rather than trusting the file or git status. Fixed by (1) reverting `20260823020000_shop_kitchen_countertop_redesign.sql` back to exactly what's actually deployed (confirmed against the live `pg_get_functiondef` output), and (2) moving the special-ingredient schema/RPC changes into a proper third forward migration, `20260824000000_shop_kitchen_special_ingredients.sql` (adds `special_ingredient_keys`, drops the old 1-arg `cook_shop_recipe` overload, creates the 2-arg replacement) — which was then pushed to dev and verified live. **Lesson for future migration edits in this repo: `git status` on a migration file only tells you whether *git* has seen it, not whether `supabase db push` has already deployed it — check `supabase migration list` (or query the live schema directly) before editing any migration file in place, even one git shows as untracked.**

## Revision 3 — 2026-08-24, named variants

Follow-up report: with Revision 2 shipped, cooking a matched special-ingredient combination correctly swapped the dish's *icon* (e.g. a brown-sugar milk tea icon), but the shelf/countertop tile's *name* still always showed the base recipe's title ("珍珠奶茶") for every variant, since tile titles were resolved purely from `recipeId` with no variant awareness. The fix mirrors Revision 2's icon design exactly, giving each variant its own optional name:

1. **`ShopVariantIconRule` (`shop.types.ts`) gains an optional `titleI18n: { en, zh }`.** Since `shop_recipes.variant_icon_rules` is a jsonb column, this needed **no database migration at all** — purely an app-layer addition. A rule with no title (the default, including every rule that existed before this revision) falls back to the recipe's own title, exactly as before.
2. **One shared match function, reused for both icon and title.** `resolveShopRecipeIconPath` was refactored to call a new `resolveShopRecipeVariant(variantIconRules, activeSpecialIngredientKeys)`, which returns the whole matched rule (same subset-match-prefer-most-specific algorithm as before) rather than just its `iconPath`. A new `resolveShopRecipeVariantTitle(variantIconRules, activeSpecialIngredientKeys, locale, fallbackTitle)` reads `titleI18n` off that *same* matched rule. Icon and name can therefore never disagree about which variant was picked, since both come from one lookup.
3. **`KitchenDishTile` now carries a resolved `title` directly, alongside `iconPath`.** `kitchen.types.ts`'s `pushDishIntoTiles` resolves a dish's display name the same way it already resolved its icon (`resolveDishTitle`, mirroring `resolveDishIconPath`), so `buildCountertopTiles`/`buildShelfTilesByFoodType` both gained a required `locale` parameter. `KitchenSection.tsx`'s `DishTileGrid`/`ShelfModal` now render `tile.title` directly; the old `resolveTileTitle`/`resolveTitle` prop (which only ever looked up the base recipe title) was removed as dead code once tiles carried their own resolved name.
4. **Shop Admin gains two small text inputs per variant card** (EN/ZH, capped at `SHOP_RECIPE_TITLE_MAX`), next to the existing special-ingredient match checkboxes — labeled "Variant Name (optional)" with helper text explaining blank means "keep the recipe's name." The plain/fallback rule (`match: []`) does not get a title input, matching its existing "stays unmapped" read-only treatment. `buildShopRecipeAdminDraft`, `normalizeShopRecipeAdminDraft`, `removeDeletedIngredientKeysFromVariantIconRules`, and `mergeReadonlyVariantIconRules` all thread `titleI18n` through alongside `match` (draft-controlled, like `match` — never treated as read-only like `iconPath` is).

**Out of scope (this revision):** localizing variant names for the Debug "Shop Reward Icon Audit" tool's own rule-creation flow (`shopRewardIconAudit.ts`/`DebugSection.tsx`) — that tool is for icon-file bookkeeping, not recipe-content authoring, and continues to create rules with no title (which simply fall back to the recipe's name until a platform admin names them from the main Shop Admin recipe editor); showing a variant's name anywhere outside the Kitchen (e.g. `ShopSection.tsx`'s recipe wall, which shows the recipe's own title only, unchanged).

## Problem

Today, a rewarded ingredient (`shop_ingredient_rewards`) is granted once, shown once in the paragraph-quiz reward panel, and then never seen again. Separately, `shop_recipes` can be *unlocked* with coins (revealing its ingredient list for inspection), but nothing in the app lets a child ever *do* anything with an unlocked recipe or a collected ingredient — there is no concept of spending an ingredient, "making" a dish, or a child-owned collection of finished dishes. The request is a new `/words`-workspace page, illustrated as a real kitchen, where a child can (1) see everything they've collected in the fridge, (2) cook an unlocked recipe on the stovetop or in the oven by spending the ingredients it needs, (3) see fresh dishes pile up on the countertop, and (4) organize the countertop onto the shelf, where dishes are automatically sorted by type.

## Scope

**Shipped (this spec, revised):**

- **New route** `/words/shop/kitchen`, nav-labeled "Shop Kitchen," positioned immediately after "Recipe Shop" — child + platform-admin only, matching `/words/shop`'s role gate. Parents are route-blocked.
- **Fridge**: clicking the fridge hotspot opens a modal grid of every ingredient the child has available (`> 0`), pooling `shop_ingredient_rewards` and `shop_ingredient_purchases` minus `shop_ingredient_consumptions` (see Proposed Behavior → Fridge).
- **Recipe Book**: clicking the book hotspot opens a modal listing every **cookable** recipe (`shop_recipes.cook_method is not null`) the child has unlocked via `shop_recipe_unlocks`, each showing required ingredients and a Ready/Missing state. The Kitchen introduces no separate unlock mechanism — an un-unlocked recipe links back to `/words/shop`.
- **Stovetop / oven**: clicking the top half of the appliance illustration cooks the selected recipe if its `cook_method` is `'stove'`; the bottom half if `'oven'`. Calls `cook_shop_recipe`, which spends ingredients and inserts one dish onto the countertop, atomically. Blocked (client-side pre-check plus server-side `countertop_full` code) once the countertop already holds `SHOP_KITCHEN_COUNTERTOP_CAPACITY` (6) dishes.
- **Countertop**: a labeled panel (tiles + `{count}/6` + Organize button) showing every dish not yet organized. Clicking **Organize** calls `organize_shop_kitchen_countertop()`, which bulk-moves every countertop dish to the shelf in one RPC call.
- **Shelf**: clicking the shelf hotspot opens a modal with three tabs (Drinks / Hot Meal / Desserts); each tab's dishes are derived from the shelved dish's *recipe's* `food_type`, computed client-side, never stored per dish.
- **Shop Admin** gains two fields on the recipe edit form: `cook_method` (None / Stove / Oven, existing) and **`food_type`** (None / Drinks / Hot Meal / Desserts, new). Validation requires `food_type` whenever `cook_method` is set — a cookable recipe must be sortable, since the shelf has no "unsorted" fallback tab.

**New schema:**

- `shop_recipes.cook_method` — nullable, `'stove' | 'oven'` (unchanged from the original draft).
- `shop_recipes.food_type` — nullable, `'drinks' | 'hotmeal' | 'desserts'` (new). Independent axis from `cook_method`: one is "how you cook it," the other is "where it lives once organized."
- `shop_ingredient_consumptions` — append-only ledger, one row per ingredient unit spent (unchanged from the original draft).
- `shop_cooked_dishes` — one row per cooked dish; **`location text check (location in ('countertop','shelf')) default 'countertop'`** replaces the original draft's `shelf_category`. Still the one field on any shop-adjacent table that mutates post-insert, and still only ever touched by an RPC, never a direct client write.
- `cook_shop_recipe(p_recipe_id uuid)` — `security definer` (see the original draft's reasoning, unchanged). Now also checks countertop capacity (`count(location = 'countertop') < 6`) before checking ingredient availability, returning `countertop_full` if the countertop is already full.
- `organize_shop_kitchen_countertop()` — `security definer`, **new, replaces `move_shop_cooked_dish`**. No parameters: bulk-updates every one of the caller's `location = 'countertop'` rows to `'shelf'` in one call, returns the moved count. There is no per-dish variant — the child never chooses a destination category.
- New service functions: `listShopIngredientRewards`, `listShopIngredientConsumptions`, `listShopIngredientPurchases`, `listShopCookedDishes`, `cookShopRecipe`, `organizeShopKitchenCountertop`.
- New domain helpers in `shop.ts`: `buildShopIngredientAvailabilityMap`, `computeShopCookReadiness`, `normalizeShopCookMethod`, `normalizeShopFoodType`, plus result normalizers for both RPCs.
- New UI-layer helpers in `kitchen.types.ts`: `buildCountertopTiles`, `countCountertopDishes`, `buildShelfTilesByFoodType`, `countTotalCookedDishes`.

## Out of scope

- Any coin cost for cooking itself — ingredients only, orthogonal to the existing coin-unlock economy.
- Un-cooking, deleting, or refunding a cooked dish, or moving a dish back from the shelf to the countertop.
- Parent-facing visibility into a child's kitchen, cooked dishes, or ingredient spend.
- Any change to `shop_recipe_unlocks`, `unlock_shop_recipe`, or the existing `/words/shop` unlock flow — the Kitchen only reads unlock state.
- Recipe authoring beyond `cook_method` and `food_type` — no new ingredient-catalog concepts, no new icon sets.
- A cap on how many times one recipe can be cooked, or a cap on total shelf size (only the countertop is capacity-limited).
- Pixel-perfect hotspot alignment — the five clickable regions over `full-kitchen.png` are approximate percentage boxes eyeballed against the artwork, not measured; see Risks.

## Proposed behavior

### Fridge

Clicking the fridge hotspot opens a modal grid, one tile per `ingredient_key` with `available > 0` — rewards plus purchases minus consumptions (`buildShopIngredientAvailabilityMap([...rewards, ...purchases], consumptions)`) — showing the real icon (`shop_ingredient_prices.icon_path`), localized label (`resolveShopIngredientLabel`), and current count. An ingredient at 0 drops out of the grid entirely.

### Recipe Book

Clicking the book hotspot opens a modal listing every recipe with `cook_method is not null`. An un-unlocked recipe shows `/words/shop`'s locked-tile treatment with a link back to unlock it. An unlocked recipe shows its required ingredients and a Ready/Missing state (`computeShopCookReadiness`). Selecting a recipe here is what the stovetop/oven click acts on.

### Cooking

Clicking the stovetop or oven hotspot: if no recipe is selected, or the selected recipe's `cook_method` doesn't match the appliance clicked, the client shows an inline message with no RPC call. If the countertop already holds 6 dishes, the client shows the countertop-full message with no RPC call. Otherwise it checks readiness client-side and, if ready, calls `cook_shop_recipe`. On success the dish lands on the countertop and the selection clears. On `insufficient_ingredients` or `countertop_full` (a legitimate race — e.g. two tabs), the client re-fetches and shows the real reason.

### Countertop and Organize

The countertop panel shows every dish with `location = 'countertop'`, aggregated by recipe into count-badged tiles (`buildCountertopTiles`), alongside a `{count}/6` badge (red once full) and an **Organize** button, enabled whenever the countertop holds at least one dish. Clicking it calls `organizeShopKitchenCountertop()`, which moves every countertop dish to the shelf in one RPC call; the client refetches dishes and shows how many moved.

### Shelf

Clicking the shelf hotspot opens a modal with three tabs. Each tab's tiles come from `buildShelfTilesByFoodType(dishes, recipesById)`, which filters to `location = 'shelf'` and groups by the dish's *recipe's* `food_type` — a dish whose recipe can't be resolved or has no `food_type` (shouldn't happen for a cookable recipe, since Shop Admin requires it, but handled defensively) is skipped rather than guessed into a tab.

## Layer impact

| Layer | Changes |
|---|---|
| Database | `shop_recipes.cook_method`, `shop_recipes.food_type`; new tables `shop_ingredient_consumptions`, `shop_cooked_dishes` (with `location`, not `shelf_category`, and `special_ingredient_keys`); RPCs `cook_shop_recipe` (now takes `p_special_ingredient_keys`), `organize_shop_kitchen_countertop` |
| Service (`supabase-service.ts`) | `listShopIngredientRewards`, `listShopIngredientConsumptions`, `listShopIngredientPurchases`, `listShopCookedDishes`, `cookShopRecipe` (now takes `specialIngredientKeys`), `organizeShopKitchenCountertop` |
| Domain (`shop.ts`) | Ingredient-availability aggregator; cook-readiness helper; `cook_method`/`food_type` normalizers; `normalizeShopSpecialIngredientKeys`; RPC result normalizers; reuses pre-existing `resolveShopRecipeIconPath` |
| UI | `src/app/words/shop/kitchen/` (`page.tsx`, `KitchenSection.tsx`, `kitchen.types.ts`, `kitchen.strings.ts`) — `full-kitchen.png` background with `SceneHotspot` regions, no drag-and-drop; `SpecialIngredientsModal` (new); `ShopAdminSection.tsx` gains `food_type` alongside `cook_method` (special-ingredient/variant-icon-rule editing was already shipped separately) |
| Permissions | `permissions.ts` — `/words/shop/kitchen` → `role === 'child'`; nav gains "Shop Kitchen" after "Recipe Shop" |
| Strings | `kitchen.strings.ts`, full EN + ZH, fridge/countertop/organize/shelf-tab copy |

No AI layer involvement. No change to `words`, `flashcard_contents`, scheduler, or `wallets`.

## Edge cases

- **A recipe's `base_ingredients` entry has no resolvable `ingredientKey`** — skipped from requirement computation, same skip-invalid-silently precedent as `reward_random_ingredients`.
- **Countertop is exactly full (6/6) and the child attempts to cook** — blocked client-side; if raced past that check, `cook_shop_recipe` itself rejects with `countertop_full` before touching ingredients.
- **Organize is clicked with an empty countertop** — the button is disabled at 0 dishes; the RPC would otherwise just report `movedCount: 0`.
- **A recipe is cookable but the child hasn't unlocked it** — Recipe Book shows it locked, cooking isn't offered.
- **A platform admin clears `food_type` on a recipe some children have already shelved dishes of** — those existing shelved dishes silently drop out of every shelf tab (their recipe now resolves to no `food_type`) rather than erroring; Shop Admin validation prevents this going forward for any recipe that's still cookable, but doesn't retroactively fix already-cleared ones.
- **Two browser tabs cook near-simultaneously** — the second call re-checks both countertop capacity and ingredient availability itself; the UI re-fetches and shows the real state rather than a stale success.
- **`cook_shop_recipe` fails entirely** (network/DB error) — nothing is spent or created (one transaction); the child sees an inline failure and can retry.
- **Selected special ingredient keys don't match any of the recipe's own slots** (stale client state, or a slot removed by an admin between opening the picker and cooking) — `cook_shop_recipe` silently drops any submitted key not present in the recipe's `special_ingredients`, rather than erroring; only the valid subset is required and consumed.
- **A selected combination doesn't match any `variant_icon_rules` entry** — cooking still succeeds, still consumes every selected ingredient, and the dish resolves to the plain icon (`match: []` always matches) — by explicit design, not a bug.
- **The child has enough of a special ingredient when the picker opens but not by the time they cook** (raced by another cook, or by nothing since there's no concurrent-session case, but defensively) — `cook_shop_recipe`'s union availability check catches this the same way it already catches base-ingredient races; the client re-fetches and shows the real reason.

## Risks

- **Two RPCs need the same care `unlock_shop_recipe`/`reward_random_ingredients` already demonstrate**: role check, ownership check, no trusting client-submitted quantities. `cook_shop_recipe` computes required quantities, countertop count, and availability entirely server-side.
- **Both RPCs are `security definer`, not `invoker`.** RLS is not a backstop for either function's own validation — see the original draft's reasoning under Schema. Any future edit needs schema/RLS-level scrutiny.
- **Hotspot coordinates are approximate, not measured.** The five `SceneHotspot` regions were eyeballed against `full-kitchen.png` at 1337×1176px and will likely need a small visual nudge once actually viewed in a browser — flagged rather than claimed precise.
- **Countertop tiles render in a panel below the artwork, not overlaid on the island itself**, a deliberate simplification for legibility (small overlaid text/icons on a detailed illustration risked being unreadable or misaligned) — the countertop is *represented* rather than *replicated* pixel-for-pixel; worth revisiting with real on-device visual QA.
- **A recipe's `food_type` can be cleared by an admin after dishes exist** — see Edge cases; those dishes become permanently unreachable from any shelf tab (not deleted, just unsortable) until the recipe's `food_type` is set again.

## Test plan

- RPC-level (`cook_shop_recipe`): role check; recipe-not-unlocked; recipe-not-cookable; **countertop-full rejection at exactly 6 existing countertop dishes**; insufficient-ingredients rejection with correct missing keys; a normal case spends exactly the required quantities and inserts one dish with `location = 'countertop'`; **a call with valid special ingredient keys consumes both base and special quantities and stores them on the dish; a call with an invalid/unmatched key silently drops it rather than erroring; an unmatched-but-valid combination still consumes ingredients and stores the plain-resolving key set**.
- RPC-level (`organize_shop_kitchen_countertop`): moves every one of the caller's countertop dishes to `'shelf'` and only the caller's; returns the correct moved count; a second call with nothing left on the countertop returns `movedCount: 0`, not an error.
- Domain: availability aggregator (rewards + purchases − consumptions); cook-readiness; both RPC result normalizers including the new `countertop_full` code.
- UI-layer (`kitchen.types.ts`): `buildCountertopTiles`/`buildShelfTilesByFoodType` filter and aggregate correctly, **including keying on resolved variant icon so same-recipe dishes with different special ingredients render as separate tiles and unmatched combinations correctly merge into the plain tile**; `resolveAvailableSpecialIngredients` includes only affordable slots with a resolvable key.
- Service: mocked-RPC tests for all six service functions, snake_case → camelCase mapping including the `shelf_category` → `location` rename.
- Shop Admin: validation requires `food_type` whenever `cook_method` is set; passes when both are set or both are null.
- UI: Fridge/Recipe Book/Shelf modals render correctly; clicking the wrong appliance, an unready recipe, or cooking at capacity never calls the RPC; Organize is disabled at 0 countertop dishes.
- `scripts/verify-rls.ts` Section 10: family-scoped read on both tables; **no** direct client insert/update/delete succeeds on `shop_cooked_dishes` or `shop_ingredient_consumptions` under any caller, including the owning child.
- **Live QA against a dev Supabase project** (completed 2026-08-25): cooked past the countertop cap and confirmed the block; organized and confirmed dishes land in the correct shelf tab per their recipe's `food_type`; confirmed a real browser renders the five hotspots roughly where expected against the actual artwork. `scripts/verify-rls.ts` Section 10 was also re-run against the currently deployed schema and confirmed passing.

## Acceptance criteria

- [x] `/words/shop/kitchen` is reachable by child and platform-admin sessions only; the "Shop Kitchen" nav entry appears immediately after "Recipe Shop."
- [x] The fridge shows every available ingredient (rewards + purchases − consumptions) with real icons.
- [x] The Recipe Book lists only cookable recipes; un-unlocked ones link back to `/words/shop`; unlocked ones show accurate Ready/Missing state.
- [x] Cooking a ready recipe on its matching appliance spends exactly its required ingredients and lands one new dish on the countertop.
- [x] Cooking is blocked, with a clear message, once the countertop holds 6 dishes.
- [x] Organize moves every countertop dish to the shelf in one action; dishes then appear under the correct Drinks/Hot Meal/Desserts tab per their recipe's `food_type`.
- [x] Shop Admin requires `food_type` whenever `cook_method` is set, and can clear both back to not-cookable.
- [x] Selecting a recipe with at least one affordable special ingredient opens the special-ingredients picker; selecting one with none skips straight to cooking, unchanged from Revision 1.
- [x] Cooking with a matched special-ingredient combination consumes both base and special ingredients and the resulting dish displays the matching variant icon; cooking with an unmatched combination still consumes the selected special ingredients but displays the plain icon.
- [x] `scripts/verify-rls.ts` Section 10 passes for both new tables.
- [x] Live-QA checklist completed against a dev Supabase project through the actual app UI. Completed 2026-08-25.

## Open questions

None. The four items resolved in the 2026-08-23 same-day Revision (fully-automatic sorting, countertop capacity/blocking, three-tab shelf popup, image-hotspot UI) close out every open question from the original draft — the "keep a separate Recipe Book" question resolved once the illustration turned out to include one. Revision 2 (special-ingredient variants) was fully specified by the bug report itself — no open questions.
