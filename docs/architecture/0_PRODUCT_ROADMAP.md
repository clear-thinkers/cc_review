# PRODUCT_VISION.md
#### last updated: 2-27-2026 9:45AM

## ⭐ Read This Before Every Feature Build

**This document is part of the `0_` prefix series.** All markdown files starting with `0_` in `docs/architecture/` are foundational reference documents that should be reviewed before starting any new feature, fix, or change:

- `0_ARCHITECTURE.md` — Product rules, layer boundaries, operational invariants
- `0_BUILD_CONVENTIONS.md` — Development practices and conventions
- `0_PRODUCT_ROADMAP.md` — High-level product strategy and planning (this file)

---

## Product Name
Chinese Review App — Memory Engine for Durable Language Growth

---

## 1. Mission

Build a long-term Chinese memory system that converts exposure into durable language ability.

This is not a drill app.  
This is not a content scraper.  
This is a structured memory engine designed to compound over years.

---

## 2. Core System Model

The product is organized around four operational pillars:

- Character Ingestion :contentReference[oaicite:0]{index=0}
- Inventory & State Audit :contentReference[oaicite:1]{index=1}
- Deterministic Due Review :contentReference[oaicite:2]{index=2}
- Controlled Content Authoring (Admin) :contentReference[oaicite:3]{index=3}

Architecturally, the system is:

- Local-first
- Deterministic
- Modular (UI / Domain / Service / AI separated) :contentReference[oaicite:4]{index=4}

---

## 3. Tier Strategy

### Tier 1 — Controlled Micro Context (Current Focus)

Purpose:
- Establish word-level understanding
- Support retrieval practice
- Maintain controlled cognitive load

Characteristics:
- Curated or AI-assisted example sentences
- Stored and normalized before review
- Used by flashcard and fill-test
- Integrated with scheduler

Tier 1 is the engine.

Success Criteria:
- Stable retention over time
- Minimal context dependency
- Clear semantic grounding
- No AI instability during review

---

### Tier 2 — Structured Text Context (Future)

Purpose:
- Reinforce high-frequency phrases in paragraph form
- Enable transfer from isolated retrieval to text context
- Introduce light paragraph-level fill tasks

Will not modify Tier 1 scheduling logic.

---

### Tier 3 — Authentic Reading Layer (Future)

Purpose:
- Language appreciation
- Reading comprehension
- Long-form exposure

Does not affect SRS scoring.

---

## 4. Design Principles

### 4.1 Memory First

- Spaced repetition drives review
- Retrieval > re-reading
- Scheduling remains deterministic

Content supports memory.
Memory does not depend on live generation.

---

### 4.2 Quality Over Volume

High-quality context means:

- Natural language
- Semantic richness
- Structural clarity
- Controlled complexity

More sentences ≠ better learning.

Durability > Density.

---

### 4.3 Separation of Concerns

- UI handles interaction only
- Domain handles scheduling and grading
- Service layer handles DB/network
- AI is generation-only and never controls scheduling :contentReference[oaicite:5]{index=5}

Review consumes persisted content.
No live AI during recall.

---

## 5. Guardrails for Development

When adding features, evaluate:

1. Does this strengthen long-term retention?
2. Does this increase uncontrolled cognitive load?
3. Does this destabilize scheduler logic?
4. Does this introduce runtime AI variability?
5. Does this preserve modular boundaries?

If Tier 1 stability is weakened, the feature is deferred.

---

## 6. Immediate Focus (Tier 1 Hardening)

Current priority:

- Improve example sentence quality
- Support multiple controlled examples per phrase (future-ready)
- Prevent semantic overfitting
- Maintain clean normalization pipeline
- Keep review deterministic and stable

Tier 1 must be rock solid before expanding outward.

---

## 7. Long-Term Evolution Path

Character Review Tool  
→ Word Memory Engine  
→ Context Reinforcement System  
→ Reading Readiness Platform  
→ Language Mastery Framework  

The goal is not to complete a curriculum.  
The goal is to build a compounding language system.

---

## 8. Identity Statement

This product is:

A structured, compounding Chinese memory engine.

Not:
- A worksheet generator
- A random AI sentence toy
- A content warehouse

It is an infrastructure for durable language growth.