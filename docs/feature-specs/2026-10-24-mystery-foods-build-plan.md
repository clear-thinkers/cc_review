# Build Plan — Mystery Foods (L/M/N) and Kitchen Chef (O)

Staged development checklist so no step is missed between sessions. **This file is the source of truth for build progress**; the specs (`2026-10-24-mystery-foods.md`, `2026-10-24-kitchen-chef-dialogue.md`) are the source of truth for behavior. If they disagree, the spec wins and this plan is corrected.

## Handoff — current state (update at the end of every session)

- **Last updated:** 2026-10-24.
- **Current stage:** Mystery Foods (Part 1) **complete and shipped**: dev + prod migration done, live QA passed, committed and pushed to `main` 2026-10-24. Only the Stage 11 prod smoke check remains for the owner to confirm. Part 2 (Chef, item O) is next whenever the owner wants it.
- **Next action:** (owner) confirm the prod smoke check — the crystal-dumpling tile and ingredient art load on prod, which requires the app deploy that includes the new `public/` PNGs. (Claude) Part 2: Chef, starting at Stage C0.
- **Blockers / notes:** none.

## Standing authorizations (do not re-ask; cite this)

Given 2026-10-24 by the owner, in the `Mystery Foods` brainstorm:
- Schema migration (`is_mystery` on `shop_recipes` and `shop_ingredient_prices`, `teaser_i18n` on `shop_recipes`), new RPC `reward_session_ingredients`, and edits to `unlock_shop_recipe`, `purchase_shop_ingredient`, `reward_random_ingredients` (`AI_CONTRACT.md §2`). Automatic free unlock via `unlock_shop_recipe`'s new mystery branch.
- **Not** authorized: any RLS policy edit, any change to the `current_*()`/`custom_access_token_hook` functions, any new route, any production deploy. If one becomes necessary, stop and ask for the word "authorized".

## Rules for working this plan

1. Read the three `0_` governance docs + `AI_CONTRACT.md` at session start (§3 protocol) and the two specs.
2. Tick a box only when the step is **done and verified** (command output seen, or checked in the running app). Add a dated one-line note for anything surprising.
3. Strings before JSX (`0_BUILD_CONVENTIONS.md §0`): EN + ZH, parity test.
4. Tests alongside implementation, not after.
5. **Never edit a migration after it has been pushed to dev** — add a new one (see `docs/feature-specs/2026-08-23-kitchen-page.md` Revision 2 incident). Check `npm run db:status` before touching any migration file.
6. Do not commit or push unless the owner asks. No prod deploy without an explicit request.
7. Update this Handoff block before ending a session.

---

## Part 1 — Mystery Foods (items L, M, N)

### Stage 0 — Pre-flight
- [x] Governance docs and both specs re-read; spec open questions confirmed empty
- [x] `git status` understood (2026-10-24): on `main`; only this feature's docs + `public/rewards/staging/` are untracked/modified. No feature branch created (owner has not asked).
- [x] `npm run db:status` baseline recorded (2026-10-24): **11 local-only migrations not in dev's history** (first written as 12 in error — corrected) — `20260929200533` … `20261007205320` (content migrations from the add-food/add-ingredient/add-food-variation skills, plus `20260930185823` which rewrites `cook_shop_recipe`). Verified read-only via `supabase db query --linked`: dev **already has** all of their effects (`cook_shop_recipe` contains `waivedBaseIngredientKeys`; recipes `noodle`/`fried-egg-over-rice`/`popcorn-chicken` and the 5 new ingredients exist) — they were applied directly and never recorded in dev's history. Not caused by this feature; handled at Stage 4.
- [x] Baseline green (2026-10-24): `tsc --noEmit` clean; `check:encoding` passes; `npm test` **940 tests / 69 files pass**. No pre-existing failures.

