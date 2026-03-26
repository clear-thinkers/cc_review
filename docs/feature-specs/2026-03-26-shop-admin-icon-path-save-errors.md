# Feature Spec - 2026-03-26 - Shop Admin Icon Path Save Errors

## Problem

Shop Admin lets platform admins edit ingredient icon paths, but saves can silently discard those paths when the database is missing `shop_ingredient_prices.icon_path`.

## Scope

- Detect the missing `icon_path` column during Shop Admin ingredient saves
- Return a structured API error instead of silently retrying without `icon_path`
- Show a localized admin-facing error message in the ingredient management section
- Add tests for the new error-code contract and string parity

## Out of scope

- Running Supabase migrations automatically
- Adding a full schema capability banner during Shop Admin load
- Changing recipe-management save behavior

## Proposed behavior

- Ingredient save keeps sending icon paths as before
- If the backend cannot persist `icon_path` because the column is missing, the API returns a dedicated error code
- Shop Admin maps that code to a bilingual message that tells the admin to run migration `20260325193000_shop_ingredient_icon_paths.sql`
- The save no longer pretends to succeed after dropping icon paths

## Layer impact

- UI: localize a schema-mismatch save error in Shop Admin
- Domain: define a typed error code for ingredient save failures
- Service: stop silently stripping `icon_path` during ingredient save fallback

## Edge cases

- The database is missing `icon_path`, but the save also changes prices or labels
- Older clients hit the API directly and only read the plain `error` string
- GET still needs to load ingredient data even if the schema is behind

## Risks

- Admins on an outdated database will now see a blocking save error until the migration is applied
- Error-code handling could drift if the UI and API stop sharing the same typed contract

## Test Plan

- Unit test the ingredient save error-code guard
- Unit test shop-admin string parity for ingredient pricing copy
- Run targeted shop-admin tests, typecheck, and encoding check

## Acceptance criteria

- Ingredient saves do not silently drop icon paths anymore
- Missing `icon_path` storage surfaces a clear, localized admin error
- The API and UI share a stable typed error code for this failure case

## Open questions

- Should Shop Admin also expose schema capability status on initial load instead of only on save?
