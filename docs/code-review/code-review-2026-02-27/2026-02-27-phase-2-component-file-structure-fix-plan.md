# Fix Plan: Phase 2 - Component File Structure (BUILD_CONVENTIONS Â§ 3)
**Date:** 2026-02-27  
**Owner:** Code Review Agent  
**Priority:** CRITICAL  
**Scope:** Resolve noncompliant issue #2 from `2026-02-27-code-compliance-review.md`  
**Status:** IMPLEMENTED (2026-02-27, Phase 2 COMPLETE)

---

## Preconditions Completed

Per request and convention policy, all `0_*.md` foundational docs were reviewed before planning:

- `docs/architecture/0_ARCHITECTURE.md`
- `docs/architecture/0_BUILD_CONVENTIONS.md`
- `docs/architecture/0_PRODUCT_ROADMAP.md`

Key constraints pulled into this plan:

1. Keep strict layer boundaries (UI does not call model providers directly).
2. Preserve review invariants (no live generation during recall/review).
3. Keep bilingual strings centralized in existing `*.strings.ts` files.
4. Follow BUILD_CONVENTIONS Â§ 3 page/component structure for new and refactored UI.
5. Update docs/fix logs after implementation.

---

## Problem Statement

`src/app/words/WordsWorkspace.tsx` is currently a 4,339-line monolith handling multiple routes/pages and mixed concerns (layout, orchestration, page rendering, and state). This violates BUILD_CONVENTIONS Â§ 3 component structure guidance and creates high change risk.

Current route wrappers already exist, but they all funnel through one large workspace file:

- `src/app/words/add/page.tsx`
- `src/app/words/admin/page.tsx`
- `src/app/words/all/page.tsx`
- `src/app/words/review/page.tsx`
- `src/app/words/review/flashcard/page.tsx`
- `src/app/words/review/fill-test/page.tsx`

## Implementation Result (2026-02-27)

Phase 2A + 2B implementation completed:

1. Extracted page-render sections from `WordsWorkspace.tsx` into feature files.
2. Added feature page entry components (`AddPage`, `AdminPage`, `AllPage`, `ReviewPage`, `FlashcardPage`, `FillTestPage`).
3. Rewired all words route `page.tsx` files to dedicated feature page components.
4. Introduced shared state/types/util layers:
   - `src/app/words/shared/words.shared.types.ts`
   - `src/app/words/shared/words.shared.utils.tsx`
   - `src/app/words/shared/words.shared.state.ts`
   - `src/app/words/shared/state/useWordsBaseState.ts`
   - `src/app/words/shared/state/useFlashcardReviewState.ts`
   - `src/app/words/shared/state/useFillTestReviewState.ts`
   - `src/app/words/shared/state/useAdminState.ts`
5. Replaced VM `any` shim with strict inferred type contract:
   - `src/app/words/shared/WordsWorkspaceVM.ts`
6. Refactored `WordsWorkspace.tsx` to coordinator-only and moved layout shell to:
   - `src/app/words/shared/WordsShell.tsx`
7. Removed reintroduced hardcoded literals from extracted section files by routing copy through `words.strings.ts`.

Build verification after refactor:
- `npm run typecheck` âœ…
- `npm run build` âœ…

---

## Goal (Issue #2)

Refactor words UI into feature-scoped components so each route uses focused page components instead of one monolithic `WordsWorkspace.tsx`.

Success for this phase means:

- Route-level pages are backed by dedicated feature page components.
- `WordsWorkspace.tsx` is removed or reduced to a small coordinator/shell.
- Page concerns are separated by feature folder (`add`, `admin`, `all`, `review`, `review/flashcard`, `review/fill-test`).
- Existing behavior remains unchanged.

---

## Target File Structure

```text
src/app/words/
  page.tsx
  words.strings.ts
  shared/
    WordsShell.tsx
    words.shared.types.ts
    words.shared.state.ts
  add/
    page.tsx
    AddPage.tsx
    add.sections.tsx
  admin/
    page.tsx
    AdminPage.tsx
    admin.sections.tsx
  all/
    page.tsx
    AllPage.tsx
    all.sections.tsx
  review/
    page.tsx
    ReviewPage.tsx
    review.sections.tsx
    flashcard/
      page.tsx
      FlashcardPage.tsx
      flashcard.sections.tsx
    fill-test/
      page.tsx
      FillTestPage.tsx
      fillTest.sections.tsx
```

Notes:

- Keep `words.strings.ts` as single source of UI copy for words feature.
- Add `shared/` for common state/selectors/utilities used across pages.
- Final naming can be adjusted, but feature ownership boundaries must remain clear.

---

## Implementation Plan

