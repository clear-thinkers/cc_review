-- ============================================================================
-- Migration: 2026-08-08 — Auth Session Profiles
-- Feature: session-scoped profile claims
-- Authorized by: docs/feature-specs/2026-08-08-session-scoped-profile-claims.md
--
-- Replaces the shared auth.users.app_metadata write in /api/auth/pin-verify
-- (one value per family, clobbered by any concurrent device's profile
-- switch -- see docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md)
-- with a per-Supabase-Auth-session record. custom_access_token_hook (next
-- migration) reads this table keyed by the token's own session_id, so a
-- profile switch on one device can never affect another device's session.
-- ============================================================================

create table auth_session_profiles (
  session_id         uuid primary key references auth.sessions(id) on delete cascade,
  auth_user_id       uuid not null references auth.users(id) on delete cascade,
  family_id          uuid not null references families(id) on delete cascade,
  user_id            uuid not null references users(id) on delete cascade,
  role               text not null check (role in ('parent', 'child')),
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index auth_session_profiles_auth_user_id_idx
  on auth_session_profiles (auth_user_id);

create index auth_session_profiles_user_id_idx
  on auth_session_profiles (user_id);

-- RLS enabled with NO policies for authenticated/anon -- default deny.
-- Only service_role (pin-verify / update-avatar API routes, which use
-- getServerSupabaseClient()) and supabase_auth_admin (the token hook, via
-- the explicit grant + policy in the next migration) may touch this table.
-- Regular client sessions never read or write it directly.
alter table auth_session_profiles enable row level security;
