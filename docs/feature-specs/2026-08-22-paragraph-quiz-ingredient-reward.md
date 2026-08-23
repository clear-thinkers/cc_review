# Feature Spec — 2026-08-22 — Paragraph Quiz Ingredient Reward

## Status

**Genuinely new — not in `0_PRODUCT_ROADMAP.md` at all (unlisted, not deferred).** No existing spec, doc, or code discusses connecting quiz completion to the shop before this. Flagged per governance process; not itself a blocker.

**Scope-boundary note — authorized 2026-08-22, now implemented and verified against dev.** Per `AI_CONTRACT.md §2`:

1. **Boundary triggered:** schema migration — a new `shop_ingredient_rewards` table and a new `reward_random_ingredients` RPC.
2. **What implied it:** the original request said "reward that to the child user"; when asked whether this should be a persisted, long-term-owned inventory or a one-off cosmetic reveal, the explicit answer was **"Persisted child-owned inventory."** That answer requires new persisted state — there is no existing table where a child can own an individual ingredient (see Problem).
3. **Implemented 2026-08-22**, authorization received explicitly: `supabase/migrations/20260822000000_shop_ingredient_rewards.sql` (table + RPC), `rewardRandomIngredients` in `src/lib/supabase-service.ts`, `RewardedIngredient` type in `src/lib/shop.types.ts`, and the reward panel in `ParagraphQuizReviewSection.tsx`. `scripts/verify-rls.ts` gained a new Section 9 covering this table (family-scoped read, cross-family isolation, user-scoped insert, no update/delete) — 66/67 passed against dev, the sole failure being the pre-existing `vocab_phrase_lesson_tags` issue already documented in `0_BUILD_CONVENTIONS.md` §"Known state," unrelated to this change. The RPC itself was also live-smoke-tested against a real unlocked recipe (`bubble_tea`, pool of 2 real ingredients — correctly rewarded both, not padded to 3), confirming idempotency (a second call for the same session returns empty), the ownership check (a session belonging to another user returns empty), and the empty-pool case (zero unlocked recipes returns empty, no rows written) all behave exactly as specced below.
4. **One implementation refinement vs. the original sketch below:** the RPC uses `security invoker` (not `security definer`) — matching `unlock_shop_recipe`/`redeem_coins`, the only two other RPCs in this codebase, both of which use `security invoker` + explicit role/ownership checks + RLS policies rather than definer-level privilege escalation. The `SQL` block under Proposed Behavior is left as originally drafted for the record; the actual shipped migration is the source of truth.