### Step 1: Baseline Capture and Safety Net
**Status:** DONE

1. Record baseline:
   - Build/typecheck status
   - Current route behavior for all words pages
2. Create a short migration checklist for parity validation.

Deliverables:
- Baseline notes in fix log draft
- Explicit parity checklist

---

### Step 2: Extract Shared Workspace Contracts
**Status:** DONE

1. Move cross-page types and shared helpers out of `WordsWorkspace.tsx` into `src/app/words/shared/`.
2. Keep domain/service imports unchanged (no architecture boundary changes).
3. Keep data-flow and scheduling semantics unchanged.

Deliverables:
- `src/app/words/shared/words.shared.types.ts` ✅
- `src/app/words/shared/words.shared.state.ts` ✅
- `src/app/words/shared/WordsWorkspaceVM.ts` strict contract (no `any`) ✅

---

### Step 3: Carve Out Feature Page Components
**Status:** DONE

1. Create feature page components:
   - `AddPage.tsx`
   - `AdminPage.tsx`
   - `AllPage.tsx`
   - `ReviewPage.tsx`
   - `FlashcardPage.tsx`
   - `FillTestPage.tsx`
2. Move render logic from monolith into feature files with minimal behavior changes.
3. Keep all user-facing text sourced from `words.strings.ts`.

Deliverables:
- Feature page components and section components created under route folders âœ…
- No build/typecheck regression âœ…

---

### Step 4: Rewire Route `page.tsx` Files to Feature Components
**Status:** DONE

1. Update each route `page.tsx` to import and render its own feature page component.
2. Keep `Suspense` wrappers where currently required by route usage/search params.
3. Remove direct dependence on a giant central render switch.

Deliverables:
- Route wrappers point to feature components
- Navigation flow unchanged

---

### Step 5: Shrink or Remove `WordsWorkspace.tsx` 
**Status:** DONE

1. If still needed, convert `WordsWorkspace.tsx` into a small shell/coordinator only.
2. Otherwise remove it and move any remaining shared orchestration into `shared/`.
3. Verify no dead exports or stale imports remain.

Deliverables:
- `WordsWorkspace.tsx` converted to thin coordinator-only workspace ✅
- Shared shell extracted to `src/app/words/shared/WordsShell.tsx` ✅
- Shared orchestration/state moved to `src/app/words/shared/words.shared.state.ts` + `shared/state/*` ✅

---

### Step 6: Verification and Documentation
**Status:** DONE

1. Validate behavior parity across:
   - add
   - review
   - review/flashcard
   - review/fill-test
   - admin
   - all
2. Run build and type checks.
3. Create/update fix log in `docs/fix-log/` for this phase.
4. Update `0_` docs only if new conventions/rules emerge from the refactor.

Deliverables:
- Build passes
- Fix log entry
- Updated compliance status note

---

## Out of Scope for This Plan

These remain related but separate compliance tracks:

1. Full component/integration test coverage (`*.test.tsx`) - tracked by issue #3.
2. Full feature-specific type modularization breadth - tracked by issue #4.
3. New architecture feature docs in `docs/architecture/` - tracked by issue #5.

This phase may create scaffolding that makes #3/#4/#5 easier, but does not claim full closure of those issues.

---

## Validation Checklist (Issue #2 Closure)

- [x] No single words UI file acts as 4k-line multi-page monolith
- [x] Each words route renders a dedicated feature component file
- [x] Feature code is organized under feature folders
- [x] Existing strings remain centralized (`words.strings.ts` / `app.strings.ts`)
- [x] No architecture boundary regressions (UI -> API/domain/service patterns unchanged)
- [x] No review-flow regressions (scheduler behavior and no-live-generation invariant preserved)
- [x] Build/typecheck pass
- [x] Fix log recorded with files moved/created and parity notes

---

## Risk Register

1. Shared state coupling breakage during extraction  
Mitigation: Extract incrementally and keep state shape stable until final pass.

2. Route behavior regressions due to component rewiring  
Mitigation: Validate each route immediately after rewiring; keep parity checklist.

3. Hidden dependency on render order within monolith  
Mitigation: Move one feature at a time and run targeted manual route checks.

4. Scope creep into tests/types/docs  
Mitigation: Keep this phase focused on structure; log follow-up items for issues #3/#4/#5.

---

## Estimated Effort

- Phase 2 planning + implementation: ~12 hours
- Verification + fix log updates: ~2 hours
- **Total:** ~14 hours

---

## Rollback Plan

If regression is detected:

1. Revert Phase 2 commit(s) only.
2. Restore route wrappers to previous `WordsWorkspace` entrypoint.
3. Keep Phase 1 string extraction intact.
4. Re-run build/typecheck to confirm baseline restoration.


