-- ============================================================================
-- Migration: 2026-03-10 — Content Lifecycle Columns
-- Adds content_status + content_source to words.
-- Adds content_source to flashcard_contents.
-- Authorized by: docs/architecture/2026-03-10-content-model-and-schema.md §5c, §5d
-- ============================================================================

-- ============================================================================
-- 1. ALTER words — content lifecycle columns
-- ============================================================================

-- content_status tracks whether flashcard content has been curated for this word.
-- pending = word added, no flashcard content, not reviewable
-- ready   = flashcard content exists, word is included in due review queue
alter table public.words
  add column if not exists content_status text not null default 'pending'
    check (content_status in ('pending', 'ready'));

-- content_source records how the word received its content.
-- null            = no content yet (pending)
-- 'pack'          = content arrived via pack purchase (copied from pack_flashcard_contents)
-- 'admin_curated' = content curated by platform admin for this family's request
alter table public.words
  add column if not exists content_source text
    check (content_source in ('pack', 'admin_curated'));

-- Index for the due review queue filter (content_status = 'ready')
create index if not exists words_content_status_idx on public.words (family_id, content_status);

-- ============================================================================
-- 2. ALTER flashcard_contents — content provenance column
-- ============================================================================

-- content_source records how this family received their flashcard content.
-- 'admin_curated' = curated by platform admin (default for all existing content)
-- 'pack'          = copied from a pack purchase
alter table public.flashcard_contents
  add column if not exists content_source text not null default 'admin_curated'
    check (content_source in ('pack', 'admin_curated'));
