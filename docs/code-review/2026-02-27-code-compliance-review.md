# Code Compliance Review
**Date:** 2026-02-27  
**Reviewer:** Code Review Agent  
**Status:** ⚠️ Phase 1, 2, 3 Complete — 2 High Issues Remain (Tests, Docs)

---

## Executive Summary

The application demonstrates **strong architectural discipline** in core logic layers (domain, service, AI). **Phase 1 (bilingual string extraction), Phase 2 (component structure), and Phase 3 (type file organization) are now complete.** Two high-severity UI compliance issues remain: testing coverage and feature documentation.

1. **Phase 1 resolved (2026-02-27):** Bilingual strings centralized in `*.strings.ts` files
2. **Phase 2 resolved (2026-02-27):** Component structure refactored; shared contracts extracted; workspace reduced to coordinator + shell
3. **Phase 3 resolved (2026-03-03):** Type definitions split into feature-scoped `*.types.ts` files with incremental test coverage
4. **Outstanding:** No `*.test.tsx` coverage in `src/app/`; missing feature documentation

---

## UPDATED FINDINGS

### 1. ✅ Bilingual String Extraction (BUILD_CONVENTIONS § 1) - RESOLVED

**Rule:** All new pages, UI components, and user-facing text must support English and Simplified Chinese via centralized `*.strings.ts` files.

**Current State (2026-02-27):**
- [src/app/words/words.strings.ts](src/app/words/words.strings.ts) exists and contains words-module strings
- [src/app/app.strings.ts](src/app/app.strings.ts) exists and contains layout/home strings
- [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx), [src/app/layout.tsx](src/app/layout.tsx), and [src/app/page.tsx](src/app/page.tsx) were updated to consume string lookups

**Resolution Evidence (from Phase 1 docs):**
- `docs/code-review/2026-02-27-phase-1-bilingual-strings-fix-plan.md` marks Steps 1-5 as DONE
- `docs/fix-log/build-fix-log-2026-02-27-bilingual-string-extraction.md` records Phase 1 as COMPLETED
- Validation checklist marks no remaining hardcoded Unicode escape strings in JSX

**Resulting Impact:**
- Non-developers can edit UI copy from centralized string files
- BUILD_CONVENTIONS § 1 / § 2 compliance is restored for this scope
- Remaining compliance work is now focused on component structure, tests, types, and docs

---

### 2. ? Component File Structure (BUILD_CONVENTIONS � 3) - RESOLVED (Phase 2 Complete)

**Rule:** New pages/components must follow feature-scoped route + page + shared-contract structure.

**Current State (after Phase 2B implementation on 2026-02-27):**
- Route files use dedicated feature page components:
  - `add/AddPage.tsx`, `admin/AdminPage.tsx`, `all/AllPage.tsx`, `review/ReviewPage.tsx`, `review/flashcard/FlashcardPage.tsx`, `review/fill-test/FillTestPage.tsx`
- Feature render blocks are extracted into feature section files:
  - `AddSection.tsx`, `DueReviewSection.tsx`, `FlashcardReviewSection.tsx`, `FillTestReviewSection.tsx`, `AdminSection.tsx`, `AllWordsSection.tsx`
- Shared contracts/state/utilities are now modularized:
  - `shared/words.shared.types.ts`
  - `shared/words.shared.utils.tsx`
  - `shared/words.shared.state.ts`
  - `shared/state/useWordsBaseState.ts`
  - `shared/state/useFlashcardReviewState.ts`
  - `shared/state/useFillTestReviewState.ts`
  - `shared/state/useAdminState.ts`
  - `shared/WordsWorkspaceVM.ts` (strict type contract)
- `WordsWorkspace.tsx` is now a thin coordinator that composes shared state and shell rendering.
- `WordsShell.tsx` owns shared layout/navigation/sidebar rendering.

**Resulting Severity:** RESOLVED for issue #2 scope.

**Verification Evidence:**
- `npm run typecheck` ?
- `npm run build` ?
- Detailed change log: `docs/fix-log/build-fix-log-2026-02-27-phase-2b-component-structure.md`

