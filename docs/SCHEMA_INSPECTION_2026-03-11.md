# Schema Inspection Report — 2026-03-11

**Purpose:** Audit live Supabase schema against documented governance to identify mismatches and RLS gaps.

**Status:** ⚠️ **DISCREPANCY FOUND** — Packs tables exist on live DB but are deferred by product roadmap.

---

## Executive Summary

| Finding | Severity | Details |
|---|---|---|
| **UNRESTRICTED tables exist** | 🔴 HIGH | 6 tables lack RLS policies: `content_requests`, `lesson_tags`, `pack_flashcard_contents`, `pack_purchases`, `pack_words`, `word_lesson_tags` |
| **Packs schema premature** | 🟠 MEDIUM | 3 packs-related tables (`packs`, `pack_purchases`, `pack_words`) exist on live DB but are explicitly deferred by `0_PRODUCT_ROADMAP.md` |
| **Tagging RLS incomplete** | 🟠 MEDIUM | `lesson_tags` and `word_lesson_tags` have migrations fixing RLS, but Supabase dashboard shows UNRESTRICTED tag — may indicate migration not deployed or RLS disabled |
| **content_requests orphaned** | 🟠 MEDIUM | Table exists but has no corresponding feature, migration, or spec — unknown origin |

---

## 1. Governance Truth Tables

### Documented Schema (from migrations + specs)

These tables **should exist** and **must have RLS enabled** per `2026-03-05-supabase-schema-rls.md`:

| Table | RLS Status | Family Scoped | Remarks |
|---|---|---|---|
| `families` | ✅ Enforced | Yes | Platform admin bypass via `is_platform_admin()` |
| `users` | ✅ Enforced | Yes | Family members can read own family users |
| `words` | ✅ Enforced | Yes | Full CRUD scoped by `family_id` |
| `flashcard_contents` | ✅ Enforced | Yes | Full CRUD scoped by `family_id` + composite key `(id, family_id)` |
| `quiz_sessions` | ✅ Enforced | Yes | Read scoped to family; insert scoped to own session |
| `wallets` | ✅ Enforced | Yes | Insert/update scoped to own wallet |
| `textbooks` | ✅ Enforced | Yes (with shared) | Supports shared (admin-curated) + family-private rows |
| `lesson_tags` | ✅ Enforced | Yes | Denormalized `family_id` added in migration `20260309000005` |
| `word_lesson_tags` | ✅ Enforced | Yes | Full CRUD scoped by `family_id` |
| `prompt_templates` | ✅ Enforced | Yes | Created in migration `20260309000000` |

### Deferred Features (per `0_PRODUCT_ROADMAP.md`)

These tables **should NOT exist**; if they do, they are premature:

| Table | Feature | Status | Spec Location |
|---|---|---|---|
| `packs` | Content pack purchase flow | 📋 Deferred post-pilot | `0_PRODUCT_ROADMAP.md` §3 |
| `pack_purchases` | Monetization / pack purchase | 📋 Deferred post-pilot | `0_PRODUCT_ROADMAP.md` §3 |
| `pack_flashcard_contents` | Pack-scoped flashcard content | 📋 Deferred post-pilot | `0_PRODUCT_ROADMAP.md` §3 |
| `pack_words` | Pack-scoped word lists | 📋 Deferred post-pilot | `0_PRODUCT_ROADMAP.md` §3 |

---

## 2. Filesystem Migrations vs. Live Supabase

### Migrations Found in Repo

```
20260305000000_initial_schema.sql
  ├─ families, users, words, flashcard_contents, quiz_sessions, wallets
  └─ RLS enabled on all tables

20260305000001_rls_policies.sql
  └─ Defines RLS policies + helper functions (is_platform_admin, current_family_id, current_user_id)

20260305000002_fix_avatar_id_comment.sql
  └─ Documentation fix only

20260306000000_fix_rls_helpers_app_metadata.sql
  └─ Fixes JWT claim reading to use app_metadata structure

20260306000001_words_parent_only_writes.sql
  └─ Parents can write words; children cannot

20260306000002_allow_child_grade_words.sql
  └─ Children can update own word grades

20260309000000_prompt_templates.sql
  ├─ Creates prompt_templates table
  └─ RLS: family-scoped read/write

20260309000001_prompt_body_instructions_only.sql
  └─ Schema refinement: body + instructions columns only

20260309000002_full_prompt_remove_redundant_rule.sql
  └─ Documentation/constraint fix

20260309000003_quiz_sessions_family_delete.sql
  └─ Platform admin can delete quiz sessions (audit/data mgmt)

20260309000004_character_level_tagging.sql
  ├─ Creates textbooks, lesson_tags, word_lesson_tags
  ├─ Initial RLS using subqueries on textbooks
  └─ ⚠️ Known issue: RLS subqueries can deadlock (fixed in next migration)

20260309000005_lesson_tags_add_family_id.sql
  ├─ Adds denormalized family_id to lesson_tags
  ├─ Backfills from parent textbook row
  └─ Replaces subquery RLS with direct family_id checks
```

