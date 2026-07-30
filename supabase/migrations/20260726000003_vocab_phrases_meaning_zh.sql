-- ============================================================================
-- Migration: 2026-07-26 — vocab_phrases: meaning_zh column
-- Feature: Tier 1, Item D — Phrase-Keyed Input (manual-QA follow-up)
-- Content Admin's phrase view should show a Chinese definition alongside
-- the English one, Chinese first — mirroring how character content already
-- has both flashcard_contents.meanings[].definition (Chinese) and the
-- optional .definition_en. vocab_phrases only ever had meaning_en; this
-- adds the missing Chinese counterpart.
-- Authorized 2026-07-26.
-- ============================================================================

alter table vocab_phrases add column meaning_zh text;

-- Keep the seeded Default vocab_phrase prompt's own descriptive text in
-- sync with the new field, so it matches the JSON shape the generate route
-- now requests (meaning_zh added, Chinese definition generated first).
update prompt_templates
set prompt_body = $$Given a fixed Chinese phrase for elementary students, generate a concise Chinese definition, a concise English definition, its pinyin, and one example sentence.
Return JSON only:
{"meaning_zh":"...", "meaning_en":"...", "pinyin":"...", "example":"...", "example_pinyin":"..."}
Rules:
- Keep the phrase unchanged.
- meaning_zh must be a simple, child-friendly Chinese definition of the phrase.
- meaning_en must be a simple, child-friendly English definition of the phrase.
- Pinyin must match the given phrase and include tones.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.
- do not return any extra fields.$$
where prompt_type = 'vocab_phrase' and is_default = true and family_id is null;