---

### 3. ❌ Missing Test Files

**Rule (BUILD_CONVENTIONS § 3 Checklist):**
- Tests cover happy path + error states

**Current State:** Zero test files found.

**Scan Results:**
- No `*.test.tsx` files in `src/app/` – **0 component tests**
- Test files exist in `src/lib/` (scheduler.test.ts, xinhua.test.ts, etc.) – ✓ Good
- UI component tests completely absent – ❌ Missing

**Examples of Missing Tests:**
- [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx) – No tests for 8 different pages
- Add page flow (character input, validation, DB save)
- Flashcard review grading logic
- Fill-test drag-drop interaction
- Admin content generation and save
- Error handling and recovery paths

**Required Fix:**
Add `*.test.tsx` files for each page component with coverage of:
- Page mounts correctly with due words
- User interactions (add, submit, grade)
- Error states and recovery
- Locale/bilingual rendering

---

### 4. ✅ Missing Type Definition Files (BUILD_CONVENTIONS § 3) - RESOLVED (Phase 3 Complete, 2026-03-03)

**Rule:** Types must be in feature-scoped `*.types.ts` files, not inline in components.

**Previous State (2026-02-27):**
- 40+ type definitions embedded in monolithic `words.shared.types.ts`
- No feature-scoped type organization
- Difficult IDE navigation and future maintainability risk

**Current State (after Phase 3 implementation on 2026-03-03):**
- Types split into 7 feature-scoped files:
  - `shared/shell.types.ts` — Navigation types (`NavPage`, `WordsSectionPage`, `NavItem`)
  - `add/add.types.ts` — Placeholder for Add feature types
  - `all/all.types.ts` — Inventory page types (`AllWordsSortKey`, `SortedAllWord`, `AllWordsSummary`)
  - `review/review.types.ts` — Due queue types (`DueWordsSortKey`, `SortedDueWord`)
  - `review/flashcard/flashcard.types.ts` — Flashcard review types
  - `review/fill-test/fillTest.types.ts` — Fill-test review types
  - `admin/admin.types.ts` — Admin curation and generation request/response types
- Central `words.shared.types.ts` refactored as re-export hub (backward compatible)
- 20 new type validation tests across 6 files (all passing)
- All imports updated to resolve from feature-specific files

**Resolution Evidence:**
- `docs/fix-log/build-fix-log-2026-03-03-feature-scoped-types-extraction.md` documents Phase 3 completion
- `npm run typecheck` — ✅ Clean (0 errors)
- `npm test` — ✅ 54/54 tests passing (includes 20 new type tests)
- Each feature directory owns its type definitions adjacent to implementation

**Resulting Impact:**
- Type navigation improved: find types in adjacent `*.types.ts` file, not monolithic central file
- Backward compatible: existing imports from `words.shared.types` continue to work via re-export
- Future-ready: Phase 1 features (Admin-Configurable Prompts) can add types to `admin.types.ts` immediately
- Incremental test coverage: types validated at compile + runtime (BUILD_CONVENTIONS § 3 Checklist)

---

### 5. ❌ Missing Feature Documentation

**Rule (BUILD_CONVENTIONS § 0 & 0_ARCHITECTURE § 5):**
- New feature docs indexed by date: e.g., `2026-02-27-flashcard-rules.md`
- Stored in `docs/architecture/` for core behavior
- Fix logs required after code fixes: `docs/fix-log/[YYYY-MM-DD]-fix-log.md`

**Current State:**
- `docs/architecture/` contains high-level docs but no granular feature specs for implemented features
- No `docs/architecture/2026-02-*-*.md` date-indexed feature docs
- `docs/fix-log/build-fix-log-2026-02-27-bilingual-string-extraction.md` now exists and records Phase 1 completion

**Missing Documentation:**
- No "flashcard rules" doc (how content is generated, normalized, stored)
- No "fill-test rules" doc (how tests are built, graded, included)
- No "admin workflow" doc (how content authoring works)
- No "scheduler implementation" doc (though code is clear)

