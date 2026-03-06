# All Characters Page

> Authoritative behavior rules for this page are maintained in `0_ARCHITECTURE.md` under `All Characters Inventory Rules`.
> This dated doc is retained for processing flow, page boundaries, risks, and iteration guardrails.

## Purpose

The All Characters page is the canonical inventory view for all added characters.
It provides:

- total inventory and progress metrics
- sortable per-character status
- maintenance actions (`Reset`, `Delete`)

This page is the operational source for quick auditing of learning state across the whole local dataset.

## Entry Point

- Route: `/words/all`
- UI host: `WordsWorkspace` with `page="all"`

## Data Sources

- `db.words` (IndexedDB via Dexie)
- `getDueWords()` output (shared global summary dependency)
- scheduler-derived familiarity (`getMemorizationProbability`)

## Rules

1. The page lists all rows in `db.words`.
2. Metrics are computed from current in-memory `words` state:
   - `Total Characters`: `words.length`
   - `Times Reviewed`: sum of `reviewCount` fallback `repetitions`
   - `Times Tested`: sum of `testCount`
   - `Avg Familiarity`: mean of scheduler probability per word
3. Table sorting is client-side and single-column at a time.
4. Re-clicking the active sort column toggles direction (`asc`/`desc`).
5. Tie-breaker for every sort path is `createdAt` ascending.
6. `Next Review Date` displays `Now` when timestamp is empty/zero.
7. `Reset` keeps the same row id/hanzi but rewrites scheduling counters as new.
8. `Delete` permanently removes the word row from local DB.
9. All operations are local-only (no server sync).

## Processing Flow

1. Component boot calls `refreshAll()`.
2. `refreshWords()` loads all rows from IndexedDB ordered by `createdAt` desc.
3. `refreshDueWords()` recomputes due set and fill-test derivations (shared app state).
4. `allWordsSummary` memo computes top stat cards.
5. `sortedAllWords` memo computes sortable table rows.
6. User actions:
   - sort header click -> updates sort key/direction state -> rerenders table
   - `Reset` -> `db.words.put(...)` with new baseline schedule -> `refreshAll()`
   - `Delete` -> `db.words.delete(id)` -> `refreshAll()`

## Boundaries

1. The page does not generate or edit flashcard/admin content.
2. The page does not deduplicate historical duplicate rows; it renders stored data as-is.
3. The page does not confirm destructive deletes.
4. The page does not paginate or virtualize large datasets.
5. The page owns display/sorting only; scheduling rules live in `scheduler.ts`.

## Risks And Caveats

1. Duplicate race risk: add flow is check-then-add without a unique `hanzi` constraint, so same character can be inserted concurrently and inflate totals.
2. Operational risk: `Delete` is immediate and irreversible at UI level.
3. Performance risk: sort and aggregate are full-array in-memory operations; very large datasets may slow rendering.
4. Data-lifecycle gap: deleting a word does not automatically remove any saved flashcard content for that character/pronunciation.
5. Test gap: there are no page-level tests for All Characters sorting and action flows.

## Future Iteration Guardrails

1. Keep stats definitions stable unless explicitly versioned in docs.
2. Preserve tie-break behavior (`createdAt`) to avoid unstable row ordering.
3. If adding filters/search, define interaction precedence with current sort behavior.
4. If adding bulk actions, require confirmation and rollback/error messaging.
5. If moving to multi-device sync, re-define `Reset/Delete` semantics with conflict rules.

## Update - 2026-02-27

- Folded authoritative inventory and boundary rules into `0_ARCHITECTURE.md` (`All Characters Inventory Rules`).
- Retained this dated file as the active companion for flow, boundaries detail, risks, and iteration guardrails.
