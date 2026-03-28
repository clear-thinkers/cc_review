---
title: Fix Log - 2026-03-28 - Quiz Session RPC User ID Ambiguity
---

## Context
Completing a quiz session threw a runtime error instead of finishing cleanly:
`recordQuizSession: column reference "user_id" is ambiguous`.
Because the RPC failed before the wallet update completed, the user did not receive the coins earned for that session.

## Root Cause
The failure lived in the database layer, inside the `record_quiz_session()` Supabase RPC.
That function used `RETURNS TABLE (user_id, family_id, ...)`, which creates PL/pgSQL output variables with those names.
Inside the same function, the wallet bootstrap insert used `on conflict (user_id) do nothing`.
In this context, `user_id` became ambiguous between the table column and the function output variable, so Postgres raised an error before the atomic wallet update could finish.

## Changes Applied
- Added [supabase/migrations/20260328000000_fix_record_quiz_session_user_id_ambiguity.sql](/d:/Documents/coding/cc_review/supabase/migrations/20260328000000_fix_record_quiz_session_user_id_ambiguity.sql) to replace `record_quiz_session()` with the same RPC signature and return shape.
- Changed the wallet bootstrap insert from `on conflict (user_id)` to `on conflict on constraint wallets_pkey`, which avoids the PL/pgSQL name collision while preserving the existing behavior.
- Kept the service-layer RPC contract unchanged, so [src/lib/supabase-service.ts](/d:/Documents/coding/cc_review/src/lib/supabase-service.ts) and its callers do not need interface changes.
- Verified the app-side RPC contract with `npm test -- src/lib/supabase-service.coins.test.ts`.

## Architectural Impact
No architecture boundary changed.
This fix stays within the existing service/database responsibility split: the app still records quiz completion through the dedicated RPC, and the database still owns the atomic session-plus-wallet write.

## Preventative Rule
When writing PL/pgSQL functions that use `RETURNS TABLE (...)`, do not reference conflict targets or other identifiers that duplicate output-column names without disambiguation.
Prefer named constraints such as `on conflict on constraint ...` or an alternative function shape that avoids output-variable collisions.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy or hard-stop rule changed
- 0_ARCHITECTURE.md: no - the service-to-RPC boundary and wallet/session model remain the same
- 0_BUILD_CONVENTIONS.md: no - no implementation convention changed
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged

---

## Retry Attempt — 2026-03-28

### Why the Prior Attempt Failed
The migration SQL was correct, but it was never applied to the remote Supabase database.
The project has no `supabase/config.toml` and `.supabase/.temp/` is empty — the Supabase CLI is not linked to a remote project, so `supabase db push` cannot be run.
The prior attempt verified the fix with `npm test -- src/lib/supabase-service.coins.test.ts`, but those tests mock the RPC boundary entirely. They confirm the service-layer contract, not the live Postgres function. The mocked tests pass regardless of what the database contains, so they gave a false green on a fix that was never deployed.

### Revised Root Cause
Root cause is unchanged: `on conflict (user_id)` inside a PL/pgSQL function with `RETURNS TABLE (user_id uuid, ...)` is ambiguous to the Postgres parser.
The prior fix wrote the correct SQL but skipped the deployment step.

### Changes Applied
No new code changes. The fix SQL already exists in [supabase/migrations/20260328000000_fix_record_quiz_session_user_id_ambiguity.sql](supabase/migrations/20260328000000_fix_record_quiz_session_user_id_ambiguity.sql).

To resolve the bug, the migration must be applied to the live Supabase project. Run the following SQL in the Supabase dashboard SQL editor (or via `supabase db push` once the CLI is linked):

```sql
create or replace function record_quiz_session(
  p_id text,
  p_created_at timestamptz,
  p_session_type text,
  p_grade_data jsonb,
  p_fully_correct_count integer,
  p_failed_count integer,
  p_partially_correct_count integer,
  p_total_grades integer,
  p_duration_seconds integer,
  p_coins_earned integer
)
returns table (
  user_id uuid,
  family_id uuid,
  total_coins integer,
  last_updated_at timestamptz,
  version integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
begin
  if v_user_id is null or v_family_id is null then
    raise exception 'record_quiz_session requires current family_id and user_id claims';
  end if;

  insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
  values (v_user_id, v_family_id, 0, now(), 1)
  on conflict on constraint wallets_pkey do nothing;

  insert into quiz_sessions (
    id, user_id, family_id, created_at, session_type, grade_data,
    fully_correct_count, failed_count, partially_correct_count,
    total_grades, duration_seconds, coins_earned
  )
  values (
    p_id, v_user_id, v_family_id, p_created_at, p_session_type,
    coalesce(p_grade_data, '[]'::jsonb),
    coalesce(p_fully_correct_count, 0),
    coalesce(p_failed_count, 0),
    coalesce(p_partially_correct_count, 0),
    coalesce(p_total_grades, 0),
    coalesce(p_duration_seconds, 0),
    coalesce(p_coins_earned, 0)
  );

  return query
  update wallets
  set
    total_coins = wallets.total_coins + coalesce(p_coins_earned, 0),
    last_updated_at = now(),
    version = coalesce(wallets.version, 1) + 1
  where wallets.user_id = v_user_id
  returning
    wallets.user_id,
    wallets.family_id,
    wallets.total_coins,
    wallets.last_updated_at,
    wallets.version;
end;
$$;
```

### Architectural Impact
No architecture boundary changed. Same as prior attempt.

### Preventative Rule
When a fix involves a database migration, include a deployment verification step — not just a test run. Mocked RPC tests confirm the service-layer contract, not the live database state. The fix is incomplete until the migration has been confirmed applied (e.g., verify the function body in the Supabase dashboard, or check `supabase migration list` status).

### Docs Updated
- AI_CONTRACT.md: no - no agent policy or hard-stop rule changed
- 0_ARCHITECTURE.md: no - layer boundaries unchanged
- 0_BUILD_CONVENTIONS.md: no - no implementation convention changed
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
