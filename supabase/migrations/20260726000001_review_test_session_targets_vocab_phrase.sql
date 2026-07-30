-- ============================================================================
-- Migration: 2026-07-26 — Review Test Session Targets: Vocab Phrase Targets
-- Feature: Tier 1, Item D — Phrase-Keyed Input
-- Additive-only: no existing column, constraint, or RLS policy on
-- review_test_sessions / review_test_session_targets changes.
-- Authorized by: docs/feature-specs/2026-07-26-phrase-keyed-input.md
-- ============================================================================

-- `character`/`pronunciation` remain not null and keep serving their
-- existing denormalized-display role. For a phrase target they hold the
-- phrase's own `phrase`/`pinyin` text. `vocab_phrase_id` is the discriminator
-- the grading/runtime layer uses to know a target grades against
-- `vocab_phrases` rather than `words`.

alter table review_test_session_targets
  add column vocab_phrase_id uuid references vocab_phrases(id) on delete cascade;

create index on review_test_session_targets (vocab_phrase_id);
