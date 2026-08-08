# Feature Spec — 2026-07-26 — Phrase-Keyed Input (Tier 1, Item D)

## Status: Built 2026-07-26 — Content Admin phrase-management UI manually
verified by the parent; quiz-taking flow and `/words/add` batch entry still
need manual QA. **Read "Handoff — Current State" immediately below before
anything else in this doc.**

## Handoff — Current State (2026-07-26, for the next agent)

**What this feature is:** parents can add multi-character phrases (not just
single characters) as their own vocabulary item — with pinyin, a Chinese +
English definition, and multiple example sentences — tag them, AI-generate
their content, and package them into fill-test quiz sessions alongside
characters.

**What's confirmed working (manually tested by the parent in-browser):**
- Content Admin's Phrases view (`/words/admin`, Characters/Phrases toggle):
  adding a phrase, AI-generating pinyin + Chinese/English definitions + an
  example, the full per-row editing UI (see below), search, tagging.
- The Content Admin phrase-editing action set was iterated on live and is
  now considered correct — see "Manual-QA log" for the exact final button
  semantics per column (Phrase / Definition / Examples).

**What's built but NOT yet manually verified — do this next:**
1. `/words/add` → "Add Phrases" batch section (comma-separated entry + batch
   tag assignment). Untested since the R/S/C/D/E work landed.
2. Selecting phrases in Content Admin and packaging them into a review test
   session (`str.admin.buttons.addToReviewTestSession` button in
   `VocabPhraseAdminSection.tsx`), optionally mixed with characters.
3. **The actual quiz-taking flow** — this is the highest-value untested
   path: start a packaged session containing a phrase, confirm it renders as
   its own drag-and-match round (never mixed with character blanks in the
   same round), confirm grading lands (`vocab_phrases.test_count`
   increments), and confirm the familiarity nudge fires on a *character*
   that shares a Hanzi with a correctly-answered phrase (check that
   character's `words` row — `ease`/`repetitions`/`next_review_at` should
   move, `test_count` should NOT).
