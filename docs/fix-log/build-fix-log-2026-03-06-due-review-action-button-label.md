# Fix Log – 2026-03-06 – Due Review Action Button Label

## Context
Parent profile saw "Fill test" label on the per-row action button in the due review page instead of "Flashcard".

## Root Cause
Two bugs in `DueReviewSection.tsx` per-row action cell:
1. The fill-test `<button>` was nested inside the flashcard `<button>` (invalid HTML).
2. The flashcard button's text content used `str.due.table.fillTest` instead of `str.due.table.flashcard`.

When `canAccessFillTest` was false (parent role), the nested fill-test button was hidden but the outer button still rendered with the "Fill test" label.

## Changes Applied
- `src/app/words/review/DueReviewSection.tsx`: Unnested the buttons so flashcard and fill-test are sibling elements; corrected the flashcard button label to `str.due.table.flashcard`.

## Architectural Impact
None. UI-only fix within a single component.

## Preventative Rule
Per-row action buttons must be sibling elements, never nested. Button labels must reference the correct string key matching the action they trigger.

## Docs Updated
- No architecture doc changes needed (behavior already correctly specified in Role-Based Routing Rules and Due Review Queue Rules).
