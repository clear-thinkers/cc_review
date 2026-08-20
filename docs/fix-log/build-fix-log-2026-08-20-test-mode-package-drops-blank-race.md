---
title: Fix Log – 2026-08-20 – Package as Quiz silently drops a just-added blank
---

## Context

User-reported while live-QA'ing Phase 3 (`docs/feature-specs/2026-08-19-paragraph-quiz-runtime.md`): added a new phrase (宏大志向) as a vocab phrase, edited an existing test mode to select it as a third blank, saved the test mode, packaged it via "Package as Quiz", then started the session as a child — the packaged session only had the original two blanks (艰难, 帮助); the newly-added third blank never made it into the quiz.

## Root Cause

Confirmed via direct inspection of the dev Supabase project (not guessed): the test mode row (`paragraph_test_modes.span_ids`) correctly had all 3 span ids, and the paragraph's own persisted span for the third blank was correctly materialized (`resolvedVocabPhraseId` pointing at the new phrase row) — both by the time packaging happened. The two packaged `review_test_sessions` rows created from this test mode both had only 2 `review_test_session_targets` rows regardless, so the data everything downstream needed was correct; something between "test mode is correctly saved" and "package reads the test mode" was dropping the third blank.

`TestModeSection.tsx`'s test-mode-list-loading effect was keyed on the whole `paragraph` object (`useEffect(() => { ... listParagraphTestModes(paragraph.id)... }, [paragraph])`), not its id. `paragraph` is a `useMemo` over `vm.paragraphs`, which gets a brand-new object reference on **every** `vm.paragraphs` update — including the `vm.setParagraphs(...)` call inside `handleSave` itself, made to materialize a newly-selected pending span (like the new phrase blank) before the test mode is saved. That `vm.paragraphs` update re-triggered this effect, kicking off a redundant `listParagraphTestModes` fetch in parallel with the rest of `handleSave`'s own work. `handleSave` then correctly calls `updateParagraphTestMode` and `setTestModes(updated)` with the fully-correct 3-blank test mode — but there was no ordering guarantee between that and the redundant effect's fetch (which had queried the test mode row as it stood *before* the edit). Whichever `setTestModes` call happened to resolve second won; when the effect's stale response arrived after `handleSave`'s own update, it silently overwrote the correct in-memory test mode with the old 2-blank version. "Package as Quiz" then read that stale in-memory object (`packagingMode`), not the DB, and packaged only 2 targets — even though the database was correct the entire time.

This is a pre-existing bug in Phase 2's original `TestModeSection.tsx` code (the effect and `handleSave` both predate Phase 3) — Phase 3's "Package as Quiz" action didn't introduce it, but was the first feature to actually read `testModes` state at a moment where this race's outcome mattered for correctness rather than just display.

## Changes Applied

- `src/app/words/add-paragraph/TestModeSection.tsx` — the test-mode-loading effect now depends on `vm.paragraphSelectedId` (a stable primitive that only changes when the user navigates to a different paragraph) instead of the whole `paragraph` object, so editing the current paragraph's own content (via Save Test Mode's span materialization, or any other future paragraph-content edit) no longer re-triggers a redundant, racy refetch of the test-mode list.

## Architectural Impact

None — UI-layer-only fix to a data-freshness/race bug. No schema, RPC, or RLS change.

## Preventative Rule

An effect that depends on a derived object (`useMemo` output) re-fires on every *content* change to that object, not just identity changes a component cares about — if the effect's own side effect (a network refetch) can race against another in-flight update to the same state, key the effect on the narrowest stable primitive that actually identifies "should this effect re-run" (here: the paragraph's id, not its content), not the whole derived object. This is a sibling issue to `build-fix-log-2026-08-19-paragraph-library-test-mode-count-stale.md`'s (an effect that re-ran too *rarely*) — this one re-ran too *often*, racing a more-authoritative local update.

## Verification

- Root cause confirmed via a one-off inspection script against the dev Supabase project (read `paragraph_test_modes`, `paragraphs`, `review_test_sessions`, `review_test_session_targets`, `vocab_phrases` directly) — not guessed from reading code alone.
- `npx tsc --noEmit` — clean.
- `npx eslint` on the changed file — clean, no new `exhaustive-deps` warning.
- `npm test` — 762/762 pass (no new automated test added; this is a same-session multi-request race condition, not practically expressible against the mocked-service test harness without simulating out-of-order promise resolution, which would test the fix's mechanism rather than the bug's actual trigger).
- Not yet re-verified live in-browser by the implementing session (no browser-automation tool available here) — the user found this bug via their own live QA and should confirm the fix resolves it the same way.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: no — no behavioral/schema rule changed, this is a data-freshness fix to an already-documented feature (Fill-Test Review Rule 28, Package as Quiz).
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no — folded into ongoing Phase 3 live-QA verification, not a separate roadmap-visible milestone.
