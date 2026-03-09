# 0_PRODUCT_ROADMAP.md

_Last updated: 2026-03-06_ (Service Layer Migration complete; IndexedDB fully retired)

---

> For reading order and authority hierarchy, see `AI_CONTRACT.md §1`.
> This document covers: what to build, in what order, and what is explicitly out of scope.

---

## Product Name

**Chinese Review App — Memory Engine for Durable Language Growth**

---

## 1. Mission

Build a long-term Chinese memory system that converts exposure into durable language ability.

This is not a drill app.
This is not a content scraper.
This is a structured memory engine designed to compound over years.

---

## 2. Tier 1 MVP — Feature Roadmap

Tier 1 MVP focuses on five outcomes: memory quality, content control, review clarity, feedback loops, and a motivation layer.

Features are sequenced into three phases. **Do not begin a phase until the prior phase is shipped and stable.**

> **Rule:** If a feature is not in this table, it is deferred. See §3.

### Phase 1 — Stability & Control

Features now include a “Last touched” timestamp and a broader set of status icons so the roadmap speaks to velocity. Agents should update the `Status` cell as work moves from 📋 Planned → 🔄 In Progress → ✅ Done (or 🔒 Blocked) and set the date in `Last touched` each time changes are merged.

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 2 | **Grading Logic Audit** | Review and document the full grading model — ease adjustment, interval curve, failure penalty, early review behavior. Add edge case tests. Ensure no silent regression. | `docs/architecture/2026-03-03-grading-logic-model.md` | ✅ Done | 2026-03-03 |
| 3 | **Flashcard UI Redesign** | Larger hanzi, progressive reveal (tap to show), clear separation of character / meaning / phrase / example, single focus per screen, large touch targets. Per-character pinyin ruby alignment, phrase-example pairing, pinyin toggle. | `docs/feature-specs/2026-03-03-flashcard-ui-redesign.md` | ✅ Done | 2026-03-04 |
| 4 | **Multi-Tenant Auth & User Model** | Replace localStorage PIN with Supabase Auth. Parent registers with email + password. Parent creates child profiles with PIN. Role model: parent / child / platform_admin. Family-scoped data isolation via Row Level Security. | `docs/feature-specs/2026-03-05-auth-and-user-model.md` | ✅ Done | 2026-03-09 |
| 5 | **Supabase Schema & RLS Policies** | Retire IndexedDB entirely. Migrate all data (words, review_history, quiz_sessions, wallet, inventory) to Supabase Postgres. Define tables, foreign keys, and RLS policies enforcing family_id scoping. Platform admin bypasses RLS. | `docs/feature-specs/2026-03-05-supabase-schema-rls.md` | ✅ Done | 2026-03-05 |
| 6 | **Role-Based Routing** | RouteGuard enforces permission matrix by session role. Blocked routes invisible in nav (not 403). Child: no add/edit/admin, has fill-test. Parent: no fill-test. Platform admin: full access. | `docs/feature-specs/2026-03-05-role-based-routing.md` | ✅ Done | 2026-03-05 |
| 8 | **Quiz Results Summary** | New page `/words/results` — session history with date, type, accuracy, words reviewed, words failed, coins earned. New `quizSessions` IndexedDB table. | [`docs/feature-specs/2026-03-04-quiz-results-summary.md`](../feature-specs/2026-03-04-quiz-results-summary.md) | ✅ Done | 2026-03-04 |
| 9 | **Fill-Test UI Improvements** | Optional pinyin toggle (default OFF, UI-only — no grading impact). Larger font, cleaner spacing, single blank per question in Tier 1. | `docs/feature-specs/` | ✅ Done | 2026-03-05 |
| 11 | **Rewards System — Coins** | Coins earned per quiz session (accuracy + completion based). `wallet` table. Persistent, cumulative balance across sessions. Track coin history and milestones. | `docs/feature-specs/2026-03-04-coin-rewards-system.md` | ✅ Done | 2026-03-05 |
| 12 | **Service Layer Migration** | Replace all IndexedDB (Dexie) reads/writes with Supabase client calls via `src/lib/supabase-service.ts`. Delete `db.ts`, `auth.ts`, `debugUtilities.ts`. Remove `dexie` dependency. camelCase ↔ snake_case conversion in service layer. | `docs/feature-specs/2026-03-05-service-layer-migration.md` | ✅ Done | 2026-03-06 |

