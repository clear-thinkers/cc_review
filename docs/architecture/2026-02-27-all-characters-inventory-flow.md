# All Characters Inventory - Processing Flow and Risks

_Created: 2026-02-27_
_Covers: `/words/all` route, summary computation, sorting, reset/delete operations_

> Authoritative behavior rules are maintained in `0_ARCHITECTURE.md` under `All Characters Inventory Rules`.
> This companion doc covers implementation flow, risks, and iteration guardrails.

---

## Entry Point

- Route: `/words/all`
- UI host: `WordsWorkspace` with `page="all"`

---

## Data Inputs

- `db.words` rows from IndexedDB
- `getDueWords()` output used by shared summary state
- Scheduler-derived familiarity via `getMemorizationProbability`

---

## Processing Flow

1. Initial render triggers `refreshAll()`.
2. `refreshWords()` loads all word rows.
3. `refreshDueWords()` recomputes due rows and fill-test derivations in shared state.
4. `allWordsSummary` computes card metrics:
   - total words
   - total reviewed
   - total tested
   - average familiarity
5. `sortedAllWords` computes table rows with current sort key/direction.
6. User actions:
   - Sort header click updates sort key/direction and re-renders rows.
   - `Reset` rewrites baseline schedule fields via `db.words.put(...)`, then refreshes state.
   - `Delete` removes row via `db.words.delete(id)`, then refreshes state.

---

## Operational Caveats

1. Add flow is check-then-add, so duplicate Hanzi race conditions can inflate inventory totals.
2. Delete is immediate at UI level and has no built-in undo.
3. Sort and summary calculations are full-array in memory and may degrade for very large datasets.
4. Deleting a word does not cascade-delete saved flashcard content for matching character/pronunciation.
5. Page-level automated tests for sorting/action flows are currently absent.

---

## Future Guardrails

1. Keep summary metric definitions stable unless explicitly versioned.
2. Preserve deterministic tie-break ordering (`createdAt`) when extending sort behavior.
3. Define precedence if filters/search are added alongside existing sort mechanics.
4. Add explicit confirmation and error handling for any future bulk destructive actions.
5. If multi-device sync is introduced, redefine reset/delete semantics with conflict policy.

---

## Archive Note

- Source file archived from `docs/architecture/2026-02-27-all-characters-page.md` to `docs/archive/2026-02/2026-02-27-all-characters-page.md` on 2026-02-27.
