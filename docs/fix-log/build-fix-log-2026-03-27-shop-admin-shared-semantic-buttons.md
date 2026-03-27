---
title: Fix Log - 2026-03-27 - Shop Admin Shared Semantic Buttons
---

## Context
The initial Shop Admin cleanup introduced local named button variants, but the intended direction was different: buttons on `/words/shop-admin` should adopt the shared workspace semantic button classes from `src/app/globals.css` and choose the class by usage.

## Root Cause
The previous consolidation treated Shop Admin buttons as a separate semantic layer. That preserved a local theme, but it did not actually align button colors with the shared semantic palette documented in `style-ref.md`.

## Changes Applied
- Removed the Shop Admin-only button variant classes from `src/app/globals.css`:
  - `shop-admin-pill--neutral`
  - `shop-admin-pill--accent`
  - `shop-admin-pill--save`
  - `shop-admin-pill--danger`
  - `shop-admin-card-button`
  - `shop-admin-card-button--selected`
- Updated `src/app/words/shop-admin/ShopAdminSection.tsx` so all Shop Admin buttons now use the shared semantic button classes by intent:
  - `btn-primary` for save
  - `btn-secondary` for add/create and active selection
  - `btn-caution` for reset and reorder controls
  - `btn-destructive` for delete/remove
  - `btn-nav` for collapse and non-mutating selection/view-state controls
- Kept the Shop Admin local CSS custom properties for non-button surfaces such as cards, inputs, labels, badges, and helper surfaces.
- Updated `docs/architecture/style-ref.md` to document Shop Admin button usage through the shared semantic classes.

## Architectural Impact
No layer boundaries changed. This was a workspace styling-system correction only.

## Preventative Rule
On `/words/shop-admin`, use the shared `btn-*` semantic classes for buttons and reserve Shop Admin CSS custom properties for non-button themed surfaces.

## Docs Updated
- AI_CONTRACT.md: no - no agent policy change
- 0_ARCHITECTURE.md: no - no architecture boundary changed
- 0_BUILD_CONVENTIONS.md: no - detailed styling guidance lives in `style-ref.md`
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged
