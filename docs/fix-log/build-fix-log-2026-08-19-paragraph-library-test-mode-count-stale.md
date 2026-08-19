---
title: Fix Log – 2026-08-19 – Test-mode count on the paragraph library list never updates
---

## Context

User-reported while testing Phase 2 (`docs/fix-log/build-fix-log-2026-08-18-paragraph-library-test-mode-prep.md`): "the test mode count isn't updating. i added 2 test modes but it still says 0."

## Root Cause

`ParagraphLibrarySection.tsx` is mounted unconditionally in `WordsWorkspace.tsx` alongside every other paragraph view and self-gates by returning `null` when `vm.paragraphViewMode !== "library"` — it never actually unmounts when the parent switches to Continue Import or Prep Fill Test, so its internal `testModesByParagraphId` state persists across view changes. That state was loaded by a `useEffect` keyed only on `[vm.paragraphs]`. Creating, editing, or deleting a test mode in `TestModeSection.tsx` never touches `vm.paragraphs` (test modes live in their own table, in their own local component state) — so the effect had no reason to ever re-run after the initial load, and the count stayed frozen at whatever it was on first mount (0, if no test modes existed yet at that point).

## Changes Applied

- `src/app/words/add-paragraph/ParagraphLibrarySection.tsx` — added `vm.paragraphViewMode` to the effect's dependency array and an early return when it isn't `"library"`, so the test-mode counts (and the tag map) re-fetch every time the library becomes the active view again, not just when the paragraph list itself changes.

## Architectural Impact

None — UI-layer-only fix to a data-freshness gap in a component that stays mounted-but-hidden rather than unmounting.

## Preventative Rule

A component that self-gates by returning `null` instead of unmounting keeps its state across view switches — any effect that loads data belonging conceptually to "this view is now active" needs the active-view condition itself in its dependency array, not just the data it happens to also depend on.

## Verification

- Reproduced and confirmed fixed live via headless-Chromium against the dev server + live dev project: created a test mode, navigated back to the library in the same session, count updated 1 → 2 correctly.
- `npm test` — 694/694 pass (no new test added; this is a same-session view-navigation staleness issue, same category as the Phase 2 QA fix, not expressible against the mocked-service test harness).
- `npm run typecheck` / `npm run lint` — clean, no new issues.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: no — no behavioral rule changed, this is a rendering-freshness fix to an already-documented feature (Add Paragraph Rules rule 14).
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no — folded into ongoing Phase 2 verification, not a separate roadmap-visible milestone.