### Phase 2 — Structure & Visibility

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 1 | **Admin-Configurable LLM Prompts** | New page `/words/prompts` — view, edit, save, version, and reset AI prompt templates. Stored in Supabase. Separated by generation type (full / phrase / example / pinyin). | `docs/feature-specs/` | 📋 Planned | — |
| 7 | **Character Level Tagging** | Add `level` field to `Word` (e.g., Grade 1, Grade 2). Assign and filter on All Characters page. Review scope can be filtered by level. Scheduler unaffected. | `docs/feature-specs/` | 📋 Planned | — |
| 10 | **Bakery Shop** | Virtual bakery shop: purchase furniture, display items, decorations with earned coins. `inventory` and `shopState` tables. Spend coins to customize player environment. No real money, no scheduler impact. | [`docs/feature-specs/2026-03-04-coin-rewards-system.md`](../../feature-specs/2026-03-04-coin-rewards-system.md) | 📋 Planned | — |

---

## 3. Deferred — Do Not Build Yet

These are explicitly out of scope. If a task implies one of these, stop and confirm before proceeding.

- Tier 2 or Tier 3 features of any kind
- Reading comprehension or paragraph-level review modes
- Streak bonuses or time-based reward mechanics
- Bulk level-tag editing (noted as future in the level tagging spec)
- Curated content packs and pack import flow (schema designed; build deferred post-pilot)
- Content pack purchase / monetization flow
- Mobile-native version or PWA packaging
- Any new AI provider integration
- Export or import of flashcard data

---

## 4. Tier 1 MVP — Completion Definition

Tier 1 is complete when **all** of the following are true:

**Content quality is controllable**
- Admin can edit, version, and reset AI prompts without touching code
- Prompt changes affect only future generations — review sessions remain deterministic

**Scheduling is stable and predictable**
- Grading model is fully documented
- Edge cases covered by test suite
- No silent regressions in `nextReviewAt` or `interval` calculation

**Review UI is child-friendly**
- Flashcard screen: single focus per screen, progressive reveal, large touch targets
- Fill-test screen: clear blank focus, optional pinyin assist, single blank per question

**Progress is visible**
- Parents and children can review session history, accuracy, and improvement over time

**Auth and data are production-grade**
- All user data stored in Supabase Postgres (IndexedDB fully retired; `dexie` removed from dependencies)
- Family data isolated via Row Level Security — no cross-tenant leakage possible
- Parent account recoverable via email; child access controlled by parent-assigned PIN
- Role-based routing enforced — blocked routes not visible to unauthorized roles

**Motivation loop exists**
- Coins are earned from review completion and accuracy
- Virtual bakery shop is functional with purchasable items
- Reward system does not affect scheduler or grading logic

**Architecture remains modular**
- All new features respect layer boundaries (UI / Domain / Service / AI)
- No live AI during review execution
- All new IndexedDB tables normalized before write

Only after all criteria above are met should Tier 2 begin.

---

## 5. Tier Strategy

### Tier 1 — Controlled Micro Context (Current)

Word-level understanding, retrieval practice, controlled cognitive load. All active work is here.

### Tier 2 — Structured Text Context (Future — not started)

Reinforcing high-frequency phrases in paragraph form. Light paragraph-level fill tasks. Will not modify Tier 1 scheduling logic. No implementation until Tier 1 completion definition above is fully met.

### Tier 3 — Authentic Reading Layer (Future — not started)

Long-form exposure and reading comprehension. Does not affect SRS scoring. Deferred until Tier 2 is stable.

---

## 6. Design Principles

### Memory First
Spaced repetition drives review. Retrieval beats re-reading. Scheduling stays deterministic. Content supports memory — memory does not depend on live generation.

### Quality Over Volume
Natural language, semantic richness, structural clarity, controlled complexity. More sentences ≠ better learning. Durability > Density.

### Separation of Concerns
UI handles interaction. Domain handles scheduling and grading. Service handles DB and network. AI is generation-only and never touches scheduling. Review consumes persisted content only.

---

## 7. Guardrails for Development

Before shipping any feature, ask:

1. Does this strengthen long-term retention?
2. Does this increase uncontrolled cognitive load?
3. Does this destabilize scheduler logic?
4. Does this introduce runtime AI variability?
5. Does this preserve modular layer boundaries?

If any answer undermines Tier 1 stability, the feature is deferred.

---

## 8. Next Implementation Sequence

