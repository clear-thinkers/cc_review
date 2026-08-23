---
title: Fix Log – 2026-08-23 – Paragraph selector tooltip always says "known"
---

## Context

On `/words/add-paragraph`'s paragraph-quiz word bank / span-selector view, hovering over any Hanzi token — including ones rendered in the "unknown" (orange) legend color — showed a native browser tooltip reading "已认识" (Known). Reported via a screenshot showing the tooltip over 北极, a token clearly styled orange/unknown per the on-page legend.

## Root Cause

`ParagraphSpanSelector.tsx`'s outer wrapping `<span>` (the element containing every token in a sentence) carried a single hardcoded `title={str.legendKnown}`. Browsers show the nearest ancestor's `title` when the hovered element itself has none, and no individual token `<span>` had its own `title` — so every token, regardless of its actual known/unknown/selected state, inherited that one hardcoded "Known" tooltip from the sentence wrapper.

A correct per-token `aria-label` already existed (known vs. unknown), but `aria-label` only affects screen readers, not the visible mouse-hover tooltip — so the bug was invisible to anyone not testing with a mouse.

## Changes Applied

`src/app/words/add-paragraph/ParagraphSpanSelector.tsx`:
- Removed the incorrect `title={str.legendKnown}` from the sentence-level wrapper span.
- Added an exported pure helper `getTokenTooltip(known, isSelected, str)` that returns the legend string matching the token's actual visual state (selected takes priority over known/unknown, mirroring the existing `colorClass` logic).
- Applied `title={getTokenTooltip(...)}` to each single-token span, and `title={str.legendSelected}` to the merged multi-token phrase-selection pill (which only ever renders in the selected state).

`src/app/words/add-paragraph/addParagraph.test.tsx`:
- Added a `getTokenTooltip` describe block (4 cases: unselected-unknown, unselected-known, selected-unknown, selected-known) alongside the file's existing extracted-helper tests for this component, per this project's UI seam-priority convention (`@testing-library/react` isn't available here, so pure helpers are the test seam — see the file's own header comment).

## Architectural Impact

None. Pure UI-layer fix, single file plus its existing test file. No schema, RPC, route, or cross-layer change.

## Preventative Rule

When a `title`/tooltip needs to vary per rendered item in a list, set it on each item's own element — never hoist a single hardcoded `title` onto a shared ancestor wrapping multiple differently-stated items. If per-item hover text and per-item `aria-label` both exist, derive both from the same shared state check (as `getTokenTooltip` now does) so they can't drift apart again.

## Docs Updated
- AI_CONTRACT.md: no — no boundary, hard-stop, or layer change
- 0_ARCHITECTURE.md: no — behavior described in existing Add Paragraph Rules is unchanged; this fixes a rendering bug, not a documented rule
- 0_BUILD_CONVENTIONS.md: no — no new convention, follows existing UI seam-testing pattern
- 0_PRODUCT_ROADMAP.md: no — Item I is already marked shipped; this is a post-ship bug fix within existing scope, no roadmap-status change needed
