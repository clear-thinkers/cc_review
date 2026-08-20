-- ============================================================================
-- Migration: 2026-08-19 — Paragraph Quiz Sessions
-- Feature: Tier 1/2 boundary, Item I, Phase 3 — Paragraph Quiz Runtime
-- Authorized by: docs/feature-specs/2026-08-19-paragraph-quiz-runtime.md
-- ============================================================================

-- `review_test_sessions.paragraph_test_mode_id` is the session-level
-- discriminator: non-null means this ENTIRE session is a paragraph quiz,
-- packaged from that test mode's current span_ids at packaging time (a
-- snapshot -- editing the test mode afterward does not retroactively touch
-- an already-packaged session). Never set alongside a session that also has
-- ordinary character/phrase targets; enforced at the packaging call site
-- (createReviewTestSession), not a DB constraint -- mirrors how
-- vocab_phrase_id on targets is an application-level discriminator too.
alter table review_test_sessions
  add column paragraph_test_mode_id uuid references paragraph_test_modes(id) on delete cascade;

create index on review_test_sessions (paragraph_test_mode_id);

-- `review_test_session_targets.paragraph_id` + `paragraph_span_id` identify
-- which paragraph and which specific span (blank) this target represents.
-- `character`/`pronunciation` keep their existing denormalized-display role
-- exactly as for phrase targets: `character` holds the span's own text,
-- `pronunciation` holds its resolved pinyin (empty-string fallback if
-- unresolved). The existing `vocab_phrase_id` column does double duty
-- as-is: null means this blank resolved to a `words` row, non-null means a
-- `vocab_phrases` row -- no new kind-discriminator column needed.
alter table review_test_session_targets
  add column paragraph_id uuid references paragraphs(id) on delete cascade,
  add column paragraph_span_id text;

create index on review_test_session_targets (paragraph_id);

-- Extend the dedupe key to include paragraph_span_id: the same word/phrase
-- can legitimately appear as two different blanks in one paragraph, so the
-- original (session_id, character, pronunciation) key must not collapse
-- them. Safe/additive since Postgres treats NULL as distinct-from-NULL in
-- unique constraints -- every existing (non-paragraph) target keeps
-- paragraph_span_id null and is unaffected in practice, since application
-- code (normalizeReviewTestSessionDraftTargets, appendTargetsToReviewTestSession)
-- already performs the real dedup for those targets; this constraint has
-- always been a backstop, not the primary enforcement.
--
-- The original constraint was declared inline in the 2026-03-21 CREATE
-- TABLE statement with no explicit name, so Postgres auto-named it. Locate
-- it dynamically by column membership rather than guess the generated name.
do $$
declare
  v_constraint_name text;
begin
  select con.conname
  into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where rel.relname = 'review_test_session_targets'
    and ns.nspname = 'public'
    and con.contype = 'u'
    and (
      select array_agg(attname order by attname)
      from pg_attribute
      where attrelid = rel.oid and attnum = any(con.conkey)
    ) = array['character', 'pronunciation', 'session_id']::name[];

  if v_constraint_name is null then
    raise exception 'Could not locate existing (session_id, character, pronunciation) unique constraint on review_test_session_targets';
  end if;

  execute format('alter table review_test_session_targets drop constraint %I', v_constraint_name);
end $$;

alter table review_test_session_targets
  add constraint review_test_session_targets_dedup_key
    unique (session_id, character, pronunciation, paragraph_span_id);
