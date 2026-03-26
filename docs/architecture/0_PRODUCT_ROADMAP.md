# 0_PRODUCT_ROADMAP.md

_Last updated: 2026-03-26_ (Recipe Shop shipped)

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
| 5 | **Supabase Schema & RLS Policies** | Retire IndexedDB entirely. Migrate all data (words, review history, quiz sessions, wallets, and shop tables) to Supabase Postgres. Define tables, foreign keys, and RLS policies enforcing family_id scoping. Platform admin bypasses RLS. | `docs/feature-specs/2026-03-05-supabase-schema-rls.md` | ✅ Done | 2026-03-05 |
| 6 | **Role-Based Routing** | RouteGuard enforces permission matrix by session role. Blocked routes invisible in nav (not 403). Child: no add/edit/admin, has fill-test. Parent: no fill-test. Platform admin: full access. | `docs/feature-specs/2026-03-05-role-based-routing.md` | ✅ Done | 2026-03-05 |
| 8 | **Quiz Results Summary** | New page `/words/results` — session history with date, type, accuracy, words reviewed, words failed, and coins earned. Backed by the Supabase `quiz_sessions` table. | [`docs/feature-specs/2026-03-04-quiz-results-summary.md`](../feature-specs/2026-03-04-quiz-results-summary.md) | ✅ Done | 2026-03-04 |
| 9 | **Fill-Test UI Improvements** | Optional pinyin toggle (default OFF, UI-only — no grading impact). Larger font, cleaner spacing, single blank per question in Tier 1. | `docs/feature-specs/` | ✅ Done | 2026-03-05 |
| 11 | **Rewards System — Coins** | Coins earned per quiz session (accuracy + completion based). `wallet` table. Persistent, cumulative balance across sessions. Track coin history and milestones. | `docs/feature-specs/2026-03-04-coin-rewards-system.md` | ✅ Done | 2026-03-05 |
| 12 | **Service Layer Migration** | Replace all IndexedDB (Dexie) reads/writes with Supabase client calls via `src/lib/supabase-service.ts`. Delete `db.ts`, `auth.ts`, `debugUtilities.ts`. Remove `dexie` dependency. camelCase ↔ snake_case conversion in service layer. | `docs/feature-specs/2026-03-05-service-layer-migration.md` | ✅ Done | 2026-03-06 |

### Phase 2 — Structure & Visibility

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 1 | **Admin-Configurable LLM Prompts** | New page `/words/prompts` — view, edit, save, version, and reset AI prompt templates. Stored in Supabase. Separated by generation type (full / phrase / example / pinyin). | `docs/architecture/2026-03-09-admin-configurable-llm-prompts.md` | ✅ Done | 2026-03-09 |
| 7 | **Character Level Tagging** | 4-level cascade tag system (Textbook → Grade → Unit → Lesson). New tables: `textbooks`, `lesson_tags`, `word_lesson_tags`. Tag assignment on `/words/add`; Lessons column + filter bar on `/words/all`; filter bar on `/words/admin`. Review scope filter deferred. | `docs/architecture/2026-03-09-character-level-tagging.md` | ✅ Done | 2026-03-09 |
| 13 | **Review Test Sessions** | Parents package multiple Content Admin targets into a named session. Due Review lists active sessions for both roles; only children can start them. Runtime bundles multiple pronunciations back to character-level review first, then fill-test, and hides the session after completion. | `docs/feature-specs/2026-03-21-review-test-sessions.md` | ✅ Done | 2026-03-21 |
| 10 | **Recipe Shop & Shop Admin** | Child-facing recipe unlock shop backed by quiz-earned coins, with ingredient views and spend history. Platform admin can manage shared recipe metadata, ingredient pricing, icon paths, and variant mappings. Uses `shop_recipes`, `shop_recipe_unlocks`, `shop_coin_transactions`, and `shop_ingredient_prices`. No real money, no scheduler impact. | [`docs/feature-specs/2026-03-23-shop-recipe-unlocks.md`](../feature-specs/2026-03-23-shop-recipe-unlocks.md) | ✅ Done | 2026-03-26 |

## Fixed to be done
1. The history table of quiz results is not displaying correctly in browser when user uses the app in phone (I tested using iphone)

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
- Recipe shop is functional with recipe unlocks, ingredient views, and spend history
- Reward system does not affect scheduler or grading logic

**Architecture remains modular**
- All new features respect layer boundaries (UI / Domain / Service / AI)
- No live AI during review execution
- All persisted structured content is normalized before write

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

## 8. Current Focus

### Shipped foundation (as of 2026-03-26)

- Family auth, Supabase service layer, role-based routing, AI prompts, tagging, review test sessions, and the recipe shop loop are all shipped.
- The motivation layer now includes quiz-earned coins, child-facing recipe unlocks, spend history, and platform-admin shop content management.

### Remaining Tier 1 features

1. Fix the quiz-results history table layout on mobile browsers.
2. Implement multi-family pilot feedback:
  - enable a different quiz mode for packaged characters in a session.  allow phrases of different characters to be tested together.  this would help characters that have only 1-2 phrases to be tested.
  - parent should have ability to set difficulty level for AI generated content. The dafault ones are too advanced for beginners.  Add a 'beginner level' setting for parent users.  Beginner level prompts are configured by Platform Admin.  Consider leveraging the current Prompt page to create different levels that can be shared across all family users.
  - parent wanted to be able to input phrases, not single characters.  need to think of a workflow that is keyed off of phrases.
  - parent expressed interest in using AI to generate paragraphs for kids to read/fill rather than just sentences. Although this is technically tier 2, we can try something small at the end of Tier 1.

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