**Required Fix:**
Create feature-specific docs:
- `docs/architecture/2026-02-27-flashcard-content-rules.md` – Schema, validation, normalization
- `docs/architecture/2026-02-27-fill-test-generation.md` – How tests are built from saved content
- `docs/architecture/2026-02-27-admin-workflow.md` – Content authoring workflow
- Keep adding dated fix logs for remaining phases (Phase 2+)

---

## ✅ ARCHITECTURAL COMPLIANCE (POSITIVE)

The following architectural rules are **properly implemented**:

### ✅ 1. Layer Boundaries (ARCHITECTURE § 2)

**Rule:** Clear separation of UI / Domain / Service / AI layers

**Status:** COMPLIANT

- **Domain Layer** ([src/lib/scheduler.ts](src/lib/scheduler.ts), [src/lib/fillTest.ts](src/lib/fillTest.ts)) – Pure logic, deterministic, no side effects ✓
- **Service Layer** ([src/lib/db.ts](src/lib/db.ts), [src/lib/xinhua.ts](src/lib/xinhua.ts)) – IO boundaries properly isolated ✓
- **AI Layer** ([src/app/api/flashcard/generate/route.ts](src/app/api/flashcard/generate/route.ts)) – Separate endpoint, clear request/response handling ✓
- **UI Layer** ([src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx)) – Imports domain/service correctly, doesn't call providers directly ✓

### ✅ 2. No Direct Model Provider Calls from UI

**Rule (ARCHITECTURE § 2 Hard Boundary):** UI must not call model providers directly.

**Status:** COMPLIANT

- WordsWorkspace imports only `flashcardLlm` for **normalization**, not for generation
- All generation requests go through `/api/flashcard/generate` endpoint
- UI calls `requestFlashcardGeneration()` which wraps the API call

### ✅ 3. AI Output Normalization (ARCHITECTURE § 4)

**Rule:** AI output must pass normalization and safety filters before use.

**Status:** COMPLIANT

