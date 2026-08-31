---
name: add-food
description: Add a brand-new food (a new shop_recipes row) to Shop Kitchen - e.g. introducing Pancake as a food type that doesn't exist yet. Requires the plain reward icon (and any launch-day variant icon) to already be placed in public/rewards/ before this skill is invoked; it aborts rather than draft art itself. Drafts the bilingual title/intro, resolves base/special ingredients against the existing catalog, then previews and applies the new shop_recipes row to dev. Use when the user asks to add a new food/recipe/dish TYPE to this game's shop/kitchen feature, distinct from adding an ingredient or a variant to an existing food.
tools: Bash, Read, Edit, Write, Glob, Grep, Skill
---

# Add Food

Creates one brand-new food: a new `shop_recipes` row from scratch (bilingual
title/intro, base ingredients, optional special ingredients, and a
`variant_icon_rules` array seeded with the mandatory plain icon plus any
launch-day named variants).

This is the third, sibling skill to **add-ingredient** (adds one ingredient
to an *existing* food) and **add-food-variation** (adds one named variant to
an *existing* food). This skill is the only one of the three that creates
the food itself — the other two always require the food to already exist
and refuse to create one.

**This skill only ever *connects to* the dev Supabase project**
(`.env.local`). The apply script never accepts a `--prod` flag and never
reads `.env.production.local`. On a successful apply, it additionally writes
a scoped SQL migration file (one `insert` for the one new recipe row —
nothing else) to `supabase/migrations/`, ready for this repo's normal
`db:push:prod` flow. Writing that file to disk is not the same as running
it — promoting to production is always a separate, explicit step the user
asks for (see "Promoting to production" below, same caveat as the other two
shop-content skills).

## Hard rules

- **The user places every reward icon this food needs on disk BEFORE this
  skill is invoked at all.** This skill never drafts an art prompt and never
  waits for one to be generated — that's deliberately different from
  add-ingredient/add-food-variation. Phase 1 checks for the plain icon
  (`public/rewards/<slug>_plain.png`) and, if this food launches with a
  named variant, that variant's icon too. **If either expected file is
  missing, stop immediately and tell the user exactly which path is
  missing — do not proceed, do not offer to draft a prompt instead.**
- The food must resolve to **no existing match**. If `find-recipe.mjs`
  returns a hit on the intended name/slug, this is not a new food — stop and
  tell the user (point them at add-ingredient/add-food-variation if they
  actually meant to modify that existing food).
- Every base/special ingredient key should ideally **already exist** in the
  shared `shop_ingredient_prices` catalog (checked via `find-ingredient.ts`,
  same as add-ingredient's Phase 2 lookup). If one genuinely doesn't, this
  skill *can* create its catalog row as part of the same apply — but only
  under the same art precondition as the food's own reward icon: **the
  user places the finished ingredient icon PNG under `public/ingredients/`
  BEFORE this skill runs, and this skill checks for it and aborts if
  missing.** It never drafts an ingredient-icon prompt either — that's
  add-ingredient's job when a recipe already exists to attach it to; here,
  the food doesn't exist yet, so this skill folds the catalog-row creation
  into its own single apply instead of delegating.
- `costCoins` for any new ingredient is **always asked of the user
  explicitly**, same as every other numeric field below — never inferred.
- `unlockCostCoins`, each ingredient's quantity, and whether the food is
  cookable (`cookMethod`/`foodType`) are **always asked of the user
  explicitly** — never defaulted or inferred, matching add-ingredient's
  existing convention for the same fields.
- At least one base ingredient is required (Shop Admin Rule 6 — a recipe
  with zero base ingredients is invalid).
- The Recipe Wall (`/words/shop`) is a **fixed-size grid** of exactly
  `SHOP_WALL_SIZE` slots — it does not grow automatically just because a
  new recipe row exists. `apply-food.ts` refuses to create an active
  recipe at a `display_order` beyond `SHOP_WALL_SIZE` for exactly this
  reason (a real bug caught the hard way: the first food ever created by
  this skill landed at `display_order 10` on a `SHOP_WALL_SIZE = 9` wall
  and was invisible despite `is_active = true`). See Phase 1.
- If `cookMethod` is set, `foodType` is required (Shop Admin Rule 10 — the
  shelf has no "unsorted" fallback tab). If the food isn't cookable yet,
  both stay unset — it's still unlockable/inspectable in the Recipe Shop,
  just never appears in the Kitchen's Recipe Book.
- Nothing is written to the database until the user has explicitly approved
  the SQL preview in Phase 5.

## Phase 1 — Resolve identity and check the art precondition

Ask the user for the food's name (English is enough to start; Chinese can be
drafted). Derive a slug the same way existing recipe slugs are formed
(lowercase, hyphenated — e.g. "Bubble Tea" → `bubble-tea`).

