# Debug Tools Page — `/words/debug`

_Created: 2026-03-10_

---

## Overview

A platform-admin-only debug page at `/words/debug` providing in-app database maintenance tools. The initial tool cleans up orphaned `flashcard_contents` rows — rows that exist in the database but have no matching `hanzi` in the `words` table for the same `family_id`.

---

## Why This Page Exists

`flashcard_contents` is not foreign-keyed to `words`. Orphaned rows can accumulate when:
- A preload batch generates content for characters that are subsequently deleted from `words`.
- An interrupted or partial bulk operation leaves stale content behind.

Since there is no database-level cascading delete, a manual cleanup mechanism is needed. This page provides that mechanism under a protected admin-only route.

---

## Access Control

- **Route:** `/words/debug`
- **Permission:** Platform admin only (`isPlatformAdmin === true`)
- Enforced in `src/lib/permissions.ts` (switch case returning `isPlatformAdmin`)
- Nav item filtered from non-admin accounts by `canAccessRoute` inside `getNavItems()`
- Direct URL access blocked by `RouteGuard` for all non-platform-admin roles

---

## Layer Impact

| Layer | Files Changed |
|---|---|
| UI | `src/app/words/debug/DebugSection.tsx` (new), `src/app/words/debug/page.tsx` (new), `src/app/words/WordsWorkspace.tsx` |
| Service | `src/lib/permissions.ts`, `src/app/words/shared/words.shared.utils.tsx` |
| Types | `src/app/words/shared/shell.types.ts` |
| Strings | `src/app/words/words.strings.ts` |

No new database tables. No schema migration required. Uses existing `getAllFlashcardContents()` and `deleteFlashcardContentByHanzi()` from `src/lib/supabase-service.ts`.

---

## Behavior

### Clean Orphaned Flashcard Content

1. Fetches all `words` rows and all `flashcard_contents` rows for the current family via `getAllFlashcardContents()` and `getAllWords()`.
2. Derives the set of valid `hanzi` from `words`.
3. Filters `flashcard_contents` to entries whose `character` is not in the valid set — these are orphans.
4. If no orphans: displays "No orphaned content found. Database is clean."
5. If orphans found: prompts `window.confirm` listing the affected characters and count.
6. On confirmation: calls `deleteFlashcardContentByHanzi(hanzi)` for each unique orphaned character.
7. Displays the count and characters of deleted rows on completion.
8. On cancellation or error: displays appropriate inline message.

---

## Future Extension

This page is intentionally minimal. Additional tools that could be added here:
- Orphaned `word_lesson_tags` cleanup (tags pointing to deleted words)
- Duplicate `flashcard_contents` key detection
- Quiz session integrity checks
- RLS policy audit helpers

---

## Files Created / Modified

| File | Type | Change |
|---|---|---|
| `src/app/words/debug/DebugSection.tsx` | New | Debug UI component (platform admin only) |
| `src/app/words/debug/page.tsx` | New | Next.js route page for `/words/debug` |
| `src/app/words/WordsWorkspace.tsx` | Modified | Import + render `DebugSection` |
| `src/app/words/shared/shell.types.ts` | Modified | Added `"debug"` to `NavPage` union |
| `src/lib/permissions.ts` | Modified | Added `/words/debug` case (platform admin only) |
| `src/app/words/words.strings.ts` | Modified | Added `nav.debug` in EN and ZH |
| `src/app/words/shared/words.shared.utils.tsx` | Modified | Added debug nav item to `getNavItems()` |
| `docs/architecture/0_ARCHITECTURE.md` | Modified | Added `/words/debug` to permission matrix |
