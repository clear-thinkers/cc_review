# Due Review Queue - Processing Flow and Risks

_Created: 2026-02-27_
_Covers: `/words/review` route, due refresh, fill-test derivation, and review-route handoff_

> Authoritative behavior rules are maintained in `0_ARCHITECTURE.md` under `Due Review Queue Rules`.
> This companion doc covers implementation flow, caveats, and extension guardrails.

---

## Entry Point

- `/words` redirects to `/words/review`
- UI host: `WordsWorkspace` with `page="review"`

---

## Processing Flow

1. Route load triggers `refreshAll()`:
   - `refreshWords()` reads all words ordered by `createdAt` descending.
   - `refreshDueWords()` reads due rows from `getDueWords()`.
2. Due rows are initially ordered by `nextReviewAt`, then `createdAt` tie-breaker.
3. Saved flashcard content is loaded via `getAllFlashcardContents()`.
4. Due rows are enriched in-memory:
   - derive fill-test payload from saved content
   - fallback to cloned persisted `word.fillTest` if present
   - else keep `fillTest` undefined
5. Due list and manual selection state are updated in memory.
6. User actions:
   - global start flashcard/fill-test review
   - per-row flashcard/fill-test handoff with `wordId` route parameter
   - client-side due-table sorting toggles

---

## In-Memory Invariants

1. Due header count equals current `dueWords.length`.
2. Missing/zero `nextReviewAt` renders as `Now`.
3. Fill-test actions are disabled when no usable `fillTest` is present.
4. Manual selection IDs are pruned to valid due rows that still have fill-test availability.

---

## Known Risks and Caveats

1. Refresh path reads full `words` and full `flashcardContents`, then derives due enrichments client-side.
2. Fill-test availability depends on saved content quality and schema consistency.
3. Large datasets may degrade due-list derivation and sort performance.
4. Due review state currently depends on shared multi-page workspace state complexity.

---

## Extension Guardrails

1. Keep due-route responsibilities read-only and route-handoff-only.
2. Keep scheduler mutations in dedicated review session paths.
3. Do not move content admin persistence into `/words/review`.
4. If changing due semantics, update `getDueWords()`, scheduler assumptions, and architecture docs together.
5. If changing fill-test eligibility semantics, update admin derivation rules and due-route derivation rules together.

---

## Archive Note

- Source file archived from `docs/architecture/2026-02-27-due-review-page.md` to `docs/archive/2026-02/2026-02-27-due-review-page.md` on 2026-02-27.
