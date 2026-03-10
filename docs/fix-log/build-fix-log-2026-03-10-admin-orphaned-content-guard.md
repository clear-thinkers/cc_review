# Build Fix Log — 2026-03-10 — Admin Page Orphaned Content Guard

## Problem

The admin page (`/words/admin`) could attempt to render flashcard content rows from `flashcard_contents` that had no corresponding entry in the `words` table for the same `family_id`. These orphaned rows accumulate when:
- A content preload batch generates rows for characters that are later deleted from `words`.
- An interrupted or partial bulk operation leaves stale content behind.
- `flashcard_contents` has no foreign key to `words`, so no DB-level cascade delete occurs.

When orphaned rows were present, the admin effect included them in the `savedContentByKey` map, which could cause them to be processed and potentially surfaced in the admin table alongside valid targets.

## Fix Applied

**File:** `src/app/words/shared/words.shared.state.ts`

After `getAllFlashcardContents()` returns and `nextTargets` is fully built, filter saved content entries to only those whose key exists in the valid target set before building `savedContentByKey`:

```typescript
const validKeys = new Set(nextTargets.map((t) => t.key));
const filteredContents = allSavedContents.filter((e) => validKeys.has(e.key));
const savedContentByKey = new Map(filteredContents.map((entry) => [entry.key, entry.content] as const));
```

This is a pure read-side guard: orphaned DB rows are silently ignored by the admin page. No data is deleted.

## Why This Fix

This is the cheapest and most immediate resilience layer. Even if orphaned rows exist in the DB (regardless of how they got there), the admin page never tries to process them. The downstream loops (`for (const target of nextTargets)`) already only iterate over `nextTargets`, so the only risk was the map being populated with stale keys — now closed.

## Related Tooling

A separate cleanup tool has been added at `/words/debug` (platform admin only) for manually deleting orphaned `flashcard_contents` rows interactively. See `docs/architecture/2026-03-10-debug-tools-page.md`.

## Scope

- No schema changes.
- No new DB queries.
- No behavior change for clean databases — the filter is a no-op when no orphans exist.
- Only affects the admin page effect in `words.shared.state.ts`.