Run:

```bash
node .claude/skills/add-food/scripts/find-recipe.mjs "<food name as given>"
```

- **Any match** → this food already exists. Stop and tell the user; point
  them at add-ingredient or add-food-variation if that's actually what they
  want.
- **No match** → continue. Note `maxDisplayOrder` from the output for Phase
  5 (or let the apply script compute it automatically). **Check it against
  `SHOP_WALL_SIZE`** in
  [../../../src/lib/shop.ts](../../../src/lib/shop.ts) — the Recipe Wall
  renders exactly that many fixed slots (`Recipe Shop Rules` in
  `0_ARCHITECTURE.md`), so if `maxDisplayOrder` already equals or exceeds
  it, the wall is full: an active new recipe would insert successfully but
  never actually render. Tell the user this up front and ask whether to (a)
  bump `SHOP_WALL_SIZE` by one as part of this change (the normal path —
  the wall is meant to grow as foods are added), or (b) land the food
  `isActive: false` on purpose instead. Don't silently pick either.

Ask whether this food launches with a named special-ingredient variant right
away (it can also get one later via add-food-variation — this is only about
what ships on day one). Then check the required file(s) exist:

```bash
ls -la "public/rewards/<slug>_plain.png"
# if a launch variant was named:
ls -la "public/rewards/<match-signature>.png"   # whatever filename the user placed
```

**If the plain icon file is missing, stop here and abort** — tell the user
the exact expected path and that they need to place the finished PNG there
before this skill can continue. Same for a named launch variant's icon if
one was requested. Do not offer to draft an art prompt as a fallback.

## Phase 2 — Normalize and validate the placed icon(s)

**Assume every icon the user places needs background cleaning and a real
PNG re-encode — always run this, don't eyeball it first.** AI image tools
routinely hand back a JPEG saved with a `.png` extension, a baked-in
checkerboard "transparency" texture flattened into real opaque pixels, or a
real-but-wrong alpha channel — and this tool's own image preview does not
reliably composite alpha, so a file can *look* fine here while being wrong
on disk. This bit the skill twice (in opposite directions) before this
step existed; don't shortcut it by inspecting visually instead.

For each icon file found in Phase 1 (the plain icon, and any launch
variant's icon), run:

```bash
node .claude/skills/add-food/scripts/normalize-reward-icon.mjs "public/rewards/<slug>_plain.png"
```

This script is idempotent and self-verifying — see its own header comment
for the full rationale, grounded in
[../add-food-variation/references/reward-art-style.md](../add-food-variation/references/reward-art-style.md)'s
corrected description of the real convention (transparent at the
edges/corners, hard cutout into an opaque vignette blob behind the
subject — not a flat opaque background, and not a soft alpha-gradient
glow):

- **Already correct** → prints `OK (already correct)` and leaves the file
  byte-for-byte untouched.
- **Needed fixing** → re-derives real transparency (achromatic-background
  flood fill, re-encoded as a genuine PNG) and overwrites the file in
  place, then re-reads its own output to confirm the fix actually took.
- **QC failed** (masked background fraction outside a sane range, or the
  image center — where every existing icon's subject sits — got masked as
  background) → **exits non-zero and writes nothing.** This is a stop,
  not a guess: tell the user the automated fix couldn't confidently
  separate subject from background for this specific file, and ask them to
  place a different source image (or confirm you should attempt a manual
  fix, treating it the same as any other change to a placed asset —
  verified against raw pixel alpha, never the visual preview, before
  finalizing).

Also confirm the file is roughly square (~1024×1024 is the observed norm —
flag anything wildly off, but don't block on it; this is a sanity check,
not a redo-the-art gate).

## Phase 3 — Draft bilingual copy

Draft:

- `titleI18n.en` / `titleI18n.zh` (if not both already given)
- `introI18n.en` / `introI18n.zh` — one to two sentences, matching the tone
  of existing recipe intros (check a couple via `find-recipe.mjs` output or
  `/words/shop` if unsure)

Show both for approval/edits before moving on.

## Phase 4 — Resolve ingredients

Ask the user for this food's **base ingredients** (name + quantity each;
at least one, per the Hard rules) and, if a launch variant was named in
Phase 1, its **special ingredient(s)** (the variant's match key(s) must be
included here — the apply script rejects a variant match key that isn't
also listed as a special ingredient).