4. Pause/resume a packaged session that contains a phrase round (Due
   Review's paused-sessions list) — confirm it resumes correctly and that a
   phrase deleted mid-pause correctly drops from resume (see
   `revalidateSavedQuizQueue`'s phrase branch in `words.shared.utils.tsx`).
5. `scripts/verify-rls.ts` Section 6 — needs a live Supabase project +
   service role key, never run in this build environment.

**Quick file map:**
- Schema: `supabase/migrations/20260726000000` through `...000003` (4 files
  — phrases table, session-target column, prompt type, `meaning_zh` column).
- Content Admin phrase UI: `src/app/words/admin/VocabPhraseAdminSection.tsx`
  (biggest file — all the R/S/C/D/E edit-state logic lives here).
- `/words/add` batch UI: `src/app/words/add/AddVocabPhraseSection.tsx`.
- Shared tag picker: `src/app/words/shared/TagCascadePicker.tsx`.
- AI generation: `src/app/api/vocab-phrase/generate/route.ts` (two modes:
  default one-shot full generate, and `mode: "example_pinyin"` for
  pinyin-only on a hand-typed sentence).
- Quiz runtime: `src/lib/fillTest.ts` (additive grading types),
  `src/app/words/shared/words.shared.utils.tsx`
  (`buildFillTestPlanForVocabPhrases`, `wrapVocabPhraseRoundAsQuizWord`),
  grading/nudge dispatch in `src/app/words/shared/words.shared.state.ts`.
- Strings: `src/app/words/words.strings.ts` → `admin.vocabPhrases` and
  `add.vocabPhrases` namespaces (both EN/ZH). The R/S/C/D/E button *labels*
  are intentionally **not** duplicated here — they're reused directly from
  `str.admin.table.actionButtons` (the Character view's own strings) so the
  two views literally say the same thing.
- Full design history (why things are shaped this way, ambiguities resolved
  along the way): rest of this document, below.

**Verification status:** 540 tests passing, `tsc --noEmit` and `eslint`
clean as of the last change (2026-08-08 Content Admin Phrases-view work —
see "2026-08-08 follow-up" under "Known gaps" below). All automated checks
only — see item 3-5 above for what still needs a human clicking through the
app.

## Problem

Today the only addable, taggable, quizzable content unit is a single Hanzi
character (`words`, one row per `(family_id, hanzi)`). A parent cannot add a
multi-character phrase or idiom as its own vocabulary item with its own
meaning and example — "phrase" currently only exists as content *nested under
an already-added character* (`flashcard_contents.phrases[]`, used to generate
quiz blanks for that character). This blocks item **I** (article-import
known/unknown triage), which requires selecting and adding unknown phrases,
not just unknown characters.

## Naming (resolved 2026-07-26)

The word "phrase" is already load-bearing in the codebase with a different
meaning: `flashcard_contents.phrases` (per-character example phrases) and
`prompt_templates.prompt_type = 'phrase'` (prompt that generates one such
example phrase for a character). To avoid ambiguity in schema/code, this spec
introduces the new entity under the internal name **`vocab_phrase`**
(table `vocab_phrases`) while all parent-facing UI copy still says "Phrase."
Confirmed — proceed with this naming.

## Scope

- New standalone content entity, **`vocab_phrases`**: one row per
  `(family_id, phrase)`, holding the phrase's Chinese text, pinyin, English
  definition, and **one or more** example sentences (each with its own
  pinyin). Flat — no nested meanings like `flashcard_contents` has for
  characters — but examples are a list, not a single field, since a phrase
  can have multiple example sentences.
- Parent manages phrases on the **same Content Admin page** (`/words/admin`)
  as characters, behind a **Characters / Phrases filter toggle**. The phrase
  view is a flat table (Phrase · Pinyin · English definition · Examples ·
  Tags · Fill-Test toggle · Actions), not the nested
  character → meaning → phrase/example table used today.
- Parent can create a new phrase one at a time directly from the Phrase view
  on Content Admin (inline add row, matching the existing "pending" row
  pattern already used to add new phrase/example content to a character).
- Parent can also **batch-add phrases from `/words/add`**: a comma-separated
  list of phrases (e.g. `你好, 谢谢, 对不起`), parsed into distinct entries,
  diffed against existing `vocab_phrases` (already-added vs. new), inserted
  in one submission, with the **same tag-assignment section already on that
  page** applied to the whole new batch at once. This is the phrase
  equivalent of the existing single-textarea character add flow.
- AI generation reuses the existing `prompt_templates` structure: a new
  `prompt_type = 'vocab_phrase'`, one-shot (given just the phrase text,
  return pinyin + English definition + one example + example pinyin in one
  call) — flatter than the character generation flow because there's no
  nested meaning/phrase hierarchy to regenerate piecemeal. Additional
  examples beyond the first are added one at a time via a per-row "Add
  another example" action (mirrors the per-character example-add pattern).
- Parent can tag phrases with the existing curriculum taxonomy
  (`lesson_tags`: Textbook/Grade/Unit/Lesson) via a new parallel join table,
  reusing the tag picker UI already built for characters — both on Content
  Admin (per-phrase or batch-selected) and on `/words/add` (batch, for a
  freshly-submitted comma-separated set).
- Parent can package phrases into a fill-test session using the **existing
  "Add to Review Test Session" flow already on Content Admin**
  (`AdminSection.tsx`'s selection toolbar → `createSelectedReviewTestSession`)
  — same button, same session-naming form, extended to accept phrase
  selections alongside (or instead of) character selections.
- **A phrase blank uses the exact same drag-and-match mechanic every
  character quiz blank already uses — not free-text typing.** (Corrected
  2026-07-26 after reading `src/lib/fillTest.ts` /
  `FillTestReviewSection.tsx`: the app has no Chinese text-entry input
  anywhere; every blank today is "drag a phrase from a shared candidate bank
  onto a blanked sentence.") The phrase's own example sentence becomes the
  blanked sentence; the phrase text itself becomes a draggable candidate in
  that round's phrase bank, tagged with `vocabPhraseId` (a new sibling to
  the existing `characterId` tag on a `FillSentence`). One blank per phrase
  per round, graded exactly like one character's blank is today — right or
  wrong, no partial credit.
- **Phrases always form their own quiz round(s), never mixed with
  characters in the same round.** (Resolved 2026-07-26.) A session
  containing both produces a sequence of rounds — some character-only, some
  phrase-only. This means the existing character-bundling function
  (`createBundledQuizWord`/`buildBundledFillTestPlan` in
  `words.shared.utils.tsx`) is **never touched** — a new, standalone
  phrase-only round builder is added alongside it instead. Zero regression
  risk to today's character quizzes; also keeps a phrase's (likely longer/
  harder) example sentences from diluting an easier single-character round.
- When a phrase has multiple examples, its round-builder picks one at random
  among those flagged fill-test-eligible each time a round is built.
- **A correct phrase answer nudges the familiarity of the phrase's own
  component characters**, for any of them that already exist as standalone
  added words — see "Grading" below for the exact mechanism. **No automatic
  spaced-repetition scheduling for the phrase itself** — phrases never
  auto-surface in Due Review; the only way a phrase enters a quiz is via
  explicit packaging. `vocab_phrases` therefore does not need
  `repetitions`/`ease`/`interval_days`/`next_review_at` — only a
  `test_count` for bookkeeping.

## Out of scope

- Any change to `words`, `flashcard_contents`, `createBundledQuizWord`, or
  `buildBundledFillTestPlan` (the existing character-bundling function),
  beyond the new incidental familiarity-nudge path described under Grading.
  Characters and phrases are parallel, independent entities that happen to
  share the Content Admin page, `/words/add`, the `lesson_tags` taxonomy,
  the `prompt_templates` mechanism, the packaged review-test-session flow,
  and the underlying `FillTest`/`gradeBundledFillTest` grading primitives in
  `src/lib/fillTest.ts` (extended additively, not modified in place).
- Item I (article-import triage) itself — this spec only unblocks it by
  making phrases addable/taggable.
- Free-text Chinese input as a quiz answer mechanism — out of scope entirely
  for this feature; not something the app has today for any content type.

## Proposed behavior

### Data model

New table `vocab_phrases`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id`, cascade delete |
| `phrase` | text | The Chinese phrase itself; `check (char_length(phrase) between 2 and 10)` |
| `pinyin` | text | Nullable until AI-generated or hand-entered |
| `meaning_en` | text | English definition; nullable until generated |
| `examples` | jsonb | `{ zh: string; pinyin: string; include_in_fill_test: boolean }[]`. Empty array until at least one example is generated/entered — mirrors `flashcard_contents.examples` shape (minus the per-example `en`, not requested here); `check (jsonb_array_length(examples) <= 20)` |
| `test_count` | integer | Default `0`; incremented on each grade, bookkeeping only (no scheduler math) |
| `created_at` | timestamptz | Default `now()` |
| **Unique constraint** | | `(family_id, phrase)` — same "already added" semantics as `words (family_id, hanzi)`, needed by item I's diff logic |

`include_in_fill_test` as a standalone column is dropped in favor of the
per-example flag inside `examples[]` — a phrase with zero fill-test-eligible
examples is implicitly excluded from packaging (same effect, one less
column).

**Validation (resolved 2026-07-26):** a phrase must be 2–10 Chinese
characters — enforced by a DB `CHECK` constraint, not just client-side, so
it holds for both the Content Admin inline-add row and the `/words/add`
batch path. A phrase may have at most 20 examples, enforced the same way.
Both limits apply uniformly regardless of entry point.

New join table `vocab_phrase_lesson_tags` (mirrors `word_lesson_tags` exactly):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `vocab_phrase_id` | uuid | FK → `vocab_phrases.id`, cascade delete |
| `lesson_tag_id` | uuid | FK → `lesson_tags.id`, cascade delete |
| `family_id` | uuid | Denormalized for RLS, matches `word_lesson_tags` pattern |
| **Unique constraint** | | `(vocab_phrase_id, lesson_tag_id)` |

`review_test_session_targets` gets one additive, nullable column — no
existing column becomes nullable, no existing constraint changes:

```sql
alter table review_test_session_targets
  add column vocab_phrase_id uuid references vocab_phrases(id) on delete cascade;
```

For a phrase target, `character`/`pronunciation` (still `not null`) are
populated with the phrase's own `phrase`/`pinyin` text as display data (they
already serve this denormalized-display role for character targets); the new
`vocab_phrase_id` column is the discriminator that tells the grading/runtime
layer "this target grades against `vocab_phrases`, not `words`." This keeps
the existing unique constraint, RLS policies, and `complete_review_test_session`
RPC untouched — no `CHECK` constraint or policy rewrite needed.

`prompt_templates.prompt_type` CHECK constraint gains one value:

```sql
alter table prompt_templates drop constraint prompt_templates_prompt_type_check;
alter table prompt_templates add constraint prompt_templates_prompt_type_check
  check (prompt_type in ('full','phrase','example','phrase_details','meaning_details','vocab_phrase'));
```

Plus one seed `Default` row for `'vocab_phrase'`, following the exact pattern
of the five existing seed rows in `20260309000000_prompt_templates.sql`.

**RLS** for both new tables mirrors the existing `words`/`word_lesson_tags`
pattern exactly (`current_family_id()`, `current_jwt_role() = 'parent'` for
writes, family-scoped read) — no new policy shape, same helpers.

### Content Admin UI (`src/app/words/admin/`)

- New top-level filter toggle: **Characters | Phrases**. Swaps the whole
  table body; existing character table/filters/pagination are untouched
  when "Characters" is active.
- Phrase view: flat table, one row per `vocab_phrases` row (no
  character → meaning → phrase/example nesting, since there's nothing to
  nest at the phrase level — though each row can expand to show multiple
  examples). Columns: Phrase, Pinyin, English Definition, Examples (each
  with its own pinyin + fill-test-eligible toggle + delete), row actions
  (Generate/Regenerate via AI, Add Example, Edit, Delete).
- Inline "+ New Phrase" row at the top of the phrase table (parent types
  the Chinese phrase, submits, gets a bare row with empty pinyin/definition/
  example — same shape as today's "pending" character-content rows before
  they're filled in or generated; confirmed a parent can save the bare
  phrase and generate/fill in content later, not required upfront). Subject
  to the 2–10 character length check below.
- Row/batch "Generate" action calls a new API route (see below) instead of
  `/api/flashcard/generate`.
- Tag assignment reuses the existing tag-picker component pointed at
  `vocab_phrase_lesson_tags` instead of `word_lesson_tags`.
- Selection + "Add to Review Test Session" reuses the **existing** toolbar
  button and session-naming form as-is. `adminTargets`/`AdminTarget` (the
  data feeding that selection) becomes a union of a character-target shape
  and a phrase-target shape; `createSelectedReviewTestSession` branches when
  building `ReviewTestSessionTargetDraft`s: character targets carry
  `character`/`pronunciation`, phrase targets carry `vocabPhraseId` (which
  the service layer maps into `character`/`pronunciation`/`vocab_phrase_id`
  on insert). A session can mix both kinds of targets.

### `/words/add` — batch phrase entry

New section on the existing add page, parallel to the current single-hanzi
character textarea:

- Parent pastes/types a comma-separated list, e.g. `你好, 谢谢, 对不起`.
- New pure parser `parseCommaSeparatedPhrases(input: string): string[]` —
  splits on `,`/`，` (support the full-width comma too), trims each entry,
  drops empties, dedupes preserving order. Deliberately not `extractUniqueHanzi`
  (which explodes text into individual Han characters) — a phrase must stay
  intact as one multi-character unit.
- New pure diff helper `computePhraseIngestionResult(parsedPhrases,
  existingPhrases)`, structurally the same shape as the existing
  `computeIngestionResult` in `src/app/words/add/addIngestion.ts`, but keyed
  on whole-phrase-string equality rather than single-character membership.
  Existing-lookup via new `getExistingVocabPhrasesByText(phrases: string[])`
  (mirrors `getExistingWordsByHanzi`).
- On submit: new phrases are bulk-inserted (`addVocabPhrases`, upsert with
  `ignoreDuplicates: true` on `(family_id, phrase)`, mirroring `addWords`).
- The **same tag-cascade section already on `/words/add`**
  (Textbook → Grade → Unit → Lesson) is reused, applied to the newly-inserted
  phrase batch via `assignVocabPhraseLessonTags(newPhraseIds, lessonTagId)`
  — one tag-assignment call per submission, same as today's character flow.
- Already-added phrases in the pasted list are reported back the same way
  duplicate characters are today (notice, not an error) — no re-insert, no
  re-tag unless the parent explicitly re-submits just for tagging.
- Entries outside the 2–10 character length check are rejected client-side
  before submission (with the DB constraint as backstop) and reported back
  as skipped, same tone as the duplicate-phrase notice — not a hard error
  that blocks the rest of the batch.

### AI generation

New route `src/app/api/vocab-phrase/generate/route.ts`, mirroring
`src/app/api/flashcard/generate/route.ts`'s structure (same DeepSeek call,
same normalization/safety-filtering step before persisting, per
`AI_CONTRACT.md §1`):

- Request: `{ phrase: string }`.
- Prompt: active `prompt_type = 'vocab_phrase'` slot (via
  `getActivePromptBody`), falling back to a new hardcoded
  `VOCAB_PHRASE_SYSTEM_PROMPT` constant + format suffix, exactly like the
  five existing hardcoded fallbacks.
- Response: `{ pinyin, meaning_en, example, example_pinyin }`.
- Prompts admin page (`src/app/words/prompts/PromptsSection.tsx`) gains a
  sixth tab, `'vocab_phrase'`, using the same tabbed slot-management UI
  already built for the other five types.

### Quiz round construction and grading (corrected 2026-07-26)

**No per-phrase "mini fill-test" step — corrected during implementation,
2026-07-26.** The original draft of this section described a
`buildFillTestFromVocabPhrase` mirroring how a character's OWN phrases get
pre-built into a small multi-sentence `FillTest` before bundling
(`buildFillTestFromSavedContent`). That doesn't actually work for a phrase:
a character has 1-3+ *different* phrases to draw from for its own mini
round, each with a different correct answer, but a single vocab phrase's
multiple examples all share the *same* answer (the phrase itself) — you
cannot build a multi-option drag-and-match bank out of one phrase's own
content alone. This has no effect on anything already approved (a phrase
blank was always going to draw its distractors from other phrases bundled
into the same round); it only removes a nonexistent intermediate step from
the design.

**Standalone phrase-only round builder — the existing character bundler is
never touched.** A new `buildFillTestPlanForVocabPhrases(phrases:
VocabPhrase[])` in `words.shared.utils.tsx`. Unlike the character path,
there is no low/standard-content split to reconcile: every phrase
contributes exactly **one** row per round (one randomly-chosen
fill-test-eligible example, blanked), since only one example is ever shown
per presentation and a phrase can never supply its own distractor. Phrases
are simply chunked into groups of up to 3 (matching the existing "3 items
per round" convention already used by `buildFillTestFromSavedContent`'s own
`slice(0, 3)` — not a new number), each chunk becoming one round with a
shared phrase bank and each sentence tagged `vocabPhraseId`. A phrase with
zero fill-test-eligible examples is skipped and reported back rather than
silently dropped. `createBundledQuizWord`/`buildBundledFillTestPlan`/
`rowsFromTestableWord` (the character path) are not modified — this spec
adds a sibling function, not a shared generic one, per the resolved
"phrases always form their own round" gate. A packaged session containing
both characters and phrases therefore produces a sequence of rounds, some
character-only (existing code path, untouched) and some phrase-only (new
code path).

**`src/lib/fillTest.ts` gains additive, non-breaking support for the new tag:**
- `FillSentence` gains `vocabPhraseId?: string`, a sibling to the existing
  `characterId?: string`.
- New `FillTestVocabPhraseMember: { vocabPhraseId: string; phrase: string;
  phraseCount: number }`, and `FillTest.vocabPhraseMembers?:
  FillTestVocabPhraseMember[]` (parallel to `members`/`FillTestMember`,
  which stay character-only).
- `gradeFillTest`'s `sentenceResults` propagate `vocabPhraseId` the same way
  they already conditionally propagate `characterId`.
- `gradeBundledFillTest` gains `vocabPhraseMemberResults:
  BundledFillTestVocabPhraseMemberResult[]`, computed by filtering
  `sentenceResults` on `vocabPhraseId` the same way `memberResults` already
  filters on `characterId`.
- None of this changes `tierFromCorrectRate`, `calculateNextState`, or any
  existing character-only field/behavior — every existing character quiz
  path is untouched.

**Grading:** a phrase-only round is graded through the exact same
`gradeBundledFillTest` call every quiz round already goes through. For each
entry in the resulting `vocabPhraseMemberResults`, `gradeVocabPhrase(id,
gradeOrResult, now)` in `supabase-service.ts` — much simpler than `gradeWord`
since there's no SRS state on the phrase row — reads the row, increments
`test_count`, writes back. No `calculateNextState` call on the phrase row —
consistent with "packaged-only, no auto SRS" scope for `vocab_phrases`. A
phrase round with one phrase has one blank, so its tier is binary —
`tierFromCorrectRate(1,1)` (correct, drag landed on the right blank) or
`(0,1)` (wrong) — through the exact same tiering function every character
blank already uses, not a new grading concept.

**On a correct phrase answer only, nudge the familiarity of the phrase's own
component characters that already exist as standalone `words`:**

1. Extract unique Hanzi from the phrase text via the existing
   `extractUniqueHanzi` (already dedupes, so a doubled character like 谢 in
   谢谢 is only nudged once).
2. For each character, look up a matching `words` row for the family. Any
   character the parent never added standalone is skipped — nothing to
   nudge.
3. For each match, call the existing, **unmodified**
   `calculateNextState(word, "good", now)` from `src/lib/scheduler.ts` — the
   same function every direct character grade already goes through, with
   `"good"` (a moderate nudge, not full-strength `"easy"`) since recognizing
   a character inside an already-familiar phrase is weaker evidence than a
   direct cold-recall test of that character alone.
4. Persist via a new `nudgeWordFamiliarity(wordId, now)` in
   `supabase-service.ts` — a sibling to `gradeWord` that writes the
   `calculateNextState` result and increments `reviewCount`, but
   deliberately **does not** increment `testCount` (reserved for direct
   standalone tests of that character, not incidental exposure via a
   phrase).

**On a wrong phrase answer, no character's SRS state is touched at all** —
a phrase failure may reflect ordering/context confusion rather than
unfamiliarity with either character, so it must never delay or penalize a
character that's otherwise well-known.

Because this reuses `calculateNextState` and `tierFromCorrectRate` exactly
as they exist today (new caller, same logic, same grade vocabulary), it is
**not** a change to the scheduler's grading logic or due-date algorithm —
the `AI_CONTRACT.md §2` boundary on scheduler changes does not apply here.
It does still fall under the broader schema-migration boundary already
called out below, since `vocab_phrases`/`vocab_phrase_lesson_tags` are new
tables.

### Item I unblocked

Once this ships, item I's phrase-diff logic gets the same shape it already
has for characters: `getExistingVocabPhrasesByText(phrases: string[])`
(mirrors `getExistingWordsByHanzi`) plus a unique `(family_id, phrase)`
constraint to check against.

## Layer impact

| Layer | Touched | Notes |
|---|---|---|
| UI | Yes | `src/app/words/admin/AdminSection.tsx` (adds the Characters/Phrases toggle only — a couple of lines; delegates to the new component below rather than extending `AdminTarget`, see "Deviations"), new standalone `src/app/words/admin/VocabPhraseAdminSection.tsx` (full phrase table + R/S/C/D/E edit state + selection/tag/package UI), new `src/app/words/add/AddVocabPhraseSection.tsx` (mounted from `AddSection.tsx`), new `src/app/words/shared/TagCascadePicker.tsx` (shared by both), `src/app/words/prompts/PromptsSection.tsx` (new tab — free, page is generic over `PromptType`), `src/app/words/words.strings.ts` |
| Domain | Yes | `src/lib/fillTest.ts` (additive `vocabPhraseId`/`vocabPhraseMembers`/`vocabPhraseMemberResults`), `src/app/words/shared/words.shared.utils.tsx` (new `buildFillTestPlanForVocabPhrases` — standalone, existing character bundler untouched), `src/app/words/review/fill-test/fillTest.types.ts` (new `TestableVocabPhrase`), `src/app/words/add/addIngestion.ts` (new `computePhraseIngestionResult`), quiz-plan building / grading / familiarity-nudge branch in `src/app/words/shared/words.shared.state.ts`, `src/app/words/review/reviewSession.utils.ts` |
| Service | Yes | `src/lib/supabase-service.ts` — new `getExistingVocabPhrasesByText`, `addVocabPhrase`, `addVocabPhrases`, `updateVocabPhrase`, `deleteVocabPhrase`, `assignVocabPhraseLessonTags`, `gradeVocabPhrase`, `nudgeWordFamiliarity`; `ReviewTestSessionTargetDraft` gains optional `vocabPhraseId` |
| AI | Yes | New `src/app/api/vocab-phrase/generate/route.ts`; new `prompt_type` value |

Three new/altered tables (`vocab_phrases`, `vocab_phrase_lesson_tags`,
`review_test_session_targets` column add) and one CHECK-constraint change on
`prompt_templates` → schema migration, `AI_CONTRACT.md §2` stop-and-confirm
boundary. **Authorized 2026-07-26.** Migrations written (see
`supabase/migrations/20260726000000_vocab_phrases.sql`,
`20260726000001_review_test_session_targets_vocab_phrase.sql`,
`20260726000002_prompt_templates_vocab_phrase.sql`,
`20260726000003_vocab_phrases_meaning_zh.sql` — the last one added during
manual QA, see below); `scripts/verify-rls.ts` extended with Section 6 for
the new tables.

### Manual-QA log (2026-07-26, post-build)

The parent started manual QA against the live Content Admin phrase view and
sent feedback in rounds. Each round below was implemented and re-verified
(tests/typecheck/lint) before moving to the next.

**Round 1 — content model + generation quality:**
- `vocab_phrases` gained a `meaning_zh` column (schema change, separately
  authorized; migration `20260726000003`) — Content Admin's Definition
  column now shows the Chinese definition first, English second, instead of
  English-only. `VocabPhrase.meaningZh`, `updateVocabPhrase`, the generate
  route's response shape, and its default prompt were all updated to match.
- The generate route now takes `existing_examples` and both prompts the
  model to avoid repeating one and rejects/retries an exact-duplicate
  response — mirrors the character route's existing dedupe behavior, which
  the phrase route didn't have at first.

**Round 2 — pinyin display:**
- The phrase Pinyin column was removed; pinyin now renders as a ruby
  annotation directly above the phrase/example characters via the existing
  `renderPhraseWithPinyin`/`renderSentenceWithPinyin` helpers, matching the
  character view exactly (both the Phrase column and each example).

**Round 3 — full per-row editing UI, matching the Character view (biggest
round; this is what the parent then manually verified):**

The Character view's per-row action buttons (`R`/`S`/`C`/`D`/`E`, "Test
On"/"Test Off") did not exist at all for phrases — only a single ambiguous
"Generate"/"Add Example" button did. Rebuilt to match column-by-column,
confirmed with the parent before implementing:

| Column | Buttons | Confirmed semantics |
|---|---|---|
| **Phrase** | R, S, C, D | **R**: full regenerate — pinyin + both definitions + exactly 1 example; if more than 1 example was already saved, *all* are wiped first, replaced by the single new one. **S**: persistent, row-level — commits whichever edit (Definition or an Example) is currently open for that row; disabled otherwise. **C**: clears *everything* — pinyin, both definitions, and all examples — back to a bare phrase (confirm dialog). **D**: delete the phrase (confirm dialog). |
| **Definition** | R, E → (S, Cancel while editing) | **R**: reloads *only* `meaning_zh`/`meaning_en` — never touches pinyin or examples. **E**: both fields become text inputs. Save commits via the same `S` as the Phrase column, or the contextual `S` shown inline next to the inputs. |
| **Examples** (per sentence) | R, E, D, + Example → (S, Cancel while editing) | **R**: regenerates *that one* example's Chinese + pinyin in place (never appended, never touches other examples or phrase-level fields). **E**: only the Chinese text becomes editable — pinyin is read-only; on save, a **new narrow AI mode** (`mode: "example_pinyin"` on the generate route) fills in pinyin for the edited sentence. **D**: delete that example. **+ Example**: admin types a brand-new Chinese sentence by hand; same pinyin-only AI mode fills in its pinyin on save. `Test On`/`Test Off` reuses the exact shared string constants the Character view uses (`str.admin.table.actionButtons.fillTestOn/Off`), not phrase-specific copy. |

New capability this required: `/api/vocab-phrase/generate` gained a second
mode (`mode: "example_pinyin"`) — generic sentence-in/pinyin-out, mirroring
the character route's own `EXAMPLE_PINYIN_SYSTEM_PROMPT` exactly (no phrase
context needed for pure pinyin generation). All edit state (which field is
being edited, draft values) lives in local component state in
`VocabPhraseAdminSection.tsx` — one edit target active at a time, tracked
per-phrase-row.

**Parent's verdict after Round 3: "verified."** This covers the Content
Admin phrase-management UI specifically — see "What's built but NOT yet
manually verified" above for what that verification does *not* yet cover
(quiz-taking, packaging, `/words/add`, live RLS).

## Design gates already resolved (2026-07-26)

- No auto-SRS for phrases — packaged-only.
- A phrase blank is one drag-and-match answer (right/wrong), using the
  app's existing quiz mechanic — not free-text typing (corrected 2026-07-26).
- Phrases always form their own quiz round(s); the existing character
  bundler is never touched (resolved 2026-07-26).
- New `vocab_phrase_lesson_tags` join table (not a polymorphic column on
  `word_lesson_tags`).
- Packaging reuses the existing Content Admin "Add to Review Test Session"
  flow — no new packaging UI.
- `vocab_phrases` supports multiple example sentences per phrase (`examples`
  jsonb array), each independently fill-test-eligible.
- `/words/add` gets a comma-separated batch-phrase entry mode with batch tag
  assignment, reusing the existing tag-cascade section on that page.
- Correct phrase answers nudge the SRS familiarity of the phrase's own
  component characters (if already added standalone) via the existing,
  unmodified `calculateNextState`/`"good"` grade — incorrect answers touch
  no character state. `testCount` is not incremented by this nudge.
- Naming: internal `vocab_phrase`/`vocab_phrases` confirmed, with UI copy
  staying "Phrase."
- A parent can save a bare phrase (Chinese text only, nothing generated yet)
  from the inline "+ New Phrase" row, then generate/fill in content later —
  AI generation is not required upfront.
- Phrase text length: 2–10 Chinese characters, DB-enforced, applies
  uniformly to Content Admin's inline add and `/words/add`'s batch entry.
- Examples per phrase: capped at 20, DB-enforced.

## Open questions

None outstanding — the four items above were resolved in conversation on
2026-07-26, alongside the earlier round of design gates.

## Risks

- New table/RLS surface — `verify-rls.ts` must be extended to cover
  `vocab_phrases` and `vocab_phrase_lesson_tags` before this ships.
- `review_test_session_targets` is read by existing quiz-runtime code paths;
  adding a nullable column is additive and safe, but every place that
  constructs a `ReviewTestSessionTargetDraft` today must be checked to
  ensure it still compiles/inserts correctly with the new optional field.
- No wallet/coin impact — grading a phrase increments `test_count` only, no
  coin RPC involved by default; confirm with you whether completing a
  phrase quiz should earn coins the same way character fill-tests do (not
  specified in your request — flagging, not deciding).
- The familiarity nudge writes to `words` rows outside the normal
  gradeWord/fill-test call site. Unit-tested (`nudgeWordFamiliarity` in
  `supabase-service.vocabPhrases.test.ts`: fires with a "good" grade,
  updates ease/repetitions/reviewCount, leaves testCount untouched, no-ops
  when the character doesn't exist standalone) — still **not manually
  verified end-to-end** through an actual quiz answer; see "Handoff"
  item 3.
- Batch-adding phrases from `/words/add` writes many `vocab_phrases` rows
  plus one tag-assignment call per submission — same shape/risk profile as
  the existing character batch-add, no new risk class.

## Test plan

- `src/lib/supabase-service.vocabPhrases.test.ts`: CRUD, multi-example
  add/remove, tag assignment, `gradeVocabPhrase` (test_count increments,
  no scheduler fields touched), `nudgeWordFamiliarity` (correct grade
  path updates ease/repetitions/nextReviewAt and reviewCount but not
  testCount), RLS boundaries mocked and asserted.
- Domain: `parseCommaSeparatedPhrases` (splitting, trimming, dedupe, empty
  filtering, full-width comma); `computePhraseIngestionResult` (new vs.
  already-added); quiz-plan-building branch for phrase targets vs.
  character targets, including random example selection among
  fill-test-eligible examples; whole-phrase answer comparison/grading
  logic; the familiarity-nudge trigger — asserted to fire only on a
  correct answer, only for characters that already exist as standalone
  words, and never on an incorrect answer.
- UI: Content Admin Characters/Phrases toggle renders the right table
  (including multiple examples per phrase row); inline add-phrase row; AI
  generate/regenerate/add-example for a phrase; tag picker against
  `vocab_phrase_lesson_tags`; mixed character+phrase selection produces a
  session with both target kinds. `/words/add` batch-phrase section:
  parses a comma-separated list, shows already-added vs. new, submits with
  a tag selection applied to the whole new batch.
- `verify-rls.ts` extended and passing for both new tables.
- Full existing suite re-run to confirm no regressions in character-only
  paths (`words`, `flashcard_contents`, `review_test_session_targets`,
  `gradeWord`).

## Acceptance criteria

- [x] Parent can filter Content Admin to a Phrases-only view, distinct from
      the Characters view. Verified live 2026-07-26.
- [x] Parent can add a new phrase (Chinese text) directly from that view.
      Verified live 2026-07-26 (Content Admin side only — the `/words/add`
      batch-comma-separated half is built but **not yet manually tested**).
- [x] Parent can use AI to generate pinyin, Chinese + English definitions,
      and an example sentence for a phrase, using the existing Prompts-page
      mechanism, and can add further example sentences (AI-generated or
      hand-typed with AI-filled pinyin) to the same phrase. Verified live
      2026-07-26, including the full R/S/C/D/E per-column edit affordances
      added during QA — see "Manual-QA log."
- [x] Parent can tag a phrase with the existing curriculum taxonomy.
      Verified live 2026-07-26.
- [ ] Parent can select one or more phrases and add them to a review test
      session via the packaging flow, optionally mixed with character
      selections in the same session. **Not yet manually tested** —
      next up, see "Handoff — Current State."
- [ ] A packaged phrase is quizzed via the app's existing drag-and-match
      mechanic, in its own round (never mixed with character blanks in the
      same round), one of its eligible examples chosen for that
      presentation. **Not yet manually tested** — highest-priority item to
      verify next.
- [ ] A correct phrase answer nudges the SRS state (moderate "good"-strength)
      of the phrase's own component characters that already exist as
      standalone words, without incrementing their `testCount`; a wrong
      phrase answer touches no character's state. **Not yet manually
      tested** — requires taking a quiz first (see above).
- [x] A phrase shorter than 2 or longer than 10 characters is rejected (both
      at the Content Admin inline-add row and DB-enforced for the
      `/words/add` batch path); a phrase cannot accumulate more than 20
      examples. Content Admin side verified live 2026-07-26.
- [ ] `verify-rls.ts` passes with both new tables covered. **Not run** —
      needs a live Supabase project + service role key, unavailable in the
      build environment.

## Build status

**Authorized and built 2026-07-26.** All layers implemented; 483 tests
passing (up from 447 at authorization), `tsc --noEmit` clean, zero
regressions to any existing character-only test or code path. Not yet
verified against a live Supabase project or in a browser — see
"Verification" below.

While implementing, two real ambiguities surfaced that weren't visible from
the spec alone and required pausing for input before proceeding, both
resolved 2026-07-26 and folded back into this spec:
1. The original "child types the whole phrase" grading design didn't fit
   the app at all — there is no free-text Chinese input anywhere. Corrected
   to the existing drag-and-match mechanic.
2. Whether phrase and character blanks could share a quiz round. Resolved:
   never — phrases always get their own round, so the existing
   character-bundling code is never touched.

A third, smaller correction (not an ambiguity — an implementation detail
that turned out not to work when actually coded) is noted inline under
"Quiz round construction and grading" above: there is no per-phrase "mini
fill-test" step, since one phrase's own examples all share the same answer
and can't supply their own drag-and-match distractors.

### What shipped

- **Schema**: `supabase/migrations/20260726000000_vocab_phrases.sql`,
  `20260726000001_review_test_session_targets_vocab_phrase.sql`,
  `20260726000002_prompt_templates_vocab_phrase.sql`. `scripts/verify-rls.ts`
  Section 6 covers both new tables (needs a live project + service-role key
  to actually run — not runnable in the environment this was built in).
- **Domain/service**: `src/lib/fillTest.ts` (additive), `src/lib/types.ts`
  (`VocabPhrase`/`VocabPhraseExample`), `src/lib/supabase-service.ts` (full
  CRUD, tagging, `gradeVocabPhrase`, `nudgeWordFamiliarity`,
  `listVocabPhrases`), `src/app/words/shared/words.shared.utils.tsx`
  (`buildFillTestPlanForVocabPhrases`, the `wrapVocabPhraseRoundAsQuizWord`
  queue-compatibility wrapper, phrase-aware `revalidateSavedQuizQueue`),
  `src/app/words/add/addIngestion.ts` (`parseCommaSeparatedPhrases`,
  `computePhraseIngestionResult`, `isValidPhraseLength`).
- **Runtime wiring**: packaged-session quiz start now builds phrase rounds
  alongside character rounds (never mixed, per the resolved gate); grading
  dispatch branches on `vocabPhraseMemberResults` and applies the
  familiarity nudge; pause/resume revalidates phrase rounds against current
  `vocab_phrases`; `FillTestReviewSection.tsx` renders phrase-round results
  and progress counts (small additive fixes found by reading the actual
  quiz-runtime code, not anticipated by the original spec text).
- **AI generation**: `src/app/api/vocab-phrase/generate/route.ts` — two
  modes: default one-shot full generate (pinyin + both definitions + one
  example, with `existing_examples` passed to avoid duplicates), and
  `mode: "example_pinyin"` (generic pinyin-for-a-given-sentence, added
  during manual QA for the manual "+ Example"/example-edit flow). The
  Prompts admin page's new "Vocab Phrase" tab came for free since that page
  is already generic over `PromptType`.
- **UI**: `src/app/words/admin/VocabPhraseAdminSection.tsx` (Content Admin
  phrase view — search, inline add, per-row R/S/C/D/E editing for
  Phrase/Definition/Examples columns, per-example fill-test toggle, tag
  assignment, packaging), `src/app/words/add/AddVocabPhraseSection.tsx`
  (batch comma-separated entry + batch tagging on `/words/add`),
  `src/app/words/shared/TagCascadePicker.tsx` (new shared
  Textbook→Grade→Unit→Lesson picker used by both). See "Manual-QA log"
  above for the exact, parent-confirmed button semantics — that log is more
  current than the original bullet list under "Content Admin UI" further
  below in this doc.

### Deviations from the original spec's exact wording (behavior-equivalent)

- **Packaging UI is a new, standalone selection/toolbar**, not literally the
  same `AdminSection.tsx` toolbar component instance the spec described
  reusing. `AdminSection.tsx`'s existing `adminTargets`/
  `adminSelectedTargetKeys` state is deeply character-specific; unifying it
  into a character-or-phrase union was a much larger, riskier change than
  building a parallel phrase-only selection+packaging flow that calls the
  same underlying `createReviewTestSession`/`appendTargetsToReviewTestSession`
  service functions. Net effect for the parent — select phrases, package
  into a session, optionally alongside characters — is the same.
- **The tag-cascade picker is a new shared component**
  (`TagCascadePicker.tsx`), not literally the same `addTagSectionOpen`-family
  vm state `/words/add`'s character form uses — that state is scoped to one
  form and would cross-wire the character and phrase forms if shared as-is.
  Same Textbook→Grade→Unit→Lesson concept and services underneath
  (`createLessonTagIfNew`, etc.).

### Known gaps (flagged, not silently shipped)

- A phrase with zero fill-test-eligible examples is silently excluded from
  a fresh packaged-session round, unlike characters, which get an explicit
  "skipped" notice (`str.fillTest.notices.skippedBundledCharacters`). No
  phrase equivalent was added.
- Content Admin's phrase table still doesn't display a phrase's
  currently-assigned tags as a column (assignment still works, and — as of
  2026-08-08 — the tag data is now read back via
  `getVocabPhraseLessonTagsForFamily()` to power the new filter bar below,
  but there's no per-row Lessons-pill column yet, unlike the character
  table).
- Whether completing a phrase round should earn coins the same way character
  fill-tests do was never specified and was not implemented — grading a
  phrase touches no wallet/coin state.

### 2026-08-08 follow-up: filter bar + inline-add removal

- **Content Admin's Phrases view now has a default filter bar** matching the
  Characters view's: Phrase Search, Tags (Cascade, multi-select OR logic),
  and Filter by Tag Part (Textbook → Grade → Unit → Lesson cascade, AND
  logic within a phrase's tags, combined with the Tags filter via AND) — see
  `str.admin.filters.*` (reused, not duplicated) and the new
  `phraseStr.filters.phraseSearchLabel` string. Backed by a new
  `getVocabPhraseLessonTagsForFamily()` in `supabase-service.ts` (mirrors
  `getWordLessonTagsForFamily`) and two new pure helpers,
  `hasActivePartialTagFilter`/`matchesPartialTagFilter`, extracted into the
  shared `tagFilter.utils.ts` (previously this AND-logic was only inlined in
  `AdminSection.tsx`).
  - **No "Due Now" filter for phrases** — `vocab_phrases` intentionally has
    no SRS/due-date state (see "Scope" above), so the concept doesn't apply.
    Confirmed with the parent 2026-08-08: dropped rather than reinterpreted.
- **The inline "+ New Phrase" add row on Content Admin was removed.**
  Phrase creation is now exclusively via `/words/add`'s batch
  comma-separated entry (`AddVocabPhraseSection.tsx`), matching how
  character creation already only happens on `/words/add`, not on Content
  Admin. The single-phrase `addVocabPhrase()` service function is unchanged
  and still covered by its own unit test — only the Content Admin UI path
  to it was removed.
- **The Phrases view also gained the same selection/batch-action toolbar
  the Characters view has**: a "No filters applied | Selected N" summary
  line, Select filtered / Clear selection, a batch AI Content Generation
  menu (missing only / all / filtered / selected, reusing the existing
  per-row one-shot `requestVocabPhraseGeneration` call at concurrency 3),
  Add to test session, and a batch Include-in-test-bank toggle. Two pieces
  don't map 1:1 onto phrases and were resolved with the parent 2026-08-08
  rather than silently faked:
  - **Batch "Pinyin Generation" is new, phrase-specific behavior**, not a
    port of the character version. Characters refresh already-saved
    phrase/example pinyin; a `vocab_phrase`'s pinyin is generated together
    with both definitions + one example in a single call, so there was no
    batch-pinyin-only precedent. Built as a new batch loop over the
    existing narrow `mode: "example_pinyin"` AI call
    (`requestExamplePinyin`), touching only `examples[].pinyin` — phrase-level
    pinyin and both definitions are never touched by this button. New pure
    helpers `resolveBatchPhraseTargets`/`resolveExamplePinyinRefreshIndices`/
    `vocabPhraseHasContent`/`vocabPhraseMissingExamplePinyin` in the new
    `src/app/words/admin/vocabPhraseAdmin.utils.ts` (tested).
  - **Batch "Include in test bank" toggles `includeInFillTest` on every
    example of every selected phrase** (all-or-nothing, mirroring the
    character button's feel), since the flag lives per-example rather than
    per-phrase for `vocab_phrases`.
  - **No "Select page" button** — the Phrases view has no pagination, so a
    page-scoped selection button would be identical to "Select filtered";
    only "Select filtered (N)" and "Clear selection" were added.
- **The Phrases table now uses the exact same border/frame styling as the
  Characters table**: the table wrapper gained `rounded-md border` (it
  previously had none — `overflow-x-auto` only) and the header row gained
  `bg-gray-50` to match. Body rows already used the identical `border-b
  align-top` styling on both views, so this was purely the outer
  wrapper/header fix, not a rebuild.

### 2026-08-08 follow-up: batch phrase entry accepts spaces/line breaks

- `/words/add`'s phrase batch textarea (`AddVocabPhraseSection.tsx`) parsed
  only comma-separated input, unlike the character batch textarea directly
  above it, which already accepts commas, spaces, or line breaks (see
  `Ingestion Rules` in `0_ARCHITECTURE.md` and `str.add.pageDescription`).
  `parseCommaSeparatedPhrases` (`src/app/words/add/addIngestion.ts`) now
  splits on the same delimiter set — ASCII/full-width comma, whitespace,
  and line breaks — collapsing consecutive/mixed delimiters into one split
  point. Function name kept as-is (still the file's public export used by
  the UI and its tests); only the split regex and its docstring changed.
  Bilingual copy (`str.add.vocabPhrases.pageDescription`/`inputPlaceholder`)
  updated to describe the same batch-input tolerance the character section
  already advertises. No schema, route, or RLS surface touched.

### 2026-08-08 follow-up: batch phrase tag setup moves before the submit button

- `/words/add`'s phrase batch tag section previously only appeared *after* a
  successful submit (a "为刚添加的短语分配标签" link revealed once phrases had
  already been created, immediately assigning the picked tag to that batch
  via its own Assign button). This didn't match the character form directly
  above it, where the "Add tags" section is expanded *before* submitting and
  the tag is created/applied together with the word batch on submit.
  `AddVocabPhraseSection.tsx` now places the same pre-submit tag section
  above its submit button; the selected tag is resolved (`createLessonTagIfNew`)
  and applied (`assignVocabPhraseLessonTags`) on submit to both newly-created
  phrases and already-existing phrases in the same submitted batch — mirroring
  `0_ARCHITECTURE.md`'s character Ingestion Rule #11 exactly. An incomplete
  tag selection (section open, not all 4 levels picked) blocks submission
  with the same `tagStr.partialTagError` the character form already uses,
  via the shared `isTagFormComplete` helper.
- `TagCascadePicker.tsx` (shared by this flow and Content Admin's phrase
  tagging) gained a `mode` prop: `"immediate"` (default, unchanged — its own
  Assign button resolves/creates the tag right away) for Content Admin's
  existing usage, and a new `"controlled"` mode (no internal button; reports
  the live in-progress selection via `onSelectionChange`) for this deferred,
  submit-time flow. Content Admin's usage is untouched and still compiles/
  passes under the new prop shape.
- The post-submit tag link and its `tagAssignSuccess` notice were removed;
  `tagAssignError` was kept and repurposed for the (rare) case where phrases
  save successfully but the subsequent tag-assignment call fails.

### 2026-08-08 fix: phrase tag Grade/Unit/Lesson now support adding new values

- The Grade/Unit/Lesson fields in `TagCascadePicker.tsx` (shared by
  `/words/add`'s phrase batch tag section and Content Admin's phrase
  tagging) were `<input list>`/`<datalist>` combo boxes with no discoverable
  way to add a value that wasn't already in the cascade — unlike the
  character tag section's `<select>` + `"+ Enter custom value"` pattern.
  Replaced with the exact same `<select>` + create-mode pattern the
  character form uses. See `docs/fix-log/build-fix-log-2026-08-08-phrase-tag-custom-value-entry.md`
  for the full root cause and change list.

### Verification

- `npx vitest run`: 544/544 passing (up from 540 — 4 new
  `parseCommaSeparatedPhrases` delimiter tests for the 2026-08-08
  space/line-break follow-up above; the tag-section relocation reused
  existing tested helpers, `isTagFormComplete` and `computePhraseIngestionResult`,
  rather than adding new pure-function surface). `npx tsc --noEmit`: clean.
  `npx eslint` on every new/touched file (including Content Admin's
  `VocabPhraseAdminSection.tsx`, to confirm its existing `TagCascadePicker`
  usage is unaffected): zero new errors or warnings. `npm run check:encoding`:
  clean.
- **Not run**: `scripts/verify-rls.ts` (needs a live Supabase project +
  service role key), and no live browser walkthrough of the actual
  drag-and-match phrase quiz, Content Admin phrase view, or `/words/add`
  batch flow. Recommend running the dev server and clicking through: add a
  phrase → generate content → tag it → package it into a session → take the
  quiz as a child profile → confirm grading and the familiarity nudge on a
  standalone character sharing a Hanzi with that phrase — before this
  reaches real families.
