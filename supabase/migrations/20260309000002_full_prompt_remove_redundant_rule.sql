-- Migration: 2026-03-09-002 — Remove redundant "phrase object can include only..." rule
-- from the 'full' Default prompt body. This is enforced in the backend normalizePhrase()
-- function by explicit field destructuring — keeping it in the prompt is unnecessary.

update prompt_templates
set
  prompt_body = $$You are a professional elementary Chinese learning assistant.
Generate JSON only for one character and one pronunciation.
Rules:
- 1-3 meanings.
- 2 phrases per meaning, prioritize common Chinese idioms.
- examples <= 30 Chinese characters.
- positive, age-appropriate content.$$,
  updated_at = now()
where prompt_type = 'full' and is_default = true;
