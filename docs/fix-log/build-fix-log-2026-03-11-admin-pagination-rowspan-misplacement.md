# Fix Log – 2026-03-11 – Admin Pagination: rowSpan Misplacement on Page 2+

## Context

The admin content page (`/words/admin`) froze when clicking "Next Page" with tag filters active. After reloading, the page rendered but content was visually misplaced — character and meaning columns were missing for rows mid-group, causing all subsequent columns to shift left.

## Root Cause

`characterRowSpan` and `meaningRowSpan` (and their paired `showCharacterCell` / `showMeaningCell` booleans) were computed **once** on the full unfiltered `adminTableRows` list in `words.shared.state.ts`. The span values encoded global row indices (e.g. "row 26 starts a new character group"). When the UI sliced a page from the middle of that list, page 2+ would begin mid-group:

- `showCharacterCell` was `false` for the first row on the page (because it wasn't the first row globally)
- `characterRowSpan` was `0`
- The `<td>` for the character column was not rendered at all
- Every column after it shifted one cell to the left, producing the misplacement visible in the screenshot

The page freeze was likely caused by React attempting to reconcile an inconsistent `<table>` DOM (overlapping/missing `rowSpan` cells stalling the layout engine).

## Changes Applied

### `src/app/words/shared/words.shared.state.ts`
- Removed `adminTableRenderRows` computed memo (span pre-computation)
- Now exports `adminTableRows` (raw `AdminTableRow[]`) instead

### `src/app/words/admin/AdminSection.tsx`
- Added module-level pure function `computeRenderRows(rows: AdminTableRow[]): AdminTableRenderRow[]`
  - Recomputes character group spans and meaning group spans on the given slice
  - Identical span logic to what was previously in `words.shared.state.ts`
- Updated `paginatedAdminRenderRows` memo to call `computeRenderRows(pageRows)` after slicing
- Updated destructured VM prop from `adminTableRenderRows` → `adminTableRows`
- Updated `filteredByStatsAdminRenderRows` to filter `adminTableRows` (type is now `AdminTableRow[]`)

## Architectural Impact

**Service/domain layer:** None — no data fetching or scheduler logic touched.

**UI layer:** Span computation moved from shared state into the component that owns pagination. This is the correct layer boundary: the shared state produces a flat ordered list; the rendering component is responsible for how that list is displayed (including visual grouping per page).

**Type safety:** `AdminTableRow` (raw) and `AdminTableRenderRow` (with span fields) remain separate types. The boundary is now explicit — raw rows leave state, render rows are produced at render time.

## Preventative Rule

When paginating a table with `rowSpan` groupings:
- **Never pre-compute `rowSpan` on the full dataset.** Span values are a rendering concern, not a data concern.
- Always compute `showCell` / `rowSpan` fields **after** the final paginated slice is determined.
- If group-span logic is needed in multiple places, extract it as a pure module-level function (not a hook or memo in shared state).

## Docs Updated

- `0_ARCHITECTURE.md` — No update needed (no layer boundary change)
- `0_BUILD_CONVENTIONS.md` — No update needed
- `0_PRODUCT_ROADMAP.md` — No update needed
