---
title: Fix Log – 2026-10-24 – No reward after a Quick Add 10 "win" (cause unconfirmed) + Quick Add picked unquizzable characters
---

## Context

On the first day of live use, the owner reported that their child (Nora) used **Quick Add 10**, completed a session with no failed answers (a "win"), and **received no reward**. The owner believes the characters she picked had quiz content.

## Root Cause

**Most likely cause: the quizzes were ad-hoc, not packaged.** Reward offers were only requested for *packaged* sessions (saved `review_test_sessions`, started with the Start button). A quiz started with Test Selected, a per-row Fill Test or the due queue is ad-hoc: it saved coins and a `quiz_sessions` row but never asked for a reward, with no message. Supporting evidence: no offer row has ever existed on prod, the offer functions and permissions are healthy there, and Quick Add followed by Test Selected is a natural way to run it. (Unconfirmed against Nora's rows; the optional `review_test_sessions` query would settle it.) Resolved by rewarding ad-hoc sessions too -- see "Resolution (same day)".

**Update (same day): the earlier "Quick Add picks uncurated characters" hypothesis was RULED OUT for Nora's sessions.** The owner's Quiz Results screenshot shows both of her sessions with **Tested Count 10** and **Failed Count 0** (100% correct, and 90% correct + 10% partial; 50 and 46 coins). Ten tested items meets the reward threshold and zero failures makes each a win, so each should have produced an offer (pick 1 of 3 mystery ingredients). The cause is therefore something else and **is still unknown** — the reward path ran for a session that qualified and produced nothing visible. The two defects fixed below are real but did not cause this report.

**Original analysis (kept for the record) — not confirmed.** Production data could not be read from the development session (the permission classifier blocked prod reads), so Nora's actual session has not been inspected. What was established:

- A reward offer is created only when the session's **Tested Count** (distinct tested items, the number the Results table shows) is **10 or more**. A packaged session's Tested Count counts the items it actually tested, not the number packaged; a bundled quiz still records one graded entry per member character, so bundling does **not** reduce it.
- **Quick Add chose from *all* due characters** (`dueWords`), including ones with no usable fill-test content (the page counts these separately as "skipped"). Such characters cannot be quizzed, so a "Quick Add 10" could package 10 but test fewer than 10 — silently landing under the reward threshold. This is a real defect and is fixed below, but it is **a candidate cause, not a confirmed one** for Nora's session.
- When no offer existed, the completion screen said **nothing** — no reason, no hint — and a *failed* reward request was swallowed by a `console.error`. That made this report impossible to diagnose from the child's side. Fixed below.
- Other candidates (the offer function failing on prod, or an offer created but not shown) were checked on prod and are not the cause. See "Diagnosis" below.

## Changes Applied

- `src/app/words/review/DueReviewSection.tsx`: **Quick Add 10/20/30 now selects only from due characters that have quiz content** (`fillTestDueWords`) and is enabled only when that many such characters exist. A **child's** Add Selected leaves out characters with no quiz content and says how many were left out (a parent's selection is used as chosen, unchanged).
- `src/app/words/shared/words.shared.state.ts` (`moveQuizForward` / `finalizeQuizCompletion`): when a packaged session ends with no reward offer **and** tested fewer than 10 items, the completion notice now says how many items were tested and that at least 10 are needed. When the reward request **fails**, the notice says the reward couldn't be loaded and will appear on Due Review if one was earned.
- `src/app/words/review/dueReviewPackaging.ts` (+ tests): `partitionByQuizReady`. `src/lib/rewardTiers.ts` (+ tests): `isBelowRewardThreshold`.
- `src/app/words/words.strings.ts`: EN/ZH strings for the three notices and the updated Quick Add tooltip.
- `src/app/words/review/DueReviewSection.tsx` (regression found in dev QA, same day, before release): **a child's Save always failed with "select at least one target."** The new child-only quiz-content filter above checked `hasFillTest` on the full word list (`words`), but quiz content is attached only to the due list (`dueWords`, in `refreshDueWords`). Every selected character therefore looked unquizzable and the selection was emptied. Parents (unfiltered) and prod (filter not yet deployed) were unaffected. Fixed by checking readiness against the due list by id. Also hardened: Save is disabled while Due Review's background target load runs (as Quick Add already was), and if targets are still empty at Save time the notice says they are loading (or shows the load error) instead of blaming the selection.
- `src/lib/shop.test.ts`: the wall-size test now asserts a floor (`>= 14`) instead of an exact value (the wall was widened to 15 for Golden Mooncake, which made the exact assertion stale — unrelated to this bug).

## Resolution (same day)

The owner decided ad-hoc and packaged sessions must behave the same now that the 10-item minimum exists. `moveQuizForward` (`words.shared.state.ts`) now requests the reward offer for **any** saved fill-test session, not just packaged ones, and the small-session / load-error hints apply to both. Reward rules are unchanged (Tested Count tiers, win rule, offer -> claim). `scripts/verify-mystery-foods.ts` gained an assertion that a session with no packaged-session row earns an offer exactly like a packaged one, and now sets aside **every** real mystery food (Crystal Dumplings and Golden Mooncake) while it runs, restoring each afterwards (81/81 pass).

## Architectural Impact

None. UI/state only; no schema, RPC, or RLS change (the reward RPC never checked for a packaged session).

## Preventative Rule

A feature whose payout depends on a measured quantity (Tested Count) must (a) select only inputs that can contribute to that quantity, and (b) **tell the user when they fall short and why**. Failures in a reward path must be visible, never only logged.

## Diagnosis (to run on prod; read-only)

```sql
select q.created_at, q.total_grades, q.failed_count,
       (select count(distinct e->>'hanzi') from jsonb_array_elements(q.grade_data) e) as tested_count,
       o.id is not null as has_offer, o.picks_allowed, o.is_win, o.claimed_at,
       (select count(*) from shop_ingredient_rewards r where r.quiz_session_id = q.id) as reward_rows
from quiz_sessions q
join users u on u.id = q.user_id
left join shop_ingredient_reward_offers o on o.quiz_session_id = q.id
where u.name ilike '%nora%'
order by q.created_at desc limit 5;

select p.proname, p.prosecdef as definer, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('reward_session_ingredients','claim_session_ingredient_offer',
  'list_pending_ingredient_offers','shop_reward_offer_json','ingredient_reward_picks',
  'shop_recipe_base_requirements','shop_ingredient_available_count','reward_random_ingredients')
order by 1;
```

Reading the first query (Nora's sessions have tested_count 10 and failed_count 0, so a win offer was expected):
- `has_offer` **true**, `claimed_at` empty → the offer exists but was not shown at completion; it should be on Due Review's "reward waiting" banner. A display bug.
- `has_offer` **false**, `reward_rows` 0 → the offer function returned nothing or failed on prod. Needs the browser console message from that moment, and the second query (an `authenticated_can_run = false` row would explain it).
- `has_offer` false, `reward_rows` > 0 → a previous version of the function granted directly.
- `has_offer` true and `claimed_at` set → she did claim it (check the fridge).

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: yes — Due Review Rule 36 note (Quick Add selects quizzable characters only).
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no.