For each ingredient, resolve it against the shared catalog:

```bash
npx tsx .claude/skills/add-food/scripts/find-ingredient.ts "<ingredient name as given>"
```

- **Found** → use its existing `key` as-is.
- **Not found** → this is a genuinely new ingredient. Ask the user (never
  infer): `costCoins`, quantity, and which slot (`base`/`special`). Draft
  `label.en`/`label.zh` and show for approval. Then check its icon is
  already placed:

  ```bash
  ls -la "public/ingredients/<key>.png"
  ```

  **If missing, stop and abort** — same hard gate as the food's own reward
  icon in Phase 1, and for the same reason: this skill never drafts an
  ingredient-icon prompt. If present, run the same normalize-and-validate
  step Phase 2 uses for reward icons — assume it needs cleaning too, don't
  eyeball it first:

  ```bash
  node .claude/skills/add-food/scripts/normalize-reward-icon.mjs "public/ingredients/<key>.png"
  ```

  Ingredient icons are a *different* asset family from reward icons (see
  [../add-ingredient/references/art-style.md](../add-ingredient/references/art-style.md)
  — no vignette-glow blob, just a tightly-cropped subject on transparency),
  but the actual defect class and fix are identical, and this same script
  is format-agnostic — it just needs real transparent corners and a
  non-masked center. Same outcomes as Phase 2: already-correct is a no-op,
  a fixable file gets fixed and self-verified, and a QC failure stops and
  asks rather than guessing.

  Once confirmed, this ingredient is passed to `apply-food.ts` via
  `--new-ingredients` (Phase 5) — it must ALSO appear in
  `--base-ingredients`/`--special-ingredients` with the same quantity; the
  script rejects a mismatch rather than guessing which one is right.

Also ask (never infer): `unlockCostCoins`, and whether the food is cookable
in Shop Kitchen (`cookMethod`: `stove`/`oven`/none; if set, `foodType`:
`drinks`/`hotmeal`/`desserts` — required together per the Hard rules).

## Phase 5 — Review checkpoint and DB-write preview

Show the user everything gathered: slug, `titleI18n`, `introI18n`,
`unlockCostCoins`, `cookMethod`/`foodType`, base ingredients (key +
quantity, flagging which are genuinely new), special ingredients if any,
the plain icon path, and any launch variant (match key(s), title, icon
path). Do not proceed until approved.

Then run the preview (dry run, no `--apply`):

```bash
npx tsx .claude/skills/add-food/scripts/apply-food.ts \
  --slug <slug> \
  --title-en "<titleI18n.en>" --title-zh "<titleI18n.zh>" \
  --intro-en "<introI18n.en>" --intro-zh "<introI18n.zh>" \
  --unlock-cost <unlockCostCoins> \
  --cook-method <stove|oven|none> --food-type <drinks|hotmeal|desserts|none> \
  --base-ingredients "<key>:<qty>,<key>:<qty>,..." \
  --special-ingredients "<key>:<qty>,..." \
  --new-ingredients '[{"key":"<key>","labelEn":"<en>","labelZh":"<zh>","cost":<costCoins>,"iconFile":"<bare-filename>.png","quantity":<qty>,"slot":"base|special"}]' \
  --plain-icon-file <bare-filename>.png \
  --variants '[{"match":"<key>","titleEn":"<en>","titleZh":"<zh>","iconFile":"<bare-filename>.png"}]'
```

