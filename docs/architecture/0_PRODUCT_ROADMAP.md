# Product Roadmap — HanziQuest (`cc_review`)

_Last updated: 2026-05-02 · Authority hierarchy: see `AI_CONTRACT.md`_

**Current state:** Tier 1, Phase 2 complete. Pre-pilot.
Bundled phrase quiz mode shipped on 2026-05-02.
One Tier 1 gate remains open: mobile layout for quiz results.
Tier 2 is blocked until all Tier 1 gates close.

---

## 1 · Active Work

> If a feature isn't in this table or §3, it's deferred — see §2.

| ID | Feature | Notes | Spec | Status |
|----|---------|-------|------|--------|
| A | Mobile quiz results layout | `/words/results` table breaks on iPhone | — | 📋 Planned |
| C | Parent difficulty setting | Beginner-level AI prompts scoped per family; admin configures via Prompts page | TBD | 📋 Planned |
| D | Phrase-keyed input | Parent enters a phrase (not just a character) as primary unit | TBD | 📋 Planned |
| E | Pilot feedback triage | Collect and triage structured feedback from pilot families | — | 🔄 In Progress |
| F | Ingredient shopping for kids | Add shopping controls to the ingredient detail page so kids can mark/add ingredients while viewing a recipe's ingredients | `docs/feature-specs/2026-03-30-shop-ingredient-shopping.md` | 📋 Planned |

> Planned features with a `TBD` spec require a feature spec before build. See `AI_CONTRACT.md §2` for scope confirmation rules.

---

## 2 · Deferred — Do Not Build

Stop and confirm before acting on any of these:

- Tier 2 / Tier 3 features of any kind
- Content pack import, purchase, or monetization
- New AI provider integrations
- Flashcard data export / import

---

## 3 · Tier Strategy

| Tier | Name | Scope | Status |
|------|------|-------|--------|
| 1 | Controlled Micro Context | Word-level Spaced Repetition System (SRS), controlled cognitive load | 🔄 Active |
| 2 | Structured Text Context | Phrase/paragraph fill tasks | 🔒 Not started — blocked on Tier 1 completion |
| 3 | Authentic Reading Layer | Long-form reading comprehension | 🔒 Not started — blocked on Tier 2 |

---

## 4 · Shipped Features (reference only)

All prior feature specs are archived at `docs/archive/specs/`.
Note that specs may not reflect the current implementation — the codebase has evolved through multiple iterations and specs were not always updated to match. Treat them as historical context, not ground truth. When in doubt, read the code.

- 2026-04-22: Quiz Results can package one session's failed Hanzi into a named review test session via the existing packaged-session flow.
  Spec: `docs/feature-specs/2026-04-22-results-failed-to-test-session.md`
- 2026-05-02: Bundled phrase quiz mode allows one- and two-phrase characters to enter fill-test sessions through runtime bundles, with per-character grading and unchanged coin logic.
  Spec: `docs/feature-specs/2026-05-02-grouped-phrase-quiz-mode.md`
