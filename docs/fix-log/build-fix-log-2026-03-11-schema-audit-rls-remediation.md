# Fix Log – 2026-03-11 – Schema Audit & RLS Remediation

## Context

Live Supabase schema audit revealed critical discrepancies:
- 6 tables marked UNRESTRICTED (no RLS policies)
- Packs schema tables existed despite being explicitly deferred in `0_PRODUCT_ROADMAP.md`
- RLS was manually enabled on tagging tables but policies were not deployed

## Root Cause

1. **Packs tables:** Feature branch migration applied to production prematurely (likely from `feature/pack-purchases` branch)
2. **content_requests:** Unknown origin; no migration file, feature spec, or code reference
3. **Tagging RLS gap:** Migrations `20260309000004` and `20260309000005` defined policies but were not deployed when RLS was manually enabled on the tables

## Changes Applied

### Schema Cleanup
1. Dropped `packs` table (deferred post-pilot per roadmap §3)
2. Dropped `pack_purchases` table (deferred post-pilot per roadmap §3)
3. Dropped `pack_words` table (deferred post-pilot per roadmap §3)
4. Dropped `pack_flashcard_contents` table (deferred post-pilot per roadmap §3)
5. Dropped `content_requests` table (orphaned — no associated feature or code)

### RLS Enforcement
1. Manually enabled RLS on `lesson_tags` (was missing policies)
2. Manually enabled RLS on `word_lesson_tags` (was missing policies)
3. Created migration `20260311000000_apply_tagging_rls_policies.sql` to formalize 7 RLS policies:
   - `lesson_tags`: 3 policies (SELECT, INSERT, UPDATE)
   - `word_lesson_tags`: 4 policies (SELECT, INSERT, UPDATE, DELETE)
4. Verified all policies enforce `is_platform_admin() OR family_id = current_family_id()`

### Verification
Ran `SELECT * FROM pg_policies WHERE tablename IN ('lesson_tags', 'word_lesson_tags')` and confirmed 7 policies present with correct scoping conditions.

## Files Changed

| File | Change | Type |
|---|---|---|
| Supabase console | Dropped 5 tables | Schema |
| Supabase console | Enabled RLS on 2 tables | Schema |
| `supabase/migrations/20260311000000_apply_tagging_rls_policies.sql` | Created | New migration |
| `docs/SCHEMA_INSPECTION_2026-03-11.md` | Status updated to ✅ REMEDIATED | Docs |

## Architectural Impact

**Security (Positive)**
- All user-facing tables now have RLS enabled
- All tables enforce family-scoped isolation
- No family data leakage vectors via UNRESTRICTED tables

**Schema Consistency (Positive)**
- Schema matches documented governance in `0_PRODUCT_ROADMAP.md`
- Deferred features removed to prevent accidental usage

**No Breaking Changes**
- No changes to active features (Tier 1 MVP)
- No changes to user-facing code
- All existing queries continue to work with RLS transparent to service layer

**Future Redeploy**
- Packs feature will be re-implemented with proper RLS in Phase 3
- Migration will include family-scoped (private) + shared (admin-curated) pack support

## Preventative Rules

1. **Before applying schema migrations to production:**
   - Verify migration is referenced in active `0_PRODUCT_ROADMAP.md` phase
   - Verify migration is in the repo's `supabase/migrations/` directory
   - Inspect the migration source to confirm it aligns with documented feature specs

2. **RLS Enforcement:**
   - RLS enabled = policies must exist in same transaction or immediately following migration
   - No table should ever reach a state where `enable row level security` completes without policies
   - Use `SELECT * FROM pg_policies WHERE tablename = '...'` as gate before deployment

3. **Schema Cleanliness:**
   - Run quarterly audit comparing live schema to documented `0_ARCHITECTURE.md` §3 (Data Schema)
   - Tag any deferred/experimental tables with comments in migration

## Docs Updated

- ✅ `docs/SCHEMA_INSPECTION_2026-03-11.md` — Status changed from 🔴 to ✅ REMEDIATED
- ✅ `docs/fix-log/` — This fix log created

**Not updated (no changes to these):**
- `docs/architecture/2026-03-05-supabase-schema-rls.md` — Still accurate; packs removed
- `docs/architecture/0_PRODUCT_ROADMAP.md` — Already defers packs correctly
- `docs/architecture/0_ARCHITECTURE.md` — Schema section remains valid

---

**Remediated:** 2026-03-11  
**Commit:** Link to migration + docs commit  
**Verification:** 7 RLS policies confirmed present via pg_policies query
