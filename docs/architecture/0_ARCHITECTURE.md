# ARCHITECTURE

_Last updated: 2026-02-27_

## ⭐ Read This Before Every Feature Build

**This document is part of the `0_` prefix series.** All markdown files starting with `0_` in `docs/architecture/` are foundational reference documents that should be reviewed before starting any new feature, fix, or change:

- `0_ARCHITECTURE.md` — Product rules, layer boundaries, operational invariants (this file)
- `0_BUILD_CONVENTIONS.md` — Development practices and conventions
- `0_PRODUCT_ROADMAP.md` — High-level product strategy and planning

---

## 1) Product Rules (Authoritative)

This project is a **local-first Chinese memory engine** with deterministic review behavior.

Current Tier 1 product rules:
- Review is scheduler-driven and deterministic (`again|hard|good|easy` tier mapping, no stochastic grading).
- Review sessions consume **persisted content** only.
- AI generation is allowed only in admin authoring workflows, never during recall/review execution.
- Flashcard content is keyed by `character|pronunciation` and normalized before persistence.
- Fill-test eligibility is derived from saved phrase/example rows and `include_in_fill_test` flags.
- Unsafe content and malformed payloads are filtered in normalization before they can be used.

Primary flow:
1. Add Hanzi (`/words/add`) into local IndexedDB.
2. Curate content in Content Admin (`/words/admin`) via `/api/flashcard/generate` plus manual edits.
3. Run due reviews (`/words/review`, `/words/review/flashcard`, `/words/review/fill-test`) using persisted data.

## 2) Layer Boundaries

- UI layer (`src/app/...`, `WordsWorkspace`): interaction and view state.
- Domain layer (`src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts`): pure logic/normalization/grading.
- Service layer (`src/lib/db.ts`, `src/lib/xinhua.ts`, API routes): IO and persistence/network boundaries.
- AI layer (`src/app/api/flashcard/generate/route.ts`): prompt orchestration and provider calls.

Hard boundaries:
- UI must not call model providers directly.
- AI output must pass normalization and safety filters before use.
- Scheduler state changes happen only through deterministic grading paths.

## 3) Runtime Data Contracts

- Source of pronunciation candidates: `public/data/char_detail.json` via `xinhua` loader.
- Source of review content (meanings/phrases/examples): `flashcardContents` table in IndexedDB.
- Source of due queue: `words` table using `nextReviewAt` + scheduler due checks.
- Fill-test build input: saved flashcard phrases/examples (not ad-hoc generation).

## 4) Operational Invariants

- No live generation in flashcard/fill-test recall screens.
- Every persisted flashcard payload is normalized to expected shape.
- Unsafe phrase/example/definition content is dropped during normalization.
- Due review pages are route wrappers around `WordsWorkspace` and keep `Suspense` around search-param usage.

## 5) Docs Authority Policy

Authoritative docs:
- `docs/architecture/*.md` (excluding `docs/archive/**`)
- `README.md`

Non-authoritative docs:
- `docs/archive/**`
- `archive/**`

### Doc Update Requirements

**`0_` prefix files must be updated after each build/fix/change:**
- If a new product rule emerges → update `0_ARCHITECTURE.md`
- If a new development practice is established → update `0_BUILD_CONVENTIONS.md`
- If roadmap priorities or scope change → update `0_PRODUCT_ROADMAP.md`

Before merging any feature, ensure foundational docs are current.

### Recent Compliance Updates

**2026-02-27: Phase 1 Bilingual Strings Extraction Complete**
- Status: ✅ **All core Words module UI fully compliant**
- Files affected: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/words/WordsWorkspace.tsx`
- Strings extracted to: `src/app/words/words.strings.ts` (120+ EN/ZH pairs), `src/app/app.strings.ts`
- Documentation: [build-fix-log-2026-02-27.md](../fix-log/build-fix-log-2026-02-27.md)
- Impact: Developers and non-technical stakeholders can now modify UI copy in centralized string files without touching component logic
- Architectural pattern established for future features

### Other Docs

New feature/domain-specific docs:
- **Indexed by date** in filename (e.g., `2026-02-27-flashcard-rules.md`) unless otherwise specified
- Stored in `docs/architecture/` for core system behavior
- Stored in `docs/archive/[YYYY-MM]/` once they become historical

### Rules for archive material:
- Archive files are historical context only.
- Archive guidance must not override current implementation or active architecture docs.
- If archive text conflicts with implementation, implementation + authoritative docs win.

## 6) Development Conventions

**See:** `0_BUILD_CONVENTIONS.md`

All feature development must follow mandatory conventions for:
- **Bilingual UI** (English + Simplified Chinese)
- **Easy-to-tweak wording** (strings extracted to `*.strings.ts`)
- **Component file structure** (consistent naming and organization)

These rules apply to every new page, component, and feature in the roadmap.

### Reference Implementation (Phase 1)

The Words module now demonstrates the full pattern:
- **Strings files:** `src/app/words/words.strings.ts`, `src/app/app.strings.ts`
- **Component usage:** All 8 Words pages (`Add`, `Due Review`, `Flashcard`, `Fill-Test`, `Admin`, `All Characters`) plus root layout and home page
- **Pattern example:** `const str = wordsStrings[locale];` then `str.pageTitle`, `str.buttons.submit`, etc.
- **Helper functions:** Dynamic string generation for navigation menus and label generation
- **Current state:** ~130 total bilingual strings extracted, zero hardcoded Unicode remaining in major UI paths

## 7) Known Current Focus

Near-term focus is Tier 1 hardening:
- Better phrase/example quality.
- Stable normalization/safety checks.
- Deterministic review reliability.
- Clear separation between authoring-time AI and review-time execution.
