# Feature Spec - 2026-03-24 - Shop Recipe Ingredient Icons

## Status: Draft

## Problem

The recipe ingredients modal already shows structured ingredient rows, but it renders them as text only.

We now have ingredient art in `public/ingredients`, for example:

- `milk_base.png`
- `flour_base.png`
- `sugar_base.png`
- `egg_base.png`
- `strawberry_base.png`

The current recipe data model does not contain a stable way to connect a recipe row like `Milk / 1 / cup` to one of those assets. Today, ingredient rows are freeform text:

```ts
type ShopIngredient = {
  name: string;
  quantity: string;
  unit?: string;
};
```

That means icon lookup would be fragile if we try to infer it from display text alone:

- names can vary (`Egg` vs `Eggs`)
- units can vary (`cup` vs `cups`)
- Chinese labels are localized and should not drive asset lookup
- some file names are not normalized yet, for example `butter, base.png`

## Goals

- Show ingredient icons in the child-facing recipe ingredients modal when a matching ingredient asset exists
- Use a stable canonical key instead of relying on freeform display text for icon lookup
- Keep the current bilingual recipe model working
- Keep the implementation small and compatible with the existing admin editor
- Support the simplifying rule that each icon-backed ingredient has one canonical measurement in v1

## Non-Goals

- Full ingredient inventory or crafting gameplay
- Browser upload or admin management of ingredient PNGs
- Automatic OCR or image analysis of ingredient art
- Multiple measurement variants per ingredient in v1
- Replacing all existing recipe ingredient text with icons only

## Recommendation

Use a small checked-in ingredient catalog plus a new `ingredientKey` field on each recipe ingredient row.

This is the smallest reliable design because:

- assets already live in the repo
- the ingredient set is currently small
- freeform names should remain localized child-facing content, not become the lookup key
- adding one optional key is much lower risk than introducing a new table right away

## Proposed Design

### 1. Canonical ingredient catalog

Add a checked-in catalog file, for example:

- `src/app/words/shop/shopIngredients.ts`

Suggested shape:

```ts
type ShopIngredientCatalogEntry = {
  key: string;
  label: {
    en: string;
    zh: string;
  };
  defaultUnit: {
    en: string;
    zh: string;
  };
  iconPath: string;
  aliases?: string[];
};
```

Example:

```ts
{
  key: "milk",
  label: { en: "Milk", zh: "niu nai" },
  defaultUnit: { en: "cup", zh: "bei" },
  iconPath: "/ingredients/milk_base.png",
  aliases: ["milk"]
}
```

Notes:

- `key` is the stable internal identifier
- `label` is the canonical localized display name
- `defaultUnit` is the single allowed icon-backed measurement in v1
- `iconPath` is explicit instead of derived from file name so we can handle naming inconsistencies safely
- `aliases` support migration of older recipe rows

### 2. Extend recipe ingredient rows

Extend `ShopIngredient` to add an optional canonical key:

```ts
type ShopIngredient = {
  ingredientKey?: string;
  name: string;
  quantity: string;
  unit?: string;
};
```

Why keep `name` and `unit`:

- it avoids a breaking schema rewrite
- the current app already renders localized ingredient rows from persisted recipe data
- it allows partial rollout where some rows are icon-backed and some remain text-only

### 3. V1 measurement rule

For icon-backed ingredients, each ingredient supports exactly one canonical unit in v1.

Examples:

- `milk` -> `cup`
- `flour` -> `cup`
- `sugar` -> `cup`
- `egg` -> empty unit or a count-based default

Implications:

- quantity remains editable text
- unit is derived from the selected ingredient catalog entry for icon-backed rows
- name is also derived from the selected ingredient catalog entry for icon-backed rows
- if a recipe needs a non-canonical unit later, that row can stay in manual text-only mode until multi-measure support is added

This satisfies the user goal of tying the visual to both ingredient identity and measurement without requiring a full unit-conversion system.

### 4. Child-facing recipe modal behavior

On the recipe ingredients modal:

- if `ingredientKey` resolves to a catalog entry, render an icon row
- if not, fall back to the existing text row

Suggested icon row layout:

- left: ingredient icon
- center: localized ingredient name
- right: quantity + unit text

