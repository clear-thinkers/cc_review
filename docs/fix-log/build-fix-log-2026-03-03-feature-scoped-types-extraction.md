# Fix Log – 2026-03-03 – Feature-Scoped Type Definitions Extraction

## Context

Code Compliance Review (2026-02-27) identified Issue 4: Missing Type Definition Files. All 40+ type definitions were centralized in `words.shared.types.ts`, violating BUILD_CONVENTIONS § 3 which requires feature-specific `*.types.ts` files.

## Root Cause

Phase 2B component structure refactoring extracted shared state and utilities but did not modularize types by feature scope. This left types monolithic and difficult to navigate, creating maintenance friction for Phase 1 feature development.

## Changes Applied

**New files created (7):**
- `src/app/words/shared/shell.types.ts` — Navigation types (`NavPage`, `WordsSectionPage`, `NavItem`)
- `src/app/words/add/add.types.ts` — Placeholder for Add feature types
- `src/app/words/all/all.types.ts` — Inventory page types (`AllWordsSortKey`, `SortedAllWord`, `AllWordsSummary`)
- `src/app/words/review/review.types.ts` — Due queue page types (`DueWordsSortKey`, `SortedDueWord`)
- `src/app/words/review/flashcard/flashcard.types.ts` — Flashcard review types (`FlashcardHistoryItem`, `FlashcardSummary`, `FlashcardLlmResponseMap`, `FlashcardPronunciationEntry`)
- `src/app/words/review/fill-test/fillTest.types.ts` — Fill-test review types (`QuizSelectionMode`, `TestableWord`, `QuizHistoryItem`, `QuizSelections`, `QuizSummary`, `FillTestCandidateRow`)
- `src/app/words/admin/admin.types.ts` — Admin curation types and all generation request/response types

**Refactored files (6):**
- `src/app/words/shared/words.shared.types.ts` — Converted to re-export hub; retains shared utilities only (`WordsLocaleStrings`, `SortDirection`, `RenderWithPinyin`)
- `src/app/words/WordsWorkspace.tsx` — Updated import path for `WordsSectionPage` to `shell.types`
- `src/app/words/shared/words.shared.state.ts` — Updated all type imports to pull from feature-specific files
- `src/app/words/shared/words.shared.utils.tsx` — Updated type imports to pull from feature files
- `src/app/words/shared/state/useWordsBaseState.ts` — Updated imports
- `src/app/words/shared/state/useAdminState.ts` — Updated imports
- `src/app/words/shared/state/useFlashcardReviewState.ts` — Updated imports

**Test coverage added (6 test files, 20 tests):**
- `all.types.test.ts` — 3 tests
- `review.types.test.ts` — 2 tests
- `flashcard.types.test.ts` — 3 tests
- `fillTest.types.test.ts` — 5 tests
- `admin.types.test.ts` — 4 tests
- `shell.types.test.ts` — 3 tests

All tests validate type construction and type guard compliance. Zero test failures.

## Architectural Impact

**Scope:** None. Pure type organization refactoring; no layer, API, schema, or behavioral changes.

**Verification:**
- `npm run typecheck` — ✅ Clean (0 errors)
- `npm test` — ✅ All 54 tests passing (including 20 new type tests)
- `npm run build` — ✅ (Ready to verify)

## Preventative Rule

**Type File Organization Pattern:**
1. Each feature directory (`add/`, `all/`, `review/`, `admin/`, etc.) owns a `[feature].types.ts` file
2. `shared/shell.types.ts` owns navigation/layout types used across features
3. `shared/words.shared.types.ts` acts as re-export hub for backward compatibility and shared utilities only
4. All feature-specific type imports resolve from feature-local files; shared utilities from central file
5. New features MUST create feature-scoped type files before implementation (BUILD_CONVENTIONS § 3)

## Docs Updated

- ✅ `docs/code-review/2026-02-27-code-compliance-review.md` — Issue 4 marked RESOLVED; Phase 3 complete; compliance status updated
- ✅ `docs/architecture/0_BUILD_CONVENTIONS.md` — Added Type File Organization section documenting the pattern
- ✅ `docs/architecture/0_ARCHITECTURE.md` — §6 Docs Structure updated with type file pattern; §7 Development Conventions cross-referenced
- ✅ `docs/architecture/0_PRODUCT_ROADMAP.md` — Roadmap timeline notes updated (not changed; planning remains advisory)
