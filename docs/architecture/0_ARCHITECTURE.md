# ARCHITECTURE

_Last updated: 2026-02-27_

---

## â­ Read This Before Every Feature Build

Read all reference docs before starting any task. See `AI_CONTRACT.md Â§1` for the required reading order and conflict resolution authority.

This document covers: system structure, layer boundaries, data schema, error handling behavior.
It does **not** define agent operating rules â€” those live in `AI_CONTRACT.md`.

---

## 1) Product Rules

This project is a **local-first Chinese memory engine** with deterministic review behavior.

Tier 1 rules (active):
- Review is scheduler-driven and deterministic (`again|hard|good|easy` grade mapping â€” no stochastic grading).
- Review sessions consume **persisted content only** â€” no live generation.
- AI generation is scoped to admin authoring workflows only (`/words/admin` â†’ `/api/flashcard/generate`).
- Flashcard content is keyed by `character|pronunciation` and normalized before persistence.
- Fill-test eligibility is derived from saved phrase/example rows and `include_in_fill_test` flags.
- Unsafe content and malformed payloads are dropped during normalization before they can be persisted.

Primary user flow:
1. Add Hanzi -> `/words/add` -> IndexedDB `words` table.
2. Curate content -> `/words/admin` -> `/api/flashcard/generate` + manual edits -> `flashcardContents` table.
3. Review -> `/words/review`, `/words/review/flashcard`, `/words/review/fill-test` -> reads persisted data only.

### Ingestion Rules

These rules govern all character ingestion via `/words/add`:

1. Input accepts free text — only Hanzi characters are extracted. Non-Hanzi symbols (letters, punctuation, numbers, emoji) are ignored.
2. Multi-character strings are split into individual Hanzi characters.
3. Duplicate characters within the same submission are removed before writing.
4. Characters already present in the `words` table are skipped — no overwrite occurs.
5. New records are initialized as unreviewed (`repetitions=0`, `nextReviewAt=0`, no fill-test content).
6. A bilingual status message is shown after every submission covering three states: nothing added, all added, some added and some skipped.
7. Add flow does not auto-generate flashcard or admin content — Content Admin remains a separate step.

---

## 2) Layer Boundaries

### Layers and Ownership

| Layer | Location | Responsibility |
|---|---|---|
| UI | `src/app/...`, `WordsWorkspace` | Interaction, view state, locale rendering |
| Domain | `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` | Pure logic: scheduling, grading, normalization |
| Service | `src/lib/db.ts`, `src/lib/xinhua.ts` | IO: IndexedDB reads/writes, static data loading |
| AI | `src/app/api/flashcard/generate/route.ts` | Prompt orchestration, provider calls |

### Call Graph (Structural)

This describes how layers are wired â€” the actual call and import relationships the system uses:

- `src/app/**` communicates with `src/app/api/**` via **fetch calls only** â€” no direct imports.
- `src/app/api/**` is invoked only from admin authoring flows â€” never from review execution paths.
- `src/lib/scheduler.ts` has no dependency on UI or API layers â€” it is a pure domain module.
- AI output flows through normalization in `src/lib/flashcardLlm.ts` before reaching `src/lib/db.ts`.
- `src/lib/db.ts` is the single point of contact for all IndexedDB reads and writes.

> For the agent rules that enforce these boundaries (what to never do), see `AI_CONTRACT.md Â§2`.

---

## 3) Data Schema

### IndexedDB Tables

**`words` table** - one row per character added by the user

| Field | Type | Initial Value | Notes |
|---|---|---|---|
| `id` | string | `makeId()` | Generated unique ID |
| `hanzi` | string | input character | Single Hanzi character |
| `pinyin` | string \| undefined | `undefined` | Optional; not set by `/words/add` |
| `meaning` | string \| undefined | `undefined` | Optional; not set by `/words/add` |
| `createdAt` | number | `Date.now() + index offset` | Timestamp; offset preserves insertion order |
| `repetitions` | number | `0` | SRS repetition count |
| `intervalDays` | number | `0` | Current SRS interval in days |
| `ease` | number | `21` | Scheduler stability/ease value |
| `nextReviewAt` | number | `0` | Unix timestamp - drives due queue; 0 = immediately due |
| `reviewCount` | number \| undefined | `0` at creation | Total flashcard review attempts |
| `testCount` | number \| undefined | `0` at creation | Total fill-test attempts |
| `fillTest` | `FillTest` \| undefined | `undefined` | Populated only after Content Admin curation/manual assignment |

**`flashcardContents` table** â€” curated content per character

