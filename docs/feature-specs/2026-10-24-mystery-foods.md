# Feature Spec — 2026-10-24 — Mystery Foods, Win-Session Rewards, Quick-Unlock Prioritization

Covers roadmap items **L** (Mystery Foods), **M** (win session + mystery-ingredient reward), **N** (quick-unlock reward prioritization). One build — the three items are not independently shippable.

## Status

**Shipped 2026-10-24 — migration on dev and prod; manual in-browser QA passed.** (Requirements were agreed in a 2026-10-24 brainstorm.) Items L/M/N are in `0_PRODUCT_ROADMAP.md` §1 as 📋 Planned.

**Scope-boundary authorization (`AI_CONTRACT.md §2`): given 2026-10-24** ("i authorize", in reply to the automatic-unlock path, migrations, and RLS changes being named together). Boundaries this spec triggers:

1. Schema migration — new columns on `shop_recipes` and `shop_ingredient_prices`; a new RPC `reward_session_ingredients`.
2. Edits to existing RPCs — `unlock_shop_recipe`, `purchase_shop_ingredient`, `reward_random_ingredients`.
3. No RLS policy edits are planned (new columns on existing, already-policied tables). If implementation finds one is needed, stop and re-confirm.

**Hard-stop check (`AI_CONTRACT.md §1`, Wallet & Coins):** `shop_recipe_unlocks` may be written only by `unlock_shop_recipe`. The automatic unlock below is therefore implemented by having `reward_session_ingredients` *call* `unlock_shop_recipe` internally (which gains a mystery branch), **not** by a second writer — so no contract amendment is needed.

Build progress is tracked in `docs/feature-specs/2026-10-24-mystery-foods-build-plan.md` (staged checklist with a handoff block).

> **Superseded in part by item P (2026-10-24):** mystery ingredients are now *offered* and claimed by the child's pick (1 / 2 / 3 by Tested Count) instead of being granted automatically, and the auto-unlock runs at claim time. See `2026-10-24-child-packaged-sessions-and-reward-picks.md`. The win rule, priority order and quantities below are unchanged.

## Problem

A completed packaged session pays out up to 3 random ingredients from recipes the child already unlocked, no matter how well they did. There is no reason to aim for a clean session, and nothing long-term to work toward. We want a reward tier for clean ("win") sessions that builds toward a special food the child cannot get any other way.

## Scope

### Decisions (all agreed 2026-10-24)

**Win session**
- Character / phrase / mixed packaged session: win iff `quiz_sessions.failed_count = 0` (the "Failed Count" column on `/words/results`) **and** `total_grades > 0`. `good`/`hard` answers do not disqualify.
- Paragraph-quiz session: has no `again` outcome by design (Fill-Test Rule 32), so `failed_count` is always 0. A paragraph quiz is a win only with **zero bounces** — every blank first-try `easy`, i.e. `fully_correct_count = total_grades`. Any bounce → non-win.
- **Rewards apply to packaged sessions only** (as today). Ad-hoc due-review sessions stay unrewarded.
- Win is derived **server-side** from the persisted `quiz_sessions` row; the client never says whether it was a win.

**Reward**
- Every completed packaged session is rewarded. Non-win → the existing random reward, unchanged. Win → mystery ingredients **instead of** (never in addition to) the random reward.
- A win never falls back to the random reward.
- Quota: up to **3 mystery ingredient types** per win. Each chosen type is rewarded at its **full per-food quantity** (topped up: `quantity − already held`).

**Mystery food / ingredient model**
- A mystery food is a `shop_recipes` row flagged `is_mystery`, authored in Shop Admin, with a `cook_method` and `food_type` like any cookable recipe. Its `base_ingredients` hold mystery ingredients with `quantity`, so `cook_shop_recipe` works **unchanged**: one cook consumes exactly one food's worth.
- A mystery ingredient is a `shop_ingredient_prices` row flagged `is_mystery` — always a **separate catalog item** from any normal ingredient (e.g. "enriched egg", never "egg"). Never buyable, never in the random-reward pool, never used by a non-mystery recipe.
- Mystery foods are **repeatable**: ingredients are consumed per cook; the child keeps earning more.
- **Auto-unlock:** the moment the child holds a full set, the food unlocks (no coins, no button) and **stays unlocked permanently**; afterwards cookability is just ingredient availability, as for normal recipes.
- **Visibility:** locked mystery foods show on the recipe wall as a silhouette/"?" with progress ("2/3" = ingredient types currently held in full quantity). Collected mystery ingredients appear in the Shop Kitchen fridge.
- Launch content: **one** mystery food. The owner supplies all artwork.

