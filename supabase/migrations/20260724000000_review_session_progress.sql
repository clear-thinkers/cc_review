-- ============================================================================
-- Migration: 2026-07-24 — Review Session Progress
-- Feature: save & resume test session progress (E1 — schema & service foundation)
-- Authorized by: docs/feature-specs/2026-07-24-save-resume-test-session-progress.md
-- ============================================================================

create table review_session_progress (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  family_id            uuid not null references families(id) on delete cascade,
  client_session_key   text not null,
  source_type          text not null check (source_type in ('due_review', 'packaged')),
  packaged_session_id  text references review_test_sessions(id) on delete cascade,
  progress_data        jsonb not null,
  started_at           timestamptz not null default now(),
  last_saved_at        timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (user_id, client_session_key)
);

create index review_session_progress_family_id_idx
  on review_session_progress (family_id);

create index review_session_progress_user_source_idx
  on review_session_progress (user_id, source_type);

alter table review_session_progress enable row level security;

create policy "review_session_progress: family scoped read"
on review_session_progress for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "review_session_progress: user scoped insert"
on review_session_progress for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

create policy "review_session_progress: user scoped update"
on review_session_progress for update
using (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

create policy "review_session_progress: user scoped delete"
on review_session_progress for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);
