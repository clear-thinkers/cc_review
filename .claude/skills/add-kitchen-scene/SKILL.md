---
name: add-kitchen-scene
description: Give an existing cookable Shop Kitchen food its own interactive cooking scene. Phase A drafts the image prompt for the owner's designer agent (numbered reference images plus a prompt in the house format) and builds the reference pack; Phase B takes the finished artwork, measures its tap targets, drag-in ingredient spots and chef box, and wires it into RECIPE_KITCHEN_SCENES with a test, so the prep step and Chef Shrewy's quiz work on that recipe. Use when the user asks for a kitchen scene, cooking scene or scene prompt for a food, or drops finished scene art into staging. Not for creating a food (add-food) or its icons.
tools: Bash, Read, Edit, Write, Glob, Grep
---

# Add Kitchen Scene

A **recipe scene** replaces the Shop Kitchen's default room while that recipe
is selected (`0_ARCHITECTURE.md`, Shop Kitchen Rule 21). An **interactive** one
(an entry with `effects`) adds the drag-the-ingredients-into-the-pot prep step,
the boil and the dish reveal. It is also one of the two things Chef Shrewy's
quiz needs. The paw marker and the challenge appear only when the recipe has an
interactive scene **and** at least one active question
(`recipeOffersChefChallenge`, `kitchen.types.ts`).

The art can't be generated here. The owner's designer agent makes it. So
this skill runs in two phases, possibly days apart:

- **Phase A, prompt:** reference pack plus prompt for the designer.
- **Phase B, wire-up:** when the art comes back, measure it and add the scene.

Database access is **read-only and dev-only** (`scene-pack.ts` reads
`.env.local`). Wiring a scene is app code only. No migration, no DB write. It
reaches prod with the regular deploy.

## Phase 0: what's missing

```bash
npx tsx .claude/skills/add-kitchen-scene/scripts/scene-pack.ts --list
```

Every cookable recipe with its scene status (`none` / `plain` /
`interactive`) and its active-question count. A recipe with **0 questions**
gets the prep step from a scene but **no quiz**. Say so when you report, since
the user may expect one. (Questions are added in Shop Admin or with
`npm run seed:chef-challenge-questions`, see the chef-challenge memory.) A
`plain` scene (no `effects`) can be upgraded to interactive from its existing
art in Phase B, if the art has a clear vessel and a painted chef.

## Phase A: draft the designer prompt

1. **Build the pack** for one or more recipes (or `--all-missing`):

   ```bash
   npx tsx .claude/skills/add-kitchen-scene/scripts/scene-pack.ts <slug> [<slug> ...]
   ```

   It writes to `public/kitchen/staging/<slug>/` (gitignored):
   - `refs/NN-<name>.*`: the reference images, numbered in the exact order
     the prompt lists them. The user attaches them in that order.
   - `contact-sheet.png`: the dish plus its ingredients, labelled.

   It also prints a JSON manifest: titles, cook method, base ingredients in
   recipe order, the reference list.

2. **View every contact sheet** (stack several into one image to save reads)
   and describe each item from what it actually looks like: container,
   colours, details. Don't describe from the name. Note any lettering on an
   icon (YEAST, SUGAR, BROTH …). The prompt already bans text, and the
   template's Technical block says to leave labels blank.

3. **Decide per recipe**, following
   [references/scene-prompt-template.md](references/scene-prompt-template.md):
   - the vessel (`pot` / `pan` / `bowl`) and where it is;
   - the star (stove vs. oven) and what's cooking in it;
   - Shrewy's action at the island (never in front of the stove or oven);
   - a spot for each ingredient (spots A–F, never on a tap target);
   - the finished dish beside the recipe book;
   - a one-line mood.

4. **Write the prompt** to `content/kitchen-scenes/prompts/<slug>.md`, with
   the front matter from the template, then the prompt exactly as the
   designer should receive it. Use the template's standard blocks word for
   word. The checked-in file is the record of what art was asked for, and
   Phase B reads its `vessel` and `ingredient_order`.

5. **Hand over:** the prompt file path, plus the `refs/` folder to attach in
   order. Tell the user to drop the finished image in
   `public/kitchen/staging/<slug>/` (any filename, PNG or JPG). Show the
   prompt text for review if they ask, or when it's a single recipe.

## Phase B: wire up the finished art

