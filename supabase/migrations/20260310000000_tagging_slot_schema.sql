-- ============================================================================
-- Migration: 2026-03-10 — Tagging Slot Schema
-- Converts lesson_tags from fixed grade/unit/lesson to flexible slot_1/2/3_value.
-- Adds slot label columns to textbooks.
-- Both tables are empty in dev and prod — safe to alter without data migration.
-- Authorized by: docs/architecture/2026-03-10-content-model-and-schema.md §5a, §5b
-- ============================================================================

-- ============================================================================
-- 1. ALTER textbooks — add flexible slot label columns
-- ============================================================================

alter table public.textbooks
  add column if not exists slot_1_label    text,
  add column if not exists slot_2_label    text,
  add column if not exists slot_3_label    text,
  add column if not exists slot_1_label_zh text,
  add column if not exists slot_2_label_zh text,
  add column if not exists slot_3_label_zh text;

-- ============================================================================
-- 2. ALTER lesson_tags — replace grade/unit/lesson with slot_1/2/3_value
-- ============================================================================

-- Drop old unique constraint (uses the old column names)
alter table public.lesson_tags
  drop constraint if exists lesson_tags_textbook_id_grade_unit_lesson_key;

-- Drop old fixed columns
alter table public.lesson_tags
  drop column if exists grade,
  drop column if exists unit,
  drop column if exists lesson;

-- Add flexible slot value columns (all nullable — a null means "not used for this textbook")
alter table public.lesson_tags
  add column if not exists slot_1_value text,
  add column if not exists slot_2_value text,
  add column if not exists slot_3_value text;

-- Add new unique index
-- Note: Postgres treats nulls as distinct in unique indexes, which is acceptable here.
-- App layer enforces semantic deduplication before INSERT (see content-model spec §13).
create unique index if not exists lesson_tags_slot_values_idx
  on public.lesson_tags (family_id, textbook_id, slot_1_value, slot_2_value, slot_3_value);
