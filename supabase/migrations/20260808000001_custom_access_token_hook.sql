-- ============================================================================
-- Migration: 2026-08-08 — Custom Access Token Hook
-- Feature: session-scoped profile claims
-- Authorized by: docs/feature-specs/2026-08-08-session-scoped-profile-claims.md
--
-- Injects app_metadata.family_id/user_id/role/is_platform_admin into every
-- minted/refreshed JWT by looking up auth_session_profiles keyed by THIS
-- token's own session_id -- not the shared auth.users row. Reproduces the
-- exact claim shape current_family_id()/current_user_id()/current_jwt_role()/
-- is_platform_admin() already read (see
-- supabase/migrations/20260311000001_fix_function_search_path_mutable.sql),
-- so none of those RLS helper functions need to change.
--
-- Must not raise: Custom Access Token Hooks run on every token mint/refresh
-- for every session in the project. A lookup miss (no Layer 2 completed yet
-- for this session) passes claims through unchanged -- matches today's
-- "no family_id -> redirect to /profile-select" behavior in AuthProvider.
--
-- Registration (supabase/config.toml [auth.hook.custom_access_token]) and,
-- for the hosted dev/prod projects, a Dashboard-side toggle
-- (Authentication -> Hooks) are required in addition to this migration --
-- see the feature spec's Edge Cases section.
-- ============================================================================

create or replace function custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = 'public'
as $$
declare
  v_session_id uuid;
  v_profile auth_session_profiles%rowtype;
  v_claims jsonb;
begin
  v_claims := event -> 'claims';

  begin
    v_session_id := (event -> 'claims' ->> 'session_id')::uuid;
  exception when others then
    return event;
  end;

  if v_session_id is null then
    return event;
  end if;

  select * into v_profile
  from auth_session_profiles
  where session_id = v_session_id;

  if not found then
    return event;
  end if;

  v_claims := jsonb_set(
    v_claims,
    '{app_metadata}',
    coalesce(v_claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'family_id', v_profile.family_id,
      'user_id', v_profile.user_id,
      'role', v_profile.role,
      'is_platform_admin', v_profile.is_platform_admin
    )
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Standard Supabase Auth Hook grant pattern: only supabase_auth_admin may
-- invoke the hook or read the table it depends on.
grant usage on schema public to supabase_auth_admin;
grant execute on function custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table auth_session_profiles to supabase_auth_admin;

create policy "auth_session_profiles: auth admin read for token hook"
on auth_session_profiles for select
to supabase_auth_admin
using (true);
