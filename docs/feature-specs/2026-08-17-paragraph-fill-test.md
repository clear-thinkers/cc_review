# Feature Spec — 2026-08-17 — Paragraph Library & Paragraph Fill-Test (Tier 1, Item I, Phase 2 — Tier 2 scope, authorized exception)

## Status

Depends on Phase 1 (`docs/feature-specs/2026-08-17-add-paragraph-article-import.md`) — `paragraphs` table, `/words/add-paragraph` import flow, and `ParagraphSpanSelector.tsx` must exist first.

**Scope-boundary note, not open for re-litigation:** this feature is Tier 2 scope ("Structured Text Context: Phrase/paragraph fill tasks" per `0_PRODUCT_ROADMAP.md §3`), which the roadmap marks blocked until all Tier 1 gates close. As of this spec's date, one Tier 1 gate (item A, mobile quiz results layout) is still open. The user explicitly authorized building this now as a deliberate exception during the 2026-08-17 planning session for this feature. Do not re-raise this as a blocker during implementation — it was surfaced and consciously overridden once already.

## Problem

Phase 1 lets a parent import an article and persist it as fill-test source material, but nothing yet uses that material — a saved paragraph is inert. There's no way to view previously-imported paragraphs, choose which triaged spans should become quiz blanks, or package a paragraph into a runnable fill test. Without this, the "paragraph becomes fill-test material" half of the feature request is unmet, and item I is only half-delivered.

## Scope

- New route `/words/paragraphs`, parent/platform-admin only.
- A library/management view listing saved `paragraphs` rows (title/preview, created date, span/blank counts).
- A per-paragraph detail view (`ParagraphDetailView.tsx`) where the parent selects which triaged spans (previously marked `fillTestEligible` during Phase 1 import, or toggled here) should become quiz blanks, reusing `ParagraphSpanSelector.tsx` from Phase 1.
- Packaging the selection into a **paragraph fill test** — a `review_test_sessions` row whose targets are paragraph blanks — reusing the exact existing "select targets → package into a named session" flow already used for characters and vocab phrases (`createReviewTestSession`/`appendTargetsToReviewTestSession`), not a new packaging mechanism.
- Full runtime integration: a packaged paragraph fill test plays through the app's existing drag-and-match quiz UI, autosave/resume, grading, and results reporting — **no new quiz UI or mechanic**. This is possible because the codebase already has a proven pattern for adding a new fill-test "round kind" without touching the quiz UI: `wrapVocabPhraseRoundAsQuizWord` (`src/app/words/shared/words.shared.utils.tsx:1023`) wraps an already-built `FillTest` as a fake `TestableWord` so it travels through the same `quizQueue: TestableWord[]` every round uses. Paragraph rounds follow the identical pattern with their own id prefix.

## Out of scope

- Any change to the character-round or phrase-round code paths (`buildBundledFillTestPlan`, `buildFillTestPlanForVocabPhrases`) beyond the additive extensions described below (new optional fields, a new sibling branch) — existing quiz behavior for characters and phrases must be unaffected.
- A new quiz UI, new drag/drop mechanic, or new grading concept — a paragraph blank is graded through the exact same `gradeBundledFillTest` call every round already uses.
- Editing a paragraph's raw text after import (still out of scope here too — see Open Questions from the Phase 1 spec, carried forward).
- Cross-family or shared/global paragraph content — paragraphs remain strictly family-scoped, same as every other learning-content table.

## Proposed behavior

### Schema extension

Additive column on `review_test_session_targets`, following the exact precedent of `20260726000001_review_test_session_targets_vocab_phrase.sql` (the migration that added `vocab_phrase_id` for phrase targets):

```sql
alter table review_test_session_targets
  add column paragraph_id uuid references paragraphs(id) on delete cascade,
  add column paragraph_span_id text;
```

`character`/`pronunciation` (still `not null`) keep their denormalized-display role for a paragraph-blank target: `character` holds the span's own text (e.g. `图书馆`), `pronunciation` holds its resolved pinyin (from the matching `words`/`vocab_phrases` row, empty-string fallback if unresolved). `paragraph_id` is the discriminator — non-null means this target's blank sentence is reconstructed from the paragraph, not from `flashcard_contents`/`vocab_phrases.examples`.

**Unique-constraint change (needs explicit sign-off, not silently applied):** the table's existing constraint is `unique (session_id, character, pronunciation)`, and `normalizeReviewTestSessionDraftTargets` dedupes drafts client-side on the same `${character}|${pronunciation}` key. This is correct for characters/phrases (one row per unique hanzi/phrase) but wrong for paragraph blanks — the same word or phrase can legitimately appear twice in one paragraph as two different blanks with different sentence context. Resolution: extend the dedupe key to `` `${character}|${pronunciation}|${paragraphSpanId ?? ""}` `` and the DB constraint to `unique (session_id, character, pronunciation, paragraph_span_id)`. This is additive and safe — Postgres treats `NULL` as distinct-from-`NULL` in unique constraints, so existing character/phrase rows (always-null `paragraph_span_id`) are unaffected.