**Prioritization (item N)** — server-side, deterministic, no client input. Candidate foods = active mystery foods with ≥ 1 unsatisfied ingredient type (type `k` is satisfied when `held(k) ≥ quantity`). Order:
1. **Closest to complete** first (fewest unsatisfied types) — decided 2026-10-24: a nearly-complete food outranks a never-made one.
2. Tie → foods the child has **never made** (no `shop_cooked_dishes` row) before foods made at least once.
3. Tie → **least-made** first (fewest cooked dishes).
4. Tie → `display_order`.

Walk foods in that order; take each food's unsatisfied types (recipe order) until 3 types are chosen. A type already chosen in this win (shared across foods) is not chosen twice. If the top food needs fewer than 3, the remainder **starts the next food**.

## Out of scope

- A dedicated mystery-collection page (progress lives on the recipe wall; ingredients in the fridge).
- Buying mystery ingredients; using them in normal recipes.
- Rewards for ad-hoc due-review sessions.
- Cook-several-at-once (a later convenience; no schema impact).
- Parent-facing visibility (Shop Kitchen has none).
- Extending the `add-food` / `add-ingredient` skills to set `is_mystery` (first food is added via migration/Shop Admin).

## Proposed behavior

### Schema (one migration)

```sql
alter table shop_ingredient_prices add column is_mystery boolean not null default false;
alter table shop_recipes          add column is_mystery boolean not null default false;
```

No new table: mystery ingredients ride the existing `shop_ingredient_rewards` ledger (one row per unit, so awarding quantity 2 = 2 rows, `quiz_session_id` preserved → existing idempotency guard still works) and the existing availability math (`rewards + purchases − consumptions`).

### RPCs

**`reward_session_ingredients(p_quiz_session_id text)`** — new; the single call site for both quiz paths. `security invoker`, same role/ownership/idempotency preamble as `reward_random_ingredients` (child or platform admin; session belongs to caller; any existing `shop_ingredient_rewards` row for the session → return empty). Then:
1. Determine win from the `quiz_sessions` row (rules above; paragraph detected via `grade_data` entries with `isParagraphBlank`).
2. Non-win → delegate to the existing random logic (same behavior, same output).
3. Win → run the prioritization above, insert reward rows (`quantity` rows per chosen type), then for every active mystery recipe now fully held and not yet unlocked, call `unlock_shop_recipe`.
4. Return `{ isWin, ingredients: [{ingredientKey, labelI18n, iconPath, quantity, isMystery}], unlockedRecipeIds: [...] }`.

**`unlock_shop_recipe`** — gains a mystery branch: for `is_mystery` recipes it ignores coin cost (no wallet decrement, no `shop_coin_transactions` row) and succeeds only if the caller currently holds every `base_ingredients` quantity; otherwise rejects. Calling it directly for a mystery recipe the child already fully holds is harmless (same condition, idempotent).

