---
title: Fix Log - 2026-03-27 - Results Empty State Btn Nav
---

## Context
The results empty-state CTA ("go to review") is a non-mutating navigation action. After introducing `btn-nav` as the semantic token for navigation and flow controls, this button was still styled through a one-off CSS-module rule.

## Root Cause
The results section still carried a local button style island in `results.module.css`, and the empty-state CTA had not yet been folded into the shared workspace nav token.

## Changes Applied
- Replaced the results empty-state CTA button style in `src/app/words/results/EmptyState.tsx` with the shared `btn-nav` class.
- Removed the unused `.emptyStateAction` rule from `src/app/words/results/results.module.css`.
- Updated `docs/architecture/style-ref.md` to list the results empty-state CTA as a `btn-nav` usage and to narrow the remaining results-module inconsistency note to the destructive buttons only.

## Architectural Impact
No layer boundaries changed. This was a workspace UI styling cleanup only.

## Preventative Rule
If a results-page action simply routes the user into another workspace page without mutating stored data, it should use `btn-nav` instead of a section-specific one-off button style.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
