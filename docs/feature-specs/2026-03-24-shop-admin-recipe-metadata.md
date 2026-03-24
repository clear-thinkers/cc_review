# Feature Spec — 2026-03-24 — Shop Admin Recipe Metadata

## Status: Draft

## Problem

The child-facing shop now depends on manually authored recipe metadata such as:
- intro text
- base ingredients
- child-friendly specialty ingredient labels
- bilingual EN/ZH recipe content that follows the active app language toggle for child users

That data currently lives in `shop_recipes`, but there is no admin-friendly way to maintain it. Editing JSON directly in SQL is error-prone, hard to review, and not suitable for routine content updates.

The highest-priority admin need is to author and update `base_ingredients` for each food type.

## Scope

- Add an admin-facing recipe metadata editor for `shop_recipes`
- Support editing one recipe row at a time
- Support editing `title`, `intro`, and `base_ingredients`
- Support editing both English and Simplified Chinese versions of recipe metadata
- Support editing child-friendly specialty ingredient labels and notes while keeping specialty logic derived from reward filenames
- Keep all UI copy bilingual in English and Simplified Chinese
- Reuse existing route/role guard patterns from the words app

## Out of Scope

- Child-facing shop changes beyond reading the saved metadata
- Runtime filesystem scanning of `public/rewards`
- Uploading or renaming PNG files from the browser
- Full visual variant authoring UI for `variant_icon_rules` in v1
- Inventory gameplay, crafting simulation, or recipe publishing workflow
- Multi-user draft/review/approval workflow

## Proposed Behavior

### 1. Route and access

- Add a admin facing only route: `/words/shop-admin`
- Child users cannot access this route
- Only platform admin can access it
- Parent users cannot access this route
- Add a `Shop Admin` nav item only for roles allowed to use it
- Add to the bottom of the nav menu

### 2. Page structure

The page has two columns on desktop and a stacked layout on mobile:

- Left: recipe list
- Right: recipe editor form

The recipe list shows all available shop recipes in display order with:
- title
- slug
- active/inactive state
- small icon preview from canonical unlock art if available
- unsaved-changes indicator on the currently selected recipe

### 3. Editor sections

The recipe editor is split into clear sections:

- Basic Info
- Base Ingredients
- Specialty Ingredients Preview
- Save Bar

### 4. Exact form fields

#### Section A: Basic Info

- `slug`
  - type: read-only text
  - source: `shop_recipes.slug`
  - note: stable id, not editable in v1

- `title`
  - type: paired single-line text inputs
  - source: `shop_recipes.title_i18n.en` and `shop_recipes.title_i18n.zh`
  - required: yes
  - max length: 80 chars

- `intro`
  - type: paired multiline textareas
  - source: `shop_recipes.intro_i18n.en` and `shop_recipes.intro_i18n.zh`
  - required: yes
  - target length: 1-3 short sentences
  - max length: 240 chars

- `display_order`
  - type: read-only numeric display in v1
  - source: `shop_recipes.display_order`

- `unlock_cost_coins`
  - type: read-only numeric display in v1
  - source: `shop_recipes.unlock_cost_coins`

- `is_active`
  - type: read-only badge
  - source: `shop_recipes.is_active`
  - note: read-only in v1

#### Section B: Base Ingredients

This is the core authoring area for this feature.

Each base ingredient row contains:

- `name`
  - type: paired EN/ZH text inputs
  - required: yes
  - examples: `Milk` / `牛奶`
  - max length: 60 chars

- `quantity`
  - type: text input
  - required: yes
  - examples: `1`, `0.5`, `2`
  - stored as string to match current schema
  - max length: 20 chars

- `unit`
  - type: paired EN/ZH text inputs
  - required: no
  - examples: `cup` / `杯`
  - max length: 20 chars

- `display_order`
  - type: implicit via row order
  - behavior: rows render and save in the order shown in the UI

Row controls:

- `Add Ingredient`
- `Remove`
- `Move Up`
- `Move Down`

Validation rules:

- at least 1 base ingredient row is required
- blank rows cannot be saved
- `name` and `quantity` are required per row
- fully blank trailing draft row is ignored only if never touched
- duplicate ingredient names are allowed in v1 but discouraged
- whitespace is trimmed on save

Saved JSON shape remains:

```json
[
  { "name": "Milk", "quantity": "1", "unit": "cup" },
  { "name": "Sugar", "quantity": "2", "unit": "tbsp" }
]
```

Localized persistence shape:

```json
{
  "en": [
    { "name": "Milk", "quantity": "1", "unit": "cup" }
  ],
  "zh": [
    { "name": "牛奶", "quantity": "1", "unit": "杯" }
  ]
}
```

#### Section C: Specialty Ingredients

This section lets platform admin refine child-facing specialty ingredient copy without changing the asset-driven matching logic.

Show:

