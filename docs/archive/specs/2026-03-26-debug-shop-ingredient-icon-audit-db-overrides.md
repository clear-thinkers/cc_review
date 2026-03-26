# Feature Spec - 2026-03-26 - Debug Shop Ingredient Icon Audit DB Overrides

## Problem

The Debug page's "Verify Shop Ingredients Icons" tool audits only the seeded static ingredient catalog, so it misses icon paths saved later in `shop_ingredient_prices`.

## Scope

- Update the debug ingredient icon audit to read Shop Admin ingredient overrides from Supabase
- Reuse the same merged catalog shaping used by Shop Admin where possible
- Add focused tests for the audit helper behavior

## Out of scope

- Reward icon audit changes
- New debug UI affordances or filters
- Shop Admin save-flow changes

## Proposed behavior

- The debug audit route loads ingredient prices plus recipe ingredient references
- It builds the audit list from the merged admin catalog, including DB-backed `icon_path` overrides
- The debug page reports file presence for both seeded icons and newly saved ingredient icons such as `bamboo-leaves`

## Layer impact

- Service: ingredient icon audit accepts merged catalog items
- API: debug ingredient audit route loads DB-backed ingredient data before auditing

## Edge cases

- Ingredients exist only in recipes but not yet in `shop_ingredient_prices`
- Databases still missing `icon_path` should continue to load the audit without crashing
- Ingredients with no icon path should still show as "No icon"

## Risks

- Duplicating Shop Admin catalog-loading logic could drift if the two paths diverge later
- Missing-column fallback for older databases must stay intact

## Test Plan

- Update audit helper tests to verify DB-backed icon overrides are audited
- Run targeted shop ingredient icon audit tests
- Run typecheck and encoding check

## Acceptance criteria

- "Verify Shop Ingredients Icons" picks up icon paths saved through Shop Admin
- `bamboo-leaves` is audited using its saved DB icon path when present
- Existing seeded-icon checks still work

## Open questions

- Should the Shop Admin ingredient catalog load move into a shared server-side helper later?
