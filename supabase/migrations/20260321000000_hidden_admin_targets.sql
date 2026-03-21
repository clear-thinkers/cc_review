-- ============================================================================
-- Migration: 2026-03-21 — Content Admin Row Deletion
-- Feature: persistent hidden targets for Content Admin character|pronunciation rows
-- Authorized by: docs/feature-specs/2026-03-21-content-admin-row-deletion.md
-- ============================================================================

-- ============================================================================
-- TABLE: hidden_admin_targets
-- Family-scoped exclusions for Content Admin targets. A row here means the
-- corresponding character|pronunciation pair should be hidden from Content
-- Admin until the Hanzi is re-added on /words/add.
-- ============================================================================

create table hidden_admin_targets (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  character     text not null,
  pronunciation text not null,
  created_at    timestamptz not null default now(),
  unique (family_id, character, pronunciation)
);

alter table hidden_admin_targets enable row level security;

create index hidden_admin_targets_family_id_idx
  on hidden_admin_targets (family_id);

create index hidden_admin_targets_family_character_idx
  on hidden_admin_targets (family_id, character);

-- ============================================================================
-- RLS POLICIES: hidden_admin_targets
-- Full CRUD scoped to family_id matching the current session. Platform admin
-- bypass is provided through the shared helper function.
-- ============================================================================

create policy "hidden_admin_targets: family scoped read"
on hidden_admin_targets for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "hidden_admin_targets: family scoped insert"
on hidden_admin_targets for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "hidden_admin_targets: family scoped update"
on hidden_admin_targets for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "hidden_admin_targets: family scoped delete"
on hidden_admin_targets for delete
using (
  is_platform_admin()
  or family_id = current_family_id()
);
