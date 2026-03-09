-- ============================================================================
-- Migration: 2026-03-09-001 — Prompt body: instructions only
-- The return-format section (JSON schema + "Return JSON only") is now hardcoded
-- in the API route and appended at call time. Default rows are updated to store
-- only the customizable instructions/rules portion.
-- ============================================================================

update prompt_templates
set
  prompt_body = $$You are a professional elementary Chinese learning assistant.
Generate JSON only for one character and one pronunciation.
Rules:
- 1-3 meanings.
- 2 phrases per meaning, prioritize common Chinese idioms.
- examples <= 30 Chinese characters.
- positive, age-appropriate content.
- phrase object can include only phrase, pinyin, example, example_pinyin.$$,
  updated_at = now()
where prompt_type = 'full' and is_default = true;

update prompt_templates
set
  prompt_body = $$Generate one new phrase and one matching example sentence for elementary students.
Rules:
- phrase must include the target character.
- phrase must match the pronunciation and meaning provided for that character.
- phrase length 2-4 Chinese characters.
- example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- positive and age-appropriate.$$,
  updated_at = now()
where prompt_type = 'phrase' and is_default = true;

update prompt_templates
set
  prompt_body = $$Generate one new example sentence for elementary students.
Rules:
- sentence must naturally use the given phrase.
- sentence must be <= 30 Chinese characters.
- example_pinyin must match the sentence and include tones.
- positive and age-appropriate.$$,
  updated_at = now()
where prompt_type = 'example' and is_default = true;

update prompt_templates
set
  prompt_body = $$Given a fixed phrase, generate phrase pinyin and one short example sentence for elementary students.
Rules:
- Keep the phrase unchanged.
- Pinyin must match the given phrase and include tones.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.$$,
  updated_at = now()
where prompt_type = 'phrase_details' and is_default = true;

update prompt_templates
set
  prompt_body = $$Given a Chinese meaning definition for elementary learners, provide a concise English translation.
Rules:
- Keep translation simple and child-friendly.
- Do not add extra explanation.$$,
  updated_at = now()
where prompt_type = 'meaning_details' and is_default = true;
