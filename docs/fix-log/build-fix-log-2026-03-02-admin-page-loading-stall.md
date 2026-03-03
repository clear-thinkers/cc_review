# Fix Log - 2026-03-02 - Admin Page Loading Stall

## Context
`/words/admin` could appear to load indefinitely (multi-minute stall) on larger local datasets.

## Root Cause
- Admin target hydration performed one dictionary lookup per character.
- Each lookup could trigger a linear scan over `char_detail.json` entries.
- Runtime also called a test-only Xinhua cache reset when entering admin, forcing cold-cache work.
- Saved-content hydration performed one IndexedDB read per target instead of a bulk read.

## Changes Applied
- Added a character index cache in `src/lib/xinhua.ts` for O(1) dictionary entry lookup.
- Removed runtime call to `resetXinhuaCachesForTests()` from admin page initialization.
- Replaced per-target `getFlashcardContent(...)` reads with a single `getAllFlashcardContents()` read and key map in admin hydration.

## Architectural Impact
- Service/UI performance optimization only.
- No schema changes.
- No API contract changes.
- No scheduler or grading changes.

## Preventative Rule
When hydrating admin targets, avoid per-item linear scans and per-item IndexedDB reads. Use indexed dictionary lookup and bulk persistence reads.

## Docs Updated
- AI_CONTRACT.md: no - no contract behavior changed.
- 0_ARCHITECTURE.md: no - no boundary or schema change.
- 0_BUILD_CONVENTIONS.md: no - project conventions unchanged.
- 0_PRODUCT_ROADMAP.md: no - bug fix only.
