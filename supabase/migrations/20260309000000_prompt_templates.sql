-- ============================================================================
-- Migration: 2026-03-09 — Prompt Templates
-- Feature: Admin-Configurable LLM Prompts (Feature #1, Phase 2)
-- New table: prompt_templates
-- Includes: RLS policies, indexes, and seed data (one Default per prompt type)
-- ============================================================================

-- ============================================================================
-- TABLE: prompt_templates
-- Configurable LLM prompt templates.
-- Default rows: is_default=true, family_id=null, user_id=null
-- Family rows: is_default=false, family_id=<uuid>, max 5 per (family_id, prompt_type)
-- ============================================================================

create table prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families(id) on delete cascade,
    -- ^ null for Default rows owned by platform_admin
  user_id     uuid references users(id) on delete cascade,
    -- ^ null for Default rows; set to creating user for family-owned slots
  prompt_type text not null
                check (prompt_type in ('full','phrase','example','phrase_details','meaning_details')),
  slot_name   text not null,
  prompt_body text not null,
  is_active   boolean not null default false,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table prompt_templates enable row level security;

-- Indexes (from spec)
create index on prompt_templates (family_id, prompt_type, is_active);
create index on prompt_templates (is_default, prompt_type);

-- ============================================================================
-- RLS POLICIES: prompt_templates
-- ============================================================================

-- SELECT: family members can read their own slots + all Default rows
create policy "prompt_templates: family read own slots and defaults"
on prompt_templates for select
using (
  is_platform_admin()
  or family_id = current_family_id()
  or is_default = true
);

-- INSERT: parents and platform_admin can insert family-owned slots
--         platform_admin can also insert Default rows (family_id=null)
create policy "prompt_templates: insert family slots"
on prompt_templates for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

-- UPDATE: parents can update their own family slots;
--         platform_admin can update any row (including Default rows)
create policy "prompt_templates: update family slots or admin update defaults"
on prompt_templates for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- DELETE: parents can delete their own non-default family slots;
--         platform_admin can delete family rows but NOT Default rows
create policy "prompt_templates: delete own non-default slots"
on prompt_templates for delete
using (
  is_default = false
  and (
    is_platform_admin()
    or family_id = current_family_id()
  )
);

-- ============================================================================
-- SEED: One Default row per configurable prompt type
-- Bodies are the current hardcoded constants from /api/flashcard/generate/route.ts
-- ============================================================================

insert into prompt_templates (family_id, user_id, prompt_type, slot_name, prompt_body, is_active, is_default)
values
(
  null, null, 'full', 'Default',
  $$You are a professional elementary Chinese learning assistant.
Generate JSON only for one character and one pronunciation.
Output format:
{
  "character":"character",
  "pronunciation":"pinyin",
  "meanings":[
    {
      "definition":"meaning in Chinese",
      "definition_en":"optional English meaning",
      "phrases":[
        {"phrase":"phrase", "pinyin":"phrase pinyin", "example":"short sentence", "example_pinyin":"example sentence pinyin"}
      ]
    }
  ]
}
Rules:
- 1-3 meanings.
- 2 phrases per meaning, prioritize common Chinese idioms.
- examples <= 30 Chinese characters.
- positive, age-appropriate content.
- phrase object can include only phrase, pinyin, example, example_pinyin.
- return JSON only.$$,
  true, true
),
(
  null, null, 'phrase', 'Default',
  $$Generate one new phrase and one matching example sentence for elementary students.
Return JSON only:
{"phrase":"...", "pinyin":"...", "example":"...", "example_pinyin":"..."}
Rules:
- phrase must include the target character.
- phrase must match the pronunciation and meaning provided for that character.
- phrase length 2-4 Chinese characters.
- example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- positive and age-appropriate.
- do not return any extra fields.$$,
  true, true
),
(
  null, null, 'example', 'Default',
  $$Generate one new example sentence for elementary students.
Return JSON only:
{"example":"...", "example_pinyin":"..."}
Rules:
- sentence must naturally use the given phrase.
- sentence must be <= 30 Chinese characters.
- example_pinyin must match the sentence and include tones.
- positive and age-appropriate.
- do not return any extra fields.$$,
  true, true
),
(
  null, null, 'phrase_details', 'Default',
  $$Given a fixed phrase, generate phrase pinyin and one short example sentence for elementary students.
Return JSON only:
{"pinyin":"...", "example":"...", "example_pinyin":"..."}
Rules:
- Keep the phrase unchanged.
- Pinyin must match the given phrase and include tones.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.
- do not return any extra fields.$$,
  true, true
),
(
  null, null, 'meaning_details', 'Default',
  $$Given a Chinese meaning definition for elementary learners, provide a concise English translation.
Return JSON only:
{"definition_en":"..."}
Rules:
- Keep translation simple and child-friendly.
- Do not add extra explanation.
- do not return any extra fields.$$,
  true, true
);
