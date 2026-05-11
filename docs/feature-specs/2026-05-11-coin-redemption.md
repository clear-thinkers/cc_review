# Feature Spec — 2026-05-11 — Coin Cash-Out (Redemption)

## Status: Shipped 2026-05-11

> **Implementation gate:** This feature requires a schema migration (new table) and a new Supabase RPC.
> Both are §2 stop-and-confirm boundaries in `AI_CONTRACT.md`.
> Do not begin implementation until explicitly authorized.

---

## Problem

Kids earn coins through quiz sessions but can only spend them on virtual shop recipes. There is no mechanism to convert coins into tangible real-world value. Parents want to incentivize learning by letting kids redeem earned coins for actual money, with a transparent rate and a documented paper trail.

---

## Scope

- New "Cash Out" UI section on `/words/shop` (child-accessible, platform-admin-accessible; parent-blocked per existing route rules)
- Child inputs a coin amount (must be a positive multiple of 100), writes a free-text note, and provides a typed signature (their name)
- Confirmed redemptions are recorded in a new `coin_redemptions` table
- A new `redeem_coins` Supabase RPC handles all wallet mutations atomically (decrements `wallets.total_coins`, inserts redemption record)
- Usable coin balance shown in the shop updates to reflect the deduction
- Quiz Results page totals are unaffected — they aggregate `quiz_sessions.coins_earned`, which is immutable
- Redemption history list visible to the child who made the redemptions (read-only)

---

## Out of scope

- Actual money transfer or payment processing — this is record-keeping only; parents handle the physical payout manually
- Parent approval flow or notifications before redemption is confirmed
- Admin override or deletion of redemption records
- Per-redemption or per-day limits — maximum is the usable balance; no other cap
- Displaying redemption history to parent profiles

---

## Proposed behavior

### Exchange rate and input

- Fixed rate: **100 coins = $1.00**
- Input is the coin amount (integer), not the dollar amount
- Dollar value is derived: `dollar_value = coins_redeemed / 100`
- Minimum redemption: 100 coins ($1.00); the Cash Out UI is disabled when usable balance < 100
- Maximum redemption: the child's full usable balance; no other per-redemption or per-day cap
- Coin amount must be a positive multiple of 100; non-multiples are rejected with an inline error
- Coin amount must not exceed the child's current usable balance; over-limit input is rejected

### Confirmation dialog

Before committing, a confirmation dialog shows:
- Coins to be redeemed
- Dollar value
- Child's typed note (required, 1–200 characters)
- Child's typed signature (required; free-form text — child may type any value, not constrained to their profile name)
- "Confirm Cash Out" and "Cancel" actions

### Post-confirmation

- `redeem_coins` RPC is called; on success:
  - Usable coin balance in the shop UI updates immediately
  - Confirmation message is shown (bilingual)
  - The new redemption appears at the top of the redemption history list
- On RPC failure: show bilingual error; no state is mutated

### Redemption history

- List of past redemptions for the current child profile, sorted newest-first
- Each row shows: date, coins redeemed, dollar value, note, signature
- Read-only — no delete or edit

### Wallet balance display

The shop page displays a **four-part coin breakdown** replacing or augmenting any existing single-balance display:

| Label | Source |
|---|---|
| Total Earned | Sum of `quiz_sessions.coins_earned` for the current user |
| Spent on Recipes | Sum of `shop_coin_transactions.coins_spent` for the current user |
| Redeemed | Sum of `coin_redemptions.coins_redeemed` for the current user |
| Available | `wallets.total_coins` (current usable balance) |

"Available" is the only value the RPC acts on; the others are display-only aggregations read at page load. The four values should satisfy: `Total Earned − Spent on Recipes − Redeemed = Available` (this invariant can be asserted in tests and used to catch drift).

---

## Layer impact

| Layer | Change |
|---|---|
| UI | New "Cash Out" section and redemption history on `/words/shop` |
| Service (`supabase-service.ts`) | New `redeemCoins()` calling the `redeem_coins` RPC; new `getCoinRedemptions()` read function; new `getCoinBreakdown()` that aggregates `quiz_sessions.coins_earned`, `shop_coin_transactions.coins_spent`, `coin_redemptions.coins_redeemed`, and `wallets.total_coins` for the breakdown display |
| Schema | New `coin_redemptions` table (migration required — §2 boundary) |
| RPC | New `redeem_coins` function (migration required — §2 boundary) |
| Domain | No changes |
| AI | No changes |
| Strings | New entries in `words.strings.ts` (cash-out labels, errors, confirmation copy) |

---

## Schema

### New table: `coin_redemptions`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `users.id` |
| `family_id` | uuid | FK → `families.id` (denormalized for RLS) |
| `coins_redeemed` | integer | Must be a positive multiple of 100 |
| `dollar_value` | numeric(10,2) | Derived at write time: `coins_redeemed / 100` |
| `note` | text | Child-supplied reason; 1–200 characters |
| `child_signature` | text | Child's typed name/signature |
| `beginning_balance` | integer | Wallet balance before redemption |
| `ending_balance` | integer | Wallet balance after redemption |
| `created_at` | timestamptz | Server timestamp |

