# Fix Log — 2026-03-06 — Child Destructive Action Guards

## Problem

Child profiles had access to destructive action buttons:
- **Reset** and **Delete** word buttons on `/words/all` (All Characters page)
- **Clear History** button on `/words/results` (Quiz Results page)

Children should only view data on these pages, not modify or delete it.

## Root Cause

No role-based conditional rendering was applied to these action buttons. They rendered identically for all authenticated users.

## Fix

### `/words/all` — AllWordsSection.tsx
- Import `useSession` from `@/lib/authContext`
- Derive `isChild` from `session?.role === "child"`
- Wrap the Actions column header and Reset/Delete button cell in `{!isChild && ...}`

### `/words/results` — ResultsPage.tsx + SessionHistoryTable.tsx
- Import `useSession` in `ResultsPage`
- Pass `hideDestructiveActions={isChild}` prop to `SessionHistoryTable`
- Add `hideDestructiveActions?: boolean` to `SessionHistoryTableProps`
- Conditionally render Clear History button only when `!hideDestructiveActions`

### Docs updated
- `0_ARCHITECTURE.md` — All Characters Inventory Rules: added rule 9 (Reset/Delete hidden for child)
- `0_ARCHITECTURE.md` — Quiz Results Rules: added Clear History hidden for child
- `0_ARCHITECTURE.md` — Role-Based Routing Rules: added "In-page action restrictions (child role)" section

## Files Changed

| File | Change |
|---|---|
| `src/app/words/all/AllWordsSection.tsx` | Hide Reset/Delete buttons + Actions header for child role |
| `src/app/words/results/ResultsPage.tsx` | Pass `hideDestructiveActions` to SessionHistoryTable |
| `src/app/words/results/SessionHistoryTable.tsx` | Accept and respect `hideDestructiveActions` prop |
| `docs/architecture/0_ARCHITECTURE.md` | Document child restrictions in 3 sections |

## Regression Risk

Low. Changes are purely additive conditional rendering. No logic, data, or scheduler changes.
