---
title: Fix Log - 2026-03-28 - Child Coin Compensation Script
---

## Context
Some child quiz completions missed their coin credit because the `record_quiz_session()` RPC failed before the wallet update completed.
After the database fix was deployed, we still needed a safe way to compensate affected child profiles so the missing coins would appear both in Quiz Results and in the Recipe Shop wallet.

## Root Cause
The app had no reusable admin repair tool for this case.
The normal runtime path records quiz completion through the child-scoped `record_quiz_session()` RPC, which depends on JWT `family_id` and `user_id` claims and cannot be reused directly to target another child profile from an admin script.

## Changes Applied
- Added [scripts/generate-coin-compensation-fix.ts](/d:/Documents/coding/cc_review/scripts/generate-coin-compensation-fix.ts), a reusable CLI script that:
  validates the target `users` row with the service-role client,
  confirms the target is a `child`,
  and generates an idempotent SQL transaction for the compensation.
- Updated the same CLI to accept both named flags and a positional invocation style (`<child-user-id> <coins> "<reason>" [output]`) so Windows PowerShell/npm argument forwarding does not block the repair flow.
- Improved the CLI error path so a `public.users.id` vs `auth.users.id` mismatch is called out explicitly and, when the provided UUID matches a family's `auth_user_id`, the script prints the valid child profile ids for that family.
- Updated production-env detection so `npm run ... -- --prod ...` still resolves to `.env.production.local` even when npm consumes `--prod` as its own `production` config flag on Windows. Also added `--env prod` as a clearer alias.
- Updated positional parsing so a leading environment token like `prod` or `development` is tolerated before the child id when npm/PowerShell forwards arguments in a simplified positional form.
- Added [src/lib/coinCompensationFix.ts](/d:/Documents/coding/cc_review/src/lib/coinCompensationFix.ts) for shared validation, deterministic session-id generation, and SQL generation.
- Added [src/lib/coinCompensationFix.test.ts](/d:/Documents/coding/cc_review/src/lib/coinCompensationFix.test.ts) covering validation, deterministic ids, and transaction SQL shape.
- Added the npm entry `generate:coin-compensation-sql` in [package.json](/d:/Documents/coding/cc_review/package.json).

## Architectural Impact
No architecture boundary changed.
The repair stays outside the app runtime and preserves the existing persisted model by writing a compensating `quiz_sessions` row plus the matching `wallets` increment in one SQL transaction.
No new route, RPC, schema field, or RLS policy was added.

## Preventative Rule
When a production repair must target a different child profile than the active session, prefer a reusable admin script that validates the target and emits an idempotent transactional SQL patch.
Do not perform manual table edits ad hoc without a checked-in repair script or SQL artifact.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy or hard-stop rule changed
- 0_ARCHITECTURE.md: no - existing wallet/session boundaries are unchanged
- 0_BUILD_CONVENTIONS.md: no - no new build convention introduced
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