**Evidence in [src/lib/flashcardLlm.ts](src/lib/flashcardLlm.ts#L7):**
```typescript
const UNSAFE_CONTENT_PATTERN = 
  /(暴力|打架|斗殴|争吵|恐惧|害怕|焦虑|作弊|撒谎|偷懒|玩火|危险|色情|毒品|赌博|仇恨|不文明)/u;

function hasUnsafeContent(text: string): boolean {
  return UNSAFE_CONTENT_PATTERN.test(text);
}
```

- Unsafe content filtered during normalization
- Phrase length validation (2-4 characters) enforced
- Example length capped at 30 characters
- Duplicates deduplicated before storage
- All responses validated against `FlashcardLlmResponse` type schema

### ✅ 4. No Live Generation During Review

**Rule (ARCHITECTURE § 4 Operational Invariants):** No live generation in flashcard/fill-test recall screens.

**Status:** COMPLIANT

**Evidence:**
- Flashcard review startup (line 2876) loads from `dueWords` queue
- Fill-test review startup (line 2920) builds test from saved content only
- Zero generation calls in review session loops
- Admin page = only place generation happens (separate from review flows)

### ✅ 5. Deterministic Grading

**Rule (ARCHITECTURE § 1):** Review is scheduler-driven and deterministic.

**Status:** COMPLIANT

- [src/lib/scheduler.ts](src/lib/scheduler.ts) implements deterministic forgetting curve
- Grade mapping: `again | hard | good | easy` → stability adjustments
- No stochastic grading anywhere
- [src/lib/fillTest.ts](src/lib/fillTest.ts) grades based on exact phrase matching (deterministic)
- [src/lib/review.ts](src/lib/review.ts) controls GradeResult mapping

---

## SUMMARY TABLE

| Rule | Convention | Status | Severity |
|------|-----------|--------|----------|
| Bilingual Strings | BUILD_CONVENTIONS § 1 | ✅ FIXED (Phase 1, 2026-02-27) | - |
| Component File Structure | BUILD_CONVENTIONS § 3 | ✅ FIXED (Phase 2, 2026-02-27) | - |
| Type Files | BUILD_CONVENTIONS § 3 | ✅ FIXED (Phase 3, 2026-03-03) | - |
| Component Tests | BUILD_CONVENTIONS § 3 Checklist | ❌ MISSING | HIGH |
| Feature Documentation | BUILD_CONVENTIONS § 0, 0_ARCHITECTURE § 5 | ❌ MISSING | MEDIUM |
| Layer Boundaries | 0_ARCHITECTURE § 2 | ✅ COMPLIANT | – |
| No Direct Provider Calls | 0_ARCHITECTURE § 2 | ✅ COMPLIANT | – |
| AI Output Normalization | 0_ARCHITECTURE § 4 | ✅ COMPLIANT | – |
| No Live Generation in Review | 0_ARCHITECTURE § 4 | ✅ COMPLIANT | – |
| Deterministic Grading | 0_ARCHITECTURE § 1 | ✅ COMPLIANT | – |

---

## Remediation Roadmap

### Phase 1: String Extraction (CRITICAL) - COMPLETED (2026-02-27)
1. Created [src/app/words/words.strings.ts](src/app/words/words.strings.ts)
2. Created [src/app/app.strings.ts](src/app/app.strings.ts)
3. Updated component pages to use string references
4. Verified completion in fix logs

**Effort:** ~5 hours (actual)  
**Files:** 2 new, 3 modified

### Phase 2: Component Breakdown (CRITICAL) - COMPLETED (2026-02-27)
1. Moved route rendering to dedicated feature page components
2. Extracted page-specific section rendering into feature files
3. Split shared contracts/state/utilities into `src/app/words/shared/*` modules
4. Reduced `WordsWorkspace` to coordinator + shared shell composition
5. Validated build/typecheck

**Effort:** ~12 hours (actual)  
**Files:** shared modules + section updates + workspace/shell refactor

### Phase 3: Type Files (CRITICAL) - COMPLETED (2026-03-03)
1. Created 7 feature-scoped `*.types.ts` files (shell, add, all, review, flashcard, fillTest, admin)
2. Refactored central `words.shared.types.ts` as re-export hub
3. Updated all imports across 6 files to resolve from feature-specific files
4. Added 20 type validation tests across 6 test files (all passing)
5. Validated typecheck (0 errors) and test suite (54/54 passing)

**Effort:** ~2.5 hours (actual)  
**Files:** 7 new type files + 6 test files + 6 refactored imports

### Phase 4: Tests (HIGH)
1. Add test files for main pages (add, admin, all, review, flashcard, fillTest)
2. Cover happy paths and error states
3. Integration tests for state management

**Effort:** ~8 hours (estimated)  
**Files:** 6+ new

### Phase 5: Documentation (MEDIUM)
1. Create feature-specific docs with date indexing
2. Update fix logs
3. Add component README.md files

**Effort:** ~3 hours (estimated)  
**Files:** 5+ new

**Remaining Remediation Effort:** ~11 hours (Phases 4-5)

---

## Recommendations

1. **Immediate**: Add `*.types.ts` and `*.test.tsx` per feature now that Phase 2 structure is complete
2. Create missing feature docs under `docs/architecture/` with date-indexed filenames
3. Continue logging each phase in `docs/fix-log/` after completion

---

## Conclusion

The application's **core logic is architecturally sound** – domain, service, and AI layers are properly separated, normalization filters are in place, and review flows are deterministically controlled. **Phases 1, 2, and 3 of compliance remediation are now complete** (string centralization, component structure, and type file organization).

Remaining UI compliance work is focused on two areas:
- **Testing:** Component and integration test coverage for review flows (Phase 4, ~8 hours)
- **Documentation:** Feature-specific behavior docs for admin, flashcard, fill-test, and scheduler modules (Phase 5, ~3 hours)

**Compliance Status:** Phases 1-3 COMPLETE ✅ | Phases 4-5 IN PLANNING 📋  
**Compliance Trajectory:** TRACKING TOWARD FULL COMPLIANCE → Ready for Phase 1 feature development (Admin-Configurable Prompts)

