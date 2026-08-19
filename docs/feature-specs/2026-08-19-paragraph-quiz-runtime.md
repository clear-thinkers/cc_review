# Feature Spec — 2026-08-19 — Paragraph Quiz Runtime (Tier 1/2 boundary, Item I, Phase 3)

## Status

Depends on Phase 2 (`docs/feature-specs/2026-08-17-paragraph-fill-test.md`) — `paragraphs`, `paragraph_test_modes`, `TestModeBlankSelector.tsx`'s eligibility/materialization machinery must exist first. They do (shipped 2026-08-18–19).

**Scope-boundary note, requires explicit authorization before implementation — do not assume it carries over from Phase 1/2's authorization.** Unlike Phases 1–2 (parent-facing content prep, nothing playable), this phase makes a paragraph fill task **actually runnable by a child** — squarely `0_PRODUCT_ROADMAP.md §3`'s Tier 2 ("Structured Text Context: Phrase/paragraph fill tasks"), which the roadmap marks blocked until all Tier 1 gates close. One Tier 1 gate (item A, mobile quiz results layout) is still open as of this spec's date. Per `AI_CONTRACT.md §2`, this needs the word "authorized" in an explicit message before any of this is built — the same exception path Phase 1's spec used, restated here rather than assumed.

**This is also, by the app's own history, the highest-risk area in the codebase.** The packaged-session resume/autosave machinery has already caused one real production incident (`docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md`) and one four-bug live-QA batch when phrase rounds were added to it (2026-08-13, see `0_PRODUCT_ROADMAP.md` item D's changelog entry — every bug was "new round kind not fully wired into every count/gate/dispatch site"). This phase adds a *third* kind, with a genuinely new UI on top. Do not consider this phase done on mocked unit tests alone — a live-QA pass against a dev Supabase project, actually playing a session through as a child, is required before this ships, not optional polish.

## Problem

Phase 2 lets a parent curate named test modes — which words/phrases in a paragraph should be blanks — but a test mode is inert: nothing packages it into a runnable session, and nothing in the quiz runtime knows how to play one even if it were packaged. The "paragraph becomes a fill task" half of item I's original request is still unmet.

## Scope

- **"Package as Quiz"** — a new action on each test mode in `TestModeSection.tsx`. Prompts for a session name (pre-filled with the test mode's own name, editable) and creates exactly one `review_test_sessions` row referencing that test mode. **A session is always exactly one test mode** — never multiple test modes, never mixed with character/phrase targets. Packaging takes a **snapshot**: the session's targets are fixed at packaging time from the test mode's current `span_ids`; editing the test mode afterward does not retroactively change an already-packaged session (see Out of Scope).
- **A genuinely new quiz UI** — not a reuse of the existing bundled fill-test's per-round "up to 5 blanks, multiple-choice" mechanic. Per explicit user direction:
  - The whole paragraph renders as continuous, readable text with blanks in place of each packaged word/phrase.
  - Below the paragraph text (per page — see pagination below), a **word bank** shows every blank's correct answer for that page, shuffled. A child drags (or clicks, then clicks a blank — see Open Questions) a bank item onto a blank.
  - A correct drop fills that blank permanently. A wrong drop **bounces back to the bank** — no penalty beyond the attempt itself; the child keeps trying. Because every bank item on a page has exactly one correct home among that page's blanks, the puzzle is always solvable to completion by trial and error alone.
  - **The session completes only once every blank on every page has been correctly filled** — there is no "submit with some blanks empty."
  - **Pagination**: the paragraph is conceptually one scrollable document, broken into pages of **~20 blanks each**, never splitting a sentence's blanks across a page boundary (mirrors Content Admin's existing "entire character block stays together on the earlier page, even when that page exceeds the nominal row count" precedent — accumulate whole sentences onto the current page until the next sentence would push it over ~20, then start a new page).
  - The word bank is **scoped to the current page only** — shuffled answers for exactly that page's blanks, not the whole test mode.