- parsed specialty options from `shop_recipes.special_ingredient_slots`
- variant preview list from `shop_recipes.variant_icon_rules`
- canonical unlock icon preview

Editable in v1:

- `slot label`
  - type: paired EN/ZH text inputs
  - source: `special_ingredient_slots_i18n.{locale}[*].label`
  - required: yes
  - max length: 60 chars

- `option label`
  - type: paired EN/ZH text inputs
  - source: `special_ingredient_slots_i18n.{locale}[*].options[*].label`
  - required: yes
  - max length: 60 chars

- `option effect note`
  - type: paired EN/ZH text input or short textarea
  - source: `special_ingredient_slots_i18n.{locale}[*].options[*].effect`
  - required: yes
  - max length: 120 chars

Read-only in v1:

- option `key`
- slot `maxSelections`
- variant preview list
- `variant_icon_rules`
- any logic derived from reward filenames

Section note:

- reward art mappings and ingredient-combination logic are maintained through the reward sync flow, not this form

### 5. Save bar behavior

The editor includes a sticky save bar with:

- `Save`
- `Reset Changes`
- unsaved state text
- success/error notice area

Save button behavior:

- disabled when there are no unsaved changes
- disabled while request is in flight
- enabled only when form validation passes

Reset button behavior:

- resets the current recipe editor to the last loaded server state
- does not affect other recipes

## Save Flow

### 1. Load

On page load:

- fetch all `shop_recipes` rows ordered by `display_order`
- select the first recipe by default
- populate the editor form from the selected row

When switching recipes:

- if there are no unsaved changes, switch immediately
- if there are unsaved changes, show a confirm dialog:
  - keep editing
  - discard changes and switch

### 2. Local form state

The page keeps a local editable draft for the selected recipe:

- `title.en`
- `title.zh`
- `intro.en`
- `intro.zh`
- `baseIngredients.en`
- `baseIngredients.zh`
- `specialIngredientSlots.en`
- `specialIngredientSlots.zh`

Recommended draft type:

```ts
type ShopRecipeAdminDraft = {
  recipeId: string;
  title: { en: string; zh: string };
  intro: { en: string; zh: string };
  baseIngredients: {
    en: Array<{ name: string; quantity: string; unit: string }>;
    zh: Array<{ name: string; quantity: string; unit: string }>;
  };
  specialIngredientSlots: {
    en: Array<{
      slotKey: string;
      label: string;
      maxSelections: number;
      options: Array<{
        key: string;
        label: string;
        effect: string;
      }>;
    }>;
    zh: Array<{
      slotKey: string;
      label: string;
      maxSelections: number;
      options: Array<{
        key: string;
        label: string;
        effect: string;
      }>;
    }>;
  };
};
```

### 3. Save submission

On save:

1. validate local draft
2. normalize whitespace
3. convert `baseIngredients` into the persisted JSON array shape
4. preserve read-only specialty logic fields such as `slotKey`, `key`, and `maxSelections`
5. convert edited specialty labels/effect notes into the persisted `special_ingredient_slots` shape
6. send one update request for the current `shop_recipes` row
7. on success:
   - update local recipe list state
   - replace draft baseline
   - show success notice
8. on failure:
   - keep draft intact
   - show error notice

### 4. Service/API shape

Recommended service-layer helper:

```ts
updateShopRecipeMetadata(input: {
  recipeId: string;
  title: { en: string; zh: string };
  intro: { en: string; zh: string };
  baseIngredients: { en: ShopIngredient[]; zh: ShopIngredient[] };
  specialIngredientSlots: {
    en: ShopRecipe["specialIngredientSlots"];
    zh: ShopRecipe["specialIngredientSlots"];
  };
}): Promise<ShopRecipe>
```

Recommended v1 implementation:

- small API route using server client
- platform-admin auth enforced in route
- do not rely on browser-client writes for this page

## Data Model

Primary edited table:

- `shop_recipes`

Edited columns in v1:

- `title`
- `intro`
- `base_ingredients`
- `special_ingredient_slots` label/effect-note subfields
- `title_i18n`
- `intro_i18n`
- `base_ingredients_i18n`
- `special_ingredient_slots_i18n`
- optionally `updated_at`

Read-only in v1:

- `slug`
- `display_order`
- `unlock_cost_coins`
- `variant_icon_rules`
- `special_ingredient_slots`
- `is_active`

## Admin-Friendly Implementation Strategy

### Recommended v1

Build a small dedicated page at `/words/shop-admin`.

Why this is the best fit:

- recipe metadata is domain-specific and not a natural fit for Content Admin
- base ingredients are structured rows, which deserve a purpose-built editor
- the data is small: only 9 food types right now
- it avoids asking admins to edit JSON directly

### Alternative: checked-in JSON source

Another workable path is to maintain a file such as:

- `src/app/words/shop/shop.recipe.metadata.ts`

That file would define manual recipe metadata, and a script/migration would sync it into `shop_recipes`.