### Stage 1 — Art processing (launch food + 4 ingredients)
Sources are 2048² opaque JPEGs in `public/rewards/staging/` (`food.jpeg`, `1.jpeg`–`4.jpeg`; mapping in the spec).
- [x] `food.jpeg` → `public/rewards/crystal-dumpling_plain.png`, real transparency (add-food skill's place-icon + `normalize-reward-icon.mjs`)
- [x] `1.jpeg` → `public/ingredients/imperial-wheat-starch.png`
- [x] `2.jpeg` → `public/ingredients/wild-tiger-prawn.png`
- [x] `3.jpeg` → `public/ingredients/spring-bamboo-shoot.png`
- [x] `4.jpeg` → `public/ingredients/gilded-sesame-oil.png`
- [x] All five visually checked (2026-10-24): normalized with real alpha 0 corners (masked 50–77% as background, within the script's QC bounds); composited on magenta — no white fringe, oil-bottle handle loop correctly transparent, subjects intact. All 2048×2048 PNG.
- [x] Source JPEGs left in staging until the owner says to delete (do not delete)

### Stage 2 — Pure domain logic + tests (no database)
New module (e.g. `src/lib/mysteryFood.ts`) with a TypeScript **reference implementation** of the rules, so the SQL can be checked against it.
- [x] `isWinSession(quizSession)` — character/phrase/mixed: `failed_count = 0 && total_grades > 0`; paragraph (`isParagraphBlank` entries): all grades `easy`
- [x] `planMysteryReward(foods, holdings, madeCounts, quota=3)` — ordering: fewest unsatisfied types → never-made → least-made → `display_order`; top-up quantity; no duplicate type per win; remainder starts next food; all-stocked → another full set; no foods → returns `null` (caller falls back to random)
- [x] `getMysteryFoodProgress(food, holdings)` — "N/M" types held in full quantity
- [x] Unit tests for every bullet above incl. the edge cases in the spec (shared ingredient across foods, partial holdings, zero grades, inactive food)
- [x] `npx tsc --noEmit` + the new test file green (2026-10-24): files `src/lib/mysteryFood.ts`, `mysteryFood.types.ts` + companion tests — 28 new tests pass; `tsc` clean; `eslint` clean on all four files.
- **Design note (2026-10-24):** the spec was silent on one case — a win whose quota is not filled after every food is satisfied (e.g. one food with 4 types, 3 already held). The reference implementation **fills the leftover slots by stockpiling another set** (same priority order, no repeated type per win) rather than paying out fewer than 3. **Owner rule (2026-10-24): in that stockpile phase, foods rank by fewest ingredient types first, ties picked at random** (`random` is an injectable parameter, default `Math.random`; tests inject a fixed value). Phase 1 ordering is unchanged (closest to complete → least-made → display order). The SQL in Stage 4 must match both; also in the spec's Edge cases. Tests: 27 in `mysteryFood.test.ts` (+3 in the types test), all passing; `tsc`/`eslint` clean.

### Stage 3 — Strings (EN + ZH)
- [x] `words.strings.ts`: reward panel (`ingredientReward.win*`, `mysteryBadge`, `quantityTimes`, `unlocked*`), recipe-wall copy (`shop.mystery.*`), Shop Admin labels (`shopAdmin.fields.isMystery/teaser*`, `ingredientPricing.mystery*/filterMystery`); `kitchen.strings.ts` `fridgeMysteryBadge` (2026-10-24). Shop Admin validation messages are English literals in `src/lib/shopAdmin.types.ts` by existing convention, so no string keys were added for them.
- [x] Parity test passes (`words.strings.test.ts` + `kitchen.test.ts` parity) — plus `tsc`, `eslint`, `check:encoding` clean (2026-10-24). Reminder for Stage 7: every key added here must actually be used by the UI or be removed.

### Stage 4 — Migration (write → review → push to dev)
New file `supabase/migrations/<timestamp>_mystery_foods.sql` (timestamp must not collide with an existing one — see `0_BUILD_CONVENTIONS.md`/add-food hardening).
- [x] **Migration history drift (prerequisite):** — **DONE 2026-10-24** (owner approved): repaired exactly the 11 versions `20260929200533 … 20261007205320`; `db:status` now shows Local = Remote for all. `db:push` would try to replay the 11 local-only migrations listed in Stage 0 and fail (plain `INSERT`s of recipes/ingredients dev already has). Fix with `supabase migration repair --status applied <11 versions> --linked` — writes only dev's migration-history table, no schema/data change. **Ask the owner before running it.** Re-run `npm run db:status` afterward: Local = Remote for all 11. (Prod is unaffected; those 12 are still pending there, which is correct.)
- [x] Read the **latest** definitions first: — read 2026-10-24 (`unlock_shop_recipe` = `20260324120000`, `purchase_shop_ingredient` = `20260823010000`, `reward_random_ingredients` = `20260822000000`; no later redefinitions). `unlock_shop_recipe` (grep migrations, newest wins), `purchase_shop_ingredient` (`20260823010000_shop_ingredient_purchases.sql` or later), `reward_random_ingredients` (`20260822000000_shop_ingredient_rewards.sql` or later)
- [x] Columns: `shop_ingredient_prices.is_mystery`, `shop_recipes.is_mystery`, `shop_recipes.teaser_i18n` — plus two CHECK constraints (mystery ingredients cost 0; mystery recipes unlock for 0).
- [x] `unlock_shop_recipe`: mystery branch — new code `mystery_not_ready` (client normalizer must accept it — Stage 6). (0 coins, no wallet/transaction rows, requires full set); non-mystery behavior byte-for-byte unchanged
- [x] `purchase_shop_ingredient`: reject `is_mystery` — reuses `ingredient_not_available`.
- [x] `reward_random_ingredients`: pool excludes `is_mystery` keys
- [x] New `reward_session_ingredients(p_quiz_session_id)`: — written; mirrors `mysteryFood.ts` incl. the owner's fewest-ingredients/random stockpile tie-break. same role/ownership/idempotency preamble; server-side win determination; non-win → random reward; win → mystery plan + inserts + internal `unlock_shop_recipe` calls; returns `{isWin, ingredients[], unlockedRecipeIds[]}`; no-mystery-foods → random fallback
- [x] Seed rows: — in the same file; `display_order 14` (**wall is full at 13 — see Stage 6/7 note**). 4 mystery ingredients (`cost_coins 0`, `is_mystery`, `/ingredients/<key>.png`, EN/ZH labels) + `crystal-dumpling` recipe (`is_mystery`, `cook_method stove`, `food_type hotmeal`, `unlock_cost_coins 0`, base ingredients with quantities 2/2/1/1, intro + `teaser_i18n`, active, next free `display_order`)
- [x] File written: `supabase/migrations/20261024170000_mystery_foods.sql`; **dry-run validated 2026-10-24** (whole file run inside `begin … rollback` against dev: no errors; follow-up query confirmed nothing persisted). Added two helper functions not in the original plan: `shop_ingredient_available_count`, `shop_recipe_base_requirements`.
- [x] **Owner reviewed and approved the SQL (2026-10-24).**
- [x] `npm run db:push` to dev; `npm run db:status` shows Local = Remote — pushed 2026-10-24, `20261024170000` in both columns.
- [x] Confirm live definitions via `supabase db query --linked` (`pg_get_functiondef`) — per the item J incident, don't trust the file alone. **Verified 2026-10-24:** `unlock_shop_recipe`, `purchase_shop_ingredient`, `reward_random_ingredients` each have exactly one overload and now contain `is_mystery`; `reward_session_ingredients` exists; `cook_shop_recipe` still one overload; 4 mystery ingredients + 1 mystery recipe seeded; 14 recipes total.

### Stage 5 — RPC verification against dev
Throwaway test family/child; clean up afterwards. **Implemented as a re-runnable script: `npm run verify:mystery-foods` (`scripts/verify-mystery-foods.ts`) — 48/48 pass on dev (2026-10-24), cleanup verified (0 leftover families/recipes/ingredients/sessions; real `crystal-dumpling` restored active).** Every item below is covered by it (temp mystery foods + a real-seed phase).
- [x] Non-win character session → random reward, identical shape to before
- [x] Win character session → mystery ingredients only, ≤ 3 types, correct quantities
- [x] Phrase `again` → non-win; zero-grade session → non-win
- [x] Paragraph clean → win; paragraph with one `good`/`hard` → non-win
- [x] Priority ordering, top-up, remainder-to-next-food (needs a temporary 2nd mystery food — remove after)
- [x] Second call, same session → empty (idempotent); other user's session → rejected
- [x] Auto-unlock fires exactly once when the set completes; food stays unlocked after cooking consumes the set
- [x] `purchase_shop_ingredient` on a mystery key → rejected; `unlock_shop_recipe` on an incomplete mystery recipe → rejected; normal recipe unlock/purchase unchanged
- [x] `cook_shop_recipe` on the mystery recipe consumes exactly one set; second cook needs a second set
- [x] `npm run verify:rls` re-run; result recorded here (known pre-existing failures per `0_BUILD_CONVENTIONS.md §10` are not regressions)
- **`verify:rls` result (2026-10-24): 80 passed, 1 failed.** The one failure is Section 6 `vocab_phrase_lesson_tags setup skipped — no shared textbook found for lesson_tags FK` — the known standing Section 6 failure class (documented in `0_BUILD_CONVENTIONS.md §10`; this run's message differs from the older "missing `grade` column" text, but it concerns textbooks/lesson tags, which this migration doesn't touch). Sections 9, 10, 11 all pass — **Section 10 (Shop Kitchen) is now confirmed passing**, closing the "likely-fixed-but-unverified" note in `0_BUILD_CONVENTIONS.md §10`; fold into Stage 9 docs.
- Test-script lesson: an extra win in one scenario shifts later holdings assertions — run independent win scenarios on separate fresh children.

### Stage 6 — Service layer + call sites
- [x] **Bump `SHOP_WALL_SIZE` 13 → 14** in `src/lib/shop.ts` (the wall is full: recipes occupy `display_order` 1–13; the add-food skill's standing instruction is to bump without asking). Check the `ShopSection.tsx` grid layout and any test asserting 13.
- [x] `normalizeUnlockShopRecipeResult` accepts the new `mystery_not_ready` code
- [x] `RewardedIngredient` gains `quantity`, `isMystery`; result type gains `isWin`, `unlockedRecipeIds`
- [x] `rewardSessionIngredients` in `supabase-service.ts` + mocked-RPC test (snake→camel)
- [x] `ParagraphQuizReviewSection.tsx` `finishSession` switched
- [x] `moveQuizForward` in `words.shared.state.ts` switched (still gated on packaged session)
- [x] Failure still never blocks completion (existing tests updated/extended)
- [x] Shop catalog/recipe types + service mappers carry `isMystery` and `teaserI18n`
- **Done 2026-10-24.** Notes:
  - Types: `ShopRecipe.isMystery/teaserI18n` and `ShopIngredientPrice.isMystery` are **required** (so any code path that builds one and forgets the flag fails to compile); `RewardedIngredient` gained optional `quantity`/`isMystery`; new `SessionIngredientReward {isWin, ingredients, unlockedRecipeIds}`; `UnlockShopRecipeErrorCode` gained `mystery_not_ready`.
  - New `normalizeShopTeaserI18n` in `shop.ts`; `rewardSessionIngredients` in `supabase-service.ts` (tolerant of malformed payloads; throws only on an RPC error). `toShopRecipe`/`toShopIngredientPrice` (service + the two admin API routes + debug route) now carry the mystery fields; the two ingredient-price routes' `select` lists include `is_mystery`.
  - `SHOP_WALL_SIZE` 13 → 14.
  - Both call sites switched (`ParagraphQuizReviewSection.finishSession`, `moveQuizForward`); the try/catch + "never block completion" structure is unchanged. The reward state now holds the whole `SessionIngredientReward`; `IngredientRewardPanel` still receives only `.ingredients` — **Stage 7 passes the full reward** so it can show quantities/win copy/unlock.
  - `rewardRandomIngredients` (client wrapper) is now unused by the app but intentionally kept with its tests; the DB function remains the non-win/fallback path inside `reward_session_ingredients`.
  - Tests: 983 pass (was 940 → +28 `mysteryFood`, +3 types, +12 service/shop). New: `supabase-service.sessionIngredientReward.test.ts`; additions in `shop.test.ts`; ~10 test fixtures got `isMystery: false`. `tsc` clean; `check:encoding` passes.
  - **ESLint:** 7 errors in `src/`, **none introduced here** — `PromptsSection.tsx`, `SessionHistoryTable.tsx` (any), `locale.tsx`, `AdminSection.tsx`, and `ingredient-prices/route.ts:423` (`prefer-const`, present in HEAD). My new/changed lines are lint-clean. Left alone (out of scope).


### Stage 7 — UI
- [x] `IngredientRewardPanel.tsx`: `×quantity`, win variant copy, unlock celebration
- [x] `ShopSection.tsx`: locked mystery tile (mysterious design, within Tailwind/`style-ref.md`; any arbitrary value documented), teaser, "N/M" progress, ingredient held/needed modal, **no** unlock/buy controls; availability ledger loaded on this page
- [x] Buy button hidden for mystery ingredients everywhere
- [x] Fridge shows mystery ingredients (verify they resolve label/icon)
- [x] Shop Admin: mystery toggle on recipe + ingredient forms, teaser inputs, validation (mystery recipes ↔ mystery ingredients only, cost forced 0, `cook_method`/`food_type` required)
- [x] Helper-level tests for progress count, locked state, validation
- **Done 2026-10-24.** What was built:
  - `IngredientRewardPanel` now takes the whole `SessionIngredientReward`: win variant (purple styling, "Perfect session!" copy, Mystery badge, `×quantity`) and an unlock banner naming the food (titles fetched via `listShopRecipes` + `buildUnlockedRecipeTitles`; banner degrades to a generic line if that fetch fails).
  - `src/app/words/shop/MysteryFoodTile.tsx` (new): locked tile (indigo/plum vault look, amber glow, twinkle stars, glowing silhouette + "?", segmented progress bar — one segment per ingredient type, so no inline `style`) and a locked-food modal (teaser only — never the name/intro; per-ingredient have/need; no Buy, no Unlock). `ShopSection` loads the reward/purchase/consumption ledgers into an availability map, shows the badge on unlocked mystery tiles, branches the modal, and `RecipeModal` hides Buy for mystery ingredients.
  - Fridge: purple "Mystery" badge on mystery ingredient cards (`KitchenSection`).
  - Shop Admin: `isMystery` + `teaserI18n` on the recipe draft/form/route (mystery forces `unlock_cost_coins` 0, requires a cook method, teaser ≤ 140; blank teaser stores null); `isMystery` on ingredient drafts/form/route (price pinned to 0, disabled input, Mystery badge + filter); cross-validation both ways via `validateShopRecipeAdminDraft(draft, mysteryIngredientKeys)` — the route loads the catalog's mystery keys server-side so the rule can't be bypassed from the client.
  - New pure helpers `src/lib/mysteryFoodUi.ts`.
  - Style note: the locked tile intentionally leaves the shop's gold/cream skin (owner direction); arbitrary glow values (`shadow-[…]`, `[text-shadow:…]`) are used only for that glow, with a header comment in the file explaining why — same precedent the shop file already follows.
  - Tests: **1002 pass** (+19 this stage: `shopAdmin.types.mystery.test.ts` 13, `mysteryFoodUi.test.ts` 6; one existing admin test updated for the new serialized field). `tsc` clean; `check:encoding` passes; **`next build` succeeds**; eslint clean on all touched files except the pre-existing `ingredient-prices/route.ts` `prefer-const` (in HEAD). Every Stage 3 string key is used (checked programmatically).
  - **Not yet seen in a browser** — all visual checks (tile look, phone width, panel, fridge, admin) are Stage 10 live QA.


### Stage 8 — Verification gates
- [x] `npx tsc --noEmit` clean
- [x] `npx eslint` clean on touched files
- [x] `npm test` all green (count recorded here)
- [x] `npm run check:encoding` passes
- [x] No hardcoded JSX strings; no `style={{}}`; no `any`
- **Final run 2026-10-24:** `tsc --noEmit` clean · `npm test` 1002/1002 · `check:encoding` passes · `next build` succeeds · eslint clean on every touched file (only the pre-existing `ingredient-prices/route.ts` `prefer-const` remains) · no `any`, no `style={{}}`, no hardcoded JSX strings (all copy via `*.strings.ts`).

### Stage 9 — Docs (same change set)
- [x] `0_ARCHITECTURE.md`: Recipe Shop rules, Shop Admin rules, Shop Kitchen rules, Fill-Test rule 39 (reward now win-aware), Data Schema (new columns/RPC), System Guarantees
- [x] `0_PRODUCT_ROADMAP.md`: items L/M/N status + §4 shipped entry; "Last updated" line
- [x] `0_BUILD_CONVENTIONS.md`: only if conventions changed (likely not)
- [x] `2026-08-22-paragraph-quiz-ingredient-reward.md`: addendum noting the reward is superseded for wins
- [x] `2026-10-24-mystery-foods.md`: status line + ticked acceptance criteria
- [x] Docs Check block + RLS check + tests result written in the final session summary (`AI_CONTRACT.md §4`)
- Docs written 2026-10-24: ARCHITECTURE (Fill-Test Rule 40; Recipe Shop Rules 23–27; Shop Admin Rules 11–12; Shop Kitchen Rule 17; schema rows for `shop_recipes`/`shop_ingredient_prices`/`shop_ingredient_rewards`; System Guarantee 6c), ROADMAP (items L/M/N status, current-state paragraph, §4 entry), BUILD_CONVENTIONS (§10 `verify-mystery-foods.ts` entry; `verify-rls` known state refreshed — Section 10 confirmed passing), older reward spec addendum, mystery spec status + acceptance ticks.
- **Docs Check (AI_CONTRACT §4)** — 0_ARCHITECTURE.md: updated · 0_BUILD_CONVENTIONS.md: updated (new §10 script, verify-rls state) · 0_PRODUCT_ROADMAP.md: updated · RLS check: `verify:rls` run 2026-10-24 — 80 passed / 1 failed (pre-existing Section 6 `vocab_phrase_lesson_tags`, unrelated); no RLS policy was added or changed · Tests: pass (1002), new tests written. AI_CONTRACT.md: not changed — `unlock_shop_recipe` is still the only writer of `shop_recipe_unlocks`.

### Stage 10 — Live QA on dev (through the real app, as a child)
- [x] Win a packaged character session → reward panel shows mystery ingredients with quantities; fridge shows them
- [x] Recipe wall: locked tile looks right, progress moves, hint/teaser shown, no buy/unlock buttons
- [x] Second win completes the set → panel announces unlock → food is unlocked and cookable
- [x] Cook it → one set consumed, dish on countertop with the plain icon; win again → rewards again (never-made now made)
- [x] Non-win session → regular random reward
- [x] Paragraph quiz: clean → mystery; one bounce → random
- [x] Phone-width layout of the locked tile and reward panel
- [x] Both English and Chinese
- [x] Any bug found → fix + fix-log in `docs/fix-log/` (`AI_CONTRACT.md §5`), noted here
- **Owner reported manual in-browser QA passed (2026-10-24)** across the Stage 10 checklist; no bugs reported, so no fix log was needed.

### Stage 11 — Production (only when the owner asks)
- [x] `npm run db:push:prod:dry` run 2026-10-24 — **prod would receive exactly one migration, `20261024170000_mystery_foods.sql`** (the 11 earlier shop-content migrations are already recorded on prod). Not yet reviewed/approved by the owner. **A read-only SELECT against prod for slug/`display_order` conflicts was attempted and denied by the permission classifier — not worked around.** The recipe seed is a plain `INSERT` (`crystal-dumpling`, `display_order` 14), so a conflict would abort the migration atomically; before pushing, the owner should either run the two checks below or grant permission for a read-only prod check.
  - `select slug, display_order from shop_recipes order by display_order;` (expect no `crystal-dumpling`, nothing at 14)
  - `select count(*) from shop_ingredient_prices where ingredient_key in ('imperial-wheat-starch','wild-tiger-prawn','spring-bamboo-shoot','gilded-sesame-oil');` (expect 0)
- [x] `npm run db:push:prod` — run by the owner (reported done 2026-10-24).
- [ ] Prod smoke check; art files confirmed deployed with the app build

---

## Part 2 — Kitchen Chef (item O) — independent of Part 1

UI-only; no migration; no authorization boundary. Do after Part 1 (the unlock line needs the mystery unlock) unless the owner reorders.

### Stage C0 — Pre-flight
- [ ] Re-read the chef spec; baseline `tsc`/`npm test`/`check:encoding` green

### Stage C1 — Art processing
Sources in `public/rewards/staging/`: `c1`–`c5`.jpeg (`c2`/`c3` are ~1330², the others 2048²).
- [ ] `c1`→`public/kitchen/chef_idle.png`, `c2`→`chef_amazed.png`, `c3`→`chef_careful.png`, `c4`→`chef_celebrate.png`, `c5`→`chef_hungry.png`
- [ ] Real transparency on all five; all normalized to one canvas size with a shared feet baseline
- [ ] Visual check at ~160 px tall (is `chef_careful` too stern at that size? if so, flag to the owner)
- [ ] `chef_cook.jpeg` left untouched (no planned use)

### Stage C2 — Strings + helpers
- [ ] `words.strings.ts` (or `kitchen.strings.ts`, whichever the kitchen already uses): `kitchenChef` section with generic lines (all triggers, 3 variants) + `crystal-dumpling` lines, EN + ZH, parity test
- [ ] Pure helper: pick line by trigger/recipe/locale with recipe override, generic fallback, never repeat last line; unit tests incl. cooldown logic
- [ ] Chef name available for `aria-label`: "Chef Shrewy" / 鼩仔

### Stage C3 — Component
- [ ] Chef overlay + speech bubble on `KitchenSection.tsx`; pose swaps per trigger, returns to `idle` after a few seconds
- [ ] Four triggers wired: unlock (next-visit, local "seen" flag), start cooking, cook success, idle tap (served vs. empty kitchen variants)
- [ ] Tap cooldown; `prefers-reduced-motion` respected; bubble wraps for long recipe lines
- [ ] Never covers fridge/recipe book/stove/oven/shelf hotspots; collapsible on small screens
- [ ] Tests at the helper/subcomponent seam

### Stage C4 — Verification + docs
- [ ] `tsc`, `eslint`, `npm test`, `check:encoding` green
- [ ] `0_ARCHITECTURE.md` Shop Kitchen rules + `0_PRODUCT_ROADMAP.md` item O + chef spec status updated
- [ ] Live QA: all four triggers in EN and ZH, phone + desktop widths, hotspots still clickable
- [ ] Docs Check block in the session summary
