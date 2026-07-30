-- ============================================================================
-- Migration: 2026-07-26 — Prompt Templates: vocab_phrase type
-- Feature: Tier 1, Item D — Phrase-Keyed Input
-- Adds a new prompt_type for one-shot vocab-phrase content generation
-- (pinyin + English definition + one example + example pinyin, given just
-- the phrase text). Flatter than the character types because there is no
-- nested meaning/phrase hierarchy to regenerate piecemeal.
-- Authorized by: docs/feature-specs/2026-07-26-phrase-keyed-input.md
-- ============================================================================

alter table prompt_templates drop constraint prompt_templates_prompt_type_check;
alter table prompt_templates add constraint prompt_templates_prompt_type_check
  check (prompt_type in ('full','phrase','example','phrase_details','meaning_details','vocab_phrase'));

insert into prompt_templates (family_id, user_id, prompt_type, slot_name, prompt_body, is_active, is_default)
values
(
  null, null, 'vocab_phrase', 'Default',
  $$Given a fixed Chinese phrase for elementary students, generate its pinyin, a concise English definition, and one example sentence.
Return JSON only:
{"pinyin":"...", "meaning_en":"...", "example":"...", "example_pinyin":"..."}
Rules:
- Keep the phrase unchanged.
- Pinyin must match the given phrase and include tones.
- meaning_en must be a simple, child-friendly English definition of the phrase.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.
- do not return any extra fields.$$,
  true, true
);