### Live Supabase Tables (from Dashboard Screenshot)

**Tables with RLS Enabled (globe icon):**
- families ✅
- flashcard_contents ✅
- quiz_sessions ✅
- textbooks ✅
- users ✅
- wallets ✅

**Tables Marked UNRESTRICTED (security badge):**
- content_requests ❌
- lesson_tags ❌ *← Should have RLS!*
- pack_flashcard_contents ❌ *← Should not exist*
- pack_purchases ❌ *← Should not exist*
- pack_words ❌ *← Should not exist*
- word_lesson_tags ❌ *← Should have RLS!*

**Missing from Supabase (should exist):**
- packs ← *← Listed in Supabase but not shown with RLS status on screenshot*
- prompt_templates (likely exists but not visible in screenshot viewport)

---

## 3. Root Cause Analysis

### Why Are Tagging Tables UNRESTRICTED?

**Migration `20260309000005` explicitly fixes this:**
```sql
-- Step 5: replace policies with direct family_id checks
drop policy if exists "lesson_tags: readable if textbook readable" on lesson_tags;
drop policy if exists "lesson_tags: insert if textbook owned or admin" on lesson_tags;
drop policy if exists "lesson_tags: update if textbook owned or admin" on lesson_tags;

create policy "lesson_tags: family read own" on lesson_tags for select using (is_platform_admin() or family_id = current_family_id());
create policy "lesson_tags: family insert own" on lesson_tags for insert with check (is_platform_admin() or family_id = current_family_id());
create policy "lesson_tags: family update own" on lesson_tags for update using (is_platform_admin() or family_id = current_family_id());
```

**Two possibilities:**
1. **Migration was not applied to live DB** — The .sql file exists locally, but Supabase hasn't run it yet
2. **Migration ran, but RLS was manually disabled** — Someone disabled RLS after the fact (security misconfiguration)

### Why Do Packs Tables Exist?

**Hypothesis:** A different feature branch or build added packs tables prematurely.

**Evidence:**
- No migration files in the repo for packs tables
- `0_PRODUCT_ROADMAP.md` explicitly defers packs: *"Curated content packs and pack import flow (schema designed; build deferred post-pilot)"*
- Packs appear on live Supabase but are not referenced in any current migrations or specs

**Likely scenario:** Someone applied a migration from a parallel development branch (e.g., `feature/pack-purchases`) to the live DB, even though that feature is not in the active Tier 1 roadmap.

### Why Does `content_requests` Exist?

**Unknown origin.** This table has:
- No migration file
- No feature spec
- No reference in documentation

Possible explanations:
- Manual table creation in Supabase console
- Migration applied from unknown source
- Dead code from an earlier feature that was abandoned

---

## 4. Security Impact Assessment

### High Risk: Family Data Leakage

```
Tables without RLS:
├─ word_lesson_tags (composite tags assigned to words)
│  └─ Child from Family A can read/write tags for Family B's words
│
├─ lesson_tags (cascade tag definitions)
│  └─ Child from Family A can read/write tags from Family B's textbooks
│
└─ pack_* tables (future purchase flow — not yet implemented)
   └─ If enabled, family data could leak across pack boundaries
```

**Example Attack Vector (word_lesson_tags):**
> Family A child logs in → queries `word_lesson_tags` without RLS → sees all rows from all families → can infer which words Family B is learning

### Medium Risk: Budget Creep

The packs tables occupy schema real estate and risk being used before proper safeguards are implemented. If someone starts building pack-purchase UI without checking RLS, a security hole could slip into code.

---

## 5. Recommended Actions

### Phase 1: Immediate (Security)

**Action 1a:** Verify RLS status on tagging tables
```bash
# Via Supabase console, for each table (lesson_tags, word_lesson_tags):
SELECT * FROM pg_policies WHERE tablename = 'lesson_tags';
```
- **Expected outcome:** 4 policies per table (select, insert, update, [delete if applicable])
- **If output is empty:** RLS is disabled or no policies exist; apply migration 20260309000005 immediately

**Action 1b:** Query live DB to confirm actual policies exist
```sql
-- Run in psql or Supabase SQL editor
SELECT * FROM pg_policies WHERE tablename IN ('lesson_tags', 'word_lesson_tags', 'content_requests');
```

### Phase 2: Schema Alignment (This Week)