No new RPC — packaging reuses `createReviewTestSession`/`appendTargetsToReviewTestSession` exactly, with `ReviewTestSessionTargetDraft` extended to optionally carry `paragraphId`/`paragraphSpanId` alongside its existing optional `vocabPhraseId`.

### New domain module

`src/lib/paragraphRoundBuilding.ts` — analog of `buildFillTestPlanForVocabPhrases`. Unlike its phrase-round counterpart (which lives in `words.shared.utils.tsx` because it depends on `FlashcardLlmResponse`-shaped content types), this has no such dependency — it only needs `Paragraph`/`ParagraphSpan` pure domain types — so it belongs as a genuine `src/lib/*.ts` domain module without crossing the UI/domain boundary `0_ARCHITECTURE.md §2` describes.

```ts
export type ParagraphBlankCandidate = {
  paragraphId: string;
  spanId: string;
  sentenceText: string;   // pre-blank
  answerText: string;     // the span's own text
  wordId?: string;
  vocabPhraseId?: string;
};

export function buildFillTestPlanForParagraphBlanks(
  candidates: ParagraphBlankCandidate[],
  roundSize: number // reuse the VOCAB_PHRASE_ROUND_SIZE = 3 convention, passed in rather than re-declared
): { rounds: FillTest[]; skippedSpanIds: string[] };
```

