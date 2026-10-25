# Feature Spec — 2026-10-24 — Coin / Shop Ledger Write Hardening

Roadmap item **Q**. A security-hardening change; no user-visible feature.

## Status

**Planned — not started. Deferred by the owner on 2026-10-24 ("we can revisit later").** Nothing in this spec has been implemented.

**Scope-boundary authorization (`AI_CONTRACT.md §2`): NOT yet given.** Implementing this triggers two boundaries and requires the word **"authorized"**:
1. **Editing RLS policy definitions** — dropping the client write policies listed below.
2. **Schema migration touching RPCs** — redefining four existing RPCs (`record_quiz_session`, `unlock_shop_recipe`, `purchase_shop_ingredient`, `redeem_coins`) from `security invoker` to `security definer`.

## Problem

`AI_CONTRACT.md §1` says application code must never write `wallets`, `shop_recipe_unlocks`, `shop_coin_transactions`, or `coin_redemptions` directly — only the RPCs may. The **database does not enforce that**. Several of those tables carry a policy that lets any signed-in user insert/update **their own rows**, because the RPCs are `security invoker` and therefore *need* those policies to do their own writes. The consequence is that the same policies also admit a direct API call.

### How a signed-in child can write the rows

The app's browser code talks to the database directly with the signed-in user's own login token; the public API key is part of the page. A child who opens the browser's developer tools can issue the same calls the app makes, with different values. The policies only ask *"is this row mine?"* (`user_id = current_user_id()` and `family_id = current_family_id()`), never *"is this value legitimate?"*. No special access is needed. `scripts/verify-rls.ts` Section 11 already performs exactly this for `shop_ingredient_purchases` with a child login, and passes. (Exact calls are deliberately not documented here.)

### Verified findings (read from the **dev** database's `pg_policy`, 2026-10-24)

Prod runs the same migrations and is *expected* to match; that was **not** verified (prod reads were blocked by the permission classifier).

| Table | Client write policy that exists today | What a signed-in child can do directly |
|---|---|---|
| `wallets` | `user can insert own wallet`; **`user can update own wallet`** (no column restriction) | **Set their own `total_coins` to any value** |
| `shop_recipe_unlocks` | `user can insert own unlocks` | Unlock any recipe for free |
| `shop_ingredient_purchases` | `user scoped insert` | Write "purchased" ingredient rows without paying |
| `shop_coin_transactions` | `user can insert own rows` | Forge spend history |
| `coin_redemptions` | `user can insert own rows` | Forge cash-out history |
| `quiz_sessions` | `user can insert own session`; `family scoped delete` (**no role check**) | Insert sessions with arbitrary `coins_earned` (skews "Total Earned"); delete any session in the family, including evidence the reward flow relies on |

### Additional finding (2026-10-24, while confirming coins still work): the sanctioned RPC also trusts the client's coin amount

`record_quiz_session` takes `p_coins_earned` **from the caller** and credits exactly that to the wallet; it does not recompute coins from the submitted `p_grade_data`. So even with every table policy closed, a signed-in child could call the *legitimate* RPC directly with an inflated `p_coins_earned` for a session they never played. Making the RPC `security definer` alone does not fix this. The fix must **compute (or at least validate) the coin amount server-side** from the saved grade data — porting `calculateSessionCoins` / `calculateParagraphQuizSessionCoins` (`src/lib/coins.ts`) to SQL, or rejecting any `p_coins_earned` that differs from the server's own computation. Verified by reading the app's call (`recordQuizSession` in `src/lib/supabase-service.ts`) and the RPC signature; a live dev run credited exactly the amount the client sent.

### Why it matters

Coins cash out at **100 coins = $1.00**. An inflated wallet can become a real payout request. The app itself never does this and it takes a technically curious child, but the database would not stop it. The policies are old (the shop launched in March 2026) and were not introduced by item P / Mystery Foods; item P only closed the two shortcuts (`shop_ingredient_rewards` direct insert, `reward_random_ingredients` execute) that would have bypassed *its* reward tiers.

## Proposed behavior

