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
- **Grading dispatch** — on a blank's final (correct) placement, dispatch to `gradeWord`/`gradeVocabPhrase` on the same id the span already resolved to (Phase 2's eligibility-materialization work made every paragraph-quiz target a real, resolvable id) — the same functions every other quiz path uses. A wrong drop touches no state at all (matches the phrase-round "wrong answer touches no character state" precedent) until the eventual correct drop. **A phrase blank's derived tier also nudges every one of its component characters found standalone in `words`** — resolved (Option B, 2026-08-19): reuses the existing `nudgeWordFamiliarity` mechanism exactly (scheduling update + `reviewCount`, `testCount` deliberately left untouched), generalized to accept the phrase's *earned* tier instead of the ordinary phrase-round's hardcoded `"good"`. A character present in more than one correctly-answered phrase blank in the same session gets nudged once per phrase, sequentially, each against its own just-updated state — not new behavior, the existing ordinary phrase-round nudge already works this way whenever two graded phrases in one session share a component character (see Edge Cases).
- **Grade tier derived from retry count** — confirmed: first-try-correct → `easy`; correct on the second attempt → `good`; correct on the third attempt or later → `hard`. There is no `again` outcome (see Open Questions for whether that's fully intentional or needs an escape hatch) — a closed matching puzzle is always eventually solvable by elimination, and completion requires every blank correct.
- **Due Review's packaged-session quiz-ready gate** gains a third category, `paragraphQuizzes`, alongside `quizWords`/`vocabPhrases` — the exact bug class the 2026-08-13 live QA caught for phrases must not recur for paragraphs (see Status).
- **Autosave/resume** extended to persist per-page progress (current page index, which blanks are already correctly filled, retry counts so far) using the existing `review_session_progress` machinery — no new table.
- **Delete Paragraph** (new UI action, doesn't exist yet even as a stub) — `ParagraphLibrarySection.tsx` gains a Delete action. **Blocked outright** (not just confirmed) while the paragraph has any active (not-yet-completed) packaged quiz session; once none remain, deletion proceeds behind a **confirmation dialog** — a deliberate departure from the codebase's default immediate-delete-no-dialog convention, per explicit user direction.
- **Delete Test Mode gets the identical treatment** — resolved 2026-08-19: `TestModeSection.tsx`'s existing (Phase 2, currently immediate/no-dialog) Delete action is upgraded to mirror Delete Paragraph exactly — blocked outright while *that specific test mode* has an active packaged session, confirmation dialog otherwise. Closes the gap where deleting a test mode could destroy an active session out from under a child even though deleting its paragraph couldn't.
- **Word/phrase deletion protection — extended to every active packaged session, not just paragraph-quiz ones** — resolved 2026-08-19: `/words/all`'s existing Delete action (Characters and Phrases views) is blocked for any word/phrase currently referenced by **any active packaged session's target — character, phrase, mixed, or paragraph-quiz alike**. Broader than this spec's original paragraph-only proposal; a genuine, deliberate behavior change to the long-standing (pre-dating item I) immediate-delete convention on `/words/all`, for consistency across every kind of packaged session.
- **Results page popup — applies to every session row, not just paragraph-quiz ones** — resolved 2026-08-19: `/words/results` shows the new clickable blanks/characters popup for **every** completed session row, replacing the existing inline comma-separated Tested/Failed Characters lists everywhere, for consistency.

## Out of scope

- Un-packaging, or auto-resyncing an already-packaged session when its source test mode is edited afterward. Packaging is a one-time snapshot; editing a test mode with an active packaged session neither blocks the edit nor touches the session (see Edge Cases for the deletion-cascade case, which is different).
- Any change to the existing character-round or phrase-round mechanics, UI, or code paths (`buildBundledFillTestPlan`, `buildFillTestPlanForVocabPhrases`, the existing drag-and-match sentence-blank component) — this phase adds a sibling, not a replacement.
- A "give up on this blank" or skip mechanic. Every blank must be correctly filled to complete the session, by design (see Scope).
- Editing a paragraph or test mode from within the quiz screen. The quiz is read/answer-only, matching every other review surface's separation from admin/curation.
- Mixing a paragraph-quiz session with character/phrase targets in the same `review_test_sessions` row (see Scope — always exactly one test mode).
- Editing an already-shipped ordinary character/phrase session's *packaging* flow itself (Content Admin, `/words/all`'s Add Selected to Session, Quick Add 25, etc.) — only the *deletion protection* generalizes to cover their targets too (see Scope); how those sessions get created is untouched.

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
5. On a blank's correct placement: compute its tier from retry count (Scope), call `gradeWord`/`gradeVocabPhrase`; if the blank is a phrase, additionally call `nudgeWordFamiliarity` for each component character found standalone in `words` (see `src/lib/supabase-service.ts` changes below); append a `SessionGradeData` entry (new `isParagraphBlank?: boolean` discriminator, sibling to `isVocabPhrase`), autosave.

**`nudgeWordFamiliarity` signature change** (`src/lib/supabase-service.ts`) — additive, backward-compatible: `nudgeWordFamiliarity(wordId: string, tier: Grade = "good", now = Date.now())`. Every existing ordinary-phrase-round call site is unchanged (it never passes `tier`, so it keeps defaulting to `"good"` exactly as today); the new paragraph path is the only caller that passes an explicit tier. The function's own behavior — `calculateNextState(word, tier, now)`, `reviewCount` +1, `testCount` untouched — does not otherwise change.
6. Session completion (last blank on last page correctly filled): same `quiz_sessions` insert / `complete_review_test_session` RPC path every packaged session already uses — no new completion mechanism.
7. `revalidateSavedQuizQueue` gets a third branch: on resume, a paragraph-quiz session's remaining (not-yet-correctly-filled) blanks are revalidated against the paragraph's *current* spans and the underlying word/phrase's continued existence — a span or word/phrase deleted while paused drops that blank's target, mirroring the existing vocab-phrase revalidation precedent. If this empties a page, that page is skipped on resume (not left as an unsolvable dead end).

### Coins — session-level, not per-entry

Structurally different from every existing coin rule in this codebase: a paragraph-quiz session's coin award is **one flat sum for the whole session**, capped regardless of paragraph length (unlike character/phrase sessions, which accumulate independently-computed per-entry values via `calculateSessionCoins`) — bounding how much one long paragraph can pay out, the way a per-blank sum wouldn't.

**Revised proposal, confirmed 2026-08-19** — the user's original table (`<5→50, <10→40, <15→20, else→10` incorrect tries) used an absolute count, which unfairly favored tiny paragraphs (one mistake barely dents a 3-blank quiz) and unfairly punished large ones (a few honest misclicks across 40 blanks blows past 15 by chance alone). Dividing 5/10/15 against the ~20-blank pagination reference size already established elsewhere in this spec lands on a clean 25%/50%/75%, so this keeps the identical four buckets and payouts, just judged as an **error rate** instead of a raw count:

```ts
// src/lib/coins.ts
export function calculateParagraphQuizSessionCoins(totalIncorrectTries: number, totalBlanks: number): number {
  if (totalBlanks <= 0) return 0;
  const errorRate = totalIncorrectTries / totalBlanks;
  if (errorRate < 0.25) return 50;
  if (errorRate < 0.5) return 40;
  if (errorRate < 0.75) return 20;
  return 10;
}
```

`SessionGradeData` gains `retryCount?: number` on paragraph-blank entries (the raw wrong-attempt count, not just the bucketed tier — the coin formula needs the sum, which tier alone can't reconstruct). `calculateSessionCoins` gains a branch: if any entry in `gradeData` has `isParagraphBlank: true`, the *entire* session is treated as a paragraph quiz (consistent with "always exactly one test mode per session" — a session is never a mix), and the total coin award is `calculateParagraphQuizSessionCoins(sum of every entry's retryCount, count of paragraph-blank entries)` instead of the normal per-entry sum. Per-blank tier (`easy`/`good`/`hard`) still drives the `gradeWord`/`gradeVocabPhrase` SRS dispatch and results display exactly as described above — it just no longer separately drives a coin value the way it does for character/phrase entries.

### Delete Paragraph / Delete Test Mode — the same block-then-confirm shape, two scopes

Two new service functions, sharing one query shape at different scopes:

```ts
/** Any test mode belonging to this paragraph has an active (completed_at is null) session. */
export async function hasActiveParagraphQuizSession(paragraphId: string): Promise<boolean>;

/** This SPECIFIC test mode has an active session — narrower than the paragraph-level check above. */
export async function hasActiveTestModeQuizSession(testModeId: string): Promise<boolean>;
```

**Delete Paragraph** (new UI action on `ParagraphLibrarySection.tsx` — no delete action exists there today, Phase 1/2 never built one):

1. If `hasActiveParagraphQuizSession` is true — deletion is **blocked outright**, not just confirmed: an inline error explains why (a child has an in-progress quiz for this paragraph; finish or remove that session first) and no delete is attempted.
2. Otherwise — a **confirmation dialog** (portal-rendered, matching the existing coin-redemption confirmation-modal precedent) gates the call to `deleteParagraph`. A deliberate departure from the codebase's default immediate-delete-no-dialog convention, per explicit user direction — the closest existing precedent for a confirmed delete is Due Review Rule 20's "removing the last remaining target deletes the whole session."
3. On confirm, `deleteParagraph` cascades `paragraph_test_modes` (this paragraph's) and any already-**completed** `review_test_sessions` referencing them. Completed `quiz_sessions` audit rows are unaffected — no FK to `paragraphs` at all, so historical results survive exactly as they do for a deleted word/phrase today.

**Delete Test Mode** (`TestModeSection.tsx`'s existing Phase 2 Delete action, currently immediate/no-dialog — upgraded, resolved 2026-08-19, to mirror Delete Paragraph exactly): checks `hasActiveTestModeQuizSession` for *that specific test mode* (not its paragraph's other test modes); blocked outright if true, confirmation dialog if false. Closes the cascade gap Delete Paragraph alone left open — `paragraph_test_modes → review_test_sessions` cascades on delete, so a test mode with an active session was destroying that session exactly as deleting its paragraph could, with no protection.

### Word/phrase deletion protection (extends `/words/all`) — every active packaged session, not just paragraph-quiz

Resolved 2026-08-19 to cover **every** kind of active packaged session, broader than this spec's original paragraph-only proposal. New service function, family-scoped:

```ts
export async function getActiveSessionTargetKeys(): Promise<{
  hanziSet: Set<string>;
  vocabPhraseIdSet: Set<string>;
}>;
```

Resolves every target of every **active** (`completed_at is null`) `review_test_sessions` row in the family — character targets via `character` (hanzi text match), phrase targets via `vocab_phrase_id`, regardless of whether the session is an ordinary character/phrase/mixed session or a paragraph-quiz one. `/words/all`'s existing Delete action, on both the Characters and Phrases views, checks this before deleting: a character whose hanzi is in `hanziSet`, or a phrase whose id is in `vocabPhraseIdSet`, is **blocked** with an inline error rather than deleted immediately — a genuine, deliberate behavior change to the already-shipped, immediate-no-confirmation delete these views have had since before this item existed (`0_ARCHITECTURE.md`'s All Characters Inventory Rule 8 / Phrases Rule 28).

This also changes `revalidateSavedQuizQueue`'s role for **every** session kind, not just paragraph-quiz ones: since a target can no longer be deleted while its session is active, that resume-time revalidation logic becomes pure defense-in-depth everywhere (a backstop for edge paths like a future bulk-delete tool or a race condition) rather than the primary safeguard it effectively was for ordinary sessions before this change.

### Results page — clickable blanks/characters popup, every session row

Resolved 2026-08-19 to cover **every** completed session row, not just paragraph-quiz ones, for consistency. `/words/results` (`SessionHistoryTable.tsx`) replaces its existing inline, comma-separated, truncated Tested/Failed Characters lists with a clickable action opening a popup (portal-rendered, matching `SendFailedToSessionDialog.tsx`'s existing anchored-popup precedent) that lists every tested/failed item in full — for an ordinary session, the same hanzi/phrase list the row shows today, just in a popup instead of inline; for a paragraph-quiz session, each blank's text, earned tier, and retry count. `truncateCharacters`/`isCharacterListTruncated` (`SessionHistoryTable.tsx`'s existing inline-truncation helpers) become unused and should be removed rather than left as dead code. Session-level summary cards and aggregate percentages (Quiz Results Rules #3–6) are otherwise unchanged — only the per-row character/blank list display changes, from inline text to a popup trigger.

## Edge cases

- **Attempting to delete a paragraph with an active packaged quiz session** — blocked outright, per Scope/Proposed Behavior. This replaces this spec's earlier draft assumption of a cascade-delete-behind-a-confirmation-dialog approach; deletion is now impossible until every session for that paragraph is either completed or removed.
- **A paragraph with only completed (no active) sessions** — deletable behind a confirmation dialog; cascades `paragraph_test_modes` and the completed `review_test_sessions` rows, but never the immutable `quiz_sessions` audit records (no FK).
- **A test mode is edited (spans added/removed) after it's been packaged** — no effect on the already-packaged session (Out of Scope); the parent packaging a *new* session from the edited test mode gets the updated composition. Two sessions can exist for the same test mode over time if packaged twice with different names.
- **Attempting to delete a word/phrase referenced by any active packaged session's target** (character, phrase, mixed, or paragraph-quiz alike) — blocked outright on `/words/all`, per Proposed Behavior. This is the primary defense for every session kind now, not just paragraph-quiz; `revalidateSavedQuizQueue`'s resume-time check (Runtime integration item 7) remains as defense-in-depth for any way a target could still end up dangling (e.g. a future bulk-delete tool bypassing this check) rather than being relied on as the only safeguard.
- **A page with only one remaining unfilled blank and one remaining bank item** — trivially solvable (only one possible placement); no special-case logic needed, the shuffle/matching mechanic already degenerates correctly.
- **Resuming mid-page** — must restore exactly which blanks on the current page are already correct, their bank items removed from the visible bank, and retry counts so far, so a child doesn't lose credit or have to re-solve an already-correct blank.
- **A test mode with fewer than 2 blanks** — packaging should be blocked (mirrors the phrase-round "a phrase can never supply its own distractor" reasoning: a 1-item word bank has no matching puzzle at all, trivially "correct" with no real quiz). Surfaced at the "Package as Quiz" action, not silently allowed through to a degenerate session.
- **Gap closed, 2026-08-19**: `paragraph_test_modes` cascades to `review_test_sessions` on delete, so deleting a *test mode* (Phase 2's `TestModeSection.tsx`) while it has an active packaged session would otherwise destroy that session exactly as deleting the paragraph itself could. `hasActiveTestModeQuizSession` closes this — Delete Test Mode now gets the identical block-then-confirm treatment as Delete Paragraph (see Proposed Behavior).
- **A phrase blank's component character is itself also directly packaged as its own separate blank in the same paragraph quiz** (e.g. "图" appears standalone elsewhere *and* inside "图书馆") — both grade independently through their own dispatch path; the character's `words` row ends up graded twice in one session (once directly via `gradeWord`, once via the phrase's `nudgeWordFamiliarity` propagation). Not a bug — matches how a character could already be graded multiple times across different bundled quizzes in one ordinary session today.
- **The same character is a component of two (or more) different, separately-answered phrase blanks in one paragraph** (e.g. "图书" and "图画" both packaged, both correctly answered) — 图 gets `nudgeWordFamiliarity`'d once per phrase, sequentially, each call computing against 图's own just-updated state from the previous nudge (not averaged, not deduplicated). `reviewCount` increments once per phrase; `testCount` stays untouched by all of it. Not new to paragraphs — the existing ordinary phrase-round nudge already behaves identically whenever two graded phrases in one session share a component character.

## Risks

- **Highest risk in the entire item I effort** (see Status) — the packaged-session resume/autosave machinery's track record demands a live-QA pass covering: packaging a paragraph-quiz session, confirming Due Review's quiz-ready count is non-zero, starting it, filling blanks across at least two pages, confirming grading lands on the right underlying `words`/`vocab_phrases` rows, confirming autosave/resume works mid-page, confirming `/words/results` reflects paragraph-blank entries sensibly, confirming a paragraph deletion mid-session behaves per Edge Cases.
- **Genuinely new drag/drop UI** with no in-app precedent for "many simultaneous blanks fed by one shared bank, wrong drops bounce back" — the existing drag-and-match component handles one bounded sentence with up to 5 blanks; this needs new interaction code, not a reuse, and should budget real QA time on both drag (desktop) and click-to-place (touch) paths.
- **`review_test_session_targets`'s unique-constraint change** touches an already-relied-upon table; every existing call site constructing a `ReviewTestSessionTargetDraft` must still compile/insert correctly with the new optional fields.
- **Three already-shipped, long-standing surfaces change behavior, with a bigger regression-risk surface than originally scoped**: `/words/all`'s Delete action (immediate since before item I existed) gains a blocking condition against *every* active packaged session's targets, not just paragraph-quiz ones; `TestModeSection.tsx`'s Delete action loses its immediate/no-dialog behavior in favor of block-then-confirm; and paragraph deletion is genuinely new. Because the deletion-protection change now retroactively covers every pre-existing ordinary character/phrase/mixed session, not only new paragraph-quiz ones, regression coverage must prove the *unblocked* path (deleting a word/phrase/paragraph/test-mode with no active session involvement at all) is completely unaffected for every session kind already in production — this phase must not make ordinary, everyday deletes slower or riskier for any existing user.
- **The session-level coin formula is a new calculation shape** (`calculateParagraphQuizSessionCoins`) living alongside, not replacing, the existing per-entry `calculateSessionCoins` — the branch condition (any `isParagraphBlank` entry) must be airtight, since accidentally running both paths (or neither) on the same session either double-pays or silently withholds every paragraph-quiz reward.

## Test plan

- `src/lib/paragraphQuizBuilder.test.ts` — page-building (sentence-integrity across the ~20 boundary, a single oversized sentence staying whole, empty/degenerate inputs), bank shuffling (deterministic with a seed, covers all page's blanks exactly once).
- `buildReviewTestSessionRuntime` paragraph-quiz branch tests — resolves correctly, error codes for a deleted paragraph/test mode/word/phrase, mirrors the existing `missing_word`/`missing_vocab_phrase`/`duplicate_word` error-code precedent.
- Due Review quiz-ready gate tests — a paragraph-quiz session reads a non-zero ready count and an enabled Start button (the specific regression class called out under Status).
- Grading-tier derivation unit tests — retry count 0/1/2+ → easy/good/hard, no path to `again`.
- `revalidateSavedQuizQueue` paragraph-quiz branch — deleted span/word/phrase drops silently, an emptied page is skipped, not left unsolvable.
- Coins — `calculateParagraphQuizSessionCoins` at each error-rate boundary (just under/at/over 25%/50%/75%) across a few different `totalBlanks` sizes, confirming the same rate produces the same payout regardless of paragraph length; `calculateSessionCoins` correctly branches to it when any entry is `isParagraphBlank` and correctly does *not* branch for an ordinary session.
- Phrase-blank component-character grading propagation — a phrase blank's earned tier is applied via `nudgeWordFamiliarity` to every component character found standalone in `words` (`reviewCount`/scheduling updated, `testCount` untouched); a component character never added standalone is silently skipped (mirrors the existing phrase-round precedent's skip behavior); a character shared by two separately-answered phrase blanks in one session gets nudged twice, sequentially, each against its own just-updated state (no averaging/deduplication).
- `hasActiveParagraphQuizSession` — true only while an incomplete session exists for that paragraph (across any of its test modes); false once every session for it is completed or removed.
- `hasActiveTestModeQuizSession` — true only while an incomplete session exists for that *specific* test mode; false for a sibling test mode on the same paragraph that has no active session of its own, confirming the two functions' scopes don't bleed into each other.
- `getActiveSessionTargetKeys` — resolves exactly the hanzi/vocab-phrase-ids referenced by *any* active session (character, phrase, mixed, and paragraph-quiz), with dedicated cases proving an ordinary character/phrase session's targets are included, not just paragraph-quiz ones.
- Delete-paragraph, delete-test-mode, and delete-word/phrase blocking — for each, both the blocked path (active session exists) and the allowed path (none does) need coverage, including confirming an *unrelated* word/paragraph/test-mode's deletion is never affected by another one's active session.
- `scripts/verify-rls.ts` re-run after the schema migration (policies unchanged, but the new nullable columns should be exercised).
- **Live QA pass against a dev Supabase project** (see Risks) — required, not optional. Extend the checklist to also cover: attempting to delete a word mid-active-session (blocked, for both an ordinary session and a paragraph-quiz session), attempting to delete the paragraph mid-active-session (blocked), attempting to delete a test mode mid-active-session (blocked), completing the session then successfully deleting all three, and the results-page popup rendering correctly for both an ordinary session row and a multi-page paragraph-quiz session row.

## Acceptance criteria

- [ ] A parent can "Package as Quiz" a test mode with ≥2 blanks into a named, playable session; a test mode with <2 blanks is blocked from packaging with an explanatory message.
- [ ] A packaged paragraph-quiz session appears in Due Review with a correct, non-zero quiz-ready indication and starts directly into the new UI (no flashcard phase).
- [ ] The paragraph renders as continuous text with blanks, paginated at ~20 blanks/page without ever splitting a sentence, each page showing its own shuffled word bank.
- [ ] A child can drag (or click-then-click) bank items into blanks; wrong drops bounce back with no penalty; the session completes only once every blank on every page is correctly filled.
- [ ] A correctly-filled blank grades the real underlying `words`/`vocab_phrases` row via the existing `gradeWord`/`gradeVocabPhrase` functions, tiered by retry count (1st try = easy, 2nd = good, 3rd+ = hard).
- [ ] A correctly-filled phrase blank also grades every component character found standalone in `words`, at the same earned tier.
- [ ] Pausing and resuming mid-page preserves exactly which blanks are already correct and each remaining blank's retry count so far.
- [ ] A completed paragraph-quiz session awards coins as one session-level sum (50/40/20/10 at the <25%/<50%/<75%/else error-rate thresholds), not a per-blank accumulation, and the payout is fair across different paragraph lengths for the same accuracy.
- [ ] A paragraph cannot be deleted while it has an active packaged quiz session; deleting one with none behind it requires confirmation.
- [ ] A test mode cannot be deleted while it has its own active packaged quiz session; deleting one with none behind it requires confirmation — mirroring the paragraph rule exactly.
- [ ] A word or phrase referenced by *any* active packaged session's target — character, phrase, mixed, or paragraph-quiz — cannot be deleted from `/words/all`; deletion of anything not so referenced is completely unaffected.
- [ ] `/words/results` shows a clickable popup listing every tested/failed item for **every** completed session row, replacing the old inline wrapped list universally, not just for paragraph-quiz rows.
- [ ] `scripts/verify-rls.ts` passes after the schema migration.
- [ ] Live-QA checklist (see Risks and Test plan) completed against a dev Supabase project, not mocked tests alone.

## Open questions

All open questions are now resolved by explicit user direction: tier mapping (1st=easy/2nd=good/3rd+=hard, `again` confirmed unreachable), the coin rule and its threshold table, drag-and-click both required, paragraph deletion requires confirmation (when not blocked), and every deletion-protection/results-popup change generalizes to *all* packaged sessions, not just paragraph-quiz ones, for consistency.

1. ~~Coin-formula scaling~~ — **Resolved.** Switched from an absolute total-incorrect-tries count to an error *rate* (`totalIncorrectTries / totalBlanks`) against the same 25%/50%/75% breakpoints the original 5/10/15 numbers imply at the ~20-blank pagination reference size — same four payouts, same bounded-per-session shape, judged fairly across different paragraph lengths instead of penalizing long ones and letting short ones off easy. See Proposed Behavior → Coins.
2. ~~Does phrase→component-character grading propagation increment `testCount`?~~ — **Resolved 2026-08-19: no (Option B).** Component characters are nudged via a tier-parameterized `nudgeWordFamiliarity`, not a raw `gradeWord` call — `reviewCount` and scheduling update, `testCount` (the "Times Tested" stat) stays exactly what it's always meant: how many times a character was itself directly the blank, never inflated by incidental exposure inside a correctly-answered phrase. See Proposed Behavior → Runtime integration item 5, and Edge Cases for the shared-component-across-multiple-phrases walkthrough.
3. ~~Does the new word/phrase deletion block extend to ordinary (non-paragraph) packaged sessions too?~~ — **Resolved 2026-08-19: yes.** `getActiveSessionTargetKeys` covers every active session's targets — character, phrase, mixed, and paragraph-quiz alike — for consistency. See Proposed Behavior → Word/phrase deletion protection.
4. ~~Does the new paragraph-deletion confirmation dialog also apply retroactively to Phase 2's test-mode deletion?~~ — **Resolved 2026-08-19: yes.** `hasActiveTestModeQuizSession` gives Delete Test Mode the identical block-then-confirm treatment as Delete Paragraph. See Proposed Behavior → Delete Paragraph / Delete Test Mode.
5. ~~`/words/results` popup scope~~ — **Resolved 2026-08-19: applies to every session row**, not paragraph-quiz-row-specific. The clickable popup replaces today's inline wrapped Tested/Failed Characters list universally, for consistency; `truncateCharacters`/`isCharacterListTruncated` become removable. See Proposed Behavior → Results page.
