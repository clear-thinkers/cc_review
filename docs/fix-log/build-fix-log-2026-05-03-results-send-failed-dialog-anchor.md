---
title: Fix Log - 2026-05-03 - Results Send Failed Dialog Anchor
---

## Context
On the Quiz Review results page, clicking the button to add failed characters to a test session opened the popup too far from the clicked button.
Users sometimes had to scroll to find the popup instead of seeing it near the action they just clicked.

## Root Cause
The send-failed dialog reused the same centered fixed-overlay behavior as the clear-history confirmation dialog.
That was reasonable for a global confirmation, but awkward for a row-level action inside the horizontally scrollable session history table.
The button click did not pass any anchor geometry to the dialog, so the dialog had no way to render near the row action.

## Changes Applied
- Updated [src/app/words/results/SessionHistoryTable.tsx](../../src/app/words/results/SessionHistoryTable.tsx) so the send-failed button passes its `getBoundingClientRect()` to the open handler.
- Updated [src/app/words/results/ResultsPage.tsx](../../src/app/words/results/ResultsPage.tsx) to store the button anchor rect while the send-failed dialog is open and clear it when the dialog closes.
- Updated [src/app/words/results/SendFailedToSessionDialog.tsx](../../src/app/words/results/SendFailedToSessionDialog.tsx) to position the popup next to the clicked button, clamp it inside the viewport, and reposition on resize or scroll.
- Added placement coverage in [src/app/words/results/SessionHistoryTable.test.ts](../../src/app/words/results/SessionHistoryTable.test.ts) for below-button placement, above-button fallback, and right-edge viewport clamping.

## Verification
- `npm run typecheck`
- `npx vitest run src/app/words/results/SessionHistoryTable.test.ts`

## Architectural Impact
No architecture boundary changed.
This stays within the Results UI layer and preserves the existing service calls for creating or appending review test sessions.

## Preventative Rule
For row-level actions in scrollable tables, pass the clicked control's viewport rect into any contextual popup instead of relying on global centered modal placement.
Keep the positioning math as a small pure helper so edge cases can be tested without browser rendering.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy or hard-stop rule changed
- 0_ARCHITECTURE.md: no - no app architecture or data-flow rule changed
- 0_BUILD_CONVENTIONS.md: no - no new implementation convention needed beyond this fix log
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
