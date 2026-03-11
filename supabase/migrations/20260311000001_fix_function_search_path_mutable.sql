-- Migration: 2026-03-11 — Fix Function Search Path Mutable Security Warnings
-- Issue: Supabase Security Advisor reports 4 warnings: "Function Search Path Mutable"
--        for current_family_id(), current_user_id(), is_platform_admin(), current_jwt_role()
--        These functions need explicit search_path restrictions for security.
-- Fix: Drop and recreate all four helper functions with explicit search_path = 'public'
--      This ensures stable, immutable search paths and passes security audit.

-- ============================================================================
-- FIX: current_family_id()
-- Notes: Using CREATE OR REPLACE (not DROP) to preserve dependent RLS policies
-- ============================================================================

create or replace function current_family_id()
returns uuid
language sql stable
set search_path = 'public'
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'family_id',
    ''
  )::uuid
$$;

-- ============================================================================
-- FIX: current_user_id()
-- Notes: Using CREATE OR REPLACE (not DROP) to preserve dependent RLS policies
-- ============================================================================

create or replace function current_user_id()
returns uuid
language sql stable
set search_path = 'public'
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_id',
    ''
  )::uuid
$$;

-- ============================================================================
-- FIX: is_platform_admin()
-- Notes: Using CREATE OR REPLACE (not DROP) to preserve dependent RLS policies
-- ============================================================================

create or replace function is_platform_admin()
returns boolean
language sql stable
set search_path = 'public'
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  )
$$;

-- ============================================================================
-- FIX: current_jwt_role()
-- Notes: Using CREATE OR REPLACE (not DROP) to preserve dependent RLS policies
-- ============================================================================

create or replace function current_jwt_role()
returns text
language sql stable
set search_path = 'public'
as $$
  select current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
$$;
