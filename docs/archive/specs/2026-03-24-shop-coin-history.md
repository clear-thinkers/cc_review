# Feature Spec — 2026-03-24 — Shop Coin History

## Problem

Child users can see their current coin balance in the shop, but they cannot easily tell why that number is lower than the cumulative coins shown in test results after spending coins on recipe unlocks.

## Scope

- Add a clickable tooltip-enabled coin card on the shop page
- Add a popup window that shows shop spending history
- Record shop spending history with timestamp, action, cost, beginning balance, and ending balance
- Keep all new UI copy bilingual in English and Simplified Chinese

## Out of scope

- Full earned coin history from quizzes
- Parent-facing wallet audit views
- Editing or deleting transaction history rows

## Proposed behavior

- The shop coin card acts like a button
- Hovering or focusing the card shows a tooltip explaining that clicking opens coin history
- Clicking the card opens a popup table
- The popup shows shop spending only, newest first
- Each row includes date/time, action, cost, beginning balance, and ending balance
- Shop unlock RPC writes a history row at the same time it deducts coins

## Layer impact

- UI: coin card button, history modal, kid-friendly table
- Domain: new `ShopTransaction` type
- Service: new `listShopTransactions()` function
- DB: new `shop_coin_transactions` table and unlock RPC write path

## Edge cases

- No spend history yet: show an empty-state message
- Recipe title removed later: fall back to a generic localized action label
- Existing unlocks from before this feature may not have spend-history rows

## Risks

- If the migration is not applied, shop history reads will fail
- Older unlocks are not reconstructable with trustworthy beginning/ending balances

## Test Plan

- Typecheck the updated shop page and service imports
- Add a `shop.types.test.ts` file covering transaction types and bilingual key parity

## Acceptance criteria

- Child users can open a history popup from the coin card
- The popup is bilingual and easy to read
- Unlocking a recipe records a shop transaction with start/end balances
- The history table lists newest shop transactions first

## Open questions

- Future version: should earned quiz history appear in a separate tab or remain on the results page only?
