---
name: add-food-variation
description: Add a named special-ingredient variant to an existing Shop Kitchen food (recipe) - e.g. turning Zongzi cooked with pork into "肉粽 Pork Zongzi" with its own icon. Drafts the bilingual variant title and a reward-icon prompt, lets the user drop in the finished PNG, then previews and applies the variant_icon_rules change to dev. Use when the user asks to add a variation/variant of a food/recipe/dish in this game's shop/kitchen feature, distinct from adding a plain ingredient.
tools: Bash, Read, Edit, Write, Glob, Grep, Skill
---

# Add Food Variation

Adds one new **named variant** to one existing food (a `shop_recipes` row)
in the Shop Kitchen feature: a bilingual display name and a reward icon for
one specific special-ingredient combination, stored as one entry in that
recipe's `variant_icon_rules` jsonb array (see
`docs/architecture/0_ARCHITECTURE.md` Shop Kitchen Rules 12-13).

This is a thin, focused layer on top of the **add-ingredient** skill, not a
replacement for it:

- **add-ingredient** creates/links the special ingredient(s) themselves
  (catalog row + `special_ingredient_slots`).
- **add-food-variation** (this skill) gives an *already-linked*
  special-ingredient combination its own display name and icon, so cooking
  that combination shows something like "肉粽 Pork Zongzi" instead of the
  recipe's plain name/icon.

The food must already exist, and every special ingredient in the variant's
match combination must already be linked to that recipe's
`special_ingredient_slots` before this skill's write step runs — this skill
never creates a food or links an ingredient itself.

**This skill only ever *connects to* the dev Supabase project**
(`.env.local`). The apply script never accepts a `--prod` flag and never
reads `.env.production.local`. On a successful apply, it additionally writes
a scoped SQL migration file (update the one recipe's `variant_icon_rules`
only) to `supabase/migrations/`, ready for this repo's normal
`db:push:prod` flow. Writing that file to disk is not the same as running
it — promoting to production is always a separate, explicit step the user
asks for (see "Promoting to production" below, same caveat as
add-ingredient).

## Hard rules

- The food must resolve to **exactly one** existing recipe. Zero or multiple
  matches is a stop, not a guess — list the candidates and ask.
- Every ingredient key in the variant's match combination must already
  appear in the recipe's `special_ingredient_slots` before the apply script
  will run — it throws a clear error naming exactly which key(s) are
  missing if not. Never invent a match against an ingredient that isn't
  actually linked.
- Never silently redefine an existing variant. If a rule with the exact same
  match combination already exists on this recipe, stop and tell the user
  what it currently shows (title/icon) — editing an existing variant is a
  Shop Admin UI action (`/words/shop-admin`), out of scope for this skill.
- The bilingual EN/ZH variant title is always drafted and shown to the user
  for approval before it's written — never invented silently and applied
  without a review checkpoint.
- Nothing is written to the database until the user has explicitly approved
  the SQL preview in Phase 5.

## Phase 1 — Resolve the food

Run:

```bash
node .claude/skills/add-food-variation/scripts/find-recipe.mjs "<food name as given>"
```

- Exactly one match in `matches` → note its `slug`, `title_i18n`,
  `special_ingredient_slots_i18n`, and `variant_icon_rules`.
- Zero matches → try a looser term, then if still zero, tell the user this
  food doesn't exist yet and stop (this skill doesn't create foods).
- More than one match → show the candidates' titles and slugs and ask which
  one.

## Phase 2 — Resolve the match combination

