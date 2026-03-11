# Fix Log - 2026-03-10 - All Characters Batch Tag Save Failure (Shared Textbook)

## Context
On `/words/all`, parent users could select words and fill cascade tag fields, but batch save failed with a generic error notice.

## Root Cause
Batch save attempted to create/find lesson tags directly under the selected textbook ID. For shared textbooks, this can hit family-isolation and unique-conflict behavior under RLS when lesson tag combinations already exist for another family, causing writes to fail in the client flow.

## Changes Applied
- Updated `src/app/words/all/AllWordsSection.tsx` batch save flow:
  - Detect when selected textbook is shared.
  - Resolve to a family-owned textbook with the same name before creating/assigning lesson tags.
  - Persist resolved textbook ID in local editor state for subsequent saves.
  - Add console error logging for easier diagnosis on future failures.

## Architectural Impact
No layer-boundary changes. This is a UI/service orchestration fix that reuses existing service APIs (`createTextbook`, `createLessonTagIfNew`, `assignWordLessonTags`). No scheduler, AI, or route changes.

## Preventative Rule
When writing family-scoped lesson tag assignments from UI flows, do not write tags directly against shared textbook IDs; resolve to a family-owned textbook first to avoid cross-family collisions under RLS.

## Docs Updated
- AI_CONTRACT.md: no - no contract policy change.
- 0_ARCHITECTURE.md: no - no architecture boundary or product rule change.
- 0_BUILD_CONVENTIONS.md: no - conventions unchanged.
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged.
