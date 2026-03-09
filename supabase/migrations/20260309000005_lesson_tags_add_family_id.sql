-- Migration: Add family_id to lesson_tags for direct RLS
-- 2026-03-09
--
-- The original lesson_tags INSERT/UPDATE/SELECT policies used a subquery on
-- textbooks to derive the owning family. Postgres evaluates RLS recursively,
-- so the textbooks SELECT policy could block that subquery, causing the
-- lesson_tags INSERT to fail with an RLS violation even when the textbook
-- exists and belongs to the correct family.
--
-- Fix: add a family_id column (denormalised from textbooks) so RLS can check
-- it directly, matching the pattern used by word_lesson_tags.

-- Step 1: add nullable column
alter table lesson_tags
  add column family_id uuid references families(id) on delete cascade;

-- Step 2: backfill from parent textbook row
update lesson_tags lt
  set family_id = t.family_id
  from textbooks t
  where t.id = lt.textbook_id;

-- Step 3: enforce NOT NULL (all rows now have a value from backfill)
alter table lesson_tags
  alter column family_id set not null;

-- Step 4: index for RLS filter
create index on lesson_tags (family_id);

-- Step 5: replace policies with direct family_id checks
drop policy if exists "lesson_tags: readable if textbook readable" on lesson_tags;
drop policy if exists "lesson_tags: insert if textbook owned or admin" on lesson_tags;
drop policy if exists "lesson_tags: update if textbook owned or admin" on lesson_tags;

create policy "lesson_tags: family read own"
on lesson_tags for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "lesson_tags: family insert own"
on lesson_tags for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "lesson_tags: family update own"
on lesson_tags for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);
