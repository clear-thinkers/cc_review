---
title: Fix Log - 2026-03-27 - Shop Admin Semantic Button Classes
---

## Context
Shop Admin had already been moved onto scoped CSS variables, but its buttons still mixed local theme values with ad hoc utility combinations at individual callsites. The next cleanup step was to make every Shop Admin button read through a named local semantic class.

## Root Cause
The Shop Admin page had a distinct visual language, but it lacked a complete local button vocabulary. Some buttons used shared local constants while others still expressed state through inline utility combinations instead of named button variants.

## Changes Applied
- Added named Shop Admin button classes in `src/app/globals.css`:
  - `shop-admin-pill--neutral`
  - `shop-admin-pill--accent`
  - `shop-admin-pill--save`
  - `shop-admin-pill--danger`
  - `shop-admin-card-button`
  - `shop-admin-card-button--selected`
- Updated `src/app/words/shop-admin/ShopAdminSection.tsx` so all page buttons now route through those local semantic button classes instead of ad hoc color utility strings.
- Kept size/layout utilities local at the callsite while moving color/intent ownership into the named Shop Admin classes.
- Updated `docs/architecture/style-ref.md` to document the Shop Admin local button-class layer.

## Architectural Impact
No layer boundaries changed. This was a local styling-system cleanup for `/words/shop-admin`.

## Preventative Rule
When adding or changing buttons on `/words/shop-admin`, use the Shop Admin local semantic button classes first and keep only size/layout utilities inline.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
