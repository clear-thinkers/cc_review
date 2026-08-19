-- ============================================================================
-- Migration: 2026-08-17 — Paragraphs (Tier 1, Item I, Phase 1 — Article Import)
-- Feature: raw pasted article text + parsed sentence/span structure, persisted
-- as fill-test source material for Phase 2. Write-only from the user's
-- perspective in Phase 1 — no view/edit/package UI ships yet.
-- Authorized by: docs/feature-specs/2026-08-17-add-paragraph-article-import.md
-- ============================================================================

create table paragraphs (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references families(id) on delete cascade,
  title              text,
  raw_text           text not null,
  sentences          jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null references users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table paragraphs enable row level security;

create index on paragraphs (family_id);

-- ============================================================================
-- RLS POLICIES: paragraphs
-- Family-scoped read. Insert/update/delete are parent (or platform admin)
-- only — deliberately NOT family-scoped-for-children the way vocab_phrases'
-- UPDATE policy is (20260726000000_vocab_phrases.sql), since a paragraph is
-- never graded or written to by a child — Phase 1 ships no child-facing
-- surface for this table at all.
-- ============================================================================

create policy "paragraphs: family scoped read"
on paragraphs for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "paragraphs: parent scoped insert"
on paragraphs for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "paragraphs: parent scoped update"
on paragraphs for update
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "paragraphs: parent scoped delete"
on paragraphs for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);
