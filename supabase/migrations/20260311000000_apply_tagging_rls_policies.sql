-- Migration: 2026-03-11 — Apply RLS Policies to Tagging Tables
-- Issue: RLS was manually enabled on lesson_tags and word_lesson_tags
--        but policies were not deployed from prior migrations.
-- Fix: Formalize the policies defined in 20260309000004 and 20260309000005.

-- ============================================================================
-- RLS POLICIES: word_lesson_tags
-- Family-scoped read/write access; platform admin bypass
-- ============================================================================

create policy "word_lesson_tags: family read own"
on word_lesson_tags for select
using (is_platform_admin() or family_id = current_family_id());

create policy "word_lesson_tags: family insert own"
on word_lesson_tags for insert
with check (is_platform_admin() or family_id = current_family_id());

create policy "word_lesson_tags: family update own"
on word_lesson_tags for update
using (is_platform_admin() or family_id = current_family_id());

create policy "word_lesson_tags: family delete own"
on word_lesson_tags for delete
using (is_platform_admin() or family_id = current_family_id());

-- ============================================================================
-- RLS POLICIES: lesson_tags
-- Family-scoped read/write access; platform admin bypass
-- ============================================================================

create policy "lesson_tags: family read own"
on lesson_tags for select
using (is_platform_admin() or family_id = current_family_id());

create policy "lesson_tags: family insert own"
on lesson_tags for insert
with check (is_platform_admin() or family_id = current_family_id());

create policy "lesson_tags: family update own"
on lesson_tags for update
using (is_platform_admin() or family_id = current_family_id());
