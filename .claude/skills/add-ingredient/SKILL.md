---
name: add-ingredient
description: Add a new ingredient to an existing Shop Kitchen food (recipe) - generates the bilingual EN/ZH ingredient name and an image-gen prompt for its icon, lets the user revise both and drop in the finished PNG, then previews and applies the dev-database change. Use when the user asks to add an ingredient to a food/recipe/dish in this game's shop/kitchen feature.
tools: Bash, Read, Edit, Write, Glob, Grep
---

# Add Ingredient

Adds one new ingredient to one existing food (a `shop_recipes` row) in the
Shop Kitchen feature: a bilingual name, an icon, and the link between the two
on that specific recipe. The food must already exist — this skill never
creates a new food.

**This skill only ever touches the dev Supabase project** (`.env.local`).
It never accepts a `--prod` flag anywhere and never writes to
`.env.production.local`. Promoting a dev content change to production still
goes through this repo's existing `export:shop-content-sql` /
`db:push:prod` flow, same as any other shop content edit.

## Hard rules

- The food must resolve to **exactly one** existing recipe. Zero or multiple
  matches is a stop, not a guess — list the candidates and ask.
- Never silently reuse or overwrite an ingredient key that already exists
  with different content. If the key already exists in the catalog, reuse
  its existing label/icon and skip content generation entirely (see Phase 2).
- `costCoins`, the ingredient slot (`base` vs `special`), and `quantity` are
  **always asked of the user explicitly** — do not default or infer them.
  The one exception: if the user has explicitly said something like "write
  it for me" / "just infer it" / "you decide" for this request, then infer
  cost from comparable ingredients (median `costCoins` of ingredients already
  used in recipes of the same `foodType`, or a small flat default like `3`
  if none exist) and infer slot/quantity from phrasing.
- The bilingual EN/ZH name is the entire scope of "description" here — there
  is no separate description field in the data model, and this skill does
  not add one.
- Nothing is written to the database until the user has explicitly approved
  the SQL preview in Phase 6.

## Phase 1 — Resolve the food

Run:

```bash
node .claude/skills/add-ingredient/scripts/find-recipe.mjs "<food name as given>"
```

- Exactly one match in `matches` → note its `slug`, `title_i18n`, `food_type`.
- Zero matches → try a looser term (strip qualifiers), then if still zero,
  tell the user this food doesn't exist yet and stop (this skill doesn't
  create foods).
- More than one match → show the candidates' titles and slugs and ask which
  one.

## Phase 2 — Resolve the ingredient key

Run:

```bash
npx tsx .claude/skills/add-ingredient/scripts/find-ingredient.ts "<new ingredient name as given>"
```

This checks both the checked-in static catalog and the live
`shop_ingredient_prices` table (including aliases).