Example:

- icon: milk cup art
- label: `Milk`
- amount: `1 cup`

Chinese example:

- icon: same art
- label: `niu nai`
- amount: `1 bei`

Fallback behavior:

- missing `ingredientKey` -> text-only row
- invalid `ingredientKey` -> text-only row
- missing catalog entry or missing asset path -> text-only row

This keeps the page resilient during migration.

### 5. Admin editor behavior

Update the existing recipe ingredient editor in `/words/shop-admin`.

For each base ingredient row, support two authoring modes:

- Catalog ingredient
- Custom ingredient

#### Catalog ingredient mode

Fields:

- ingredient picker
- quantity
- read-only icon preview
- read-only derived EN/ZH name
- read-only derived EN/ZH unit

Behavior:

- selecting an ingredient sets `ingredientKey`
- selecting an ingredient auto-fills EN/ZH `name`
- selecting an ingredient auto-fills EN/ZH `unit`
- quantity remains editable

#### Custom ingredient mode

Fields:

- EN name
- ZH name
- quantity
- EN unit
- ZH unit

Behavior:

- `ingredientKey` is blank
- no icon preview is shown
- row renders in child UI using text only

### 6. Persistence

Persist `ingredientKey` inside both English and Chinese localized ingredient rows, even though the value should be identical across locales.

Example persisted shape:

```json
{
  "en": [
    {
      "ingredientKey": "milk",
      "name": "Milk",
      "quantity": "1",
      "unit": "cup"
    }
  ],
  "zh": [
    {
      "ingredientKey": "milk",
      "name": "niu nai",
      "quantity": "1",
      "unit": "bei"
    }
  ]
}
```

English compatibility field:

```json
[
  {
    "ingredientKey": "milk",
    "name": "Milk",
    "quantity": "1",
    "unit": "cup"
  }
]
```

## Why This Over Name-Only Matching

Name-only matching sounds simpler, but it will become brittle immediately:

- `Egg` and `Eggs` should likely map to the same icon
- English and Chinese rows should not require separate matching logic
- custom naming for child readability would silently break icons
- unit mismatches would create confusing art, such as showing a cup icon for a tablespoon row

Using `ingredientKey` avoids those failure modes.

## Data Model Changes

### Type updates

- Update `ShopIngredient` in [shop.types.ts](/d:/Coding/cc_review/src/app/words/shop/shop.types.ts)
- Update admin draft normalization and validation in [shopAdmin.types.ts](/d:/Coding/cc_review/src/app/words/shop-admin/shopAdmin.types.ts)
- Update recipe loading helpers in [shop.ts](/d:/Coding/cc_review/src/lib/shop.ts)
- Update Supabase row mappers in [supabase-service.ts](/d:/Coding/cc_review/src/lib/supabase-service.ts)
- Update shop admin API normalization in [route.ts](/d:/Coding/cc_review/src/app/api/shop-admin/recipes/route.ts)

### Database

No new table is required in v1.

No migration is required if we only add an optional property inside existing JSON payloads.

Recommended migration still:

- backfill `ingredientKey` into seeded recipe rows where a safe alias match exists

## Asset Rules

Use the catalog as the source of truth for ingredient icon paths.

Do not derive paths directly from display names in the UI.

Why:

- the current asset folder already contains at least one inconsistent filename: `butter, base.png`
- a manifest lets us normalize gradually without blocking the feature

Optional cleanup task:

- rename odd files like `butter, base.png` to `butter_base.png`

That cleanup is helpful but not required if the catalog stores explicit paths.

## Validation Rules

For catalog ingredient rows:

- `ingredientKey` is required
- quantity is required
- EN/ZH `name` must match the selected catalog labels on save
- EN/ZH `unit` must match the selected catalog default unit on save

For custom rows:

- `ingredientKey` must be blank
- EN name is required
- ZH name is required
- quantity is required
- unit remains optional

Global rules:

- EN and ZH ingredient row counts must stay aligned
- quantity stays shared across locales
- unknown `ingredientKey` should fail validation in admin save flow

## Migration Strategy

Backfill existing recipes using an alias-based mapper.

Suggested first-pass mappings:

