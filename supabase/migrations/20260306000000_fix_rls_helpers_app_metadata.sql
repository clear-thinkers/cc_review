-- Migration: Fix RLS helper functions to read from app_metadata
-- 2026-03-06
--
-- Reason: JWT enrichment patch (2026-03-05-auth-jwt-enrichment-patch.md) writes
-- family_id/user_id/role into the Supabase auth user's app_metadata via
-- auth.admin.updateUserById(). Supabase injects app_metadata under the
-- 'app_metadata' key inside request.jwt.claims — not at the top level.
-- The previous helpers read from the top level and always returned NULL.

create or replace function current_family_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'family_id',
    ''
  )::uuid
$$;

create or replace function current_user_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_id',
    ''
  )::uuid
$$;

create or replace function is_platform_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  )
$$;
