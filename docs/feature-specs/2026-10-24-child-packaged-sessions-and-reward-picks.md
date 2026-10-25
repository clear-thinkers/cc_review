# Feature Spec — 2026-10-24 — Child-Created Packaged Sessions + Size-Tiered Reward Picks

Roadmap item **P**. Builds on Mystery Foods (`2026-10-24-mystery-foods.md`) and the packaged-session ingredient reward (`2026-08-22-paragraph-quiz-ingredient-reward.md`).

## Status

**Shipped 2026-10-24 — manual in-browser QA passed on dev; migration `20261024190000` run on prod by the owner.** Authorized 2026-10-24 (build plan at the bottom).

**Scope-boundary authorization (`AI_CONTRACT.md §2`): given 2026-10-24** ("authorize the change", after the boundary and plan were stated). Covers:
1. **RLS policy additions** — child-scoped INSERT on `review_test_sessions` and `review_test_session_targets`, and child-scoped DELETE on their own `review_test_sessions`. Additive: no existing policy is edited or dropped.
2. **Schema migration** — new table `shop_ingredient_reward_offers` (RPC-only writes); new RPCs `claim_session_ingredient_offer` and `list_pending_ingredient_offers`; `reward_session_ingredients` redefined to create an offer instead of granting directly.
3. **Added at the owner's request after review:** the direct-insert policy `shop_ingredient_rewards: user scoped insert` was **dropped**, and `reward_random_ingredients` had its execute grant revoked from clients — both were shortcuts around the new tiers.
4. No change to `current_*()` helpers, `custom_access_token_hook`, the scheduler, or any route.

**Known remaining gaps (not changed, outside this authorization):** `shop_ingredient_purchases` still has a user-scoped insert policy (the purchase RPC is `security invoker` and relies on it), so a signed-in child can still write their own "purchased" ingredient rows directly; `shop_recipe_unlocks` has the same pattern for unlocks. Both predate this work. Closing them means making those RPCs `security definer` — a separate, explicitly-authorized change, now tracked as **roadmap item Q** (`2026-10-24-ledger-write-hardening.md`), which also covers the larger `wallets` update hole found afterwards.

## Problem

Only a parent can package a review test session, so a child can't choose their own practice set, and a packaged session's ingredient reward is the same whether it tests 1 word or 40. Letting a child package sessions makes tiny-session reward farming possible (reward ingredients can be bought with coins), so rewards must scale with effort.

## Decisions (owner, 2026-10-24)

