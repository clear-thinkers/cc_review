-- Migration: 2026-03-11 — Restore fill_test Column to Words Table
-- Issue: fill_test column was accidentally dropped during schema cleanup
-- Fix: Restore the column that stores flashcard content for quiz sessions
-- Impact: Restores functionality for fill-test mode and flashcard content persistence

-- ============================================================================
-- ADD COLUMN: fill_test back to words table
-- ============================================================================

alter table words
  add column fill_test jsonb default null;

-- Note: This is a nullable column that stores the FillTest object
-- Used by quiz sessions and flashcard review mode
-- Existing rows will have null values; populated on demand during content curation
