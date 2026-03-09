-- ============================================================================
-- Migration: 2026-03-09 — Character Level Tagging
-- Feature: #7 Phase 2 — 4-level cascade textbook tags on words
-- New tables: textbooks, lesson_tags, word_lesson_tags
-- Includes: RLS policies, indexes, seed data (one shared demo textbook)
-- Authorized by: docs/architecture/2026-03-09-character-level-tagging.md
-- ============================================================================

-- ============================================================================
-- TABLE: textbooks
-- A textbook is the root of a 4-level cascade hierarchy.
-- is_shared = true → admin-curated, visible to all families (family_id = null)
-- is_shared = false → family-private (family_id IS NOT NULL)
-- ============================================================================

create table textbooks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_shared  boolean not null default false,
  family_id  uuid references families(id) on delete cascade,
    -- ^ null for is_shared rows
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table textbooks enable row level security;

-- Indexes
create index on textbooks (family_id, is_shared);

-- ============================================================================
-- RLS POLICIES: textbooks
-- ============================================================================

-- SELECT: family can read shared rows + their own rows
create policy "textbooks: family read shared and own"
on textbooks for select
using (
  is_platform_admin()
  or is_shared = true
  or family_id = current_family_id()
);

-- INSERT: parents can create private family textbooks;
--         platform_admin can create shared (family_id null) or family rows
create policy "textbooks: insert own or admin insert shared"
on textbooks for insert
with check (
  is_platform_admin()
  or (
    family_id = current_family_id()
    and is_shared = false
  )
);

-- UPDATE: parents can update their own family rows;
--         platform_admin can update any row
create policy "textbooks: update own or admin"
on textbooks for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- DELETE: parents can delete their own non-shared rows;
--         platform_admin can delete any non-shared row
create policy "textbooks: delete own or admin"
on textbooks for delete
using (
  is_shared = false
  and (
    is_platform_admin()
    or family_id = current_family_id()
  )
);

-- ============================================================================
-- TABLE: lesson_tags
-- One row per unique (textbook_id, grade, unit, lesson) combination.
-- Created implicitly on first use (type-ahead "Create" flow).
-- ============================================================================

create table lesson_tags (
  id          uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references textbooks(id) on delete cascade,
  grade       text not null,   -- e.g. "G2", "Grade 2", "二年级"
  unit        text not null,   -- e.g. "Unit 8", "第八单元"
  lesson      text not null,   -- e.g. "Lesson 4", "第四课"
  created_at  timestamptz not null default now(),
  unique (textbook_id, grade, unit, lesson)
);

alter table lesson_tags enable row level security;

-- Indexes
create index on lesson_tags (textbook_id);

-- ============================================================================
-- RLS POLICIES: lesson_tags
-- Readable if parent textbook is readable.
-- Insertable if parent textbook belongs to family (or is_shared + platform_admin).
-- ============================================================================

-- SELECT: readable if parent textbook is readable to this family
create policy "lesson_tags: readable if textbook readable"
on lesson_tags for select
using (
  is_platform_admin()
  or exists (
    select 1 from textbooks t
    where t.id = lesson_tags.textbook_id
    and (
      t.is_shared = true
      or t.family_id = current_family_id()
    )
  )
);

-- INSERT: insertable if parent textbook belongs to family or is_shared + admin
create policy "lesson_tags: insert if textbook owned or admin"
on lesson_tags for insert
with check (
  is_platform_admin()
  or exists (
    select 1 from textbooks t
    where t.id = lesson_tags.textbook_id
    and t.family_id = current_family_id()
  )
);

-- UPDATE: same as insert
create policy "lesson_tags: update if textbook owned or admin"
on lesson_tags for update
using (
  is_platform_admin()
  or exists (
    select 1 from textbooks t
    where t.id = lesson_tags.textbook_id
    and t.family_id = current_family_id()
  )
);

-- ============================================================================
-- TABLE: word_lesson_tags
-- Join table: family-scoped assignment of a lesson_tag to a word.
-- A word can have multiple rows (multiple cascade tags).
-- Deleting a word cascades to delete its tag assignments.
-- ============================================================================

create table word_lesson_tags (
  id            uuid primary key default gen_random_uuid(),
  word_id       text not null references words(id) on delete cascade,
  lesson_tag_id uuid not null references lesson_tags(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (word_id, lesson_tag_id, family_id)
);

alter table word_lesson_tags enable row level security;

-- Indexes
create index on word_lesson_tags (word_id);
create index on word_lesson_tags (lesson_tag_id);
create index on word_lesson_tags (family_id);

-- ============================================================================
-- RLS POLICIES: word_lesson_tags
-- Full CRUD scoped to family_id matching the session.
-- ============================================================================

-- SELECT
create policy "word_lesson_tags: family read own"
on word_lesson_tags for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- INSERT
create policy "word_lesson_tags: family insert own"
on word_lesson_tags for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

-- UPDATE
create policy "word_lesson_tags: family update own"
on word_lesson_tags for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- DELETE
create policy "word_lesson_tags: family delete own"
on word_lesson_tags for delete
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- ============================================================================
-- SEED DATA: one shared demo textbook for testing
-- ============================================================================

insert into textbooks (name, is_shared, family_id, created_by)
values ('New Oriental Bingo Chinese', true, null, null);
