# Fix Log – 2026-03-11 – RLS Helper Search Path Protection

## Context

Supabase Security Advisor flagged a vulnerability: four RLS helper functions (`current_family_id()`, `current_user_id()`, `is_platform_admin()`, `current_jwt_role()`) lack explicit `search_path` settings, exposing them to **function spoofing attacks**.

## Root Cause

PostgreSQL functions without an explicit `search_path` declaration use the database or session default schema search list. An attacker could create a malicious function with the same name in a different schema, and if that schema appears earlier in the search path, PostgreSQL would execute the attacker's function instead of the legitimate one.

In a multi-tenant system like this, this is **critical** — the spoofed functions could return false family_id, user_id, or role values, bypassing Row Level Security (RLS) and violating family isolation boundaries.

## Changes Applied

Added `set search_path = 'public'` to all four RLS helper functions:

| File | Functions |
|------|-----------|
| `supabase/migrations/20260306000000_fix_rls_helpers_app_metadata.sql` | `current_family_id()`, `current_user_id()`, `is_platform_admin()` |
| `supabase/migrations/20260306000001_words_parent_only_writes.sql` | `current_jwt_role()` |

**Before:**
```sql
create or replace function current_family_id()
returns uuid
language sql stable
as $$
  ...
$$;
```

**After:**
```sql
create or replace function current_family_id()
returns uuid
language sql stable
set search_path = 'public'
as $$
  ...
$$;
```

The `set search_path = 'public'` clause forces PostgreSQL to only search the `public` schema when resolving identifiers within the function, preventing schema spoofing.

## Architectural Impact

**Severity:** High  
**Layer:** Service layer (Supabase RLS enforcement)

This fix ensures the **trust foundation** of the RLS boundary model (ARCHITECTURE §1, Tier 1 rules). All family isolation relies on `current_family_id()`, `current_user_id()`, and `is_platform_admin()` returning trusted values from the JWT claims. Function spoofing could break this isolation entirely.

No behavioral changes to the application — the fix tightens security without altering logic.

## Preventative Rule

**New Rule:** All PostgreSQL helper functions that read from JWT claims or enforce identity checks must include `set search_path = 'public'` in their definition.

Add this to migration review checklist:
- [ ] Security functions have explicit `set search_path = 'public'`
- [ ] Functions used in RLS policies are audit-checked for schema resolution vulnerabilities

## Docs Updated

None. This is a patch to existing migration files; no architecture or convention changes required.
