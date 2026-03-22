-- ============================================================================
-- Migration: 2026-03-21 — Review Test Sessions
-- Feature: family-scoped packaged flashcard + fill-test sessions
-- Authorized by: docs/feature-specs/2026-03-21-review-test-sessions.md
-- ============================================================================

create table review_test_sessions (
  id                   text primary key,
  family_id            uuid not null references families(id) on delete cascade,
  name                 text not null,
  created_by_user_id   uuid not null references users(id) on delete cascade,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz,
  completed_by_user_id uuid references users(id) on delete set null
);

create table review_test_session_targets (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null references review_test_sessions(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  character     text not null,
  pronunciation text not null,
  display_order integer not null check (display_order >= 0),
  unique (session_id, character, pronunciation)
);

create unique index review_test_sessions_active_name_unique
  on review_test_sessions (family_id, name)
  where completed_at is null;

create index review_test_sessions_family_id_idx
  on review_test_sessions (family_id, created_at desc);

create index review_test_session_targets_family_id_idx
  on review_test_session_targets (family_id);

create index review_test_session_targets_session_id_idx
  on review_test_session_targets (session_id, display_order);

alter table review_test_sessions enable row level security;
alter table review_test_session_targets enable row level security;

create policy "review_test_sessions: family scoped read"
on review_test_sessions for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "review_test_sessions: parent scoped insert"
on review_test_sessions for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "review_test_session_targets: family scoped read"
on review_test_session_targets for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "review_test_session_targets: parent scoped insert"
on review_test_session_targets for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create or replace function complete_review_test_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not (is_platform_admin() or current_jwt_role() = 'child') then
    raise exception 'Only child profiles can complete review test sessions';
  end if;

  update review_test_sessions
  set completed_at = now(),
      completed_by_user_id = current_user_id()
  where id = p_session_id
    and family_id = current_family_id()
    and completed_at is null;

  if not found then
    raise exception 'Review test session not found or already completed';
  end if;
end;
$$;

grant execute on function complete_review_test_session(text) to authenticated;
