# Build Fix Log - 2026-02-26

## Issue
- `npm run build` failed during prerender with:
  - `useSearchParams() should be wrapped in a suspense boundary at page "/words/add"`.

## Root Cause
- `WordsWorkspace` uses `useSearchParams` in a client component.
- Route wrapper pages rendered `WordsWorkspace` directly without a `Suspense` boundary.
- Next.js static prerender for these routes requires a suspense boundary around this client-side search-param usage path.

## Fix Applied
- Added `Suspense` wrappers (`fallback={null}`) in route wrapper pages that render `WordsWorkspace`:
  - `src/app/words/add/page.tsx`
  - `src/app/words/all/page.tsx`
  - `src/app/words/admin/page.tsx`
  - `src/app/words/review/page.tsx`
  - `src/app/words/review/flashcard/page.tsx`
  - `src/app/words/review/fill-test/page.tsx`

## Validation
- Ran `npm run build` after patch.
- Result: success.
- Build output confirms static generation completes for all app routes, including:
  - `/words/add`
  - `/words/all`
  - `/words/admin`
  - `/words/review`
  - `/words/review/flashcard`
  - `/words/review/fill-test`

