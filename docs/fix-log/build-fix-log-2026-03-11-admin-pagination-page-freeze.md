# Fix Log – 2026-03-11 – Admin Content: Page Freeze on Page Transition

## Context

Admin Content screen (`/words/admin`) froze when clicking Next from page 3 → page 4 (unfiltered). When a tag filter was applied, the freeze occurred on page 1 → page 2. Reported by a prod user with 5 pages of content (≈ 125 admin table rows).

## Root Cause

### 1. Synchronous blocking render on page navigation

`setCurrentPage(N)` was called directly in each pagination button's `onClick` handler without `startTransition`. React treated each page change as a high-priority synchronous update, which:

- Unmounted all 25 `AdminTableRowComponent` instances from the current page
- Mounted 25 new `AdminTableRowComponent` instances for the target page

Each row is a complex component with multiple buttons, conditional inputs, and pinyin ruby elements. The combined unmount + mount across 25 rows in a single synchronous render blocked the main thread long enough to cause a perceptible browser freeze. Later pages are more affected because they contain denser content (more phrases, longer sentences, more ruby elements).

### 2. Dead `adminTableRenderRows` useMemo in `words.shared.state.ts` (leftover from previous fix)

The prior fix log (`build-fix-log-2026-03-11-admin-pagination-rowspan-misplacement.md`) claimed the `adminTableRenderRows` computed memo was removed from `words.shared.state.ts` — but it was not. The memo (lines 660–720) was still running span computation over the full `adminTableRows` list on every `adminTableRows` change, doing O(n) work that was discarded because the result was never exported or used. This was harmless to correctness but wasteful.

## Changes Applied

### `src/app/words/admin/AdminSection.tsx`

- Added `useTransition` to imports
- Added `const [isPageTransitionPending, startPageTransition] = useTransition();`
- Wrapped all four pagination button `onClick` handlers in `startPageTransition(...)`:
  - First: `startPageTransition(() => setCurrentPage(1))`
  - Previous: `startPageTransition(() => setCurrentPage((p) => Math.max(1, p - 1)))`
  - Next: `startPageTransition(() => setCurrentPage((p) => Math.min(totalPages, p + 1)))`
  - Last: `startPageTransition(() => setCurrentPage(totalPages))`
- Added `opacity-50` class to the table while `isPageTransitionPending` is true (visual feedback during transition)

With `useTransition`, React marks the page update as non-urgent. The current page remains visible and interactive while React computes the new page in the background, yielding to the browser between units of work. Once the new page is ready, it commits atomically.

### `src/app/words/shared/words.shared.state.ts`

- Removed the unused `adminTableRenderRows` useMemo (span pre-computation on full list, ~60 lines)
- Removed the now-unused `AdminTableRenderRow` type import

## Behaviour After Fix

- Navigating between pages does not block the main thread
- The table dims (`opacity-50`) while the transition is in-flight, snapping to full opacity when the new page rows commit
- All page transitions (first, previous, next, last) benefit from the same non-blocking update path
- No functional change to filter logic, data loading, or scheduler logic

## Architectural Impact

**Service/domain layer:** None.

**UI layer:** Page navigation in `AdminSection` now uses React's concurrent transition API. This is the correct pattern for any large list re-render triggered by a UI control. The shared state is now leaner (no dead span-computation memo).

## Preventative Rule

Any `setState` call that drives a full re-render of a large list or table should be wrapped in `startTransition` (or `useTransition`) to prevent blocking the main thread. This applies to all paginated views.

## Docs Updated

- `0_ARCHITECTURE.md` — No update needed
- `0_BUILD_CONVENTIONS.md` — No update needed
- `0_PRODUCT_ROADMAP.md` — No update needed