1. **Find the art:** a new image in `public/kitchen/staging/<slug>/` (not in
   `refs/`), or wherever the user says, e.g. `public/rewards/staging/`. Look at
   it before anything else.

2. **Check it against the prompt** before measuring:
   - fridge, recipe book, stove, oven and right-hand shelf are visible and
     not covered;
   - the vessel is clear and not hidden;
   - each base ingredient is visible and separate;
   - Shrewy is drawn (`showChef: false` relies on it).

   If something important is wrong (the vessel is missing, an ingredient is
   missing, Shrewy is hiding the stove), tell the user and offer one fix line
   to add to the prompt for a re-roll. Don't silently work around it. Minor
   misses (the dish isn't beside the book, an extra prop) are fine.

3. **Place it** at `public/kitchen/kitchen_<slug>.<ext>`, keeping its format.
   The scene is a full rectangular painting, not a cutout, so don't run the
   add-food transparency normalizer on it. Note its pixel size with
   `sharp(...).metadata()`; it becomes `aspectRatio: "<W> / <H>"`. Designer
   output sizes vary (1600×1391, 1376×768 and 1024×1024 all ship), and every
   size works because all positions are percentages.

4. **Measure** with the grid:

   ```bash
   node .claude/skills/add-kitchen-scene/scripts/grid.mjs public/kitchen/kitchen_<slug>.<ext> <scratch>/grid.png
   node .claude/skills/add-kitchen-scene/scripts/grid.mjs public/kitchen/kitchen_<slug>.<ext> <scratch>/zoom.png --zoom <l>,<t>,<w>,<h>
   ```

   The first command draws lines every 5%. The `--zoom` version draws lines
   every 1% on a 3× enlargement; use it for anywhere tight. All values are
   percentages of the image: `left`/`width` of its width, `top`/`height` of
   its height.

5. **Write the entry** in `RECIPE_KITCHEN_SCENES`
   (`src/app/words/shop/kitchen/kitchen.types.ts`), modelled on the existing
   interactive entries:
   - `imagePath`, `aspectRatio`, `showChef: false`.
   - `hotspots`: fridge, book, stovetop, oven, shelf. Each box covers the
     visible appliance. Where Shrewy or a prop overlaps one, cover only what
     shows and add a comment.
   - `effects.pot` plus `vessel`: a box around the vessel from the prompt's
     front matter. A comment says what it really is, e.g. `// A stove brew,
     so the "pot" is the copper kettle on the burner.`
   - `effects.sparkles`: about 5 points over the existing painted sparkles
     and steam.
   - `effects.ingredientOrigins`: one per base ingredient **in recipe
     order** (`ingredient_order`), each centred on its painted prop, each
     with a `// what it is` comment, and a heading comment listing the
     order. A token is a circle **8% of the image's width** across, centred
     on the origin, so keep origins at least ~8.5% of the width apart. Origins
     cycle for chosen special ingredients, which is fine.
   - `effects.chef`: a tap box on Shrewy's body. It must **not overlap any
     hotspot box** (a test enforces this), so shrink it to the body if
     needed. `bubbleAlign` / `bubbleBesideOnWide` (`"left"` or `"right"`):
     the bubble is 176px wide and sits above the chef (or beside, on wide
     screens). Pick the side where it covers neither the vessel nor any
     token, and add a comment saying why.

6. **Verify visually:**

   ```bash
   npx tsx .claude/skills/add-kitchen-scene/scripts/overlay.ts <slug> <scratch>/overlay.png
   ```

   View it. Every box sits on its object, every token sits on its prop with
   none overlapping, and the chef box sits on Shrewy. Nudge and re-render
   until it's right.

7. **Test and document:**
   - Add a test in `kitchen.test.ts` next to the other recipe-scene tests
     (image path, `showChef` false, `vessel`, token count = base-ingredient
     count).
   - Run `npx vitest run src/app/words/shop/kitchen` and `npx tsc --noEmit -p .`.
   - Append the recipe to the "Current entries" list in `0_ARCHITECTURE.md`
     Shop Kitchen Rule 21: `` `<slug>` (interactive, stove|oven, <vessel>; added <date>) ``.
     If you extended the vessel type, update that rule's vessel sentence too.

8. **Report:**
   - what was added;
   - any art issue you worked around;
   - whether the quiz will show (active-question count from Phase 0);
   - that it ships with the regular deploy, no DB step.

   Commit and push only when the user asks (this repo ships by pushing
   `main`). The staged art stays in gitignored `staging/`.
