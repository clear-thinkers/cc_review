# Code Compliance Review
**Date:** 2026-02-27  
**Reviewer:** Code Review Agent  
**Status:** ⚠️ High Violations Remain (Phase 1 and Phase 2 Complete)

---

## Executive Summary

The application demonstrates **strong architectural discipline** in core logic layers (domain, service, AI). Since this review started, **Phase 1 (bilingual string extraction) has been completed**. Critical and high-severity UI compliance issues still remain in structure, testing, and documentation.

1. **Phase 1 resolved:** bilingual strings are now centralized in `*.strings.ts` files
2. **Component structure now compliant:** shared contracts/state extracted and workspace reduced to coordinator/shell
3. **Missing UI tests and type split** – No `*.test.tsx` coverage in `src/app/`, inline page types still concentrated in workspace
4. **Feature documentation gaps remain** – missing architecture-level feature behavior docs

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

### 4. ❌ Missing Type Definition Files

**Rule (BUILD_CONVENTIONS § 3):**
- Types in `*.types.ts` if adding new domain models

**Current State:** No `*.types.ts` files exist.

**Evidence:**
- Type definitions are inline in [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx#L32):
  ```tsx
  type QuizSelectionMode = (typeof QUIZ_SELECTION_MODES)[number];
  type TestableWord = Word & { fillTest: FillTest };
  type QuizHistoryItem = { /* ... */ };
  type FlashcardHistoryItem = { /* ... */ };
  type AdminTarget = { /* ... */ };
  // ... many more embedded types
  ```

**Required Fix:**
Create feature-specific `*.types.ts` files:
- `words.types.ts` – shared types (Word, NavPage, etc.)
- `review.types.ts` – review page state types
- `admin.types.ts` – admin page types

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
| Bilingual Strings | BUILD_CONVENTIONS § 1 | ✅ FIXED (Phase 1) | - |
| Component File Structure | BUILD_CONVENTIONS � 3 | ? FIXED (Phase 2) | - |
| Component Tests | BUILD_CONVENTIONS § 3 Checklist | ❌ MISSING | HIGH |
| Type Files | BUILD_CONVENTIONS § 3 | ❌ MISSING | HIGH |
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
3. Updated [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx), [src/app/layout.tsx](src/app/layout.tsx), and [src/app/page.tsx](src/app/page.tsx) to use string references
4. Verified completion in `docs/fix-log/build-fix-log-2026-02-27-bilingual-string-extraction.md` and `docs/code-review/2026-02-27-phase-1-bilingual-strings-fix-plan.md`

**Effort:** ~5 hours (actual)  
**Files:** 2 new, 3 modified

### Phase 2: Component Breakdown (CRITICAL) - COMPLETED (2026-02-27)
1. ? Moved route rendering to dedicated feature page components
2. ? Extracted page-specific section rendering into feature files
3. ? Split shared contracts/state/utilities into `src/app/words/shared/*` modules
4. ? Reduced `WordsWorkspace` to coordinator + shared shell composition
5. ? Revalidated build/typecheck and recorded Phase 2B fix log

**Effort:** ~12 hours planned; Phase 2A + 2B completed  
**Files:** shared modules + section updates + workspace/shell refactor

### Phase 3: Type Files (HIGH)
1. Create `[feature].types.ts` for each page
2. Move inline type definitions to appropriate files
3. Update imports across codebase

**Effort:** ~2 hours  
**Files:** 5+ new

### Phase 4: Tests (HIGH)
1. Add test files for main pages (add, admin, all, review, flashcard, fillTest)
2. Cover happy paths and error states
3. Integration tests for state management

**Effort:** ~8 hours  
**Files:** 6+ new

### Phase 5: Documentation (MEDIUM)
1. Create feature-specific docs with date indexing
2. Update fix logs
3. Add component README.md files

**Effort:** ~3 hours  
**Files:** 5+ new

**Remaining Remediation Effort:** ~13 hours

---

## Recommendations

1. **Immediate**: Add `*.types.ts` and `*.test.tsx` per feature now that Phase 2 structure is complete
2. Create missing feature docs under `docs/architecture/` with date-indexed filenames
3. Continue logging each phase in `docs/fix-log/` after completion

---

## Conclusion

The application's **core logic is architecturally sound** – domain, service, and AI layers are properly separated, normalization filters are in place, and review flows are deterministically controlled. **Phase 1 bilingual string compliance is now complete.** Remaining UI compliance risks are concentrated in testing coverage, additional type modularization scope, and feature documentation.

Remaining violations create:
- Testing confidence gaps (no UI component/integration tests)
- Documentation gaps (feature behavior unclear)

**Compliance Status: PARTIAL** � Phases 1 and 2 are complete; Phases 3-5 remain required for full compliance.