**`purchase_shop_ingredient`** — rejects `is_mystery` ingredients.
**`reward_random_ingredients`** — pool excludes `is_mystery` keys (otherwise an unlocked mystery food's ingredients would leak into the random pool).
**`cook_shop_recipe`** — no change.

### Client

- `src/lib/supabase-service.ts`: `rewardSessionIngredients(quizSessionId)`; `RewardedIngredient` gains `quantity` and `isMystery`. Both existing call sites switch to it: `ParagraphQuizReviewSection.tsx` `finishSession`, and `moveQuizForward` in `words.shared.state.ts` (still gated on packaged session). Failure never blocks completion — unchanged.
- `IngredientRewardPanel.tsx`: show `×quantity`; win variant headline/copy; "unlocked" celebration when `unlockedRecipeIds` is non-empty.
- `ShopSection.tsx` (recipe wall): mystery recipe tile — a deliberately **mysterious, special/fancy** locked treatment (e.g. dark/jewel-toned backdrop, sparkle accents, the real icon rendered as a glowing silhouette with a "?"; Tailwind only, within `style-ref.md` rules — exact look to be reviewed in-browser before sign-off) + "N/M" progress until unlocked; modal shows each ingredient held/needed; no unlock or buy controls. Needs the ledger availability map loaded on this page.
- Fridge: mystery ingredients appear via the existing availability map (they are catalog rows).
- Shop Admin: `is_mystery` toggle on recipe form and ingredient catalog form. Validation: a mystery recipe may reference only mystery ingredients, a non-mystery recipe none; mystery recipe `unlock_cost_coins` forced to 0; `cook_method` + `food_type` required as for any cookable recipe.
- Strings: new EN + ZH keys in `words.strings.ts` (reward panel, recipe-wall progress/silhouette copy, Shop Admin labels), with parity test coverage.

## Layer impact

UI (review sections, `IngredientRewardPanel`, `ShopSection`, Shop Admin), Service (`supabase-service.ts`, `shop.ts` helpers), DB (2 columns, 1 new RPC, 3 edited RPCs). Spec required (`0_BUILD_CONVENTIONS.md §1`). No AI layer, scheduler, grading, or coin-formula change. No new route.

## Edge cases

- **Fully stocked, nothing to give:** every mystery food already has ≥ 1 full set held (child hasn't cooked yet) so no type is unsatisfied → **decided 2026-10-24:** reward another full set (target becomes `2 × quantity`) of the first food in priority order, so a win always pays out and repeat cooking is possible.
- **Quota not filled after every food is satisfied** (e.g. one 4-type food with 3 types held: the win tops up the 4th, then has 2 slots left): remaining slots **stockpile another full set**, never repeating a type within one win, so a win does not pay out fewer ingredients than it could. **Owner rule (2026-10-24): when every food is satisfied, prioritize the food with the fewest ingredient types; foods tied on that count are picked at random.** (Reference implementation `src/lib/mysteryFood.ts`; SQL uses `order by random()` for the tie-break.)
- **No mystery foods exist / all inactive:** **decided 2026-10-24:** fall back to the random reward, so a win never pays less than a non-win.
- **Shared mystery ingredient across two foods with different quantities:** reward the larger needed quantity once per win.
- **Partial holdings (1 of 2):** topped up to 2, not +2.
- **Retried reward call:** existing per-`quiz_session_id` idempotency guard returns empty; no second set, no second unlock.
- **Admin deactivates a mystery food mid-progress:** held ingredients stay in the fridge; the food leaves the candidate list; an already-unlocked food just becomes non-cookable like any inactive recipe.
- **Admin edits quantities after a child holds a partial set:** progress is recomputed from the ledger at read time, so no stale state. A food already unlocked stays unlocked.
- **Session with 0 graded entries:** non-win.
- **Cooking drops holdings below one set:** food stays unlocked (decided); cook is just blocked by `insufficient_ingredients`.

## Risks

- **Edits three existing RPCs in the coin/unlock family** — highest-risk part; regressions would hit paid unlocks and purchases. Needs focused RPC-level tests plus a live smoke test of normal unlock/purchase/cook after the migration.
- **Win derived from `grade_data` shape** (`isParagraphBlank`, tier counts) — a future change to how paragraph tiers are recorded silently changes who wins. Cover with a unit test on the win predicate.
- **Mystery-flag integrity** — the "never buyable / never random / never in a normal recipe" guarantees depend on `is_mystery` being checked in four places (purchase RPC, random pool, Shop Admin validation, buy UI). Missing any one breaks the promise.
- **Migration deployment tracking** — per the standing lesson (see item J history), do not edit this migration in place after it is pushed to dev; add a new one.

## Test plan

- Win predicate (pure function mirrored in SQL): character session 0 `again` → win; ≥ 1 `again` → non-win; phrase `again` → non-win; paragraph all-`easy` → win; paragraph with any `good`/`hard` → non-win; zero grades → non-win.
- RPC: non-win returns random reward identical to today; win returns mystery rows only; quota ≤ 3 types; top-up quantities; ordering (closest-to-complete first, then never-made, then least-made); remainder starts next food; no duplicate type in one win; idempotent on retry; ownership/role rejection; auto-unlock fires exactly when the set completes and is a no-op afterwards; `unlock_shop_recipe` mystery branch charges 0 and rejects an incomplete set; `purchase_shop_ingredient` rejects mystery; random pool excludes mystery keys; `cook_shop_recipe` consumes exactly one set and a second cook works only with a second set.
- Service wrapper mocked-RPC test (snake → camel, `quantity`, `isMystery`, `unlockedRecipeIds`).
- UI helpers: panel quantity/win copy, recipe-wall progress count, silhouette state.
- `scripts/verify-rls.ts` re-run (Sections 9–11) after migration; `db:status` to confirm deployment.
- Live QA on dev: win a packaged character session → mystery ingredients, fridge shows them, recipe wall progress moves, food auto-unlocks, cook it, win again → rewards again; non-win → random reward; paragraph with one bounce → random, paragraph clean → mystery.

## Acceptance criteria

- [x] Win/non-win derived server-side exactly per the rules above; paragraph quiz wins only with zero bounces. _(verify:mystery-foods)_
- [x] Non-win packaged session rewards identically to today; win rewards only mystery ingredients. _(verify:mystery-foods)_
- [x] A win rewards up to 3 ingredient types at full per-food quantity, prioritized per item N. _(verify:mystery-foods + mysteryFood.test.ts)_
- [x] Mystery ingredients cannot be bought, never appear in random rewards, and are rejected in non-mystery recipes by Shop Admin. _(verify:mystery-foods + shopAdmin.types.mystery.test.ts)_
- [x] Mystery food auto-unlocks when a full set is held, stays unlocked, cooks via unchanged `cook_shop_recipe`, consumes one set per cook, and is repeatable. _(verify:mystery-foods)_
- [x] Recipe wall shows a silhouette + progress for a locked mystery food; fridge shows mystery ingredients. _(manual in-browser QA passed 2026-10-24)_
- [x] No change to coins, wallet, scheduler, or grading; ad-hoc sessions still unrewarded. _(auto-unlock verified to write no wallet/coin-history row; reward call sites still gated on packaged sessions)_
- [x] `tsc`, `eslint`, `npm test`, `check:encoding` pass; `verify:rls` run and result noted; migration deployed and confirmed via `db:status`; live QA checklist done.
- [x] `0_ARCHITECTURE.md` (Recipe Shop / Shop Admin / Shop Kitchen / Fill-Test reward rules, schema tables), `0_PRODUCT_ROADMAP.md`, `0_BUILD_CONVENTIONS.md`, and the ingredient-reward spec addendum updated 2026-10-24.

## Open questions

Resolved 2026-10-24: (1) fully stocked → reward another full set; (2) no mystery foods → random-reward fallback; (3) nearly-complete outranks never-made (ordering above); (5) locked-food treatment is a **mysterious, special/fancy design** (see Client → recipe wall) rather than a plain filtered icon.

(4) Launch food supplied 2026-10-24 — see "Launch content" below.

## Launch content (supplied 2026-10-24)

**Food:** slug `crystal-dumpling` · "Crystal Dumplings" / 水晶虾饺 · `cook_method: stove` · `food_type: hotmeal` · `unlock_cost_coins: 0` · `is_mystery: true`.
- Intro EN: "Translucent jade dumplings glowing with sweet tiger prawns and bamboo. A bite of pure imperial magic!"
- Intro ZH: 晶莹剔透的水晶皮，裹着鲜甜脆嫩的笋尖虾仁，像发光的小宝盒！
- Locked-tile teaser EN: "A royal bamboo steamer hides a secret treasure glowing like jade." / ZH: 神秘的蒸笼里，藏着一道像玉石般透亮发光的点心。 *(teaser is new copy not covered elsewhere in this spec — needs a place to live: recommend a localized `teaser_i18n` jsonb on `shop_recipes`, shown only while a mystery food is locked; part of this migration if accepted.)*

**Mystery ingredients** (all `is_mystery: true`, `cost_coins: 0`; 4 types, 6 units → needs 2 wins: one win gives up to 3 types, e.g. starch×2 + prawn×2 + bamboo×1, the next gives the oil):

| key | EN | ZH | qty | staged art |
|---|---|---|---|---|
| `imperial-wheat-starch` | Imperial Wheat Starch | 御膳澄粉 | 2 | `public/rewards/staging/1.jpeg` |
| `wild-tiger-prawn` | Wild Tiger Prawn | 野生虎头虾 | 2 | `…/2.jpeg` |
| `spring-bamboo-shoot` | Spring Bamboo Shoot | 翡翠春笋 *(corrected from 翡翠冬笋)* | 1 | `…/3.jpeg` |
| `gilded-sesame-oil` | Gilded Sesame Oil | 金箔香油 | 1 | `…/4.jpeg` |

Food art: `public/rewards/staging/food.jpeg` → final `public/rewards/crystal-dumpling_plain.png`. Ingredient art → final `public/ingredients/<key>.png`.

**Art status / required processing:** all five staged files are 2048×2048 **JPEGs on an opaque white background**, not transparent PNGs — they must go through the repo's place-icon + `normalize-reward-icon.mjs` transparency step (the `add-food` skill's Phase 1–2 flow) before use. Note the staging folder is `public/rewards/staging/` (no underscore), not the skill's `public/rewards/_staging/`; ingredient icons are also sitting in the rewards staging folder rather than `public/ingredients/_staging/` — move or point the skill at them at implementation time.

**Content flags to resolve before build:**
- **ZH name mismatch (resolved: 翡翠春笋):** English says "Spring Bamboo Shoot" but 翡翠冬笋 means "jade *winter* bamboo shoot" (冬笋 = winter shoot; spring shoot is 春笋). Recommend 翡翠春笋 — confirm.
- The ordinary-ingredient catalog already has bamboo *leaves*; no key collision with the four above.
- Locked-tile look (agent guidance, advisory): midnight-indigo `#1E1B4B` → royal plum `#3B185F` radial gradient, soft gold glow border (`#FDE047` / `#F59E0B`), glowing amber "?" with twinkle stars, golden-on-plum progress bar. **Implementation must stay within `0_BUILD_CONVENTIONS.md §7`:** Tailwind only, no `style={{}}`, no arbitrary values (`bg-[#1E1B4B]`, custom `box-shadow`) without a documented reason, and twinkle animation via existing Tailwind utilities (`animate-pulse`) unless a keyframe truly cannot be expressed — then a documented CSS-module exception per §7. Reconcile the hex values with `style-ref.md` colors, or document the deliberate exception in the spec before building.

**Chef dialogue (explicitly NOT in this spec):** the design agent also wrote four lines for a cartoon chef (first unlock, tapping the stove/selecting the recipe, cook success, idle tap). No chef character, speech bubble, or dialogue system exists in the codebase today (searched `src/`), and no chef art was delivered. This is a separate new feature — tracked as roadmap item O — to be specced once the owner decides scope. The lines are preserved verbatim in the roadmap row for item O's future spec.

**Resolved 2026-10-24:** (a) ZH name for the bamboo shoot becomes **翡翠春笋** (matches "Spring"); (b) `teaser_i18n jsonb` (`{ en, zh }`, nullable) is **added to `shop_recipes` in this migration** and shown only on a locked mystery tile; Shop Admin gains two teaser inputs on the mystery recipe form; (c) staged JPEGs go through the `add-food` skill's place-icon + transparency normalization, sources moved/pointed at from `public/rewards/staging/`; (d) the locked-tile look is rebuilt within Tailwind/`style-ref.md` constraints, any unavoidable arbitrary value documented as a deliberate exception.

Nothing is open for item L/M/N's launch content. Ready to build on the owner's go-ahead.
