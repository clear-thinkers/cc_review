# Feature Spec - 2026-03-26 - Debug Shop Ingredient Icon Actions

## Problem

The Debug page's ingredient icon audit currently shows both icon path and derived file path, which is redundant for admins, and it does not offer direct actions for fixing broken ingredient icon rows.

## Scope

- Remove the duplicate file-path column from the ingredient icon audit UI
- Add ingredient key as a dedicated column
- Add inline actions to edit an ingredient icon path and clear a broken icon-path row
- Keep the audit route aligned with DB-backed Shop Admin icon overrides

## Out of scope

- Reward icon audit redesign
- Ingredient creation flows
- Deleting full ingredient catalog rows

## Proposed behavior

- The ingredient audit response keeps one public-facing path: `iconPath`
- The table shows Ingredient, Key, Status, Icon Path, and Actions
- Admin can edit an ingredient icon path inline from the debug tool
- Admin can clear the icon path for a missing/broken row without deleting the ingredient itself
- Edited icon paths must point to an existing PNG under `public/ingredients`

## Layer impact

- UI: add ingredient icon action state and inline edit controls
- Types: extend ingredient audit response for action support
- API: support ingredient icon PATCH actions and path-option loading
- Service: audit helper no longer returns redundant file paths to the client

## Edge cases

- Ingredient has no icon configured yet
- Ingredient row exists in the audit but has no persisted `shop_ingredient_prices` row
- Database is missing `icon_path`
- Admin enters a path outside `/ingredients/` or to a missing file

## Risks

- Inline edit controls could drift from the reward-icon patterns if the two tools evolve separately
- Clearing a broken icon path could hide a mistake if the admin intended to repair it instead

## Test Plan

- Extend ingredient icon audit tests for available paths and action-oriented fields
- Add unit tests for ingredient icon path validation helpers
- Run focused tests, typecheck, and encoding check

## Acceptance criteria

- Ingredient icon audit no longer shows a duplicate file-path column
- Ingredient key is visible in the audit table
- Missing/broken ingredient icon rows can be cleared directly
- Ingredient icon paths can be edited inline and must reference an existing file in `public/ingredients`

## Open questions

- Should the ingredient audit eventually support creating icon paths for rows that do not yet have a persisted `shop_ingredient_prices` record?