Pros:

- easy to version-control
- easy to review in Git

Cons:

- not admin-friendly for non-developers
- still requires code changes for content edits

### Recommendation

- Build `shop-admin` for routine metadata editing by platform admin
- Keep a checked-in metadata source or reward sync script as a complementary maintenance tool, not the primary authoring UI

## Promotion Flow

Platform admin edits are typically made in dev first, then promoted to production through a reviewed SQL patch.

### Recommended dev-to-prod workflow

1. Make recipe metadata edits in dev through `/words/shop-admin`
2. Export the current `shop_recipes` metadata from dev as SQL
3. Review the generated SQL patch
4. Apply that SQL patch to production

### Export script

Use the checked-in export script:

- `scripts/export-shop-metadata-patch.mjs`
- package command: `npm run export:shop-metadata-sql`

By default, it reads dev credentials from:

- `.env.local`

With `--prod`, it reads production credentials from:

- `.env.production.local`

Required env vars in the selected file:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Example commands

Export the current dev metadata into a migration-ready SQL file:

```bash
npm run export:shop-metadata-sql -- --output supabase/migrations/20260324190000_shop_metadata_promote_from_dev.sql
```

Export a production snapshot for comparison:

```bash
npm run export:shop-metadata-sql -- --prod --output supabase/migrations/20260324190000_shop_metadata_snapshot_from_prod.sql
```

### Exported fields

The export script writes SQL updates for:

- `title`
- `title_i18n`
- `intro`
- `intro_i18n`
- `display_order`
- `is_active`
- `unlock_cost_coins`
- `base_ingredients`
- `base_ingredients_i18n`
- `special_ingredient_slots`
- `special_ingredient_slots_i18n`
- `variant_icon_rules`

### Recommendation

- Use dev as the authoring environment
- Generate a SQL patch from dev
- Review the patch in Git
- Apply the reviewed patch to production instead of manually re-entering edits in prod

## Permissions

- Child:
  - no access
- Parent:
  - no access
- Platform admin:
  - can read and update all recipe metadata

V1 policy choice:

- restrict both read and write access for this page to platform admin only

Why this is the cleaner default:

- `shop_recipes` is currently global/shared content, not family-scoped content
- parent editing is not part of this feature
- family-by-family recipe divergence would complicate maintenance quickly

## Layer Impact

### UI

- new `/words/shop-admin` page
- recipe list sidebar
- structured ingredient row editor
- save/reset notices

### Domain

- new draft-normalization helpers for base ingredients
- dirty-state comparison for recipe drafts

### Service

- add `updateShopRecipeMetadata()` helper

### Database

- likely no new table needed for v1
- may need updated RLS or an API route for platform-admin-only editing

## Edge Cases

- recipe has zero saved base ingredients and admin opens it
- admin adds multiple blank rows then tries to save
- admin removes all rows and tries to save
- admin edits one recipe, then clicks another recipe without saving
- server save succeeds but list state is stale
- reward sync later changes variant art while base ingredients remain untouched
- specialty ingredient labels are edited here, but filename-derived keys and matching logic remain unchanged

## Risks

- If base ingredient editing and reward sync editing are mixed in one screen without separation, admins may think PNG art is manually authored there too
- If specialty label editing is allowed to overwrite filename-derived keys or matching rules, recipe art resolution can drift from the actual reward assets
- If the UI stores quantities as numbers instead of strings, it may drift from current persisted schema
- If row ordering is unstable, ingredient display order in the child modal may jump unexpectedly

## Test Plan

- Type tests for admin draft shape if a new admin types file is added
- Service tests for `updateShopRecipeMetadata()`
- UI tests:
  - loads recipe list in display order
  - selecting a recipe loads its existing base ingredients
  - add/remove/reorder ingredient rows works
  - save disabled when invalid
  - save persists title, intro, and base ingredients
  - save persists specialty ingredient labels and effect notes without changing slot keys or option keys
  - unsaved-change guard appears on recipe switch
  - child cannot access `/words/shop-admin`
  - parent cannot access `/words/shop-admin`

## Acceptance Criteria

- An authorized admin can open `/words/shop-admin`
- The page lists all shop recipes in order
- The admin can edit `title`, `intro`, and `base_ingredients`
- The admin can edit both English and Chinese versions of recipe metadata
- The admin can edit child-facing specialty ingredient labels and effect notes in both languages
- Base ingredients are edited through structured rows, not raw JSON
- Saving updates the current `shop_recipes` row
- The child-facing shop reflects the saved language variant that matches the active locale toggle, with English fallback when Chinese content is still blank
- The page clearly separates manual recipe metadata from asset-driven art mappings

## Open Questions

- Specialty ingredient labels should be editable in v1, while the underlying logic remains determined by reward filenames.
- `display_order`, `unlock_cost_coins`, and `is_active` remain read-only in this first pass.
