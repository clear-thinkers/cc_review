# Fix Log — 2026-03-11 — Textbook Dropdown Family Scoping

## Problem

The textbook dropdown on both the **Add Characters** (`/words/add`) and **All Characters** (`/words/all`) pages was showing all textbooks visible to the family — including shared/admin-created ones (`is_shared = true`). Users should only see textbooks they created themselves (i.e., scoped to their own `family_id`).

## Root Cause

`listTextbooks()` in `src/lib/supabase-service.ts` used an OR filter:

```ts
.or(`is_shared.eq.true,family_id.eq.${familyId}`)
```

This intentionally returned both shared (admin-created) and family-owned textbooks. The shared textbooks were meant as visible defaults, but the product requirement is that the dropdown should be private to each family.

## Fix

Changed the Supabase query in `listTextbooks()` to filter exclusively on `family_id`:

```ts
.eq("family_id", familyId)
```

Updated the JSDoc comment from "shared + own" to accurately describe the new behaviour.

**File changed:** `src/lib/supabase-service.ts`

## Affected Pages

| Page | Route | Call site |
|---|---|---|
| Add Characters | `/words/add` | `AddSection.tsx` line 46 |
| All Characters | `/words/all` | `AllWordsSection.tsx` line 68 |

Both pages call `listTextbooks()` directly — no component-level changes were required.

## Docs Check

- `0_ARCHITECTURE.md` — no boundary or schema change; existing RLS already scopes `family_id` writes per family. No update needed.
- `0_BUILD_CONVENTIONS.md` — no convention change. No update needed.
- `0_PRODUCT_ROADMAP.md` — no new feature; this is a behaviour correction within the Character Level Tagging feature (Phase 2 #7). No update needed.
