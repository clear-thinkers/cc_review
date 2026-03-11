# Fix Log - 2026-03-10 - Flashcard Pinyin Ruby Alignment

## Context
Flashcard review (`/words/review/flashcard`) showed incorrect pinyin alignment in phrase/example sentences. Compact pinyin inputs (for example, `lǎoshī` and `lǐngdǎo`) were not aligned per Hanzi character, and missing tokens rendered placeholder glyphs that created visual ghost spacing.

## Root Cause
`FlashcardCard.tsx` used a local whitespace-only token splitter and inserted placeholder pinyin nodes (`·`) when a Hanzi had no mapped token. This caused two problems:
1. Compact pinyin strings were not segmented robustly, so token-to-Hanzi mapping drifted.
2. Placeholder pinyin spans violated the rule to render Hanzi without pinyin when no token exists.

## Changes Applied
- Updated `src/app/words/review/flashcard/FlashcardCard.tsx`:
  - Removed placeholder pinyin span rendering.
  - Kept pinyin spans out of the DOM when token missing or `showPinyin` is off.
  - Switched renderer to a shared token alignment utility.
- Added `src/app/words/review/flashcard/flashcard.ruby.ts`:
  - Centralized Hanzi detection and pinyin token alignment helpers.
  - Added fallback path that reuses shared count-aware pinyin alignment from admin utilities.
- Updated `src/app/words/review/flashcard/flashcard.styles.css`:
  - Pinyin now uses italic styling as required by ruby conventions.
  - Removed unused placeholder style.
- Updated `src/app/words/shared/words.shared.utils.tsx`:
  - Exported `alignPinyinPartsForCount` for cross-feature reuse.
- Added regression tests in `src/app/words/review/flashcard/flashcard.ruby.test.ts`.

## Architectural Impact
No boundary changes. This is a UI-layer rendering correction with shared utility reuse. No changes to Domain scheduling logic, Service I/O, or AI routes.

## Preventative Rule
Do not maintain independent pinyin segmentation logic in flashcard rendering when equivalent admin/shared alignment logic already exists. Reuse shared alignment helpers and avoid placeholder pinyin DOM nodes.

## Docs Updated
- AI_CONTRACT.md: no - no contract policy change.
- 0_ARCHITECTURE.md: no - no architecture boundary/behavior changes.
- 0_BUILD_CONVENTIONS.md: no - conventions already cover required ruby behavior.
- 0_PRODUCT_ROADMAP.md: no - roadmap scope/status unchanged.