Omit `--special-ingredients`, `--new-ingredients`, and `--variants` entirely
when they don't apply (base-only food, no new ingredients, no launch
variant). `--variants`/`--new-ingredients` take JSON arrays. `--display-order`
can be passed explicitly; omitted, it's computed as `max(display_order) + 1`
automatically.

This re-validates everything server-side (no existing slug/ingredient-key
collision, every ingredient key resolves in the catalog or is covered by
`--new-ingredients`, every referenced icon file — reward AND ingredient —
exists on disk, `cookMethod`/`foodType` pairing, and that every
`--new-ingredients` entry's key+quantity actually matches an entry in
`--base-ingredients`/`--special-ingredients`) and prints the exact SQL it
would run: one `insert` per new ingredient catalog row (if any), then the
one new recipe row. Show this to the user verbatim and get explicit
go-ahead before continuing.

## Phase 6 — Apply

Only after explicit approval, re-run the same `apply-food.ts` command from
Phase 5 with `--apply` appended. This inserts any `--new-ingredients`
catalog row(s) first, then the new `shop_recipes` row, in **dev**. On
success it also writes a scoped migration file to
`supabase/migrations/<timestamp>_shop_add_<slug>_food.sql` containing the
same statement(s) — written to disk only, never run.

If `--new-ingredients` created any genuinely new ingredient(s), also update
the checked-in fallback catalog so it doesn't drift from the DB: add an
entry for each new key to `SHOP_INGREDIENT_CATALOG` in
[../../../src/lib/shopIngredients.ts](../../../src/lib/shopIngredients.ts),
matching the array's existing entry shape — same step add-ingredient's own
Phase 7 already does for the ingredients it creates.

If Phase 1 determined `SHOP_WALL_SIZE` needed to grow, make that one-line
edit to [../../../src/lib/shop.ts](../../../src/lib/shop.ts) now (or confirm
it was already done before this phase). This is a normal app-code change,
not a DB migration — it ships via this repo's regular deploy, not
`db:push:prod`, so don't conflate the two in the summary below.

Report back a short summary: slug, `display_order` it landed at, whether it
launched active/cookable, whether `SHOP_WALL_SIZE` was bumped, which icon(s)
it references, any new ingredient(s) created (and whether the static
catalog was updated for them), and the path of the generated migration
file.

## Promoting to production

The migration file from Phase 6 is deliberately **not** applied
automatically — promoting to production is a separate, explicit action the
user asks for.

Unlike add-ingredient/add-food-variation's migration files (which append to
an existing array and can silently overwrite a diverged prod row), this
migration is a plain `insert` — it fails loudly instead of silently
overwriting if a row with this slug somehow already exists in prod. Still,
confirm prod doesn't already have this slug (`supabase migration list`, or
ask the user) before promoting — a Bash-tool attempt to query prod's tables
directly may get blocked by the auto-mode safety classifier, which is
expected for direct production database access; if so, either get the
user's explicit permission for that one read, ask the user to paste prod's
current state, or proceed on the user's explicit instruction to skip the
check.

Once the user has reviewed the file and wants to proceed:

```bash
npm run db:push:prod:dry
npm run db:push:prod
```

Commit the migration file to git either before or after — it's a normal
checked-in file like any other migration in this repo. Commit the placed
reward icon PNG(s) too, since they're referenced by path from the DB row.

## Notes on the scripts

- `find-recipe.mjs` is a plain Node script (no build step) — run with
  `node`. It also reports `maxDisplayOrder` across all recipes.
- `find-ingredient.ts` and `apply-food.ts` import the *real*
  [shopIngredients.ts](../../../src/lib/shopIngredients.ts) and
  [shopRewardIconAudit.ts](../../../src/lib/shopRewardIconAudit.ts) modules
  (key canonicalization, variant-rule construction/duplicate-check) rather
  than reimplementing that logic, so they can never drift from actual app
  behavior — run both with `npx tsx`.
- All three scripts load `.env.local` only. If it's missing, they fall back
  to `process.env` and warn — they never read `.env.production.local`.
- `normalize-reward-icon.mjs` touches only the one image file it's pointed
  at — no database/env access at all. It's a plain Node script (`node`),
  used identically for reward icons (`public/rewards/`) and new-ingredient
  icons (`public/ingredients/`) since the underlying defect class and fix
  are the same for both asset families.