Builds `FillSentence[]` the same way `createVocabPhraseQuizBundle` does: shuffles option text, blanks the sentence via the same regex-replace helper phrase rounds use, chunks candidates into rounds of `roundSize`. Distractor sourcing is same-paragraph-only (see Open Questions) — a paragraph with fewer than `roundSize` eligible blanks yields a smaller final round or, if fewer than 2, is skipped and reported via `skippedSpanIds` (mirrors `buildFillTestPlanForVocabPhrases`'s `skippedPhrases`).

### Route & components

New directory `src/app/words/paragraphs/`:
- `page.tsx`, `ParagraphLibraryPage.tsx` — mirror the `add/` route-shell pattern.
- `ParagraphLibrarySection.tsx` — mounted in `WordsWorkspace.tsx`, self-gates on `vm.page !== "paragraphs"`. Library table; visual baseline = `AdminSection.tsx` per `0_BUILD_CONVENTIONS.md §7`.
- `ParagraphDetailView.tsx` — single paragraph, renders sentences via `ParagraphSpanSelector.tsx` (Phase 1's component, reused as-is) in a blank-selection mode; selection + session-name form → `createReviewTestSession`/`appendTargetsToReviewTestSession`, matching Content Admin's existing packaging form exactly (session-name uniqueness, append-to-existing-by-exact-name-match behavior, all unchanged).
- `paragraphLibrary.strings.ts`, `paragraphLibrary.types.ts`, `paragraphLibrary.test.tsx`.

Same route-access/nav/mount wiring as Phase 1: `"paragraphs"` added to `WordsSectionPage`/`NavPage`, `canAccessRoute` parent-only case + `ProtectedRoute` entry, nav item, `<ParagraphLibrarySection vm={vm} />` mounted in `WordsWorkspace.tsx`.

New composed hook `src/app/words/shared/state/useParagraphLibraryState.ts` — loaded `Paragraph[]`, selected blanks-for-packaging, session-name form state.

### Runtime integration — the core of this phase

Exact dispatch site confirmed: `submitCurrentQuizWord` in `words.shared.state.ts` (~line 3959), which today branches on `result.memberResults` (→ `gradeWord`) vs. `result.vocabPhraseMemberResults` (→ `gradeVocabPhrase` + conditional `nudgeWordFamiliarity`), mutually exclusive per round per the existing comment at that call site.

1. Extend `FillSentence` (`src/lib/fillTest.ts`) with optional `paragraphSpanId?: string`, a sibling to the existing `characterId?`/`vocabPhraseId?`. Extend `FillTest` with `paragraphMembers?: FillTestParagraphMember[]` (`{ paragraphSpanId, answerText, wordId?, vocabPhraseId? }`), a sibling to `members?`/`vocabPhraseMembers?`.
2. Extend `gradeBundledFillTest` with a third derived `paragraphMemberResults` array, using the identical filter-and-aggregate pattern already used for the other two member kinds.
3. Add a third loop in `submitCurrentQuizWord` over `result.paragraphMemberResults`: on a correct blank, dispatch to `gradeWord(wordId, ...)` or `gradeVocabPhrase(vocabPhraseId)` depending on which id the span resolved to during Phase 1 triage (see Open Questions — whether this dispatch fires at all is a decision, not assumed).
4. `wrapParagraphRoundAsQuizWord`/`isParagraphRoundQuizWord` in `words.shared.utils.tsx`, id-prefixed `"paragraph-round:"` (sibling constant to `VOCAB_PHRASE_ROUND_ID_PREFIX`), mirroring `wrapVocabPhraseRoundAsQuizWord`/`isVocabPhraseRoundQuizWord` exactly — inert zeroed SRS fields, real `FillTest` payload.
5. `buildReviewTestSessionRuntime` (`src/app/words/review/reviewSession.utils.ts`) gets a third resolution branch parallel to its existing character/phrase split, resolving `paragraph_id`+`paragraph_span_id` targets against `Paragraph` rows fetched via `getParagraph`/`listParagraphs` (only the paragraphs referenced by the session's own targets, not the whole family library).
6. `revalidateSavedQuizQueue` (`words.shared.utils.tsx`) gets a third branch parallel to its `isVocabPhraseRoundQuizWord` check, validating paragraph members against a `currentParagraphSpanIds: Set<string>` the same way vocab-phrase members are checked against `currentVocabPhraseIds` — a span deleted or un-flagged after packaging must silently drop from a resumed session, not crash it.
7. **Due Review's packaged-session quiz-ready count/gate** needs a third category, `paragraphBlanks`, alongside `quizWords`/`vocabPhrases`, or a paragraph-only packaged session reads 0/0 quiz-ready and can never start. **This is the top risk item for this phase** — it is the exact bug class the 2026-08-13 phrase-keyed-input live QA pass caught for phrases (see `0_ARCHITECTURE.md`'s 2026-08-13 changelog entry: "Due Review's quiz-ready count/gate ignored phrase targets entirely, so a phrase-only packaged session always read 0/0 and could never start"). Every count/gate/dispatch site touched in this section must be checked for the equivalent phrase-only-session bug's paragraph-only-session twin before this phase is considered done.
8. Coins (`src/lib/coins.ts` `calculateCoinValueForEntry`) — extend with an `isParagraphBlank?: boolean` discriminator on `SessionGradeData`/`QuizHistoryItem`, recommended flat-1-coin rule mirroring the phrase-round precedent (structurally identical: one binary drag, no partial credit within a single blank) — pending sign-off, see Open Questions.

## Edge cases

- **Paragraph with fewer than 2 fill-test-eligible spans** — cannot form a round (no distractor available); reported as skipped, not silently dropped, matching the phrase-round precedent.
- **A word/phrase deleted from `words`/`vocab_phrases` after a paragraph blank referencing it was packaged** — must be caught by the `revalidateSavedQuizQueue` extension (item 6 above) on resume, mirroring the existing "deleted vocab phrase drops from a resumed session" precedent; must not crash a paused session.
- **A paragraph deleted while it has active packaged fill-test targets** — `on delete cascade` on `review_test_session_targets.paragraph_id` removes the dependent targets; if that empties a session down to zero targets, the existing "removing the last remaining target deletes the whole session" precedent (Due Review Rule 20) should apply, not a broken empty session.
- **Same word/phrase appears as two different blanks in one paragraph** — must package as two distinct targets, not collapse into one (see the unique-constraint change above).
- **Mixed session** — a `review_test_sessions` row containing character, phrase, and paragraph targets together must produce a sequence of rounds, each single-kind, never mixed within one round (extends the existing "a round is never mixed-kind" system guarantee in `0_ARCHITECTURE.md §4` rule 10 to a third kind).
- **Resuming a paused session mid-paragraph-round** — must follow the exact same autosave/resume state machine already governing character and phrase rounds (`review_session_progress`, `client_session_key`, NOT-YET-ANSWERED-tail revalidation) with no new resume code path.

## Risks

- **Highest risk in this entire feature**: the packaged-session resume/autosave machinery has already produced one real production incident class (2026-07-30 packaged-session-limbo fix-log) and one live-QA bug batch (2026-08-13, phrase-keyed-input — four bugs, all "new round kind not fully wired into every count/gate/dispatch site"). This phase adds a *third* round kind into that same machinery. Do not consider this phase done on mocked unit tests alone — budget a live-QA pass against a dev Supabase project before shipping, covering: packaging a paragraph-only session, confirming Due Review's quiz-ready count is non-zero, starting it, answering through it, confirming grading lands on the right underlying `words`/`vocab_phrases` rows, confirming autosave/resume works mid-paragraph-round, confirming `/words/results` reflects paragraph-round entries sensibly.
- New table/column RLS surface — `scripts/verify-rls.ts` must be extended for the `review_test_session_targets` column addition (its RLS policies don't change, but the new nullable columns should be exercised in the existing paragraph-adjacent test section once one exists).
- The unique-constraint change on `review_test_session_targets` (§ Schema extension) touches an already-relied-upon table; every existing call site constructing a `ReviewTestSessionTargetDraft` must be checked to still compile/insert correctly with the new optional fields before this ships.
- Coin-rule and grading-dispatch decisions (Open Questions 1–2 below) are genuine open design gaps, not implementation details — building ahead of sign-off risks rework.

## Test plan

- `src/lib/paragraphRoundBuilding.test.ts` — round chunking, skip-when-too-few-blanks, blanked-sentence construction, distractor shuffling.
- `src/lib/fillTest.test.ts` extension — `gradeBundledFillTest`'s new `paragraphMemberResults` derivation (filter-and-aggregate correctness, mutual exclusivity with `memberResults`/`vocabPhraseMemberResults` on any single round per the existing system guarantee).
- Grading dispatch unit tests for the `submitCurrentQuizWord` paragraph branch — correct blank dispatches to the right underlying grade function based on `wordId`/`vocabPhraseId`; wrong blank touches no underlying state (mirrors the existing phrase-round "wrong answer touches no character state" test).
- `revalidateSavedQuizQueue` paragraph-branch tests — deleted/un-flagged span drops silently from a resumed queue.
- `buildReviewTestSessionRuntime` paragraph-branch tests — resolves `paragraph_id`+`paragraph_span_id` targets correctly, including a session mixing all three target kinds.
- Due Review quiz-ready count/gate tests — a paragraph-only packaged session reads a non-zero quiz-ready count and its Start button is enabled (this is the specific regression class called out under Risks).
- `scripts/verify-rls.ts` re-run after the schema migration.
- **Live QA pass against a dev Supabase project** (not just mocked tests) — see the Risks section's checklist; this is a required step, not optional polish, given the precedent.

## Acceptance criteria

- [ ] Parent/platform-admin can navigate to `/words/paragraphs`, see previously-imported paragraphs, and open one to view its sentences and triaged spans.
- [ ] Parent can select which spans in a paragraph become quiz blanks and package them into a named review test session, reusing the existing session-naming/append-to-existing form.
- [ ] A packaged paragraph fill test appears in Due Review's packaged-session list with a correct, non-zero quiz-ready count.
- [ ] Starting the session plays paragraph blanks through the app's existing drag-and-match quiz UI, in their own rounds, never mixed with character or phrase blanks in the same round.
- [ ] Grading a paragraph blank correctly updates the underlying `words`/`vocab_phrases` row per the sign-off in Open Question 2, and increments the paragraph round's own tally regardless.
- [ ] Pausing and resuming a session mid-paragraph-round works, including correct revalidation when an underlying word/phrase was deleted while paused.
- [ ] `/words/results` reflects completed paragraph-round entries without crashing or producing nonsensical aggregate numbers (may inherit the same known-gap treatment phrase entries get today per `0_ARCHITECTURE.md`'s Quiz Results Rules #10 — acceptable if so, but should be a conscious call, not an accident).
- [ ] `scripts/verify-rls.ts` passes after the schema migration.
- [ ] Live-QA checklist (see Risks) completed against a dev Supabase project, not mocked tests alone.

## Open questions

1. **Distractor sourcing for paragraph blanks** — same-paragraph-only pool (this spec's default, mirrors the phrase-round rule that a phrase can never supply its own distractor) vs. a cross-paragraph/family-wide fallback bank when a paragraph has too few eligible blanks. Needs confirmation before `paragraphRoundBuilding.ts` is finalized, since it directly determines how usable short or lightly-triaged paragraphs are for fill-test packaging.
2. **Does a correct paragraph blank also grade/nudge the underlying `words`/`vocab_phrases` row's own SRS/test-count state**, or is a paragraph round's tally fully independent of standalone state? This spec's draft leans toward "yes, grade the underlying row" (consistent with "reuse the exact same mechanic" framing) but this changes what a paragraph-round "easy" grade does to unrelated state and needs explicit sign-off, not an assumption baked into `submitCurrentQuizWord`.
3. **Coin rule for a paragraph blank** — recommend flat-1 (phrase-round precedent, since structurally identical), pending sign-off.
4. **Paragraph mutability** — is a saved paragraph editable/re-triageable after import (add more spans, change `fillTestEligible` flags), or is it import-then-immutable once packaged? If editable, editing a paragraph that already has packaged targets referencing specific `paragraph_span_id`s needs an invalidate/re-validate story, same shape as the problem `revalidateSavedQuizQueue` already solves for deletions.
5. **Retention/deletion confirmation** — does deleting a paragraph (which can cascade-delete active packaged fill-test targets across potentially multiple sessions) warrant a confirmation dialog, breaking from the codebase's default "destructive = immediate, no dialog" rule? The existing "deleting the last target deletes the whole session" dialog precedent (Due Review Rule 20) suggests yes, given the larger blast radius here.
