-- ============================================================================
-- Migration: 2026-07-26 — Vocab Phrases (Tier 1, Item D — Phrase-Keyed Input)
-- Feature: standalone multi-character phrase entity, parallel to `words`
-- New tables: vocab_phrases, vocab_phrase_lesson_tags
-- Authorized by: docs/feature-specs/2026-07-26-phrase-keyed-input.md
-- ============================================================================

-- ============================================================================
-- TABLE: vocab_phrases
-- One row per (family_id, phrase). Flat content: phrase, pinyin, English
-- definition, and a list of example sentences (each independently
-- fill-test-eligible). No SRS fields — phrases are packaged-only, never
-- auto-surfaced via spaced repetition (see feature spec §Scope).
-- ============================================================================

create table vocab_phrases (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  phrase      text not null check (char_length(phrase) between 2 and 10),
  pinyin      text,
  meaning_en  text,
  examples    jsonb not null default '[]'::jsonb
                check (jsonb_array_length(examples) <= 20),
  test_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (family_id, phrase)
);

alter table vocab_phrases enable row level security;

create index on vocab_phrases (family_id);

-- ============================================================================
-- RLS POLICIES: vocab_phrases
-- Mirrors the `words` posture exactly (20260306000001, 20260306000002):
-- INSERT/DELETE parent-only; UPDATE family-scoped (children grade phrases
-- during fill-test, same reasoning as gradeWord on `words`); SELECT
-- family-scoped read.
-- ============================================================================

create policy "vocab_phrases: family scoped read"
on vocab_phrases for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "vocab_phrases: parent scoped insert"
on vocab_phrases for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "vocab_phrases: family scoped update"
on vocab_phrases for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "vocab_phrases: parent scoped delete"
on vocab_phrases for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

-- ============================================================================
-- TABLE: vocab_phrase_lesson_tags
-- Join table: family-scoped assignment of an existing lesson_tag to a
-- vocab_phrase. Reuses the same lesson_tags taxonomy characters use.
-- Mirrors word_lesson_tags exactly (20260309000004).
-- ============================================================================

create table vocab_phrase_lesson_tags (
  id            uuid primary key default gen_random_uuid(),
  vocab_phrase_id uuid not null references vocab_phrases(id) on delete cascade,
  lesson_tag_id uuid not null references lesson_tags(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (vocab_phrase_id, lesson_tag_id, family_id)
);

alter table vocab_phrase_lesson_tags enable row level security;

create index on vocab_phrase_lesson_tags (vocab_phrase_id);
create index on vocab_phrase_lesson_tags (lesson_tag_id);
create index on vocab_phrase_lesson_tags (family_id);

create policy "vocab_phrase_lesson_tags: family read own"
on vocab_phrase_lesson_tags for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "vocab_phrase_lesson_tags: family insert own"
on vocab_phrase_lesson_tags for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "vocab_phrase_lesson_tags: family update own"
on vocab_phrase_lesson_tags for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "vocab_phrase_lesson_tags: family delete own"
on vocab_phrase_lesson_tags for delete
using (
  is_platform_admin()
  or family_id = current_family_id()
);