Ask the user which special ingredient(s) define this variant (usually one,
sometimes two — e.g. donut's `chocolate,sugar-sprinkles` combo).

For each named ingredient:

- Canonicalize it and check it against the recipe's
  `special_ingredient_slots_i18n.en` (from Phase 1's output) by
  `ingredientKey`.
- **Already linked to this recipe** → good, continue.
- **Not yet linked** (whether or not it exists elsewhere in the catalog) →
  it must be linked first. Invoke the **add-ingredient** skill for this
  ingredient against this same recipe with slot `special` (via the Skill
  tool, or by directly following its `SKILL.md` phases using
  `.claude/skills/add-ingredient/scripts/find-ingredient.ts` and
  `apply-ingredient.mjs` — same hard rules apply there: cost/quantity are
  always asked explicitly, a genuinely new ingredient gets its own icon
  review checkpoint). Only continue to Phase 3 of this skill once the link
  has actually been applied to dev (re-run this skill's `find-recipe.mjs`
  to confirm `special_ingredient_slots_i18n` now includes it).

Once every match ingredient is confirmed linked, compute the match signature
by sorting the keys (comma-joined) — this is exactly what the apply script
does internally too, so the preview in Phase 5 is the source of truth, not
this step.

## Phase 3 — Check for an existing variant at this match

Look at `variant_icon_rules` from Phase 1's `find-recipe.mjs` output. If any
rule's `match` array (order-independent) equals the resolved match
combination, **stop**: tell the user this exact combination already
resolves to `{titleI18n or recipe's own title}` via `{iconPath}`, and that
changing an existing variant is done in Shop Admin
(`/words/shop-admin`), not this skill.

## Phase 4 — Draft the variant title and the reward icon prompt

Draft `titleI18n.en` / `titleI18n.zh` — the bilingual name this exact
combination should display (e.g. "Pork Zongzi" / "肉粽"). Show it to the
user for approval/edits before moving on.

Read
[references/reward-art-style.md](references/reward-art-style.md) — it
documents the *actual* observed style of this game's existing reward icons
(grounded in inspecting real files: a different, opaque, vignette-background
style from ingredient icons — don't reuse the add-ingredient skill's art
style guide here). Pick (or ask the user for) a mood matching the existing
`<recipe>_<ingredient>_<mood>.png` convention, or no mood suffix if none
fits, matching the plain-icon convention.

The prompt text should refer to **"the attached reward icons"** generically
— never name specific sibling PNGs by filename. The user attaches their own
chosen reference images (from `public/rewards/`) to whatever design
agent/image tool they run the prompt through themselves.

Write the prompt to a staging file:

```
public/rewards/_staging/<recipe-slug>_<match-signature>.prompt.txt
```

Tell the user exactly this path, and that once they've generated the image
with it (any tool of their choice), they should save the result to:

```
public/rewards/_staging/<recipe-slug>_<match-signature>.png
```

**This skill only produces the prompt — it never generates the image
itself.** Wait for the user to say the file is ready before continuing (or,
if the user has already dropped a finished PNG directly into
`public/rewards/` under the final filename they want, skip straight to
validating that file in Phase 5 instead of staging a prompt).

## Phase 5 — Review checkpoint and DB-write preview

Once the staged (or directly placed) PNG exists, **assume it needs
background cleaning and a real PNG re-encode — always run this, don't
eyeball it first.** AI image tools routinely hand back a JPEG saved with a
`.png` extension, a baked-in checkerboard "transparency" texture, or a
real-but-wrong alpha channel, and this tool's own image preview does not
reliably composite alpha — a file can look fine here while being wrong on
disk:

```bash
node .claude/skills/add-food-variation/scripts/normalize-reward-icon.mjs <path-to-png>
```

This script is idempotent and self-verifying (see its own header comment):
an already-correct file is a no-op, a fixable one gets fixed and
re-verified against raw pixel alpha before it reports success, and a QC
failure (can't confidently separate subject from background) exits
non-zero and writes nothing — stop and ask the user for a different source
image rather than guessing past that.

The real convention here (**corrected** — this doc previously claimed the
opposite and was wrong even about the specific files it cited as evidence):
genuinely **transparent at the edges/corners** (`alpha = 0`), with a hard
cutout into an opaque, vignette-glow-colored blob behind the subject — not
a flat opaque background filling the whole canvas. See the reference doc's
corrected note for the full detail.

Also sanity-check dimensions (roughly square, ~1024x1024 is the observed
norm — flag anything wildly off, but don't block on it).

Show the user everything gathered so far: recipe, match ingredients,
`titleI18n.en`/`.zh`, and the staged PNG. Offer to edit any field or
regenerate the prompt before proceeding. Do not proceed until approved.

Then run the preview (dry run, no `--apply`):

```bash
npx tsx .claude/skills/add-food-variation/scripts/apply-variant.ts \
  --recipe-slug <slug> \
  --match <comma-separated-ingredient-keys> \
  --title-en "<titleI18n.en>" --title-zh "<titleI18n.zh>" \
  --icon-file <bare-filename>.png
```

`--icon-file` takes a **bare filename** (e.g. `zongzi_pork.png`), not a path
— the script prefixes `/rewards/` internally, for the same Git-Bash/MSYS
leading-slash rewriting reason the add-ingredient skill's script documents.

This prints the exact SQL it would run — one narrow `update ... where
slug = ...` touching only `variant_icon_rules`. It also re-validates (via
the real `src/lib/shopRewardIconAudit.ts` logic) that this match combination
doesn't already exist and that the icon path is well-formed, so a stale
Phase 1 read can't silently produce a bad write. Show this to the user
verbatim and get explicit go-ahead before continuing.

## Phase 6 — Apply

Only after explicit approval:

1. Move the PNG into place (if it was staged):

   ```bash
   mv public/rewards/_staging/<recipe-slug>_<match-signature>.png public/rewards/<icon-file>
   ```

2. Re-run the same `apply-variant.ts` command from Phase 5 with `--apply`
   appended. This updates `shop_recipes.variant_icon_rules` in **dev**. On
   success it also writes a scoped migration file to
   `supabase/migrations/<timestamp>_shop_add_<slug>_<match>_variant.sql`
   containing the same statement — written to disk only, never run.

3. Report back a short summary: PNG added, which recipe's `variant_icon_rules`
   now includes this combination in dev, and the path of the generated
   migration file.

## Promoting to production

The migration file from Phase 6 step 2 is deliberately **not** applied
automatically — promoting to production is a separate, explicit action the
user asks for.

Before suggesting `npm run db:push:prod`, be aware of what that migration
file actually contains: it appends to whatever dev's `variant_icon_rules`
array for that recipe was *at the time `apply-variant.ts` ran*, not to
production's current array. If dev and prod have diverged on that specific
recipe's variant rules (check with the user, or run `supabase migration
list` to compare — a Bash-tool attempt to query prod's tables directly may
get blocked by the auto-mode safety classifier, which is expected for
direct production database access; if so, either get the user's explicit
permission for that one read, ask the user to paste prod's current state
for that recipe, or proceed on the user's explicit instruction to skip the
check), running it will **overwrite** production's `variant_icon_rules` for
that recipe with dev's array plus the new rule — not merge with whatever
production actually has. The generated file's header comment says
explicitly whether this was verified (`--prod-verified` was passed) or not.

Once the user has reviewed the file and wants to proceed:

```bash
npm run db:push:prod:dry
npm run db:push:prod
```

Commit the migration file to git either before or after — it's a normal
checked-in file like any other migration in this repo. If Phase 2 also ran
the add-ingredient skill, its own migration file (linking the special
ingredient) must be promoted too, and should generally go out in the same
batch as this variant's migration — a variant rule referencing a
special-ingredient key that doesn't exist in prod yet is a latent bug
waiting for that ingredient's migration to land.

## Notes on the scripts

- `find-recipe.mjs` is a plain Node script (no build step) — run with
  `node`.
- `apply-variant.ts` imports the *real* `src/lib/shopIngredients.ts` (key
  canonicalization) and `src/lib/shopRewardIconAudit.ts` (match
  normalization, duplicate-check, icon-path validation — the same functions
  Shop Admin's own "add reward icon rule" UI action calls) rather than
  reimplementing that logic, so it can never drift from actual app
  behavior — run with `npx tsx`.
- Both scripts load `.env.local` only. If it's missing, they fall back to
  `process.env` and warn — they never read `.env.production.local`.
- `normalize-reward-icon.mjs` touches only the one image file it's pointed
  at — no database/env access at all. Plain Node script (`node`), shared
  verbatim with the add-food skill.