1. **`record_quiz_session` must compute coins itself** (see the additional finding above) instead of crediting the caller's number.
2. **Make the four money RPCs `security definer`** with explicit, complete checks inside each (caller identity from the JWT claims via `current_user_id()`/`current_family_id()`, role, ownership, balance, idempotency) — the posture `cook_shop_recipe` and the new reward RPCs already use. RLS is no longer a backstop inside them, so each query must be scoped to the caller by hand.
3. **Drop the client write policies** on `wallets` (insert + update), `shop_recipe_unlocks` (insert), `shop_ingredient_purchases` (insert), `shop_coin_transactions` (insert), `coin_redemptions` (insert), and `quiz_sessions` (insert). Keep every read policy.
4. **`quiz_sessions` delete:** restrict to parent / platform admin (the Clear History action is already hidden from children in the UI), or route Clear History through an RPC.
5. **Update `scripts/verify-rls.ts`:** assertions that currently expect a child *can* insert (Section 11, others) flip to *refused*; add wallet-update and unlock-insert refusals; add a delete-scope check for `quiz_sessions`.
6. **Regression-test every money path** against dev as a real child: finish a quiz (coins credited atomically), unlock a recipe, buy ingredients, cash out, Mystery Foods auto-unlock, and the reward claim.
7. **Audit existing data** for past tampering (see below) before and after.

## Layer impact

Database only (policies + 4 RPC redefinitions), plus verification scripts and docs. **No app-code change is expected**: the client already goes through these RPCs. The implementation must confirm that by searching for any client code that writes these tables directly (an implementation task — not assumed here).

## Edge cases / risks

- **Highest risk: these functions handle coin spending and crediting.** A mistake in a definer rewrite can mint or lose coins for everyone. Needs a careful line-by-line port of the existing bodies plus the full regression pass above.
- Making them `security definer` changes who runs the inserts; any code path that relied on RLS to reject something (e.g. a wrong-family call) must be re-expressed as an explicit check.
- `record_quiz_session` is called at every quiz completion — the most-used path — and has a documented history of bugs (`build-fix-log-2026-03-28-quiz-session-rpc-user-id-ambiguity.md`).
- Compensation scripts (`generate-coin-compensation-fix.ts`) run as the service role and are unaffected by policy removal; confirm.
- Migration deployment tracking: add a **new** migration; never edit one that was already pushed to dev (item J incident).

## Data check (run before and after; read-only)

Each profile's wallet should equal earned minus spent minus redeemed. Any row returned deserves a look (legitimate drift is possible if a manual repair was ever applied without a matching record).

```sql
select u.name, w.total_coins as wallet,
       coalesce(q.earned,0) - coalesce(s.spent,0) - coalesce(r.redeemed,0) as expected
from wallets w join users u on u.id = w.user_id
left join (select user_id, sum(coins_earned)   earned   from quiz_sessions         group by 1) q on q.user_id = w.user_id
left join (select user_id, sum(coins_spent)    spent    from shop_coin_transactions group by 1) s on s.user_id = w.user_id
left join (select user_id, sum(coins_redeemed) redeemed from coin_redemptions       group by 1) r on r.user_id = w.user_id
where w.total_coins <> coalesce(q.earned,0) - coalesce(s.spent,0) - coalesce(r.redeemed,0);
```

No rows = consistent. Run against **dev and prod**.

## Test plan

`verify:rls` updated as above · a new section proving each former hole is refused with a child JWT (wallet update, wallet insert, unlock insert, purchase insert, history inserts, quiz-session insert, quiz-session delete) · RPC-level smoke tests of all four functions for success, insufficient coins, idempotency, wrong-family/wrong-role, and atomicity · `verify:mystery-foods` re-run · full app gates (`tsc`, eslint, `npm test`, `check:encoding`, `next build`) · live QA of a full quiz → shop → kitchen → cash-out loop as a child.

## Acceptance criteria

- [ ] A child JWT is refused (not silently succeeding) on every direct write listed in the table above, **and `record_quiz_session` credits only the coins the server computes from the submitted grade data**.
- [ ] Quiz completion, recipe unlock, ingredient purchase, cash-out, reward claim, and mystery auto-unlock all still work end to end.
- [ ] `quiz_sessions` deletion is parent/admin only.
- [ ] `verify:rls` and `verify:mystery-foods` pass (apart from the pre-existing Section 6 failure).
- [ ] The wallet-consistency query returns no rows on dev and on prod, or each row is explained.
- [ ] `0_ARCHITECTURE.md` (Recipe Shop Rules, System Guarantees, schema RLS notes), `0_BUILD_CONVENTIONS.md`, and `0_PRODUCT_ROADMAP.md` updated in the same change.

## Open questions

1. Should `quiz_sessions` clearing become an RPC, or just a parent-only delete policy?
2. Keep `shop_coin_transactions` / `coin_redemptions` insertable by the service role only, or via the RPCs only? (Equivalent in effect; pick for clarity.)
3. Any other tables the owner wants swept in? Not audited yet: everything outside the six tables above (e.g. learning tables) was not reviewed for this problem.
4. Timing: after item P's live QA and prod deploy, so two large database changes don't overlap.
