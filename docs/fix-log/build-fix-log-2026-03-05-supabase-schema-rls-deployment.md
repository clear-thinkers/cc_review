# Fix Log — 2026-03-05 — Supabase Schema & RLS Policies Deployment

## Context

The application has been storing all data in IndexedDB (client-side, device-local), which blocks multi-user access, multi-family pilots, and public launch. To support server-hosted multi-tenant architecture, all data must migrate to a Postgres database with Row Level Security (RLS) policies enforcing family-scoped isolation.

This fix log documents the initial Supabase schema deployment (Feature 5 in the product roadmap).

---

## Root Cause

- IndexedDB is a single-device, single-user storage mechanism unsuitable for:
  - Parent + child shared access to same data
  - Multi-family pilot (3 families onboarding)
  - Public SaaS launch (multi-tenant isolation)
  - Data durability (cache clear wipes learning history)
  
- RLS policies must be deployed immediately after schema creation to enforce tenant isolation and prevent accidental cross-family data leakage.

---

## Changes Applied

### 1. Database Schema (Supabase Postgres)

**New files:**
- `supabase/migrations/20260305000000_initial_schema.sql` — 6 tables with constraints and indexes
  - `families` — one row per tenant
  - `users` — parent (Supabase Auth) + child (PIN-only) accounts
  - `words` — Hanzi characters, scoped to family
  - `flashcard_contents` — curated content (meanings, phrases, examples)
  - `quiz_sessions` — completed session audit records (immutable)
  - `wallets` — cumulative coin balance per user

- `supabase/migrations/20260305000001_rls_policies.sql` — RLS policies + helper functions
  - Helper functions: `current_family_id()`, `current_user_id()`, `is_platform_admin()`
  - Family-scoped read/write policies on all tables
  - Platform admin bypass on all operations
  - `quiz_sessions` immutable for non-admins (insert-only, no update/delete)

### 2. Supabase Client Initialization

**New file:**
- `src/lib/supabaseClient.ts` — browser and server client factories
  - Browser client: anon key, respects RLS, auto-refreshes session
  - Server client: service role key for admin operations only (API routes)

### 3. Environment Configuration

**New files:**
- `.env.local.example` — template for dev environment
- `.env.production.example` — template for prod environment
- Updated `.env.local` with Supabase placeholders and notes

**Key change:** Separate Supabase projects for dev and prod
- `NEXT_PUBLIC_SUPABASE_URL` — project URL (differs by environment)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-safe anon key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only admin key (never commit, env-var only)

### 4. Bootstrap & Migration Scripts

**New files:**
- `scripts/seed-platform-admin.mjs` — creates Nora family + admin user
  - Runs with service role key to bypass RLS
  - Creates singleton platform admin account (`is_platform_admin = true`)
  - Idempotent: skips if family/admin already exists

- `scripts/reset-schema.mjs` — resets all tables (dev only)
  - DANGER: drops and recreates schema
  - For local testing and cleanup

- `scripts/migrate-from-indexeddb.mjs` — migrates from IndexedDB JSON export
  - For compatibility testing and data federation scenarios
  - Converts camelCase (IndexedDB) to snake_case (Postgres)
  - Skips duplicates; continues non-fatally on per-row failures

### 5. Integration Tests

**New file:**
- `src/lib/rls.test.ts` — comprehensive RLS policy validation
  - Tests: family-scoped isolation, admin bypass, immutability, constraints
  - Skipped by default (requires SUPABASE_URL + SERVICE_ROLE_KEY env vars)
  - Checklist items for session-based testing (simulating different users via JWT)

### 6. Documentation Updates

**Modified file:**
- `docs/architecture/0_ARCHITECTURE.md`
  - Updated "Last updated" date (2026-03-05)
  - Replaced IndexedDB schema documentation with Supabase schema
  - Documented RLS policies and helper function signatures
  - Updated "Layer Boundaries" section to reflect supabaseClient as single point of contact
  - Added note that IndexedDB is deprecated; noted localStorage auth phase-out

---

## Architectural Impact

### Data Layer Transition

| Aspect | Before (Phase 1) | After (Feature 5) | Next (Feature 4 onwards) |
|---|---|---|---|
| Storage | IndexedDB (browser-local) | Supabase Postgres (server) | Supabase Postgres (server) |
| Multi-user access | ❌ No (device-local only) | ✅ Yes (family-scoped RLS) | ✅ Yes (Supabase Auth) |
| Multi-tenant isolation | ❌ Not applicable | ✅ Yes (RLS policies on family_id) | ✅ Yes (RLS policies on family_id) |
| Read point | `src/lib/db.ts` (deprecated) | `src/lib/supabaseClient.ts` | `src/lib/supabaseClient.ts` |
| Session management | localStorage PIN hash | localStorage + Supabase → Supabase Auth |  Supabase Auth (httpOnly cookies) |