- **A match already exists** → this is not a new ingredient. Reuse its
  existing `label`, `costCoins`, and `iconPath` as-is. Skip Phase 3
  (content drafting) and Phase 4 (art) entirely — go straight to asking
  the user for slot + quantity (Phase 3's slot/quantity question only),
  then Phase 6.
- **No match, and `canonicalKeyIfNew` is non-empty** → this is genuinely
  new. Use `canonicalKeyIfNew` as the key. Continue to Phase 3.
- **No match, and `canonicalKeyIfNew` is empty** → the ingredient key is
  always a Latin slug (it's canonicalized by stripping everything outside
  `a-z0-9`), so a Chinese-only or otherwise non-Latin input canonicalizes to
  nothing on its own. This is expected, not an error: draft `label.en` first
  (pull it forward from Phase 3), canonicalize *that* to get the candidate
  key, then re-run `find-ingredient.ts` with the English label to confirm
  it's not secretly a collision under a different key before treating it as
  final. Continue to the rest of Phase 3 once the key is confirmed.

## Phase 3 — Draft content (new ingredients only)

Draft:

- `label.en` / `label.zh` — the bilingual ingredient name.

Then ask the user for, rather than inferring (unless they've explicitly
delegated this run per the Hard rules above):

- `costCoins` (an integer)
- slot: `base` or `special`
- `quantity` (a positive integer)

If the user *has* explicitly delegated inference: derive `costCoins` from
the median `costCoins` of other ingredients used in recipes sharing this
food's `food_type` (fall back to a flat default of `3` if none), and infer
slot/quantity from how the user phrased the request (e.g. "as an optional
topping" → special; otherwise base, quantity 1 unless stated).

## Phase 4 — Draft the icon prompt (new ingredients only)

Read [references/art-style.md](references/art-style.md) — it documents the
*actual* observed style of this game's existing ingredient icons (grounded
in inspecting real files, including a real inconsistency: most icons use a
plain white background, a minority use a dark vignette — default to the
plain white background for new ones).

The prompt text should refer to **"the attached ingredient icons"**
generically — never name specific sibling PNGs by filename. The user attaches
their own chosen reference images (from `public/ingredients/`) to whatever
design agent/image tool they run the prompt through themselves.

Write the prompt to a staging file:

```
public/ingredients/_staging/<key>.prompt.txt
```

Tell the user exactly this path, and that once they've generated the image
with it (any tool of their choice), they should save the result to:

```
public/ingredients/_staging/<key>.png
```

**This skill only produces the prompt — it never generates the image
itself.** Wait for the user to say the file is ready before continuing.

## Phase 5 — Review checkpoint

Once `public/ingredients/_staging/<key>.png` exists, validate it:

```bash
file public/ingredients/_staging/<key>.png   # confirm it's actually a PNG
```

Also sanity-check dimensions (1024x1024 is the observed norm; flag anything
wildly off, e.g. a tiny thumbnail or a non-square image, rather than
silently accepting it) and that the background is actually transparent
(alpha channel varies, not a flat opaque fill) — unlike the legacy icons,
new ones are expected to have real transparency per
[references/art-style.md](references/art-style.md), so a baked-in white or
dark square background here is a defect, not acceptable "matching the
existing style."

Show the user everything gathered so far in one place: `key`, `label.en`,
`label.zh`, `costCoins`, slot, `quantity`, and the staged PNG. Offer:

- edit any text field in place
- **"regenerate the image prompt"** — go back to Phase 4 with a refined
  prompt (never "regenerate the image" — this skill doesn't generate images)
- "I replaced the file" — re-run the validation above on the new file

Do not proceed until the user explicitly approves everything shown here.

## Phase 6 — Preview the database write

Run (dry run, no `--apply`):

```bash
node .claude/skills/add-ingredient/scripts/apply-ingredient.mjs \
  --recipe-slug <slug> \
  --ingredient-key <key> \
  --label-en "<label.en>" --label-zh "<label.zh>" \
  --cost <costCoins> --slot <base|special> --quantity <quantity> \
  --icon-file <key>.png
```

`--icon-file` takes a **bare filename** (e.g. `cinnamon.png`), not a path —
the script prefixes `/ingredients/` internally. Omit it entirely if reusing
an existing ingredient that already has an icon, per Phase 2. (Don't pass a
leading-slash path directly on this shell: Git Bash on Windows silently
rewrites `/ingredients/...` into a Windows filesystem path before Node sees
it — this is why the flag takes a bare filename instead.)

This prints the exact SQL it would run — one `insert ... on conflict` for
`shop_ingredient_prices` and one narrow `update ... where slug = ...` for
`shop_recipes` touching only the chosen slot's two JSON columns. Show this
to the user verbatim and get explicit go-ahead before continuing.

## Phase 7 — Apply

Only after explicit approval:

1. Move the PNG into place (skip if reusing an existing ingredient's icon):

   ```bash
   mv public/ingredients/_staging/<key>.png public/ingredients/<key>.png
   ```

   Use the `<key>_base.png` naming variant instead of `<key>.png` only if
   the user indicates this is a "base tier" ingredient matching that
   existing naming convention (check [shopIngredients.ts](../../../src/lib/shopIngredients.ts)
   for current examples before deciding).

2. Re-run the same `apply-ingredient.mjs` command from Phase 6 with `--apply`
   appended. This upserts `shop_ingredient_prices` and updates the one
   matched recipe row.

3. Update the checked-in fallback catalog so it doesn't drift from the DB:
   add or update the entry for this key in `SHOP_INGREDIENT_CATALOG` in
   [../../../src/lib/shopIngredients.ts](../../../src/lib/shopIngredients.ts),
   keeping the array's existing key ordering convention.

4. Report back a short summary: PNG added, catalog entry added/updated in
   `shopIngredients.ts`, and which recipe's which slot now includes this
   ingredient.

## Notes on the scripts

- `find-recipe.mjs` and `apply-ingredient.mjs` are plain Node scripts (no
  build step) — run with `node`.
- `find-ingredient.ts` imports the *real*
  [shopIngredients.ts](../../../src/lib/shopIngredients.ts) module (for
  canonicalization and alias matching) rather than re-implementing that
  logic, so it can never drift from actual app behavior — run with
  `npx tsx`.
- All three scripts load `.env.local` only. If it's missing, they fall back
  to `process.env` and warn — they never read `.env.production.local`.
