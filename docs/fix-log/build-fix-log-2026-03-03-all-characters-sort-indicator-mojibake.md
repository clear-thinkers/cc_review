# Fix Log - 2026-03-03 - All Characters Sort Indicator Mojibake

## Context
The All Characters table header sort markers were rendering as garbled text (for example, `â†“`) instead of arrows.

## Root Cause
The shared sort-indicator helpers returned mojibake literals rather than valid arrow symbols.

## Changes Applied
- Updated `getSortIndicator` in `src/app/words/shared/words.shared.state.ts` to return Unicode escapes:
  - unsorted: `\u2195`
  - ascending: `\u2191`
  - descending: `\u2193`
- Updated `getDueSortIndicator` in `src/app/words/shared/words.shared.state.ts` to use the same Unicode escapes for consistency.

## Architectural Impact
No architecture boundary changes. This is a UI display correction in shared view-model state.

## Preventative Rule
Use Unicode escape sequences for symbol glyphs in shared UI indicator helpers to reduce encoding-related corruption risk.

## Docs Updated
- AI_CONTRACT.md: no - no contract rule changes.
- 0_ARCHITECTURE.md: no - no behavior boundary or rule changes.
- 0_BUILD_CONVENTIONS.md: no - existing encoding and strings conventions already cover this.
- 0_PRODUCT_ROADMAP.md: no - no roadmap scope changes.
