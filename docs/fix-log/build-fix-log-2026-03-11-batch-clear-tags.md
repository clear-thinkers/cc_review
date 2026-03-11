# Fix Log — 2026-03-11 — Batch Clear Tags on All Characters Page

## Problem

Users had no way to remove lesson tags from characters once assigned. If a tag was
applied by mistake (wrong textbook, grade, unit, or lesson), there was no correction
path — users could only overwrite with a new tag, accumulating incorrect entries.

## Scope

All Characters page (`/words/all`) — parent and platform_admin roles only.
No schema migration required; the existing `word_lesson_tags` table supports deletes.

## Changes

### `src/lib/supabase-service.ts`
Added `clearWordLessonTags(wordIds: string[]): Promise<void>`.

- Deletes all `word_lesson_tags` rows matching the given word IDs scoped to the
  current family (`family_id` from session JWT metadata).
- Leaves `lesson_tags` and `textbooks` rows intact — only the word ↔ tag associations
  are removed.
- Fully RLS-aligned: the `.eq("family_id", familyId)` filter mirrors what RLS enforces,
  so no cross-family deletions are possible.

### `src/app/words/shared/tagging.strings.ts`
Added to `en.allEditor` and `zh.allEditor`:
- `clearTags` — button label ("Clear Tags" / "清除标签")
- `clearingTags` — in-progress state ("Clearing..." / "清除中...")
- `clearTagsSuccess` — "{count} words cleared" confirmation
- `clearTagsError` — failure message
- `tooltips.clearTags` — accessible tooltip

### `src/app/words/all/AllWordsSection.tsx`
- Imported `clearWordLessonTags` from the service layer.
- Added `tagClearing` boolean state.
- Added `handleBatchClearTags()` async handler: validates selection, calls service,
  refreshes data, sets notice.
- Restructured the `{!isChild && ...}` editor block:
  - Notice paragraph moved above both panels so it surfaces for both save and clear
    actions.
  - Panels wrapped in `flex flex-col gap-2 lg:flex-row lg:items-start` container.
  - Tag Assignment panel gets `flex-1` (narrows on wide screens to make space).
  - New **Clear Tags panel** (`shrink-0 lg:w-40`) placed beside the tag panel at
    `lg` breakpoint and below it on small screens. Styled with rose/red tones to
    clearly distinguish it from the green "Save tags" action.
  - Clear Tags button is disabled when no words are selected or another action
    is in progress.

## Behaviour

1. User selects one or more characters via the row checkboxes.
2. User clicks **Clear Tags** (rose button in the Clear Tags panel).
3. All `word_lesson_tags` associations for those word IDs are deleted.
4. Data refreshes; the Tags column for the affected rows goes empty.
5. Success notice: "Cleared tags for N words."

## Docs Check

- `0_ARCHITECTURE.md` — All Characters Inventory Rules are unchanged; no new
  table, boundary, or product rule introduced. No update needed.
- `0_BUILD_CONVENTIONS.md` — No convention change. No update needed.
- `0_PRODUCT_ROADMAP.md` — No new feature; this is a correctability improvement
  within the Character Level Tagging feature (Phase 2 #7). No update needed.