- **Grading dispatch** — on a blank's final (correct) placement, dispatch to `gradeWord`/`gradeVocabPhrase` on the same id the span already resolved to (Phase 2's eligibility-materialization work made every paragraph-quiz target a real, resolvable id) — the same functions every other quiz path uses. A wrong drop touches no state at all (matches the phrase-round "wrong answer touches no character state" precedent) until the eventual correct drop.
- **Grade tier derived from retry count**, since there is no "again" outcome to reach in a closed matching puzzle a child can always eventually solve by elimination (see Open Questions for what "again" would even mean here): first-try-correct → `easy`; correct after exactly one wrong attempt → `good`; correct after two or more wrong attempts → `hard`.
- **Due Review's packaged-session quiz-ready gate** gains a third category, `paragraphQuizzes`, alongside `quizWords`/`vocabPhrases` — the exact bug class the 2026-08-13 live QA caught for phrases must not recur for paragraphs (see Status).
- **Autosave/resume** extended to persist per-page progress (current page index, which blanks are already correctly filled, retry counts so far) using the existing `review_session_progress` machinery — no new table.

## Out of scope

- Un-packaging, or auto-resyncing an already-packaged session when its source test mode is edited afterward. Packaging is a one-time snapshot; editing a test mode with an active packaged session neither blocks the edit nor touches the session (see Edge Cases for the deletion-cascade case, which is different).
- Any change to the existing character-round or phrase-round mechanics, UI, or code paths (`buildBundledFillTestPlan`, `buildFillTestPlanForVocabPhrases`, the existing drag-and-match sentence-blank component) — this phase adds a sibling, not a replacement.
- A "give up on this blank" or skip mechanic. Every blank must be correctly filled to complete the session, by design (see Scope).
- Editing a paragraph or test mode from within the quiz screen. The quiz is read/answer-only, matching every other review surface's separation from admin/curation.
- Mixing a paragraph-quiz session with character/phrase targets in the same `review_test_sessions` row (see Scope — always exactly one test mode).

## Proposed behavior

### Schema

Additive columns, following the exact precedent of `20260726000001_review_test_session_targets_vocab_phrase.sql` (the migration that added `vocab_phrase_id`):

```sql
alter table review_test_sessions
  add column paragraph_test_mode_id uuid references paragraph_test_modes(id) on delete cascade;

alter table review_test_session_targets
  add column paragraph_id uuid references paragraphs(id) on delete cascade,
  add column paragraph_span_id text;
```

- `review_test_sessions.paragraph_test_mode_id` — non-null is the discriminator: this **entire session** is a paragraph quiz, packaged from that test mode. Never set alongside a session that also has ordinary character/phrase targets (enforced at the packaging call site, not a DB constraint — mirrors how `vocab_phrase_id` on targets is an application-level discriminator too).
- `review_test_session_targets.paragraph_id` + `paragraph_span_id` — which paragraph and which specific span (blank) this target represents. `character`/`pronunciation` keep their existing denormalized-display role exactly as Phase 2's original runtime-integration draft specified: `character` holds the span's own text, `pronunciation` holds its resolved pinyin (empty-string fallback if unresolved). `vocab_phrase_id` (already on this table) does double duty as-is: null means this blank resolved to a `words` row, non-null means a `vocab_phrases` row — no new kind-discriminator column needed.
- **Unique-constraint change (needs explicit sign-off at implementation time, not silently applied):** extend the dedupe key to include `paragraph_span_id` exactly as Phase 2's original draft specified for the same reason (the same word/phrase can legitimately appear as two different blanks in one paragraph) — `unique (session_id, character, pronunciation, paragraph_span_id)`, safe/additive since Postgres treats `NULL` as distinct-from-`NULL` in unique constraints.

No RPC changes — packaging is `createReviewTestSession` called with `paragraph_test_mode_id` set and one `ReviewTestSessionTargetDraft` per span, extended with optional `paragraphId`/`paragraphSpanId` fields alongside its existing optional `vocabPhraseId`.