**RLS:** family-scoped read; insert-only for the acting child/user (no update, no delete by non-admin); platform admin can read all.

### New RPC: `redeem_coins`

**Parameters:** `p_user_id uuid`, `p_family_id uuid`, `p_coins integer`, `p_note text`, `p_signature text`

**Atomic behavior (single transaction boundary):**
1. Ensure wallet row exists for `(user_id, family_id)`; create if absent
2. Read current `total_coins`; reject if `p_coins` is not a positive multiple of 100 or exceeds current balance
3. Compute `dollar_value = p_coins / 100.0`
4. Decrement `wallets.total_coins` by `p_coins`
5. Insert row into `coin_redemptions` with `beginning_balance` (pre-deduction) and `ending_balance` (post-deduction)
6. Return the new `ending_balance`

**Rejection codes (returned to service layer):**
- `insufficient_coins` — balance < requested amount
- `invalid_amount` — not a positive multiple of 100
- `invalid_note` — empty or over 200 characters
- `invalid_signature` — empty

---

## Edge cases

| Case | Behavior |
|---|---|
| Balance exactly equals redemption amount | Allowed; ending balance = 0 |
| Concurrent duplicate submission | RPC reads balance inside the transaction; second call fails with `insufficient_coins` if first already committed |
| Wallet row does not yet exist | RPC creates it (same pattern as `unlock_shop_recipe`) |
| Note is blank | Rejected with inline error before RPC call |
| Signature is blank | Rejected with inline error before RPC call |
| Amount = 0 | Rejected client-side and by RPC |
| Child has never earned any coins (balance = 0) | Cash Out UI section is shown but disabled; balance breakdown shows all zeros |
| Balance is positive but below 100 | Cash Out UI section is shown but disabled; breakdown still renders normally |

---

## Risks

1. **§2 boundaries:** new table and new RPC both require explicit authorization before implementation begins
2. **Wallet field semantics:** `wallets.total_coins` is a running balance (not a total-earned counter) — it is already decremented by shop unlocks. Redemption deducts from the same field. If a "total earned" wallet view is ever added, it must source from `quiz_sessions` aggregation, not `total_coins`
3. **No approval gate:** once confirmed by the child, the redemption is committed. Parents have no in-app veto. This is intentional for the initial version but may need revisiting if disputes arise during pilot
4. **Dollar amount is informational only:** the app creates no payment obligation or ledger entry beyond the `coin_redemptions` record; real-world fulfillment is entirely manual

---

## Test plan

- Unit: `redeem_coins` RPC rejects invalid amounts, insufficient balance, empty note/signature
- Unit: concurrent redemptions — second call returns `insufficient_coins` when balance was already consumed
- Unit: wallet balance correctly reflects deduction after successful redemption
- Unit: `quiz_sessions` totals on results page are unchanged after redemption
- UI: cash-out form validates inline (non-multiple, empty fields) before calling RPC
- UI: confirmation dialog renders correct coins, dollar value, note, signature
- UI: redemption history list shows new entry after success
- UI: balance breakdown (Total Earned / Spent on Recipes / Redeemed / Available) displays correctly on page load
- UI: all four breakdown values update immediately after a successful redemption
- Unit: `Total Earned − Spent on Recipes − Redeemed = Available` invariant holds after a redemption

---

## Acceptance criteria

- [ ] Child on `/words/shop` can initiate a redemption for a valid multiple-of-100 coin amount
- [ ] Confirmation dialog shows coins, dollar value, note, and signature before committing
- [ ] Committed redemption decrements `wallets.total_coins` via `redeem_coins` RPC
- [ ] `coin_redemptions` row is inserted with correct fields, including `beginning_balance` and `ending_balance`
- [ ] Quiz Results page totals (`coins_earned` per session) are identical before and after redemption
- [ ] Redemption history list is visible to the child, sorted newest-first
- [ ] Invalid inputs (non-multiples, over-balance, empty note/signature) are rejected with bilingual errors
- [ ] Shop page displays four-part breakdown: Total Earned, Spent on Recipes, Redeemed, Available — all sourced from correct tables
- [ ] `Total Earned − Spent on Recipes − Redeemed = Available` invariant holds
- [ ] Cash Out UI is disabled when usable balance < 100
- [ ] All UI copy is bilingual (English + Simplified Chinese) sourced from `words.strings.ts`
- [ ] `verify-rls.ts` confirms new table is family-scoped and insert-only for non-admins

---

## Resolved decisions

| # | Question | Decision |
|---|---|---|
| 1 | Minimum balance threshold | 100 coins — the feature is available as long as usable balance ≥ 100; no higher threshold |
| 2 | Per-redemption or daily cap | None — maximum is the full usable balance |
| 3 | Parent visibility of redemption history | Out of scope — parents cannot view child redemption history |
| 4 | Balance breakdown display on shop page | Yes — show Total Earned / Spent on Recipes / Redeemed / Available |
| 5 | Signature constraint | Free-form — child may type any value, not constrained to their profile name |
