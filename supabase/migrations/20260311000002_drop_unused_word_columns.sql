-- Migration: 2026-03-11 — Drop Unused Word Columns
-- Issue: words table contains 3 columns with zero code dependencies and 0 data rows
-- Columns: pinyin, meaning, content_source
-- Impact: None — these columns are not referenced by any UI, business logic, or service code
-- Rationale: Simplify schema, reduce storage footprint, improve clarity

-- Services only reference these for database I/O; no business logic depends on them
-- fill_test is intentionally preserved — it is actively used for quiz sessions

-- ============================================================================
-- DROP UNUSED COLUMNS: words
-- ============================================================================

alter table words
  drop column if exists pinyin,
  drop column if exists meaning,
  drop column if exists content_source;