**Design decisions already resolved** (2026-08-22, by explicit answer):
- Persistence: **persisted child-owned inventory** (not cosmetic-only).
- Ingredient pool: **for each finished paragraph quiz, the child unlocks any 3 ingredients from the ingredient bank — the distinct-key pool built across every recipe the child has already unlocked (see Scope step 4).** No duplicate ingredient type within one reward event; the 3 rewarded ingredients do not need to come from the same recipe (confirmed again 2026-08-22, after mockup review, in these exact terms).
- Reward-panel visuals: **must use the real ingredient artwork already shipped in `public/ingredients/*.png`** (the same files `shop_ingredient_prices.icon_path` / `resolveShopIngredientIconPath` already resolve for the shop's own ingredient tiles in `ShopSection.tsx`) — not a placeholder icon set. Confirmed 2026-08-22 after the first mockup pass used hand-drawn placeholder icons; the mockup was corrected to embed the real PNGs (`strawberry_base.png`, `milk_base.png`, `egg_base.png`) for review, and the real implementation must do the same via the existing icon-resolution helper, never a new icon set.
- No unlocked recipes (or an unlocked recipe with an empty ingredient pool): **skip the reward step entirely** — return to Due Review exactly as today, no page, no error.
- Placement: **inline in the existing paragraph-quiz completion flow** (`ParagraphQuizReviewSection.tsx`), not a new route — mirrors the paragraph quiz's own precedent of mounting as a sibling at the existing `/words/review/fill-test` entry point rather than adding a second new-route boundary.

## Problem

Nothing currently rewards a child for finishing a paragraph-quiz session beyond coins (`calculateParagraphQuizSessionCoins`). Separately, "ingredients" today are not something a child can own in any sense: `shop_recipes.base_ingredients`/`special_ingredient_slots` are just display-data JSON arrays embedded on each shared/global recipe row (name, quantity, optional `ingredientKey`), cross-referenced against a global `shop_ingredient_prices` catalog (cost/label/icon). `shop_recipe_unlocks` records only "this child unlocked this whole recipe" — no ingredient-level state exists anywhere (confirmed by search: no `inventory`/`collect`/`reward`/`own` concept in any shop-related file). We want finishing a paragraph quiz to also hand the child 3 random ingredients, drawn from recipes they've already unlocked, that they keep.

Note: a **different**, draft/unbuilt spec already exists for a related-but-distinct idea — `docs/feature-specs/2026-03-30-shop-ingredient-shopping.md` (roadmap item F) proposes kids *spending* coins to *purchase* individual ingredients into a future `shop_ingredient_purchases` table. That table does not exist yet (confirmed: zero references in migrations or `src`). This spec does **not** build item F or attempt to unify with it — see Out of scope — but the schema below is named and shaped so a future item F build could plausibly reuse the same `shop_ingredient_prices` catalog lookups without conflict.

## Scope

- **New table `shop_ingredient_rewards`** — an append-only ledger, one row per rewarded ingredient (not per reward-event), owned by a `user_id`. "How many of ingredient X does this child have" is derived by counting matching rows — mirrors this codebase's existing append-only-ledger convention (`quiz_sessions`, `shop_coin_transactions`, `coin_redemptions` are all insert-only audit tables, never updated).
- **New RPC `reward_random_ingredients(quiz_session_id text, requested_count int default 3)`** — the only write path to this table (mirrors `unlock_shop_recipe`'s "RPC is the only allowed writer" pattern). Runs entirely server-side:
  1. Verifies caller role is `child` (or platform admin) — same check `unlock_shop_recipe` already does.
  2. Verifies the given `quiz_session_id` belongs to the caller (`quiz_sessions.user_id = current_user_id()`) — a child cannot claim a reward for a session that isn't theirs.
  3. **Idempotency guard:** if `shop_ingredient_rewards` already has any row for this `quiz_session_id`, no-ops and returns an empty result — protects against an accidental double-invocation (retry, double-click) minting duplicate rewards for the same completion.
  4. Resolves every recipe the caller has unlocked (`shop_recipe_unlocks` joined to `shop_recipes`), flattens **`base_ingredients` only** from all of them, extracts each entry's `ingredientKey` (entries without one, or whose key no longer exists in `shop_ingredient_prices`, are skipped — skip-invalid-silently, matching this codebase's existing precedent elsewhere), and de-duplicates into one **distinct-key pool** across every unlocked recipe (per the resolved "pooled, not tied to one recipe" decision). **Corrected during implementation, 2026-08-22:** the original draft here said "`base_ingredients` + `special_ingredient_slots`" — wrong. Reading the actual seeded JSON before writing the query found that `special_ingredient_slots` rows are cosmetic reward-icon variant selectors (`slotKey`/`options[].key`, e.g. `"wink_jelly"`, `"spark_pop"` — mood/topping toggles that pick which reward-icon variant renders, per `resolveShopRecipeIconPath`), never real `shop_ingredient_prices`-catalog ingredient keys. Including them would have been harmless (the `exists (... shop_ingredient_prices ...)` filter would silently exclude every one, since none of those keys are priced ingredients) but also pointless dead code — dropped from the query entirely.
  5. If the pool is empty, returns an empty result (caller's job to skip the reward UI — see Proposed behavior).
  6. Otherwise samples `min(requested_count, pool size)` distinct keys at random **inside Postgres** (`order by random() limit n`) — the client never supplies or influences which ingredients are chosen, mirroring `unlock_shop_recipe`'s pattern of deciding everything server-side rather than trusting a client-submitted outcome.
  7. Inserts one `shop_ingredient_rewards` row per sampled key, then returns the sampled keys joined with their `shop_ingredient_prices` display data (label/icon) so the client needs no second fetch to render the reward panel.
- **New service wrapper** `rewardRandomIngredients(quizSessionId: string): Promise<RewardedIngredient[]>` in `src/lib/supabase-service.ts`, mirroring `unlockShopRecipe`'s existing shape (`supabase.rpc(...)`, throw on error).
- **UI**: `ParagraphQuizReviewSection.tsx`'s `finishSession()` calls `rewardRandomIngredients(session.id)` right after `recordQuizSession(session)` succeeds (so a real `quiz_sessions.id` exists to pass), **before** `completeReviewTestSession`/`returnToDueReviewAfterReviewTestSession`. If the result is non-empty, an inline reward panel renders (new local state, e.g. `rewardedIngredients: RewardedIngredient[] | null`) showing each ingredient's icon + label with a manual "Continue" button the child clicks to actually leave — matching the existing `FillTestReviewSection.tsx` inline-summary-panel pattern (a results screen shown in the same section, not a modal or separate route, that the child dismisses themselves) rather than inventing a new UI shape. If the result is empty (no unlocked recipes, or an empty pool), the panel is skipped and behavior is unchanged from today — straight back to Due Review.
- Scoped to the **paragraph quiz only**, but `reward_random_ingredients` is parameterized generically by `quiz_session_id` (not paragraph-specific) — extending this to the classic character/phrase fill-test later would be an additional call site, not a redesign.

## Out of scope

- Roadmap item F (ingredient *purchasing*, `2026-03-30-shop-ingredient-shopping.md`) — not built, not touched, not unified with this spec's table. A future item F spec should decide for itself whether to reuse `shop_ingredient_rewards`' shape or build its own; this spec does not pre-commit that decision (see Open Questions).
- Any change to `shop_coin_transactions` — its `action_type` CHECK constraint currently only allows `'unlock_recipe'`; this feature spends no coins and logs nothing there, so it stays untouched.
- Any change to `wallets`, coin calculation, or grading — ingredient rewards are additive and orthogonal to the existing coin system, exactly the way the phrase-round flat-1-coin rule and the paragraph-quiz session-level coin formula are separate from each other today.
- A "My Ingredients" viewing page for the child to browse their accumulated rewards later. This spec only builds the grant path (the reward panel shown once, at the moment of the quiz completion that earned it); a durable collection-browsing UI is a natural follow-up but is not requested here and is not included.
- Extending this to the classic character/phrase fill-test (`FillTestReviewSection.tsx`). Paragraph-quiz-only, per the original request.
- Any admin/parent-facing controls over ingredient rewards (rates, on/off toggle, etc.).

## Proposed behavior

### Schema

```sql
create table shop_ingredient_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  ingredient_key text not null references shop_ingredient_prices(ingredient_key),
  quiz_session_id text not null references quiz_sessions(id) on delete cascade,
  rewarded_at timestamptz not null default now()
);

create index shop_ingredient_rewards_user_id_idx on shop_ingredient_rewards(user_id);
create index shop_ingredient_rewards_quiz_session_id_idx on shop_ingredient_rewards(quiz_session_id);
```

- No unique constraint on `(user_id, ingredient_key)` — repeats are allowed and expected (accumulating multiples of a common ingredient across many quiz completions is the intended, fun behavior). See Open Questions for the alternative (collect-each-once) some products prefer instead.
- `family_id` denormalized for RLS, matching every other per-user table's existing pattern (`review_session_progress`, `shop_recipe_unlocks`, etc.).
- **RLS:** family-scoped read (parent gets read-only visibility into a child's rewards, matching the `review_session_progress`/packaged-session read pattern); **no** direct client insert/update/delete policy at all — the table is default-deny for direct writes, exactly like `auth_session_profiles`'s posture, since `reward_random_ingredients` (SECURITY DEFINER) is the only permitted writer.

### RPC

```sql
create or replace function reward_random_ingredients(
  p_quiz_session_id text,
  p_requested_count int default 3
) returns table (ingredient_key text, label_i18n jsonb, icon_path text)
language plpgsql
security definer
as $$
-- 1. role check (child or platform admin) -- mirrors unlock_shop_recipe
-- 2. verify quiz_sessions.user_id = current_user_id() for p_quiz_session_id
-- 3. idempotency: if any shop_ingredient_rewards row already exists for
--    p_quiz_session_id, return empty (no-op)
-- 4. resolve distinct ingredient_key pool across every recipe in
--    shop_recipe_unlocks for current_user_id(), via shop_recipes
--    .base_ingredients / .special_ingredient_slots, skipping entries with
--    no ingredientKey or an ingredientKey no longer in shop_ingredient_prices
-- 5. if pool is empty, return empty
-- 6. sample least(p_requested_count, pool size) distinct keys via
--    order by random() limit n
-- 7. insert one shop_ingredient_rewards row per sampled key
-- 8. return sampled keys joined with shop_ingredient_prices display data
$$;
```

(Full PL/pgSQL to be written at implementation time, once authorized — the numbered steps above are the complete behavioral spec.)

### Service layer

```ts
// src/lib/supabase-service.ts
export type RewardedIngredient = {
  ingredientKey: string;
  labelI18n?: ShopLocalizedValue<string>;
  iconPath?: string | null;
};

export async function rewardRandomIngredients(quizSessionId: string): Promise<RewardedIngredient[]> {
  const { data, error } = await supabase.rpc("reward_random_ingredients", {
    p_quiz_session_id: quizSessionId,
  });
  if (error) throw new Error(`rewardRandomIngredients: ${error.message}`);
  return (data ?? []).map(/* snake_case -> camelCase, matching every other service function's convention */);
}
```

### UI — `ParagraphQuizReviewSection.tsx`

`finishSession()` changes from:

```
recordQuizSession(session) → completeReviewTestSession(id) → returnToDueReviewAfterReviewTestSession(...)
```

to:

```
recordQuizSession(session) → rewardRandomIngredients(session.id) →
  if non-empty: render inline reward panel, wait for child to click Continue →
  completeReviewTestSession(id) → returnToDueReviewAfterReviewTestSession(...)
  if empty: completeReviewTestSession(id) → returnToDueReviewAfterReviewTestSession(...) [unchanged from today]
```

The reward panel is new local state + JSX in the same component (no new route), showing each `RewardedIngredient`'s icon and localized label (`labelI18n`), plus a single "Continue" button. **Icons must be the real `public/ingredients/*.png` artwork** — resolve `iconPath` the same way `ShopSection.tsx` already does via `resolveShopIngredientIconPath`, reusing that helper rather than duplicating its fallback logic; no placeholder/generic icon set. Styling follows `/words/admin` as the visual baseline per `BUILD_CONVENTIONS.md §7`, Tailwind only — no new CSS module, but the gold/cream palette already established by `ShopSection.tsx`'s recipe/ingredient tiles (`#dcc38a`/`#fffaf0`/`#fff8ea`/`#eadfbe`) is the right visual reference for this panel specifically, since it's a shop-adjacent reward moment, not a review-workspace one — see the reviewed mockup (Artifact, linked from the 2026-08-22 planning conversation) for the agreed layout/spacing/copy direction.

A failure calling `rewardRandomIngredients` (network error, RPC error) must not block session completion — caught and logged, treated the same as an empty result (skip the panel, proceed to `completeReviewTestSession` as today). Matches this codebase's existing "shop/reward failures never block core learning flow" instinct (e.g. `finishSession`'s existing `recordQuizSession` failure handling already just logs and continues to `completeReviewTestSession`).

### Strings

New keys in `words.strings.ts`'s `paragraphQuiz` section (EN + ZH), e.g. a panel title, a "you earned these ingredients!" message, and a Continue button label — exact copy to be drafted at implementation time.

## Layer impact

Touches Service (`supabase-service.ts`) and UI (`ParagraphQuizReviewSection.tsx`) layers, plus a new DB table and RPC — **spec required** per `BUILD_CONVENTIONS.md §1` (adds a DB table, adds an RPC, touches ≥2 layers). No AI layer involvement. No change to `src/lib/scheduler.ts`/`fillTest.ts`/`paragraphQuizBuilder.ts` — grading and coins are completely untouched by this feature.

## Edge cases

- **Child has unlocked recipes but every one has an empty `base_ingredients`/`special_ingredient_slots`, or every entry lacks an `ingredientKey`** — pool resolves empty; same skip-the-panel behavior as having no unlocked recipes at all.
- **An unlocked recipe references an `ingredientKey` that was since removed from `shop_ingredient_prices`** (platform admin edited the catalog) — that entry is skipped from the pool, not an error, mirroring this codebase's skip-invalid-silently precedent used throughout (e.g. `resultsReviewTestSession.ts`).
- **Fewer than 3 distinct ingredient keys available across all unlocked recipes** — RPC rewards as many as exist (1 or 2), not an error and not padded with repeats within the same reward event.
- **Same ingredient rewarded across multiple separate quiz completions over time** — expected and allowed (no uniqueness constraint); the child's total count of that ingredient is however many rows exist for it.
- **Double-invocation of the RPC for the same `quiz_session_id`** (network retry, accidental double-click before UI disables the trigger) — idempotency guard (step 3) makes the second call a no-op, returning empty rather than minting a second set of rewards.
- **The reward RPC call fails entirely** (network/DB error) — session completion proceeds unaffected; the child simply doesn't see a reward panel this time, logged for debugging, never surfaced as a blocking error.
- **A child navigates away / closes the tab while the reward panel is showing, before clicking Continue** — the ingredients are already persisted (insert happened before the panel rendered), so nothing is lost; only `completeReviewTestSession`/navigation is deferred, and worst case the session is later re-entered as if never left the reward step (same category of resume concern that already exists for every other in-flight-completion path in this app, not new to this feature).

## Risks

- **New SECURITY DEFINER RPC** — needs the same care `unlock_shop_recipe`/`redeem_coins` already demonstrate: role check, ownership check, and no trusting client-submitted values for anything that gets persisted. Get this wrong and a child could plausibly claim rewards for someone else's session or repeat-claim indefinitely.
- **RLS on a new table** — must be verified with `scripts/verify-rls.ts` before shipping (default-deny-direct-write posture is easy to get subtly wrong; a parent-readable-only policy that accidentally allows child writes would defeat the RPC-only guarantee).
- **Low risk to existing systems** — no touch to `words`, `flashcard_contents`, scheduler, wallet, or `shop_coin_transactions`; this is additive, new-table-only.

## Test plan

- RPC-level: role check rejects a non-child/non-admin caller; ownership check rejects a `quiz_session_id` belonging to a different user; idempotency guard returns empty on a second call for the same session; empty-pool case (no unlocked recipes, or unlocked recipes with no ingredient keys) returns empty and inserts nothing; pool smaller than 3 rewards fewer than 3, not an error; a normal case rewards exactly `min(3, pool size)` distinct keys and inserts that many rows.
- `rewardRandomIngredients` service wrapper: mocked-RPC unit test confirming the request/response shape and snake_case → camelCase mapping (per `BUILD_CONVENTIONS.md §6`'s "mock Supabase client/RPC boundaries" rule).
- `ParagraphQuizReviewSection.tsx`: a failed `rewardRandomIngredients` call still proceeds to `completeReviewTestSession`; an empty result skips the panel; a non-empty result renders the panel and defers `completeReviewTestSession` until Continue is clicked.
- `scripts/verify-rls.ts` re-run after the migration — confirm the new table's default-deny-direct-write posture and family-scoped read actually hold.
- **Live QA against a dev Supabase project** — actually complete a paragraph quiz as a child with 0, 1, and several unlocked recipes; confirm rewarded ingredients appear correctly, persist across a page reload, and don't block completion if the RPC is made to fail.

## Acceptance criteria

- [x] Finishing a paragraph-quiz session with at least one unlocked recipe rewards up to 3 random, distinct ingredient keys pooled across every recipe the child has unlocked (not restricted to one recipe) — no duplicate ingredient type within a single reward. Live-smoke-tested against the real `bubble_tea` recipe (2-ingredient pool, both correctly rewarded, distinct).
- [x] The reward panel code renders `ingredient.iconPath` (the real `public/ingredients/*.png` path, resolved server-side by the RPC's join against `shop_ingredient_prices` — confirmed via smoke test, e.g. `/ingredients/tapioca-pearls_base.png`), not a placeholder icon set. **Refined from the original plan**: the RPC already returns a fully-resolved `icon_path`, so the UI renders it directly rather than calling `resolveShopIngredientIconPath` client-side (that helper needs a full `ShopIngredient` + catalog map and exists to handle cases this RPC's pool-building already filters out — an ingredient key with no priced catalog entry never reaches the client at all). Visual rendering in an actual browser has not been checked — worth a look before calling this fully done (see Open Questions / Risks).
- [x] Finishing a paragraph-quiz session with no unlocked recipes (or an empty ingredient pool) skips the reward panel entirely — behavior identical to today. Live-smoke-tested: a fresh child with zero unlocked recipes gets `[]` from the RPC, no rows written, no error.
- [x] Rewarded ingredients are persisted in `shop_ingredient_rewards`, survive a page reload (nothing in this feature clears them), and are attributable to the specific `quiz_sessions` row that earned them via `quiz_session_id`. Confirmed via direct row inspection in the smoke test.
- [x] The same `quiz_session_id` can never be rewarded twice, even under a retried/duplicated RPC call. Live-smoke-tested: calling the RPC twice for the same session returns `[]` the second time and inserts nothing further.
- [x] A failure in the reward RPC never blocks or delays normal session completion (`completeReviewTestSession` still fires) — verified by code review of `finishSession`'s try/catch structure; not separately live-tested (would require forcing the RPC to fail mid-flow).
- [x] No coins, wallet, scheduler, or grading state is touched by this feature — confirmed by code review; the migration touches only the new table + RPC, and `finishSession`'s existing `recordQuizSession`/coin-calculation code path is unmodified.
- [x] `scripts/verify-rls.ts` passes for `shop_ingredient_rewards` (new Section 9, 7/7 assertions) after the migration — 66/67 overall, the one failure being the pre-existing unrelated `vocab_phrase_lesson_tags` issue.
- [ ] Live-QA checklist (see Risks/Test plan) completed against a dev Supabase project **through the actual app UI** — what's done so far is RPC-level smoke testing (real recipe data, idempotency, ownership, empty pool) and RLS verification, not an actual browser session completing a paragraph quiz and watching the reward panel render. Recommended before calling this fully shipped.

## Open questions

1. **Collect-each-once vs. accumulate duplicates** — this spec defaults to allowing unlimited duplicates of the same ingredient (no uniqueness constraint). Should repeats instead be prevented, turning this into a "collect each ingredient once" completion mechanic instead of an accumulating stockpile? This is a real product-taste call, not a technical one, and changes the schema (would need a uniqueness constraint + a "already have it, try again" fallback behavior).
2. **Relationship to roadmap item F** — should a future item F (coin-purchased ingredients) reuse `shop_ingredient_rewards` (adding a `source` discriminator column: `quiz_reward` vs. `purchase`), or should it get its own separate table entirely? Not decided here; flagged so a future item F spec doesn't have to rediscover this tension from scratch.
3. **Viewing accumulated rewards later** — explicitly out of scope for this spec (see Out of scope), but worth confirming that's acceptable for a first version — right now, once the reward panel is dismissed, there is no page anywhere in the app where a child could look back at what they've collected.
4. **Requested count of 3 — hardcoded or should it vary** (e.g. scale with something)? This spec hardcodes 3, matching the request exactly; no configurability proposed.
