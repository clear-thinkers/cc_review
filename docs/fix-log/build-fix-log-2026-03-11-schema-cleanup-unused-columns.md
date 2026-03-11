# Fix Log – 2026-03-11 – Schema Cleanup: Remove Unused Word Columns

## Context

Schema audit (SCHEMA_INSPECTION_2026-03-11.md) identified that the `words` table contained 3 columns with zero code dependencies and zero data:
- `pinyin` (text, nullable)
- `meaning` (text, nullable)
- `content_source` (text, nullable — unknown origin, not in migrations)

These columns were created as part of the IndexedDB → Supabase migration but were never integrated into the application layer. No UI, business logic, or service code references them beyond the database converter layer.

## Root Cause

Historical schema debt from IndexedDB migration planning. The columns were provisioned in anticipation of features (e.g., native pinyin display, content source attribution) that were deferred or never implemented.

## Changes Applied

### 1. Migration: Drop Unused Columns
**File:** `supabase/migrations/20260311000002_drop_unused_word_columns.sql`

Dropped three columns:
```sql
alter table words
  drop column if exists pinyin,
  drop column if exists meaning,
  drop column if exists content_source;
```

**Preserved:** `fill_test` column — actively used for quiz session data.

### 2. Type Definition Update
**File:** `src/lib/types.ts`

Removed optional fields from `Word` type:
```typescript
// Before
export type Word = {
  id: string;
  hanzi: string;
  pinyin?: string;        // ✓ Removed
  meaning?: string;       // ✓ Removed
  fillTest?: FillTest;
  ...
};

// After
export type Word = {
  id: string;
  hanzi: string;
  fillTest?: FillTest;
  ...
};
```

### 3. Service Layer Converters
**File:** `src/lib/supabase-service.ts`

Updated database converters to match schema:

- **SupabaseWordRow interface:** Removed pinyin, meaning fields
- **toWord():** Removed pinyin/meaning field mapping
- **fromWord():** Removed pinyin/meaning from upsert payload

## Architectural Impact

**Layer:** Service Layer (no impact to UI, domain, or scheduler layers)

**Scope:** Pure structural cleanup. No business logic, no state management, no UI rendering affected.

**Data Continuity:** This is a safe destructive migration. The columns were empty (0 rows had data); no data loss occurs.

## Preventative Rule

When provisioning a new database column:
1. **Code first:** Implement service layer read/write FIRST
2. **Integration required:** Column must be used in at least one of: UI display, business logic, scheduler, or service error handling
3. **Test coverage:** Add test cases _before_ committing the column definition
4. **Audit during code review:** Verify column references are non-trivial (not just pass-through converters)

## Docs Updated

- ✅ `0_ARCHITECTURE.md` — No update needed (words table schema remains correct with fill_test preserved)
- ✅ `0_PRODUCT_ROADMAP.md` — No update needed (no feature scope change)
- ✅ `0_BUILD_CONVENTIONS.md` — No update needed (no convention change)
- ✅ `AI_CONTRACT.md` — No update needed (no hard stop or boundary affected)

---

**Migration Status:** Ready to deploy  
**Risk Level:** Low — destructive migration on empty columns only  
**Rollback Plan:** If needed, re-run migrations from 20260305000000 and re-populate `words` from Supabase backup (if columns were somehow repopulated; they won't be in normal operations)
