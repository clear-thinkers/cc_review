# All Characters Inventory - Processing Flow and Risks

_Created: 2026-02-27_
_Updated: 2026-03-11_ (Batch Tag Management section; Supabase data inputs; tag clear/add actions)
_Covers: `/words/all` route, summary computation, sorting, reset/delete operations, batch tag management_

> Authoritative behavior rules are maintained in `0_ARCHITECTURE.md` under `All Characters Inventory Rules`.
> This companion doc covers implementation flow, risks, and iteration guardrails.

---

## Entry Point

- Route: `/words/all`
- UI host: `WordsWorkspace` with `page="all"`

---

## Data Inputs

- `words` rows from Supabase (via `supabase-service.ts`)
- `word_lesson_tags` join rows resolved to `WordLessonTagsMap` via `getWordLessonTagsForFamily()`
- Scheduler-derived familiarity via `getMemorizationProbability`

---

## Processing Flow

1. Initial render triggers `refreshAllData()`.
2. `refreshWords()` loads all word rows from Supabase.
3. `allWordsSummary` computes card metrics:
   - total words
   - total reviewed
   - total tested
   - average familiarity
4. `sortedAllWords` computes table rows with current sort key/direction.
5. `wordTagsMap` resolves lesson tag pills per word via `getWordLessonTagsForFamily()`.
6. User actions:
   - Sort header click updates sort key/direction and re-renders rows.
   - `Reset` rewrites baseline schedule fields via Supabase, then refreshes state.
   - `Delete` removes row from Supabase immediately (no confirmation dialog).
   - **Batch Tag Management** (parent/platform_admin only) — expandable section, collapsed by default:
     - Expand link label: "Batch Tag Management" / "标签管理".
     - User selects rows via checkboxes; selected count shown in panel header.
     - **Add tags**: cascade 4-level selection (Textbook → Grade → Unit → Lesson); calls
       `createLessonTagIfNew` + `assignWordLessonTags`; refreshes data.
     - **Clear Tags**: removes all `word_lesson_tags` associations for selected word IDs via
       `clearWordLessonTags`; refreshes data. Family-scoped by `family_id` JWT claim.
     - **Clear selection**: deselects all checked rows (client-only, no server call).
     - Button order in panel: Add tags (emerald) · Clear Tags (rose) · Clear selection (gray).

---

## Operational Caveats

1. Add flow is check-then-add, so duplicate Hanzi race conditions can inflate inventory totals.
2. Delete and Clear Tags are immediate at UI level and have no built-in undo.
3. Sort and summary calculations are full-array in memory and may degrade for very large datasets.
4. Deleting a word does not cascade-delete saved flashcard content for the matching character.
5. Clear Tags removes `word_lesson_tags` associations only — `lesson_tags` and `textbooks` rows are preserved.
6. Page-level automated tests for sorting/action flows are currently absent.

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
