# Code Compliance Review
**Date:** 2026-02-27  
**Reviewer:** Code Review Agent  
**Status:** ⚠️ Multiple Critical Violations

---

## Executive Summary

The application demonstrates **strong architectural discipline** in core logic layers (domain, service, AI) but has **multiple critical violations** in the UI layer related to build conventions. The primary issues revolve around:

1. **Absence of bilingual string files** – No `*.strings.ts` files exist anywhere in the codebase
2. **Monolithic component structure** – Single 4,348-line file violates component breakdown conventions
3. **Missing test and documentation files** – No `*.test.tsx`, `*.types.ts`, or `*.README.md` files
4. **Non-compliance with BUILD_CONVENTIONS** – Hardcoded strings embedded in JSX violate all documented standards

---

## CRITICAL VIOLATIONS

### 1. ❌ Bilingual String Extraction (BUILD_CONVENTIONS § 1)

**Rule:** All new pages, UI components, and user-facing text must support English and Simplified Chinese via centralized `*.strings.ts` files.

**Current State:** No `*.strings.ts` files exist anywhere in the codebase.

**Violation:** [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx) contains hundreds of hardcoded bilingual strings using escaped Unicode, e.g.:
```tsx
{"\u6c49\u5b57 / Character"}  // Instead of strings.hanzi or similar
{"\u5f53\u524d\u6ca1\u6709\u5f85\u590d\u4e60\u6c49\u5b57\u3002 / No due characters right now."}
{"\u6dfb\u52a0\u6c49\u5b57 / Add Characters"}
```

Also appears in:
- [src/app/page.tsx](src/app/page.tsx) – Hardcoded page title
- [src/app/layout.tsx](src/app/layout.tsx) – Hardcoded metadata

**Impact:** 
- Non-developers cannot easily update UI copy without touching code
- Strings are scattered across multiple JSX files (impossible to find all translations in < 2 minutes)
- Violates "easy-to-tweak wording" principle directly

**Required Fix:**
- Create [src/app/words/words.strings.ts](src/app/words/words.strings.ts) with all UI text
- Create [src/app/app.strings.ts](src/app/app.strings.ts) for home/layout text
- Extract all 100+ hardcoded strings to these centralized files
- Update all components to use `strings[locale]` pattern

---

### 2. ❌ Component File Structure (BUILD_CONVENTIONS § 3)

**Rule:** New pages/components must follow this structure:
```
src/app/words/[feature]/
  ├── page.tsx              (Next.js route, minimal logic)
  ├── [FeatureName]Page.tsx (main component, layout)
  ├── [feature].strings.ts  (all text strings)
  ├── [feature].types.ts    (TypeScript types)
  ├── [feature].test.tsx    (component + integration tests)
  └── README.md             (optional: brief feature guide)
```

**Current State:** [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx) is a **4,348-line monolith** containing:
- All UI layout and rendering
- State management for 8+ pages
- Admin content management logic
- Flashcard/fill-test grading UI
- All hardcoded strings (bilingual)
- Helper functions and type definitions
- Request/response handling

**Violation Severity:** CRITICAL
- Single 4,348-line file violates component breakdown principle
- Impossible to maintain, test, or modify safely
- Multiple concerns mixed (UI, state, logic, strings, types)

**Example of Current Problematic Structure:**
```tsx
// Inside WordsWorkspace.tsx - all mixed together:
export default function WordsWorkspace({ page }: { page: WordsSectionPage }) {
  // 40+ useState hooks
  // 1,000+ lines of render logic
  // 100+ hardcoded strings in JSX
  // Helper functions for phrase normalization
  // Type definitions intermixed
  // Admin content request functions
  // Flashcard grading logic
  // ...
}
```

**Required Fix:**
Refactor into multiple files:
```
src/app/words/
  ├── WordsWorkspace.tsx      (main orchestrator, orchestrates subpages)
  ├── review/
  │   ├── page.tsx
  │   ├── ReviewPage.tsx
  │   ├── review.strings.ts
  │   ├── review.types.ts
  │   └── review.test.tsx
  ├── add/
  │   ├── page.tsx
  │   ├── AddPage.tsx
  │   ├── add.strings.ts
  │   └── add.test.tsx
  ├── admin/
  │   ├── page.tsx
  │   ├── AdminPage.tsx
  │   ├── admin.strings.ts
  │   ├── admin.types.ts
  │   └── admin.test.tsx
  ├── all/
  │   ├── page.tsx
  │   ├── AllPage.tsx
  │   ├── all.strings.ts
  │   └── all.test.tsx
  └── shared/
      └── words.strings.ts (shared strings)
```

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
- `docs/fix-log/` has only one entry: `build-fix-log-2026-02-26.md`

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
- Update `docs/fix-log/build-fix-log-2026-02-27.md` after compliance fixes

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
| Bilingual Strings | BUILD_CONVENTIONS § 1 | ❌ VIOLATION | CRITICAL |
| Component File Structure | BUILD_CONVENTIONS § 3 | ❌ VIOLATION | CRITICAL |
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

### Phase 1: String Extraction (CRITICAL)
1. Create [src/app/words/words.strings.ts](src/app/words/words.strings.ts) with all bilingual strings
2. Create [src/app/app.strings.ts](src/app/app.strings.ts) for home/layout
3. Update all components to use extracted strings
4. Verify no hardcoded strings remain in JSX

**Effort:** ~4 hours  
**Files:** 2 new, 6 modified

### Phase 2: Component Breakdown (CRITICAL)
1. Refactor WordsWorkspace into subpage components
2. Move each page (add, admin, all, review, flashcard, fillTest) to separate component files
3. Implement proper component hierarchy with state management per page
4. Extract shared utilities to separate files

**Effort:** ~12 hours  
**Files:** 20+ new files, 1 file removed (WordsWorkspace refactored into multiple)

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

**Total Remediation Effort:** ~29 hours

---

## Recommendations

1. **Immediate** (This Build): Extract bilingual strings to `*.strings.ts` files – this unblocks non-developers from content updates
2. **Next Priority**: Break down WordsWorkspace into manageable, testable components
3. Before merging any new features, apply these build conventions consistently
4. Update 0_ARCHITECTURE.md and 0_BUILD_CONVENTIONS.md after completion (as per rule § 0)

---

## Conclusion

The application's **core logic is architecturally sound** – domain, service, and AI layers are properly separated, normalization filters are in place, and review flows are deterministically controlled. However, the **UI implementation severely violates build conventions** around bilingual content management and component structure.

These violations create:
- Maintenance burden (hardcoded strings scattered across files)
- Non-developer friction (cannot easily tweak copy)
- Testing difficulty (monolithic 4K+ line component)
- Documentation gaps (feature behavior unclear)

**Compliance Status: FAIL** – Multiple critical violations must be resolved before next feature build.
