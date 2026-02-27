# Build Fix Log - 2026-02-27 (Phase 2B: Component Structure Closure)

## Summary

- **Date:** 2026-02-27
- **Area:** `src/app/words/*`
- **Scope:** BUILD_CONVENTIONS § 3 closure for component structure
- **Result:** Phase 2 moved from partial to complete for issue #2 (shared contracts/state extracted, coordinator shell finalized)

---

## Problem

After Phase 2A, route-level components and section extraction were done, but `WordsWorkspace.tsx` still held most orchestration/state and shared contracts remained weak (`WordsWorkspaceVM = any`).

This left a high-risk central coupling point and prevented full closure of component-structure compliance.

---

## Root Cause

Initial extraction focused on page rendering decomposition first. State orchestration, cross-feature types, and shared utility logic were intentionally deferred, leaving a large central implementation surface.

---

## What Was Changed

### 1) Shared contract extraction

Added:

- `src/app/words/shared/words.shared.types.ts`
- `src/app/words/shared/WordsWorkspaceVM.ts` (strict inferred type alias)

Outcome:

- Removed `any` VM shim
- Consolidated cross-feature words/admin/review/shared UI types

### 2) Shared utility extraction

Added:

- `src/app/words/shared/words.shared.utils.tsx`

Outcome:

- Moved pure shared helpers out of `WordsWorkspace` (sorting/probability/clone, pinyin rendering, fill-test build, admin normalization guards, request-shape guards)

### 3) Shared state decomposition

Added:

- `src/app/words/shared/words.shared.state.ts` (composition root)
- `src/app/words/shared/state/useWordsBaseState.ts`
- `src/app/words/shared/state/useFlashcardReviewState.ts`
- `src/app/words/shared/state/useFillTestReviewState.ts`
- `src/app/words/shared/state/useAdminState.ts`

Outcome:

- State initialization split by feature domain
- Shared orchestration moved out of page component into shared state layer

### 4) Thin coordinator + shell

Updated/added:

- `src/app/words/WordsWorkspace.tsx` -> thin coordinator
- `src/app/words/shared/WordsShell.tsx` -> layout shell (menu/sidebar/stats)

Outcome:

- `WordsWorkspace` now resolves locale + composes VM + renders shell/sections
- Page component no longer contains the monolithic orchestration body

### 5) Section hardcoded copy cleanup

Updated:

- `src/app/words/all/AllWordsSection.tsx`
- `src/app/words/admin/AdminSection.tsx`
- `src/app/words/review/DueReviewSection.tsx`
- `src/app/words/review/flashcard/FlashcardReviewSection.tsx`
- `src/app/words/review/fill-test/FillTestReviewSection.tsx`
- `src/app/words/words.strings.ts`

Outcome:

- Removed reintroduced section-level hardcoded UI literals
- Added missing EN/ZH string keys used by section components

---

## Verification

Executed:

1. `npm run typecheck` ✅
2. `npm run build` ✅
3. `rg -n "\bany\b" src/app/words` ✅ (no matches)
4. `rg -n "Please start|Stop quiz|Date added|Date due|Reset|Delete|No quiz character loaded|No saved content yet" src/app/words` ✅ (matches now centralized in string/state definitions)

Build output confirmed static generation for:

- `/words/add`
- `/words/admin`
- `/words/all`
- `/words/review`
- `/words/review/flashcard`
- `/words/review/fill-test`

---

## Behavior Parity Notes

- Route wrappers remain unchanged and continue delegating to dedicated page components.
- Existing architecture invariants preserved:
  - UI does not call model providers directly.
  - Review flows still consume persisted content and avoid live generation.
- No DB schema or API contract changes were introduced.

---

## Residual Risks

1. Manual UI parity still requires interactive browser verification for drag/drop and admin editing ergonomics.
2. Phase 3/4/5 compliance tracks remain open (tests, additional type-file granularity, feature docs) and should continue independently.