- `Milk` -> `milk`
- `Flour` -> `flour`
- `Sugar` -> `sugar`
- `Egg` and `Eggs` -> `egg`
- `Butter` -> `butter`
- `Strawberry` -> `strawberry`

Rows with no safe match remain custom text-only rows.

Examples that likely remain text-only in v1 unless art is added:

- `Black Tea`
- `Tapioca Pearls`
- `Yeast`
- `Warm Water`
- `Ice Cream`
- `Seaweed`

## Edge Cases

- `Egg` and `Eggs` should share one icon key
- a recipe row uses a valid ingredient but a non-canonical unit such as `tbsp`
- the catalog contains a key but the PNG is missing
- a row is custom and should keep rendering with no icon
- EN/ZH names drift from the catalog after a manual edit
- an older recipe row has no `ingredientKey`

## Risks

- If we rely on text matching, icons will silently disappear when content is edited
- If we allow free editing of unit on catalog-backed rows, the icon may no longer match the row
- If we do not keep a text fallback, partially migrated recipes will look broken
- If we derive file paths from display names, current filename inconsistencies will cause avoidable bugs

## Test Plan

- Type tests for the new `ingredientKey` field
- Unit tests for ingredient catalog lookup and fallback behavior
- Unit tests for alias-based migration helpers
- Admin draft validation tests for catalog-backed vs custom rows
- UI test: ingredient modal renders icon row when `ingredientKey` resolves
- UI test: ingredient modal falls back to text when key is missing
- UI test: catalog selection auto-fills names and units
- UI test: custom ingredient row remains editable

## Acceptance Criteria

- The recipe ingredients modal shows icons for ingredient rows that have a valid catalog match
- The modal still shows text correctly for rows without a catalog match
- Admin can select a catalog ingredient for a row
- Selecting a catalog ingredient auto-fills localized names and units
- Quantity remains editable
- Existing recipes without `ingredientKey` do not break
- The feature works with the current bilingual EN/ZH recipe content flow

## Implementation Plan

### Phase 1: Catalog and type support

1. Add a checked-in ingredient catalog file with explicit keys, labels, default units, and icon paths.
2. Extend `ShopIngredient` with optional `ingredientKey`.
3. Add helper functions to look up ingredient catalog entries by key.

### Phase 2: Child-facing rendering

1. Update the recipe modal in [ShopSection.tsx](/d:/Coding/cc_review/src/app/words/shop/ShopSection.tsx) to render icon-backed rows.
2. Keep a text-only fallback for rows without a valid icon mapping.
3. Add small layout polish so icon rows still read clearly on mobile.

### Phase 3: Admin authoring

1. Update the ingredient editor in [ShopAdminSection.tsx](/d:/Coding/cc_review/src/app/words/shop-admin/ShopAdminSection.tsx).
2. Add catalog selection and icon preview for icon-backed rows.
3. Preserve a custom/manual mode for unsupported ingredients.
4. Tighten validation so catalog-backed rows cannot drift from their assigned unit.

### Phase 4: Data migration

1. Add a one-time migration or admin-safe backfill to set `ingredientKey` on existing recipe rows where matching is safe.
2. Leave unmatched rows as manual text-only rows.
3. Verify that seeded recipes like milkshake, cake, and donut pick up icons for `milk`, `flour`, `sugar`, `egg`, and `butter`.

### Phase 5: Tests and QA

1. Add type and helper tests.
2. Add UI coverage for modal rendering and admin editing.
3. Manually verify that mixed recipes with some icon-backed rows and some custom rows still render well.

## Open Questions

- Should catalog-backed names be fully read-only, or should admins be allowed to override display labels while keeping the same `ingredientKey`?
- Do we want to treat singular and plural display labels as separate catalog content, or normalize all count-based rows to singular labels in v1?
- Should we rename inconsistent files in `public/ingredients` now, or defer and rely on the catalog manifest?

## Recommendation Summary

Build this as a catalog-backed extension of the existing ingredient row model:

- add `ingredientKey`
- keep `name`, `quantity`, and `unit`
- use one canonical unit per icon-backed ingredient in v1
- render icons opportunistically with text fallback

That gives us a reliable first release without forcing a large schema rewrite.
