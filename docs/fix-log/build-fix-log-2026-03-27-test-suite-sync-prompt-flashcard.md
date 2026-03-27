---
title: Fix Log - 2026-03-27 - Test Suite Sync For Prompt And Flashcard Coverage
---

## Context
The repo-level Vitest run was failing after the button override consolidation because two pre-existing test files no longer matched current implementation:
- `src/app/words/prompts/prompts.test.tsx` still expected older prompt length limits.
- `src/app/words/review/flashcard/FlashcardCard.test.tsx` was only a manual test note file, so Vitest treated it as an empty suite.

## Root Cause
Test coverage had drifted away from the current codebase:
- Prompt limit assertions were written against outdated numeric constraints.
- The flashcard card file had never been converted from a manual verification note into an actual automated test suite.

## Changes Applied
- Updated `src/app/words/prompts/prompts.test.tsx` to assert the current prompt limits (`full: 30-700`, `meaning_details: 20-400`) and to derive validation boundary tests from the live constants.
- Replaced `src/app/words/review/flashcard/FlashcardCard.test.tsx` with real server-rendered unit tests that cover loading state, fill-test filtering, pinyin visibility, lowercase ruby output, and the current empty-render behavior when no phrase is eligible for fill-test.
- Updated `docs/architecture/style-ref.md` with a maintenance note for this step; no styling rules changed.

## Architectural Impact
No layer boundaries changed. This was a test-only repair in the UI/test surface.

## Preventative Rule
When implementation contracts change, update boundary-value tests in the same change. Placeholder `.test.tsx` files should either contain executable tests or be renamed so the runner does not treat them as suites.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no implementation behavior changed in this fix
- 0_BUILD_CONVENTIONS.md: no - conventions unchanged
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged

## Follow-Up Note
There is still a separate doc/code mismatch outside this fix: `docs/architecture/0_ARCHITECTURE.md` describes a flashcard placeholder for the "no phrases included for testing" case, but `FlashcardCard.tsx` currently returns `null` in that path. This fix kept tests aligned to the actual implementation rather than changing behavior silently.
