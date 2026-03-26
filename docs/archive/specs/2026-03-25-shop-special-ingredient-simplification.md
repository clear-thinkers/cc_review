# Feature Spec — 2026-03-25 — Shop Special Ingredient Simplification

## Problem

Special ingredients are currently authored as slot/options with bilingual effect notes. That is heavier than the product now needs, and it duplicates relationship editing that already fits better in variant mapping.

## Scope

- Simplify special ingredients into plain ingredient rows with localized names and integer quantities
- Remove special-effect authoring from shop admin
- Keep variant relationship editing in the variant preview cards
- Allow shared ingredient-price cards to edit localized labels in the active locale

## Out of scope

- Creating new reward image assets
- Replacing the subset-match runtime for variant icon selection
- Inventory or consumption mechanics

## Proposed behavior

- Special ingredients are stored and edited like base ingredients: name, optional key, quantity
- Variant cards remain the only place where ingredient-to-variant relationships are authored
- Shared ingredient pricing becomes the global place for editing shared labels and prices

## Layer impact

- UI: simplify special ingredient editor and pricing cards
- Domain: replace slot/effect draft handling with localized ingredient rows
- Service: persist shared label overrides and quantity-based special ingredients
- DB: extend `shop_ingredient_prices` with localized label storage

## Edge cases

- Special ingredient uses a shared key but has no icon
- Duplicate special ingredient keys appear in one recipe
- Variant card references a removed special ingredient key
- One locale label is blank while the other is edited

## Risks

- Old recipe JSON may still contain slot/effect-shaped special data
- Shared labels and recipe-local names can drift if not resolved consistently

## Test Plan

- Draft validation for keyed and custom special ingredients
- Variant mapping validation against simplified special ingredient rows
- Shared ingredient catalog tests for persisted label overrides

## Acceptance criteria

- Platform admin no longer sees slot/effect authoring for special ingredients
- Special ingredients are edited as quantity rows
- Shared ingredient pricing allows locale-aware label editing
- Variant preview remains the relationship editor
