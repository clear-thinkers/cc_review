---
title: Fix Log - 2026-03-27 - Shop Admin CSS Variables
---

## Context
`src/app/words/shop-admin/ShopAdminSection.tsx` was still carrying a large number of repeated gold and cream hex literals. The Shop Admin area is intentionally its own themed surface, but the palette was embedded directly in JSX instead of being expressed through named theme properties.

## Root Cause
The Shop Admin UI grew as a local visual system without a shared variable layer. That left repeated literal colors for pill buttons, form fields, cards, badges, helper text, and selected states throughout the component.

## Changes Applied
- Added scoped Shop Admin CSS custom properties in `src/app/globals.css` on `.shop-admin-pane` for the gold, cream, muted, danger, support, and card-surface palette.
- Replaced raw hex-based Shop Admin constants in `src/app/words/shop-admin/ShopAdminSection.tsx` with CSS-variable-backed classes for:
  - panel and label styles
  - pill button variants
  - inputs and readonly fields
  - card borders and selected states
  - badges, helper text, icons, dividers, and warning/danger surfaces
- Removed all remaining raw `#...` and `rgba(...)` color literals from `src/app/words/shop-admin/ShopAdminSection.tsx`.
- Updated `docs/architecture/style-ref.md` to note that Shop Admin now uses scoped CSS custom properties for its local theme.

## Architectural Impact
No layer boundaries changed. This was a local UI theming cleanup inside the existing Shop Admin surface.

## Preventative Rule
When extending the Shop Admin theme, add or reuse scoped Shop Admin CSS custom properties instead of introducing new literal color values directly in JSX class strings.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