### Hard Boundaries Maintained

Per AI_CONTRACT.md §2, the following boundaries remain unviolated:

- ❌ API routes do NOT import `src/lib/db.ts` (IndexedDB) — they use supabaseClient
- ❌ UI layer does NOT call AI providers — all generation routed through `/api/flashcard/generate`
- ❌ No live AI generation on review screens — only persisted content
- ❌ Scheduler logic unchanged — still a pure function in `src/lib/scheduler.ts`
- ✅ All normalization still occurs before write (no unsafe content persistence)

### Service Layer Status (Deferred)

Feature 5 (this fix) deploys the Supabase schema + RLS policies only. The service layer refactor (retiring `src/lib/db.ts` and implementing `src/lib/supabase.ts`) is deferred to a follow-up task post-Feature 4 (Auth & User Model), as per user guidance.

**Temporary state:** App still imports from `src/lib/db.ts` (IndexedDB), but `src/lib/supabaseClient.ts` is now available for new code and service-layer refactoring.

---

## Preventative Rules

1. **RLS Validation in every patch**
   - Before any schema migration ships to production, run RLS integration tests to verify:
     - Family A user cannot read Family B data
     - Platform admin can read all families
     - Non-admins cannot delete quiz sessions or update users
   - Add to CI/CD pipeline once Feature 4 (auth) enables session JWT injection

2. **Separate dev/prod projects**
   - Never share Supabase projects between dev and prod
   - Template `.env.local.example` and `.env.production.example` prevent accidents
   - Add CI check: reject PRs that add hardcoded Supabase URLs

3. **Platform admin bootstrap protection**
   - The `is_platform_admin = true` flag is set only via direct SQL or seed script
   - Application layer never exposes an "admin mode" toggle in UI
   - Audit trail: creation timestamp and user_id in `users` table logs who made changes

4. **Immutable quiz sessions**
   - RLS policy blocks all updates and deletes (except platform admin)
   - Application layer assumes sessions are immutable; no UPDATE queries
   - Prevents accidental grade corrections or score manipulation

5. **JWT claims injection (Feature 4 prerequisite)**
   - Supabase RLS policies depend on JWT claims `family_id` and `user_id`
   - Feature 4 (auth spec) must implement the mechanism that enriches the session JWT
   - Until then, RLS tests are marked `skip` — they require Feature 4's auth flow

---

## Docs Updated

- [✅] `docs/architecture/0_ARCHITECTURE.md` — schema, RLS, layer boundaries updated
- [✅] `.env.local.example` — Supabase env vars documented
- [✅] `.env.production.example` — Supabase env vars documented
- [❌] No new rule doc created (rules already in feature spec `docs/feature-specs/2026-03-05-supabase-schema-rls.md`)

---

## Open Items

1. **Feature 4 (Auth & User Model)** must ship before this can be tested end-to-end
   - Requires: JWT enrichment with `family_id` and `user_id` claims
   - Unlocks: RLS integration test execution (currently skipped)
   - Schedule: after Feature 5 (this fix)

2. **Service Layer Refactor (deferred)**
   - Create `src/lib/supabase.ts` with service functions
   - Retire `src/lib/db.ts` (IndexedDB)
   - Update all UI and API code to use new service layer
   - Scheduled after Feature 4 for phased migration

3. **Production Supabase Setup (manual)**
   - Create prod Supabase project
   - Run migrations via Supabase CLI
   - Seed platform admin via `seed-platform-admin.mjs`
   - Manual step; not automated until CD pipeline in place

---

## Deployment Checklist

- [ ] Create Supabase project (dev environment)
- [ ] Run migrations: `supabase db push` or `psql -f supabase/migrations/*.sql`
- [ ] Seed platform admin: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-platform-admin.mjs`
- [ ] Copy Supabase URL and keys to `.env.local`
- [ ] Verify RLS tests can be run: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm test -- rls.test.ts`
- [ ] Create prod Supabase project (separate)
- [ ] Repeat for prod environment
- [ ] Verify Feature 4 (auth spec) is ready before attempting end-to-end testing

