# 0_PRODUCT_ROADMAP.md

_Last updated: 2026-02-27_

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
| 1 | **Admin-Configurable LLM Prompts** | New page `/words/prompts` — view, edit, save, version, and reset AI prompt templates. Stored in IndexedDB. Separated by generation type (full / phrase / example / pinyin). | `docs/feature-specs/` | 📋 Planned | — |
| 2 | **Grading Logic Audit** | Review and document the full grading model — ease adjustment, interval curve, failure penalty, early review behavior. Add edge case tests. Ensure no silent regression. | — | 📋 Planned | — |
| 3 | **Flashcard UI Redesign** | Larger hanzi, progressive reveal (tap to show), clear separation of character / meaning / phrase / example, single focus per screen, large touch targets. | `docs/feature-specs/` | 📋 Planned | — |

### Phase 2 — Structure & Visibility

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 4 | **Character Level Tagging** | Add `level` field to `Word` (e.g., Grade 1, Grade 2). Assign and filter on All Characters page. Review scope can be filtered by level. Scheduler unaffected. | `docs/feature-specs/` | 📋 Planned | — |
| 5 | **Quiz Results Summary** | New page `/words/results` — session history with date, type, accuracy, words reviewed, words failed, coins earned. New `quizSessions` IndexedDB table. | `docs/feature-specs/` | 📋 Planned | — |

### Phase 3 — Motivation Layer

| # | Feature | Description | Spec | Status | Last touched |
|---|---|---|---|---|---|
| 6 | **Fill-Test UI Improvements** | Optional pinyin toggle (default OFF, UI-only — no grading impact). Larger font, cleaner spacing, single blank per question in Tier 1. | `docs/feature-specs/` | 📋 Planned | — |
| 7 | **Rewards System — Bakery MVP** | Coins earned per quiz (accuracy + completion based). Virtual bakery shop: purchase furniture, display items, decorations. New tables: `wallet`, `inventory`, `shopState`. No real money, no scheduler impact. | `docs/feature-specs/` | 📋 Planned | — |

---

## 3. Deferred — Do Not Build Yet

These are explicitly out of scope. If a task implies one of these, stop and confirm before proceeding.

- Tier 2 or Tier 3 features of any kind
- Reading comprehension or paragraph-level review modes
- Rewards system features beyond the Bakery MVP defined in Phase 3
- Streak bonuses or time-based reward mechanics
- Bulk level-tag editing (noted as future in the level tagging spec)
- User accounts, authentication, or cloud sync
- Multi-user or shared vocabulary lists
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

## 8. Long-Term Evolution Path

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

## 9. Identity Statement

This product is a structured, compounding Chinese memory engine.

Not a worksheet generator.
Not a random AI sentence toy.
Not a content warehouse.

It is infrastructure for durable language growth.