1. **A child can package sessions like a parent**, from Due Review, reusing the parent buttons (**Add Selected to Session** and Quick Add). Quick Add 25 becomes **Quick Add 10 / 20 / 30**.
2. **A child may append only to sessions they created** (never a parent's); a name already used by someone else's active session is rejected, not appended to. (Active-session names are unique per family.)
3. **Delete:** a parent may delete any session (as today, including a child's); a child may delete **only sessions they created**, never a parent's.
4. **"Slot" = Tested Count**, the number the Quiz Results table shows: the count of **distinct `hanzi` entries in the saved session's `grade_data`** (for a paragraph quiz, distinct blank texts). Measured server-side from the saved session — not from packaged targets.
5. **Reward size tiers apply to ALL packaged sessions** (parent- and child-created alike):

   | Tested Count | Child picks |
   |---|---|
   | < 10 | no reward |
   | 10 – 19 | 1 of the 3 offered |
   | 20 – 29 | 2 of the 3 offered |
   | ≥ 30 | all 3 |

6. **Win rule unchanged** (Failed Count 0; a paragraph quiz only with zero bounces): the 3 offers are **mystery ingredients** (Mystery Foods priority order, full per-food quantity each). Otherwise the 3 offers are the regular random ingredients.
7. If fewer than 3 offers exist (small pool), picks = min(tier picks, offers).

## Behavior

- **Offer, then claim.** Finishing a packaged session calls `reward_session_ingredients`, which **creates and stores an offer** (3 candidates, `picks_allowed`, win flag) and grants nothing. The child picks `picks_allowed` of them on the reward panel; `claim_session_ingredient_offer` validates the pick against the stored offer, grants it (one ledger row per unit), and — for mystery rewards — runs the auto-unlock. A mystery food therefore unlocks at **claim** time.
- **Walking away is safe.** An unclaimed offer stays pending; Due Review shows "You have a reward waiting" with a button to open the picker (`list_pending_ingredient_offers`).
- **Idempotent:** one offer per quiz session; a repeated call returns the existing offer; an offer can be claimed once; a claim must be exactly `picks_allowed` distinct offered keys. The client never supplies which ingredients exist, the tier, or win status.
- **Failure never blocks completion** (unchanged): a failed offer call just means no panel now; a pending offer, if one was created, still shows on Due Review.
- **Due Review:** children now see Add Selected to Session, Quick Add 10/20/30 and the name form. The name box defaults to a fresh unique name ("My practice" + date/time) for a child — never a parent's session name. A hint explains the tiers. A child sees Delete only on sessions they created.

## Addendum (owner, 2026-10-24): ad-hoc sessions are rewarded too

The first release rewarded only **packaged** sessions (saved `review_test_sessions`); a fill-test run started any other way (Test Selected, a per-row Fill Test, the due queue) was **ad-hoc** and earned coins only. That split was confusing -- the owner's child ran an ad-hoc quiz right after Quick Add and saw no reward. **Decision: every completed fill-test session is rewarded identically**, packaged or not: same Tested Count tiers, same win rule, same offer -> claim flow. The reward RPC keys off the saved `quiz_sessions` row and never checked "packaged", so this is a client-only change (`moveQuizForward` requests an offer whenever a quiz session was saved); no schema, RPC or RLS change. Packaging remains useful for planning and repeating a set, but is no longer a condition for a reward.

## Out of scope

- Per-target delete stays parent-only. No change to paragraph packaging (still parent-only on `/words/add-paragraph`), scheduler, coins, or the Mystery Foods win rule/priority.
- No expiry of pending offers.
- No notice to the child on a < 10 session beyond the static tier hint on Due Review.

## Risks

- **RLS additions** are the sensitive part; `verify:rls` gains a section covering: child insert for own family only, `created_by_user_id` must be the caller, child can't add targets to or delete someone else's session, cross-family isolation, and the offers table having no client writes.
- `reward_session_ingredients` and the new claim RPC are `security definer` (the offers table has no write policy, same posture as `cook_shop_recipe`), so every query inside is explicitly scoped to the caller and RLS is not a backstop.
- Existing parent flows change: a parent-packaged session under 10 tested items no longer earns a reward, and every reward is now a pick. Intentional (decision 5).

## Edge cases

- Same word in several paragraph blanks counts once toward Tested Count (matches the Results table).
- A mystery win when no mystery food exists falls back to random offers.
- Pool empty (nothing unlocked, no mystery food): no offer.
- Child deletes a session whose targets are mid-quiz: the existing delete rules apply; an in-progress packaged session's saved progress cascades.
- Two tabs claiming the same offer: the second claim fails cleanly ("already claimed").

## Test plan

Pure helpers (tier boundaries 9/10/19/20/29/30, distinct tested count, picks capped by offers) · verify:mystery-foods updated (offer vs claim, tiers, claim validation, double-claim, wrong key, wrong count, other user, pending list, unlock-at-claim) · verify:rls new section · service wrapper mocks · UI helper tests · full gates (`tsc`, eslint, `npm test`, `check:encoding`, `next build`) · live QA as a child and as a parent.

## Open questions

None at authorization time.

---

## Build plan (tick when verified)

### P0 — Spec, roadmap
- [x] Spec written; item P in the roadmap
### P1 — Pure logic
- [x] `src/lib/rewardTiers.ts`: tested-count + picks helpers + claim validation, 14 tests pass
### P2 — Migration (STOP for owner review before push)
- [x] `supabase/migrations/20261024190000_child_sessions_and_reward_offers.sql` written (3 additive RLS policies; offers table; `ingredient_reward_picks`, `shop_reward_offer_json`; `reward_session_ingredients` → offer, `claim_session_ingredient_offer`, `list_pending_ingredient_offers`; REVOKE on `reward_random_ingredients`)
- [x] Dry-run validated against dev inside begin/rollback (no errors; tier function 0/1/1/2/2/3 for 9/10/19/20/29/30; nothing persisted)
- [x] Owner reviewed the SQL (2026-10-24) and asked to also drop the direct-insert policy on `shop_ingredient_rewards` (added) → pushed to dev; live state confirmed: offers table (1 read policy, no write policies), `reward_session_ingredients`/`claim_session_ingredient_offer` are `security definer`, `list_pending_ingredient_offers` present, `authenticated` can run the offer function but **not** `reward_random_ingredients`, rewards table has only its read policy, sessions/targets have the 3 new child policies beside the unchanged parent ones
### P3 — Verification scripts
- [x] `verify-mystery-foods.ts` updated for offer/claim/tiers — **80/80 pass** on dev (adds tier boundaries 9/10/19/20/29/30, claim validation, double-claim, other-user claim, pending list, unlock-at-claim-not-offer, and the blocked shortcuts)
- [x] `verify-rls.ts`: Section 9 updated (direct inserts into `shop_ingredient_rewards` are now REFUSED; seed row via service role) + new Section 12 (child create/extend/delete own sessions, parent's out of reach, cross-family, offers table read-only) — **99 passed / 1 failed**, the failure being the pre-existing Section 6 `vocab_phrase_lesson_tags` setup
### P4 — Service layer
- [x] types (`SessionRewardOffer`, `ClaimSessionOfferResult`), `requestSessionRewardOffer` / `claimSessionRewardOffer` / `listPendingRewardOffers`, old `rewardRandomIngredients` wrapper + its test removed, 19 service tests
### P5 — Reward panel + call sites + Due Review banner
- [x] `IngredientRewardPanel` is now a two-step picker (pick → claimed view with unlock banner, "Decide later"); both completion call sites switched; `PendingRewardOfferBanner` on Due Review; EN/ZH strings; `toggleRewardSelection` helper (+4 tests)
### P6 — Due Review packaging for children
- [x] Children see Add Selected to Session + Quick Add 10/20/30 (a size is disabled unless that many are due); child default name "My practice MM-DD HH:mm"; append/delete only own sessions (`dueReviewPackaging.ts`, 14 tests); tier hint; strings
### P7 — Gates, docs, QA
- [x] `tsc` clean · eslint clean on all touched files (7 pre-existing errors elsewhere) · `npm test` 1068/1068 · `check:encoding` passes · `next build` succeeds
- [x] ARCHITECTURE (Due Review Rules 13/14/32/35/36 notes + new 38/39; Content Admin Rule 21; Fill-Test Rule 40; Recipe Shop Rule 26; schema incl. the new offers table; System Guarantees 6c/6d), ROADMAP, BUILD_CONVENTIONS, older specs' addenda
- [x] Owner live QA (child + parent) passed 2026-10-24 · committed and pushed to `main`
- [x] Prod: `db:push:prod` run by the owner 2026-10-24 (the migration also dropped a policy and revoked a function there); live use on prod has begun
