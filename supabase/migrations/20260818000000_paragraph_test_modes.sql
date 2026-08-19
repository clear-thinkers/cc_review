-- ============================================================================
-- Migration: 2026-08-18 — Paragraph Test Modes (Tier 1, Item I, Phase 2)
-- Feature: named, reusable blank-selection templates per paragraph. Purely a
-- saved selection of which already-eligible paragraph spans should become
-- fill-test blanks -- creates nothing runnable (no review_test_sessions row).
-- Actually wiring a test mode into the quiz runtime is a future Phase 3.
-- Authorized by: docs/feature-specs/2026-08-17-paragraph-fill-test.md
-- ============================================================================

create table paragraph_test_modes (
  id                 uuid primary key default gen_random_uuid(),
  paragraph_id       uuid not null references paragraphs(id) on delete cascade,
  family_id          uuid not null references families(id) on delete cascade,
  name               text not null,
  span_ids           jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null references users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Deliberately per-paragraph, NOT family-wide -- a departure from every
  -- other named/unique thing in this app (textbooks, lesson_tags,
  -- review_test_sessions), since a test mode is scoped to one paragraph.
  -- Two different paragraphs may each have a test mode named "Quiz 1".
  unique (paragraph_id, name)
);

alter table paragraph_test_modes enable row level security;

create index on paragraph_test_modes (paragraph_id);
create index on paragraph_test_modes (family_id);

-- ============================================================================
-- RLS POLICIES: paragraph_test_modes
-- Same posture as `paragraphs` (20260817000000_paragraphs.sql): family-scoped
-- read; insert/update/delete are parent (or platform admin) only -- nothing
-- here is child-facing yet.
-- ============================================================================

create policy "paragraph_test_modes: family scoped read"
on paragraph_test_modes for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "paragraph_test_modes: parent scoped insert"
on paragraph_test_modes for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "paragraph_test_modes: parent scoped update"
on paragraph_test_modes for update
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "paragraph_test_modes: parent scoped delete"
on paragraph_test_modes for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);
