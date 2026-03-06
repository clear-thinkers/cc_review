# Due Review Page

## 1. Purpose
- What problem this page solves
  - The page provides a deterministic queue view of characters that are currently due for review, so the learner can act only on items whose `nextReviewAt` has passed (or is missing/zero and treated as due).
  - It also surfaces which due characters are eligible for fill-test (derived from saved flashcard content).
- Why it exists in the product loop
  - It is the routing and decision point between backlog visibility and active review sessions.
  - The default `/words` route redirects here, making it the operational entry point of the review loop.

## 2. Responsibilities
- What this page is allowed to do
  - Read all words and due words from local IndexedDB-backed APIs.
  - Derive due-list presentation state (sorting, familiarity display, due count).
  - Derive per-word fill-test availability from saved flashcard content.
  - Route to flashcard or fill-test review pages, optionally scoped to one word via `wordId`.
- What it must NOT do
  - It must not grade words or update spaced-repetition schedule fields directly on `/words/review`.
  - It must not persist flashcard/fill-test content edits.
  - It must not create/delete words.
  - It must not run review-session logic in-page; it only hands off to sibling review routes.

## 3. Data Dependencies
- Which models/types it consumes
  - `Word` (`src/lib/types.ts`)
  - `FillTest` (`src/lib/fillTest.ts`) as derived/attached review metadata
  - `FlashcardLlmResponse` content via `getAllFlashcardContents()` (`src/lib/db.ts`)
- Which fields it reads/writes
  - Reads from `Word`: `id`, `hanzi`, `createdAt`, `nextReviewAt`, `repetitions`, `intervalDays`, `ease`, optional `fillTest`, optional `reviewCount`, optional `testCount`.
  - Reads from flashcard content: `character`, `content.meanings[].phrases[]`, including `phrase`, `example`, `include_in_fill_test`.
  - Persistent writes on `/words/review`: none.
  - In-memory writes: React state for `words`, `dueWords`, loading, and due-list sort controls.
- Any coupling to scheduler or persistence
  - Due eligibility is sourced through `getDueWords()`, which queries `words.nextReviewAt <= now` and rechecks missing timestamps through `isDue(...)` from scheduler logic.
  - Familiarity percentage is computed client-side from scheduler state fields (`ease`, `intervalDays`, `nextReviewAt`, `repetitions`) using a forgetting-curve formula.
  - Fill-test availability is coupled to persistence schema/content quality in `flashcardContents`.

## 4. Processing Flow
- Page load sequence
  - Route `/words/review` renders `WordsWorkspace page="review"`.
  - Initial `useEffect` calls `refreshAll()`:
    - `refreshWords()` loads all words ordered by `createdAt` desc.
    - `refreshDueWords()` loads due words, sorts by due time then creation time, enriches each with derived `fillTest` from saved flashcard content (fallback: clone existing `word.fillTest`, else `undefined`), and updates `dueWords`.
  - `loading` is set to `false` after refresh completes.
- State transitions
  - `loading: true -> false` after initial refresh.
  - `dueWords` is recomputed on each refresh and re-sorted in-memory by the active due sort key/direction.
  - Due sort toggles:
    - same key: direction flips
    - new key: key changes and direction resets (`hanzi` asc, others desc).
- User interactions
  - Click `Start flashcard review` -> `router.push("/words/review/flashcard")`.
  - Click `Start fill-test review` -> `router.push("/words/review/fill-test")` (disabled if no due words have fill-test).
  - Per-row actions route to the same pages with `?wordId=<id>`.
  - Column header buttons toggle due-table sorting.
- Side effects
  - IndexedDB reads (`db.words`, `getDueWords`, `getAllFlashcardContents`).
  - Local state updates for due data and sorting.
  - Client-side navigation via Next.js router.

## 5. Invariants (Must Always Be True)
- UI invariants
  - Due count shown in header equals `dueWords.length`.
  - Fill-test start action is disabled when there are zero due words with a usable fill-test.
  - Fill-test action button is disabled per row when that row lacks `fillTest`.
  - Table rows map one-to-one to `sortedDueWords`.
- Data invariants
  - `dueWords` only contains words considered due by `getDueWords()` at refresh time.
  - Missing/zero `nextReviewAt` is treated as due and rendered as `"Now"`.
  - A derived fill-test exists only when at least 3 valid phrase/example candidates are available from saved content, with each example containing its phrase.
  - Manual fill-test selection state is pruned to valid due words with fill-tests during refresh.
- Performance assumptions
  - Current flow assumes full-table reads are acceptable: all words and all flashcard content are loaded on refresh.
  - In-memory sorting and fill-test derivation are expected to be fast enough for current dataset size.

## 6. Edge Cases
- Empty state
  - While loading: shows loading message.
  - After load with no due words: shows "No due characters right now."
  - If due words exist but none have fill-tests: fill-test start is disabled.
- Corrupt data
  - Words missing `nextReviewAt` are still handled as due.
  - Flashcard phrase rows with blank phrase/example, phrase not present in example, or duplicate normalized phrase are skipped for fill-test derivation.
  - If fewer than 3 valid rows remain, fill-test is treated as unavailable for that word.
- Future compatibility concerns
  - The page depends on `flashcardContents` phrase schema (`include_in_fill_test`, `phrase`, `example`) for fill-test availability.
  - The route behavior assumes sibling pages `/words/review/flashcard` and `/words/review/fill-test` remain the handoff targets.

## 7. Known Risks
- Technical debt
  - Due Review lives inside a large multi-page `WordsWorkspace` component with shared state for unrelated pages.
  - Initial refresh path has no local error handling; data-read failures can prevent normal ready-state behavior.
- Tight coupling
  - Due-page availability of fill-test depends on content-admin/flashcard content quality and schema consistency.
  - Familiarity display logic is tightly coupled to scheduler field semantics (`ease` as stability days).
- Scalability concerns
  - Refresh reads entire `words` and entire `flashcardContents` collections, then performs client-side derivation/sorting.
  - Fill-test derivation runs on each due refresh rather than using a precomputed index.

## 8. Explicit Non-Goals
- What should never be added to this page
  - Direct grading controls that mutate schedule state.
  - Content authoring/editing workflows for flashcard data.
  - Word ingestion or destructive word-management operations.
- Features that belong elsewhere
  - Active review session execution and scoring: `/words/review/flashcard` and `/words/review/fill-test`.
  - Content generation/admin operations: Content Admin route.
  - Character ingestion: Add Characters route.

## 9. Extension Boundaries
- Where new features may be added safely
  - Presentation-only enhancements to due-table rendering (new columns from already-loaded data, formatting changes, sort UX).
  - Non-persistent UI controls that do not alter scheduling or persistence contracts.
  - Additional routing shortcuts that still hand off to dedicated review-session routes.
- Where changes would require architecture review
  - Any change to due eligibility semantics (`getDueWords`, scheduler `isDue`, or `nextReviewAt` interpretation).
  - Any persistent schema/API changes for `Word` scheduling fields or flashcard content structure used for fill-test derivation.
  - Moving grading, generation, or admin persistence into `/words/review`.
  - Breaking the current route handoff contract to flashcard/fill-test pages.