### Blocker Analysis (as of 2026-03-05)

**Feature 5 ✅ Done:**
- Supabase schema + RLS policies deployed
- Service layer refactor deferred until Feature 6 completes

**Feature 4 ✅ Done (2026-03-05):**
- `/register` → 3-step wizard → POST `/api/auth/register` (atomic; Auth account cleaned up on DB failure)
- `/login` → Supabase `signInWithPassword()` → Layer 1 complete
- `/profile-select` → renders family profiles from `useAuth().familyProfiles`
- `/pin-entry` → on-screen PIN pad → POST `/api/auth/pin-verify` (scrypt + timingSafeEqual, server-side lockout at 5 attempts)
- `SessionGuard` rewritten to use `useAuth()` — no localStorage reads
- `AuthProvider` added to root layout
- `WordsShell` reads avatar + logout from `useSession()` / `clearSession()`
- Old `src/app/login/` folder (5 files) deleted

**Feature 6 ✅ Done (2026-03-05):**
- Permission matrix enforced: child cannot access add/admin; parent cannot access fill-test
- RouteGuard component redirects blocked routes to `/words/review`
- Navigation items filtered by role (blocked routes hidden from nav)
- Fill-test buttons conditionally rendered (visible for children, hidden for parents)
- All role checks use `canAccessRoute()` from `src/lib/permissions.ts`

### Critical Path (Tier 1 Completion)

```
Feature 4 (Auth & User Model)
  ├─ Supabase Auth integration
  ├─ JWT enrichment (family_id, user_id claims)
  ├─ Child PIN-based login
  └─ Session persistence + auto-refresh
         ↓
Feature 6 (Role-Based Routing)
  ├─ RouteGuard middleware
  ├─ Route matrix by role (parent/child/admin)
  └─ Nav visibility filtering
         ↓
Service Layer Refactor
  ├─ Create src/lib/supabase.ts
  ├─ Retire src/lib/db.ts (IndexedDB)
  └─ Migrate all service calls
         ↓
Tier 1 Completion + Multi-Family Pilot
  ├─ End-to-end testing (3 families)
  ├─ RLS isolation verification
  └─ Prod Supabase deployment
```

### Recommended Action Plan

1. **✅ Done (2026-03-05):** Feature 4 (Auth & User Model) shipped on `feat/phase3`.

2. **Immediately (next PR):** Implement Feature 6 (Role-Based Routing)
   - Create RouteGuard component using `useSession().role` from Feature 4 auth context
   - Build permission matrix for parent/child/admin roles
   - Hide blocked routes from nav (don't show 403)
   - Integration test: verify child cannot navigate to `/words/add` or `/words/admin`
   - Target: 2026-03-07

3. **After Feature 6 ships:** Service Layer Refactor
   - Create `src/lib/supabase.ts` with domain-scoped service functions
   - Translate all `src/lib/db.ts` calls to Supabase equivalents
   - Convert camelCase (TypeScript) ↔ snake_case (Postgres) in service layer
   - Retire `src/lib/db.ts` (IndexedDB)
   - Functional equivalence test: verify same data shape in reads
   - Target: 2026-03-14

4. **Multi-Family Pilot (final Tier 1 step):**
   - Create 3 test families in prod Supabase
   - Verify RLS isolation (Family A user cannot read Family B words)
   - Parent + child login flow with PIN entry
   - Admin platform account bypass (can read/write all families)

### Risks & Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Auth spec incomplete | Blocks Features 4, 6, RLS tests | Confirm auth spec ready before Feature 4 starts |
| JWT claims not injected | RLS policies cannot evaluate | Feature 4 must implement `/api/auth/enrich-session` |
| Service layer not updated | App still reads from IndexedDB | Plan refactor immediately after Feature 6 |
| Pilot families not set up | Cannot test prod RLS isolation | Manual setup via Supabase console or seed script |

---

## 9. Long-Term Evolution Path

```
Character Review Tool
  → Word Memory Engine (Tier 1 MVP)     ← current
  → Context Reinforcement System (Tier 2)
  → Reading Readiness Platform (Tier 3)
  → Language Mastery Framework
```

The goal is not to complete a curriculum.
The goal is to build a compounding language system.

---

## 10. Identity Statement

This product is a structured, compounding Chinese memory engine.

Not a worksheet generator.
Not a random AI sentence toy.
Not a content warehouse.

It is infrastructure for durable language growth.