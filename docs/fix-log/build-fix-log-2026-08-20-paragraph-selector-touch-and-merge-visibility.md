---
title: Fix Log – 2026-08-20 – Paragraph Span Selector Touch Support and Merge Visibility
---

## Context

User reported that on `/words/add-paragraph`, phrase selection (as opposed to single-character selection) didn't work from a phone or touchpad. Investigation established the selector's multi-character mechanism was click-and-drag only (`onMouseDown`/`onMouseEnter` + a `window` `mouseup` listener) — touchscreens never deliver a held pointer-move gesture through React's synthetic mouse events, so drag silently degraded to single-character-only selection on phone.

Mid-fix, the user reported that touchpad drag actually did work, but a follow-up problem: after a successful drag-select of a two-character phrase, the UI rendered the two characters as separate individually-bordered boxes sitting next to each other — visually indistinguishable from two independently-selected single characters, with no indication they were bundled as one phrase.

## Root Cause

1. **Touch selection**: `ParagraphSpanSelector.tsx`'s drag state machine (`dragAnchorIndex`/`dragHoverIndex`, mouse-event-only) had no touch-event equivalent, so multi-character selection was unreachable on touchscreens.
2. **Merge visibility**: every token — regardless of whether it belonged to a single- or multi-token selection — was rendered as its own independently-bordered `<span>`. A selected 2-char range and two separately-selected 1-char ranges produced identical-looking adjacent boxes.

## Changes Applied

**First attempt (reverted)**: replaced the mouse-drag state machine with a two-sequential-tap model (a fresh pure function `resolveTokenTap`, driven by `onClick` instead of `onMouseDown`/`onMouseEnter`). This worked for 2-character phrases but the user reported it couldn't reliably build a 3-4+ character selection — a two-tap gesture (first + last character) doesn't match how people naturally try to select a multi-character run, and there was no way to keep extending an in-progress selection past the second tap. The user also reported that touchpad drag had in fact worked fine — the original problem was specifically the phone/touchscreen. Reverted; `resolveTokenTap` removed.

**Final approach**: kept the original mouse-driven anchor/hover drag state machine (`dragAnchorIndex`/`dragHoverIndex`, `mousedown`/`mouseenter`/window `mouseup`) and added a parallel touch path onto the *same* state: `touchstart` sets the anchor (mirrors `mousedown`); a `touchmove` listener (registered `{ passive: false }` only while a drag is in progress, so ordinary page scrolling is unaffected the rest of the time) hit-tests the token under the moving finger via `document.elementFromPoint` — matched back to a token index via a `data-token-index` attribute on each selectable span — and updates the hover index the same way `mouseenter` does; `touchend` commits via the same `finishDrag` path as `mouseup`. This gives real, arbitrary-length continuous selection on touchscreens instead of a synthetic tap-based approximation.

`src/app/words/add-paragraph/ParagraphSpanSelector.tsx`:
- Restored the mouse drag state machine; added `touchstart`/`touchmove`/`touchend` support onto the same anchor/hover state, as above.
- Kept `groupTokensForSelection`, a pure function that groups adjacent tokens sharing the same committed `selectedRanges` entry. A committed multi-token group renders as one continuous pill (single border/background around the joined text) instead of N separate boxes; clicking/tapping the pill deselects the whole phrase in one action. This is unaffected by which drag mechanism commits the selection — it only reads `selectedRanges` after commit. Unselected tokens and single-character selections are unaffected — still individually boxed as before.

`src/app/words/add-paragraph/addParagraph.strings.ts`: `selectionHint` (en + zh) describes click-and-drag, noting touchscreens use press-and-drag.

`docs/architecture/0_ARCHITECTURE.md`: updated Add Paragraph Rules 6–7 with dated notes describing touch-drag support and the pill-grouping visual.

`src/app/words/add-paragraph/addParagraph.test.tsx`: kept `computeDragSelectionRange` tests (unchanged, still the shared clamp logic) and `groupTokensForSelection` tests (no selection, same-range merge, two independent single-char selections stay separate, selected token never merges with an adjacent unselected one). The `resolveTokenTap` tests from the reverted attempt were removed along with the function.

## Architectural Impact

UI-layer only (`src/app/words/add-paragraph/`). No schema, RPC, RLS, service-layer, or cross-layer changes. `computeDragSelectionRange`'s existing pure logic and tests were preserved unchanged and reused by the new `resolveTokenTap`.

## Preventative Rule

Any interaction that depends on a held pointer-move gesture (drag, hover-tracking) must have a tap/click-equivalent path from the start for any UI reachable from a touchscreen — `/words/add-paragraph` has no device restriction, so phone access was always in scope. When a selection state can span more than one visual element, the committed-selection rendering must visually distinguish "N elements are one bundled selection" from "N elements are independently selected" — do not rely on adjacency alone to imply grouping.

## Docs Updated
- AI_CONTRACT.md: no — no hard-stop, boundary, or layer-crossing behavior involved.
- 0_ARCHITECTURE.md: yes — Add Paragraph Rules 6–7 updated to describe the tap-and-merge mechanism and pill-grouping visual, replacing the retired click-and-drag description.
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced.
- 0_PRODUCT_ROADMAP.md: no — Item I is already tracked as shipped; this is a bug fix within existing shipped scope, not a new roadmap entry.
