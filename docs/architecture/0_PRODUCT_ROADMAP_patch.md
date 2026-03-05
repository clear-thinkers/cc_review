# ROADMAP PATCH — Apply to docs/architecture/0_PRODUCT_ROADMAP.md
# Date: 2026-03-05
# Instructions: Replace the indicated sections in-place. Do not change any other section.

---

## REPLACE: header date line

_Last updated: 2026-03-05_

---

## REPLACE: Phase 1 table

### Phase 1 — Stability & Control

Features now include a "Last touched" timestamp and a broader set of status icons so the roadmap speaks to velocity. Agents should update the `Status` cell as work moves from 📋 Planned → 🔄 In Progress → ✅ Done (or 🔒 Blocked) and set the date in `Last touched` each time changes are merged.

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 1 | **Admin-Configurable LLM Prompts** | New page `/words/prompts` — view, edit, save, version, and reset AI prompt templates. Stored in Supabase. Separated by generation type (full / phrase / example / pinyin). | `docs/feature-specs/` | 📋 Planned | — |
| 2 | **Grading Logic Audit** | Review and document the full grading model — ease adjustment, interval curve, failure penalty, early review behavior. Add edge case tests. Ensure no silent regression. | `docs/architecture/2026-03-03-grading-logic-model.md` | ✅ Done | 2026-03-03 |
| 3 | **Flashcard UI Redesign** | Larger hanzi, progressive reveal (tap to show), clear separation of character / meaning / phrase / example, single focus per screen, large touch targets. Per-character pinyin ruby alignment, phrase-example pairing, pinyin toggle. | `docs/feature-specs/2026-03-03-flashcard-ui-redesign.md` | ✅ Done | 2026-03-04 |
| 4 | **Multi-Tenant Auth & User Model** | Replace localStorage PIN with Supabase Auth. Parent registers with email + password. Parent creates child profiles with PIN. Role model: parent / child / platform_admin. Family-scoped data isolation via Row Level Security. | `docs/feature-specs/2026-03-05-auth-and-user-model.md` | 📋 Planned | 2026-03-05 |
| 5 | **Supabase Schema & RLS Policies** | Retire IndexedDB entirely. Migrate all data (words, review_history, quiz_sessions, wallet, inventory) to Supabase Postgres. Define tables, foreign keys, and RLS policies enforcing family_id scoping. Platform admin bypasses RLS. | `docs/feature-specs/2026-03-05-supabase-schema-rls.md` | 📋 Planned | 2026-03-05 |
| 6 | **Role-Based Routing** | RouteGuard enforces permission matrix by session role. Blocked routes invisible in nav (not 403). Child: no add/edit/admin. Parent: no fill-test quiz. Platform admin: full access. | `docs/feature-specs/2026-03-05-role-based-routing.md` | 📋 Planned | 2026-03-05 |

---

## REPLACE: §3 Deferred list
## (Remove the two lines below from the Deferred list — they are now active features)
##   - User accounts, authentication, or cloud sync
##   - Multi-user or shared vocabulary lists

## ADD to Deferred list (append these two lines):
- Curated content packs and pack import flow (schema designed; build deferred post-pilot)
- Content pack purchase / monetization flow

---

## REPLACE: Tier 1 MVP Completion Definition — add this bullet under "Progress is visible"

**Auth and data are production-grade**
- All user data stored in Supabase Postgres (IndexedDB fully retired)
- Family data isolated via Row Level Security — no cross-tenant leakage possible
- Parent account recoverable via email; child access controlled by parent-assigned PIN
- Role-based routing enforced — blocked routes not visible to unauthorized roles