| Field | Type | Notes |
|---|---|---|
| `id` | string | `character\|pronunciation` composite key |
| `meanings` | string[] | Definition list |
| `phrases` | Phrase[] | Each: `{ zh, pinyin, en, include_in_fill_test }` |
| `examples` | Example[] | Each: `{ zh, pinyin, en, include_in_fill_test }` |

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` â€” loaded via `src/lib/xinhua.ts`

---

## 4) System Guarantees

These are the technical behaviors the system upholds. They are the factual basis behind the hard stops in `AI_CONTRACT.md Â§2` â€” refer there for agent-facing rules.

1. **Review screens read only from `flashcardContents`.** No path from `/words/review/*` reaches `/api/flashcard/generate`.
2. **Every value written to `flashcardContents` has been normalized.** Schema shape is enforced before any IndexedDB write.
3. **Normalization drops bad content â€” it does not pass it through.** Invalid phrases/examples are removed; the rest of the payload proceeds.
4. **`nextReviewAt` and `interval` are updated only by the deterministic grade functions in `scheduler.ts`.** No other write path exists.
5. **Due review pages wrap `WordsWorkspace` in `<Suspense>`.** Required for correct search-param handling in Next.js.

---

## 5) Error Handling

Required error behaviors for each failure mode. Do not improvise alternatives.

| Failure | Required Behavior |
|---|---|
| AI generation failure (`/api/flashcard/generate`) | Return error to admin UI. Do not fall back to cached or unvalidated output. Surface the error to the user. |
| Normalization failure (malformed AI payload) | Log the failure. Drop the affected phrase/example. Continue with remaining valid content. Never write a partial payload. |
| IndexedDB read failure (review screens) | Show a graceful error state in the UI. Do not re-fetch from AI. Session fails cleanly. |
| Missing `char_detail.json` entry | Return empty pronunciation candidates. Do not throw. UI handles the empty state. |

---

## 6) Docs Structure

### Authority order (highest to lowest)
1. `AI_CONTRACT.md` â€” agent rules and authority hierarchy
2. `docs/architecture/0_ARCHITECTURE.md` â€” system structure (this file)
3. `docs/architecture/0_BUILD_CONVENTIONS.md` â€” development conventions
4. `docs/architecture/0_PRODUCT_ROADMAP.md` â€” scope and priorities
5. Other `docs/architecture/*.md` â€” dated feature/domain behavior docs
6. `README.md`

---

### Folder Map

```
docs/
  AI_CONTRACT.md                          â† highest authority; agent rules
  architecture/
    0_ARCHITECTURE.md                     â† system structure (this file)
    0_BUILD_CONVENTIONS.md                â† code and doc conventions
    0_PRODUCT_ROADMAP.md                  â† scope, sprint, deferrals
    YYYY-MM-DD-short-description.md       â† dated feature/domain behavior docs
  feature-specs/
    YYYY-MM-DD-short-feature-name.md      â† one file per feature; drafted before build
  code-review/
    YYYY-MM-DD-short-scope.md             â† periodic code quality reviews
  fix-log/
    build-fix-log-YYYY-MM-DD-summary.md   â† one file per fix; created after merge
  archive/
    YYYY-MM/
      *.md                                â† superseded docs moved here
```

---

### Filing Rules by Doc Type

**`docs/architecture/` â€” system behavior docs**
- Create when: a feature or domain rule needs to be documented for future builders.
- Filename: `YYYY-MM-DD-short-description.md`
- Retire to `docs/archive/YYYY-MM/` when the content is superseded by a `0_` file update or a newer dated doc.

**`docs/feature-specs/` â€” pre-build feature specifications**
- Create when: a feature is prioritized in `0_PRODUCT_ROADMAP.md Â§Active Sprint` and needs a spec before implementation starts.
- Filename: `YYYY-MM-DD-short-feature-name.md`
- Content: problem statement, non-goals, behavior rules, edge cases, risks, test plan, acceptance criteria, open questions.
- Status: once the feature ships, add a `## Status: Shipped YYYY-MM-DD` header â€” do not delete. Move to `docs/archive/YYYY-MM/` after one sprint cycle.
- Authority: feature specs are implementation guidance only. If a spec conflicts with `0_ARCHITECTURE.md`, the spec loses â€” update the spec before building.

**`docs/code-review/` â€” periodic code quality reviews**
- Create when: a scheduled or triggered review of code quality, compliance, or architectural drift is conducted.
- Filename: `YYYY-MM-DD-short-scope.md` (e.g., `2026-02-27-code-compliance-review.md`)
- Content: scope, findings, recommended actions, severity ratings.
- Authority: findings are advisory. Accepted findings that produce rule changes must be written into the relevant `0_` doc â€” the review file itself is not authoritative.
- Do not move to archive â€” keep all code reviews in `docs/code-review/` as a permanent audit trail.

**`docs/fix-log/` â€” post-merge fix records**
- Create when: any bug fix, refactor, structural correction, or regression prevention is merged. See `AI_CONTRACT.md Â§5` for full policy and template.
- Filename: `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`
- Do not move to archive â€” fix logs are a permanent record.

---

### Archive rule
If archived content conflicts with active docs or current implementation, active docs and implementation win. Archive material is historical context only â€” it is never justification for a design choice.

---

## 7) Development Conventions

All code must follow the conventions in `0_BUILD_CONVENTIONS.md`: bilingual UI, strings extraction, TypeScript strict mode, component file structure, and test coverage.
