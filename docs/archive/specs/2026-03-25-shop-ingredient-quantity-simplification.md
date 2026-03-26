# Feature Spec - 2026-03-25 - Shop Ingredient Quantity Simplification

## Problem

Shop recipe ingredients currently carry a `unit` concept and freeform `quantity` text.

That creates unnecessary complexity for this product:

- recipe ingredient rows show labels like `cup` and `packet`
- ingredient catalog entries must carry bilingual measurement labels
- admin ingredient pricing shows measurement fields that are no longer meaningful
- validation permits quantity strings that do not match the intended gameplay model

The desired model is simpler:

- ingredients are counted in integer units only
- each row quantity is an integer from `1` to `99`
- ingredient pricing is per unit / `份`
- child-facing recipe details only need ingredient name plus quantity needed

## Scope

- Remove the measurement/unit concept from shop ingredient authoring and display
- Normalize ingredient quantity to integers `1-99`
- Simplify ingredient catalog metadata and pricing UI
- Preserve compatibility when reading older persisted recipe JSON that still contains `unit`

## Out Of Scope

- Changing reward icon logic
- Inventory or consumption gameplay
- Database schema migrations that introduce new tables
- Reworking specialty ingredient slots

## Proposed Behavior

### Ingredient model

`ShopIngredient` becomes:

```ts
type ShopIngredient = {
  ingredientKey?: string;
  name: string;
  quantity: number;
  costCoins?: number;
};
```

`unit` is removed from the active app model.

### Catalog model

Ingredient catalog entries keep:

- `key`
- localized `label`
- `defaultCostCoins`
- `iconPath`
- `aliases`

`defaultUnit` is removed.

### Backward compatibility

When loading persisted JSON:

- numeric `quantity` is accepted as-is if it is an integer in range
- string `quantity` is parsed if it contains a valid integer
- legacy `unit` fields are ignored

When saving recipe metadata:

- only `ingredientKey`, `name`, and integer `quantity` are written for base ingredients

### Quantity rules

- quantity is required
- quantity must be a whole number
- quantity must be between `1` and `99`
- EN and ZH rows still share the same quantity

### Child-facing shop UI

Recipe ingredient cards show:

- ingredient icon when available
- localized ingredient name
- `x{quantity}` style quantity display
- ingredient cost

The ingredient detail panel shows:

- image
- localized ingredient name
- quantity needed
- ingredient cost

### Admin recipe editor

Catalog rows:

- ingredient picker
- quantity numeric input (`1-99`)
- icon preview
- derived EN/ZH names

Custom rows:

- EN name
- ZH name
- quantity numeric input (`1-99`)

No unit fields are shown.

### Ingredient pricing UI

Ingredient pricing cards show:

- icon preview
- localized ingredient label
- ingredient key
- price per unit / `份`

No unit labels are shown.

## Layer Impact

- `shop.types.ts`: remove `unit`, change `quantity` to number
- `shopIngredients.ts`: remove `defaultUnit`
- `shop.ts`: parse and normalize integer quantities from legacy JSON
- `shopAdmin.types.ts`: validate `1-99` integer quantities and stop merging units
- `ShopSection.tsx`: render quantity-only ingredient text
- `ShopAdminSection.tsx`: replace text quantity editing with numeric quantity inputs and remove unit fields
- `words.strings.ts`: simplify ingredient and pricing copy
- API routes: continue using JSON payloads, but save quantity-only ingredient rows

## Edge Cases

- older rows with `"quantity": "2"` should still load
- older rows with invalid quantity strings should fall back safely instead of crashing
- legacy rows with `unit` should not break reads
- custom ingredient rows still need localized EN/ZH names
- catalog-backed rows still require valid `ingredientKey`

## Risks

- changing `quantity` from string to number touches many tests and UI assumptions
- old data may contain unexpected non-numeric quantity values
- price copy may become inconsistent if some strings still say `unit`

## Test Plan

- unit tests for quantity normalization from legacy string values
- admin validation tests for non-integer, `0`, and `100`
- UI tests for quantity-only recipe rendering expectations where covered
- focused shop tests for cost lookup and localized ingredient content

## Acceptance Criteria

- shop recipe ingredient rows no longer display measurement units
- admin recipe editor no longer exposes unit fields
- ingredient pricing no longer exposes unit labels
- ingredient quantities are saved and rendered as integers from `1` to `99`
- existing legacy recipe JSON with string quantities continues loading safely