**Action 2a:** Decide on packs tables
- **Option A (Recommended):** Drop packs tables until feature is planned for the next roadmap phase
  ```sql
  DROP TABLE pack_purchases CASCADE;
  DROP TABLE pack_flashcard_contents CASCADE;
  DROP TABLE pack_words CASCADE;
  DROP TABLE packs CASCADE;
  ```
  - Record decision in a migration: `20260311000000_drop_deferred_packs_tables.sql`
  - Update `0_PRODUCT_ROADMAP.md` note: *"Packs schema removed from live DB; will be re-created when feature moves to Phase 3"*

- **Option B:** Keep packs tables but apply RLS immediately
  - Create migrations for packs RLS policies (family-scoped for private packs, shared for admin packs)
  - Add to next fix log

**Action 2b:** Investigate `content_requests`
- [ ] Search git history: when was this table created?
- [ ] Check if any code references it (`grep -r "content_requests"`)
- [ ] If orphaned: drop it and record removal in fix log
- [ ] If active: create a spec and apply RLS

**Action 2c:** Verify tagging RLS is live
- [ ] Run migration `20260309000005` in Supabase if not already applied
- [ ] Re-check Supabase dashboard — lesson_tags and word_lesson_tags should show globe icon, not UNRESTRICTED

### Phase 3: Confirm & Document

**Action 3a:** Create a fix log
- File: `docs/fix-log/build-fix-log-2026-03-11-schema-audit-rls-remediation.md`
- Document each action taken, root causes, and architectural impact

**Action 3b:** Update governance docs
- [ ] If packs dropped: update `0_PRODUCT_ROADMAP.md` to note removal
- [ ] If new policy applied: update `2026-03-05-supabase-schema-rls.md` with actual policies and constraints

---

## 6. Detailed Table Reference

### Tables With RLS Enabled ✅

| Table | Primary Key | Family Scope | RLS Status | Notes |
|---|---|---|---|---|
| **families** | `id` (uuid) | Self | ✅ Enforced | Admin can create/manage; families can read own |
| **users** | `id` (uuid) | `family_id` | ✅ Enforced | Family members can read same-family users; parent creates children |
| **words** | `id` (text) | `family_id` | ✅ Enforced | Unique index: `(family_id, hanzi)`; parent adds words, child grades |
| **flashcard_contents** | `id, family_id` (composite) | `family_id` | ✅ Enforced | Key: `{character}\|{pronunciation}`; family-scoped curation |
| **quiz_sessions** | `id` (text) | `family_id` | ✅ Enforced | Immutable audit record; child inserts own, family reads all |
| **wallets** | `user_id` (uuid, PK) | `family_id` | ✅ Enforced | One row per user; updated on quiz completion |
| **textbooks** | `id` (uuid) | `family_id` (nullable) | ✅ Enforced | Supports shared (`is_shared=true`, `family_id=null`) and private rows |
| **prompt_templates** | `id` (uuid) | `family_id` | ✅ Enforced | Separated by type (full, phrase, example, pinyin) |

### Problematic Tables ❌

| Table | Primary Key | RLS Status | Import | Notes |
|---|---|---|---|---|
| **lesson_tags** | `id` (uuid) | ❌ UNRESTRICTED | 🟠 HIGH | Migration 20260309000005 adds `family_id` and RLS; may not be deployed |
| **word_lesson_tags** | `id` (uuid) | ❌ UNRESTRICTED | 🟠 HIGH | Join table; should have `family_id` + RLS; migration 20260309000004 defines it |
| **pack_purchases** | ? | ❌ UNRESTRICTED | 🔴 CRITICAL | Deferred feature; should not exist; no migration file |
| **pack_flashcard_contents** | ? | ❌ UNRESTRICTED | 🔴 CRITICAL | Deferred feature; should not exist; no migration file |
| **pack_words** | ? | ❌ UNRESTRICTED | 🔴 CRITICAL | Deferred feature; should not exist; no migration file |
| **content_requests** | ? | ❌ UNRESTRICTED | 🟡 MEDIUM | Unknown origin; no spec, migration, or code reference found |

---

## 7. Next Steps

1. **✓ Verification** (This section)
2. **→ Confirm RLS status** via Supabase SQL editor (Action 1b)
3. **→ Decide on packs** (keep+secure vs. drop+redeploy ← recommend DROP)
4. **→ Investigate `content_requests`**
5. **→ Deploy any outstanding migrations**
6. **→ Create fix log + update governance docs**

---

**Generated:** 2026-03-11  
**Issue:** `UNRESTRICTED` tables + premature packs schema  
**Status:** ✅ **REMEDIATED** — 2026-03-11 Complete
- ✅ Packs tables (`packs`, `pack_purchases`, `pack_words`, `pack_flashcard_contents`) dropped
- ✅ `content_requests` table dropped (orphaned, no spec/code reference)
- ✅ RLS enabled manually on `lesson_tags` and `word_lesson_tags`
- ✅ All 7 policies deployed and verified (migration 20260311000000)
- ✅ Family scoping confirmed for all tables