### New pure module — `src/lib/paragraphQuizBuilder.ts`

Domain layer (no `src/app/**` imports), mirrors `paragraphLibrary.ts`'s placement.

```ts
export type ParagraphQuizBlank = {
  spanId: string;
  sentenceIndex: number;
  startOffset: number;
  text: string;               // the correct answer
  wordId?: string;
  vocabPhraseId?: string;
};

export type ParagraphQuizPage = {
  pageIndex: number;
  sentences: { index: number; text: string; blankSpanIds: string[] }[]; // blanks within each sentence, by position
  bankSpanIds: string[];      // shuffled order for this page's word bank
};

/**
 * Groups a paragraph's blanks into pages of ~20, never splitting a
 * sentence's blanks across a page boundary — accumulates whole sentences
 * onto the current page until the next sentence would push it over the
 * target, then starts a new page. A single sentence with >20 blanks of its
 * own (pathological, but not impossible) still stays whole on one page.
 */
export function buildParagraphQuizPages(
  paragraph: Paragraph,
  blankSpanIds: string[],
  targetBlanksPerPage?: number // default 20
): ParagraphQuizPage[];

/** Deterministic-seedable shuffle for the per-page word bank order. */
export function shuffleBankOrder(spanIds: string[], seed?: number): string[];
```

### Runtime integration — reuses the existing packaged-session entry point, not a new route

Per `0_ARCHITECTURE.md`'s existing precedent (a phrase-only packaged session already skips the flashcard phase and branches its round-planning at the same `/words/review/fill-test?reviewTestSessionId=<id>` entry point character/mixed sessions use), this phase adds a **third branch at that same entry point** rather than a new route — avoiding another `AI_CONTRACT.md §2` new-route boundary on top of the Tier-2 one already required:

1. `buildReviewTestSessionRuntime` (`reviewSession.utils.ts`) gets a third resolution branch parallel to its existing character/phrase split: when `session.paragraphTestModeId` is set, resolve the paragraph + test mode + each target's `paragraph_span_id` instead of building `quizWords`/`vocabPhrases`. Returns a new `paragraphQuiz: { paragraph: Paragraph; testMode: ParagraphTestMode; pages: ParagraphQuizPage[] } | null` field.
2. Due Review's quiz-ready count/gate (`words.shared.state.ts`, alongside `activeReviewTestSessionQuizCount`) gains `activeReviewTestSessionParagraphQuizReady: boolean` — true when `paragraphQuiz` resolved with no error. A paragraph-quiz session's Start button must never read as disabled/0-ready the way the 2026-08-13 phrase bug did.
3. Starting a paragraph-quiz session **skips the flashcard phase entirely** (same reasoning as phrase-only sessions — there's no flashcard entity to review) and renders the new UI directly.
4. **New component** `src/app/words/review/paragraph-quiz/ParagraphQuizReviewSection.tsx`, mounted as a sibling to `FlashcardReviewSection`/`FillTestReviewSection` in `WordsWorkspace.tsx`, self-gating on the resolved session having a non-null `paragraphQuiz`. Owns: current page index, per-blank fill state (`correct` | `unfilled`), per-blank retry counts, drag/drop (and click-to-select-then-click-to-place, for accessibility/touch parity with the existing drag-and-match mechanic) interaction.
5. On a blank's correct placement: compute its tier from retry count (Scope), call `gradeWord`/`gradeVocabPhrase`, append a `SessionGradeData` entry (new `isParagraphBlank?: boolean` discriminator, sibling to `isVocabPhrase`), autosave.
6. Session completion (last blank on last page correctly filled): same `quiz_sessions` insert / `complete_review_test_session` RPC path every packaged session already uses — no new completion mechanism.
7. `revalidateSavedQuizQueue` gets a third branch: on resume, a paragraph-quiz session's remaining (not-yet-correctly-filled) blanks are revalidated against the paragraph's *current* spans and the underlying word/phrase's continued existence — a span or word/phrase deleted while paused drops that blank's target, mirroring the existing vocab-phrase revalidation precedent. If this empties a page, that page is skipped on resume (not left as an unsolvable dead end).

### Coins

`src/lib/coins.ts`'s `calculateCoinValueForEntry` extended with an `isParagraphBlank?: boolean` discriminator on `SessionGradeData`/`QuizHistoryItem`. **Proposed default** (pending sign-off, see Open Questions): reuse the existing character tier table (`easy=5, good=3, hard=1`) rather than the phrase-round's flat-1 rule — unlike a phrase round (a single binary drag with no partial credit), a paragraph blank's tier is genuinely earned through retry count, so a tiered reward is more consistent with what the tier represents. `again=0` is moot here since `again` isn't a reachable tier for a paragraph blank (see Open Questions).

## Edge cases

- **A paragraph is deleted while it has an active packaged quiz session** — `on delete cascade` on both `paragraph_test_modes.paragraph_id` and `review_test_sessions.paragraph_test_mode_id` removes the test mode and the session together. Unlike Phase 2's "deleting a paragraph with test modes" edge case (which only lost inert prep data), this can delete a session a child has *started but not finished* — warrants the confirmation-dialog exception Phase 2 already flagged as likely necessary (Phase 2 Open Question 5, carried forward here since this is where the stakes actually materialize).
- **A test mode is edited (spans added/removed) after it's been packaged** — no effect on the already-packaged session (Out of Scope); the parent packaging a *new* session from the edited test mode gets the updated composition. Two sessions can exist for the same test mode over time if packaged twice with different names.
- **A word/phrase deleted from `words`/`vocab_phrases` after being packaged as a paragraph-quiz target** — caught by the `revalidateSavedQuizQueue` extension on resume; must not crash a paused session (Runtime integration item 7).
- **A page with only one remaining unfilled blank and one remaining bank item** — trivially solvable (only one possible placement); no special-case logic needed, the shuffle/matching mechanic already degenerates correctly.
- **Resuming mid-page** — must restore exactly which blanks on the current page are already correct, their bank items removed from the visible bank, and retry counts so far, so a child doesn't lose credit or have to re-solve an already-correct blank.
- **A test mode with fewer than 2 blanks** — packaging should be blocked (mirrors the phrase-round "a phrase can never supply its own distractor" reasoning: a 1-item word bank has no matching puzzle at all, trivially "correct" with no real quiz). Surfaced at the "Package as Quiz" action, not silently allowed through to a degenerate session.

## Risks

- **Highest risk in the entire item I effort** (see Status) — the packaged-session resume/autosave machinery's track record demands a live-QA pass covering: packaging a paragraph-quiz session, confirming Due Review's quiz-ready count is non-zero, starting it, filling blanks across at least two pages, confirming grading lands on the right underlying `words`/`vocab_phrases` rows, confirming autosave/resume works mid-page, confirming `/words/results` reflects paragraph-blank entries sensibly, confirming a paragraph deletion mid-session behaves per Edge Cases.
- **Genuinely new drag/drop UI** with no in-app precedent for "many simultaneous blanks fed by one shared bank, wrong drops bounce back" — the existing drag-and-match component handles one bounded sentence with up to 5 blanks; this needs new interaction code, not a reuse, and should budget real QA time on both drag (desktop) and click-to-place (touch) paths.
- **`review_test_session_targets`'s unique-constraint change** touches an already-relied-upon table; every existing call site constructing a `ReviewTestSessionTargetDraft` must still compile/insert correctly with the new optional fields.
- **Coin-rule and "again"-reachability decisions** (Open Questions) are genuine open design gaps, not implementation details — building ahead of sign-off risks rework, per the same caution Phase 2's original draft flagged for its own open questions.

## Test plan

- `src/lib/paragraphQuizBuilder.test.ts` — page-building (sentence-integrity across the ~20 boundary, a single oversized sentence staying whole, empty/degenerate inputs), bank shuffling (deterministic with a seed, covers all page's blanks exactly once).
- `buildReviewTestSessionRuntime` paragraph-quiz branch tests — resolves correctly, error codes for a deleted paragraph/test mode/word/phrase, mirrors the existing `missing_word`/`missing_vocab_phrase`/`duplicate_word` error-code precedent.
- Due Review quiz-ready gate tests — a paragraph-quiz session reads a non-zero ready count and an enabled Start button (the specific regression class called out under Status).
- Grading-tier derivation unit tests — retry count 0/1/2+ → easy/good/hard, no path to `again`.
- `revalidateSavedQuizQueue` paragraph-quiz branch — deleted span/word/phrase drops silently, an emptied page is skipped, not left unsolvable.
- Coins — `calculateCoinValueForEntry` with `isParagraphBlank: true` at each tier.
- `scripts/verify-rls.ts` re-run after the schema migration (policies unchanged, but the new nullable columns should be exercised).
- **Live QA pass against a dev Supabase project** (see Risks) — required, not optional.

## Acceptance criteria

- [ ] A parent can "Package as Quiz" a test mode with ≥2 blanks into a named, playable session; a test mode with <2 blanks is blocked from packaging with an explanatory message.
- [ ] A packaged paragraph-quiz session appears in Due Review with a correct, non-zero quiz-ready indication and starts directly into the new UI (no flashcard phase).
- [ ] The paragraph renders as continuous text with blanks, paginated at ~20 blanks/page without ever splitting a sentence, each page showing its own shuffled word bank.
- [ ] A child can drag (or click-then-click) bank items into blanks; wrong drops bounce back with no penalty; the session completes only once every blank on every page is correctly filled.
- [ ] A correctly-filled blank grades the real underlying `words`/`vocab_phrases` row via the existing `gradeWord`/`gradeVocabPhrase` functions, tiered by retry count.
- [ ] Pausing and resuming mid-page preserves exactly which blanks are already correct and each remaining blank's retry count so far.
- [ ] `/words/results` reflects completed paragraph-quiz sessions without crashing or producing nonsensical aggregate numbers.
- [ ] `scripts/verify-rls.ts` passes after the schema migration.
- [ ] Live-QA checklist (see Risks) completed against a dev Supabase project, not mocked tests alone.

## Open questions

1. **Is `again` a reachable tier at all**, or should the tier scale genuinely be `good`/`easy`/`hard`-and-that's-it (2+ retries just keeps mapping to `hard` no matter how many)? This spec assumes the latter (no escape hatch, no "give up" — see Out of Scope) but flags it since it's a real departure from every other grade path in the app, all of which can reach `again`.
2. **Coin rule** — this spec proposes reusing the character tier table (5/3/1) rather than the phrase-round's flat-1, reasoning that a paragraph blank's tier is earned (unlike a phrase round's single binary drag). Needs explicit sign-off, not an assumption baked into `coins.ts`.
3. **Deletion confirmation** — per Edge Cases, deleting a paragraph/test mode with an active, in-progress (not just packaged-but-unstarted) session is a meaningfully bigger blast radius than anything Phase 1/2 risked. Should this specifically (not paragraph deletion in general) get a confirmation dialog, breaking from the codebase's default immediate-delete convention?
4. **Drag vs. click-to-place** — this spec assumes both are supported (mirroring accessibility expectations elsewhere in the app) but the existing drag-and-match component's exact interaction model should be reviewed before committing to parity being straightforward.
5. **`/words/results` display** — do paragraph-blank entries get the same "known gap, accepted" treatment phrase entries get today (`0_ARCHITECTURE.md` Quiz Results Rule #10 — showing up in Tested/Failed Hanzi lists despite not being a single character), or does the scale of a paragraph session (potentially dozens of blanks) make that gap too visible to leave as-is and warrant a real fix this time?
