# Fix Log – 2026-03-06 – Service Layer Migration (IndexedDB → Supabase)

## Context
The app's data layer (`src/lib/db.ts`) used IndexedDB via Dexie.js for all persistent state. Supabase schema and RLS policies were deployed (Feature 5), authenticated sessions existed (Feature 4), but the app still read/wrote IndexedDB. Every data operation threw "Database not initialized" because the PIN-scoped Dexie setup path was no longer active after the auth rewrite.

## Root Cause
After Features 4 and 5 deployed Supabase Auth and Postgres schema, the IndexedDB data path became a dead end. The service layer was never updated to use Supabase — it still imported Dexie and relied on PIN-scoped database initialization that no longer occurs in the Supabase Auth flow.

## Changes Applied

### New file: `src/lib/supabase-service.ts`
- All data access functions: `getAllWords`, `getDueWords`, `getExistingWordsByHanzi`, `addWords`, `deleteWord`, `putWord`, `gradeWord`, `getFlashcardContent`, `getAllFlashcardContents`, `putFlashcardContent`, `deleteFlashcardContent`, `getAllQuizSessions`, `createQuizSession`, `clearAllQuizSessions`, `getOrCreateWallet`, `updateWallet`
- `FlashcardContentEntry` type moved here from `db.ts`
- Internal camelCase ↔ snake_case converters: `toWord`, `fromWord`, `toFlashcardContentEntry`, `toQuizSession`, `toWallet`
- `getSessionMetadata()` helper reads `family_id` and `user_id` from JWT `app_metadata` for insert operations

### Deleted files
- `src/lib/db.ts` — entire IndexedDB/Dexie layer
- `src/lib/auth.ts` — PIN-scoped database helpers (no longer imported from any source file)
- `src/lib/debugUtilities.ts` — Dexie debug tools (not imported anywhere)

### Updated consumers
- `src/app/words/shared/words.shared.state.ts` — imports swapped from `@/lib/db` to `@/lib/supabase-service`; 5 direct `db.words.*` calls replaced with service functions
- `src/app/words/results/ResultsPage.tsx` — imports swapped (static + dynamic import)

### Dropped functions (dead code per spec)
- `getCustomFillTest`, `getAllCustomFillTests`, `putCustomFillTest`, `deleteCustomFillTest`, `getAllDisabledFillTests`, `putDisabledFillTest`, `deleteDisabledFillTest` — zero references in active `src/` outside `db.ts`
- `getFlashcardContentsByCharacter`, `putFlashcardContents` — zero references outside `db.ts`
- `initializeDatabaseForPin`, `clearDatabaseState`, `migrateFromLegacyDatabase` — PIN-scoped DB lifecycle no longer needed
- `initializeWallet`, `getWallet` — replaced by `getOrCreateWallet`

### Dependency removed
- `dexie` removed from `package.json` dependencies

### Docs updated
- `AI_CONTRACT.md` — hard stop updated to reflect deleted `db.ts` and retired IndexedDB
- `0_ARCHITECTURE.md` — service layer table, call graph, error handling, localStorage/database state sections updated
- `0_PRODUCT_ROADMAP.md` — Feature 12 (Service Layer Migration) added as ✅ Done; completion criteria updated

## Architectural Impact
**Service layer boundary changed.** All data I/O now routes through `src/lib/supabase-service.ts` → `src/lib/supabaseClient.ts` → Supabase Postgres with RLS. Domain layer (`scheduler.ts`, `fillTest.ts`, `flashcardLlm.ts`, `coins.ts`) is untouched. UI layer changes are import-only.

## Preventative Rule
- All new data access must go through `src/lib/supabase-service.ts`. No direct Supabase table queries from UI components.
- camelCase ↔ snake_case conversion must only happen in the service module — never in UI or domain code.

## Docs Updated
- `docs/AI_CONTRACT.md` — hard stop #5 rewritten
- `docs/architecture/0_ARCHITECTURE.md` — service layer, call graph, error handling, retired sections
- `docs/architecture/0_PRODUCT_ROADMAP.md` — Feature 12 added, completion criteria updated
