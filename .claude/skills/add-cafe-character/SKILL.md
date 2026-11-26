---
name: add-cafe-character
description: Add a new character (visitor) to the Café, like Li Bai. Phase A drafts the designer-agent prompt (art formats, reference images) and the character's spec (bilingual name, token, speech lines, orders, token content such as poems); Phase B cleans up the delivered art (removes painted-in checkerboards or green screens, matches the two poses' scale and feet, fits the token) and previews it in the café; Phase C seeds the character on dev with a generated, idempotent SQL file, and on prod only when the owner asks. Use when the user asks to add, design or set up a new Café character or visitor, write a character's design prompt, process a character's art, or seed a character. Not for editing an existing character (that's Shop Admin → Café Characters) or for app code changes to the Café.
tools: Bash, Read, Edit, Write, Glob, Grep
---

# Add Café Character

A **Café character** visits the Café one at a time, orders a mix of dishes from the child's shelf
and pays in their own **token** (`0_ARCHITECTURE.md`, Café Rules; spec
`docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md`). Tokens can carry
content (Li Bai's 诗笺 each carry one of his poems) and are spent on the Rewards page.

A character is **data, not code**: one `shop_characters` row, its orders and items, its token
content, plus three images in `public/characters/<key>/`. No migration and no app change.
**Li Bai is the worked example for every step:**
- [content/characters/li-bai.md](../../../content/characters/li-bai.md): the designer prompt;
- [content/characters/li-bai.json](../../../content/characters/li-bai.json): the spec;
- [supabase/manual/2026-11-25-seed-cafe-li-bai.sql](../../../supabase/manual/2026-11-25-seed-cafe-li-bai.sql): the hand-written seed the generator reproduces.

The art comes from the owner's designer agent, so this runs in phases, possibly days apart.

## Phase 0: what exists

```bash
npx supabase db query --linked "select character_key, name_i18n->>'zh' zh, is_active, visits_cafe, visit_frequency, visit_limit, (select count(*) from shop_character_orders o where o.character_key = c.character_key) orders from shop_characters c order by display_order"
npx supabase db query --linked "select slug, title_i18n->>'zh' zh, cook_method, is_mystery from shop_recipes where is_active and cook_method is not null order by display_order"
```

(Dev, read-only.) The second list is every dish a character can order. A **mystery** food is
cookable only after the child has unlocked it with win-session rewards, so an order made only
of mystery foods may rarely be fillable. Mention that when suggesting orders.

## Phase A: the designer prompt and the spec

1. **Agree the basics with the user:** who the character is, their **key** (lowercase, digits,
   dashes, e.g. `chang-e`; it can never change), their token (name and motif), and the theme.
   Prefer figures and stories with real cultural content for a Chinese-learning game, kept
   child-friendly.
2. **Write the prompt** to `content/characters/<key>.md` following
   [references/designer-prompt-template.md](references/designer-prompt-template.md). Use its
   reference-image list and Technical block word for word. Below the prompt, add a
   `## Copy for Shop Admin (not for the design agent)` section the owner can read (as in
   `li-bai.md`).
3. **Write the spec** to `content/characters/<key>.json`, shaped like `li-bai.json`:
   - `name`, `intro`, `tokenName`: `{ en, zh }`. Intro is one short line.
   - `lines.order` (3), `lines.served` (3), `lines.dismissed` (2): `{ en, zh }`, about
     **24 Chinese / 60 English characters** at most (the bubble fits ~13 Chinese per line). Warm,
     never scolding; served lines thank the child; dismissed lines say "another time".
   - `orders`: each `{ tokenPrice: 1–50, items: [{ recipe: <slug>, quantity: 1–9 }] }`, each
     recipe once per order. Pick dishes that fit the character (Li Bai and the moon → mooncakes).
     Calibration so far: ~1 token per dish, mixed or mystery orders a little more.
     **Pin a kind** with `specialIngredients` when any variant won't do (Café Rule 4): `[]` =
     plain, `["red-bean"]` = 红豆包; leave it out for any kind. Check Phase 0's recipes'
     `variant_icon_rules` / `special_ingredient_slots` for the keys. A diet (唐僧 is vegetarian)
     needs every dish with a meat variant pinned. Worked example: `content/characters/tang-seng.json`.
   - `tokenContents` (optional): `{ title ≤ 60, body ≤ 600 }`. **Real, accurate text only**:
     quote poems or sayings exactly as commonly taught, and leave out anything about alcohol.
     If unsure of a text, say so rather than guess.
   - `visitFrequency` / `visitLimit`: default `"unlimited"` / `null`; or `daily` / `weekly` /
     `monthly` with 1–100, or `random_days` with 1–31 (Café Rule 9).
   - `art` is optional; by default the paths are `/characters/<key>/<key>_{token,waiting,delighted}.png`.
4. **Check the spec now** (it validates without writing anything you need to keep):
   `node .claude/skills/add-cafe-character/scripts/build-seed.mjs content/characters/<key>.json`
   Fix every error; read the warnings (long lines). Delete the SQL it wrote if you're not seeding yet.
5. **Hand over:** the prompt file and the reference images to attach in order. Ask the user to
   drop the finished files in `public/characters/<key>/_staging/` (git-ignored; any names, PNG or
   JPG). Show the owner the copy, poems and orders for approval: they're the owner's call.

## Phase B: process the art

1. **Look at every delivered file** (Read each image) before running anything:
   - Does it match the brief (style, chibi proportions like Shrewy and Li Bai, props, colours)?
   - Nothing disallowed (alcohol, weapons, anything scary)? Text on it? (Ask the owner.)
   - Is the character **isolated**, or painted into a scene? A scene can't be cut out cleanly:
     ask for an isolated redraw and attach the draft as the approved design.
   - Background: real transparency, a painted grey/white checkerboard (common), or green screen.
2. **Cut out and normalize:**

   ```bash
   node .claude/skills/add-cafe-character/scripts/cutout.mjs poses <key> <waitingSrc> <delightedSrc> [--chroma 10,10] [--bg auto|checker|green]
   node .claude/skills/add-cafe-character/scripts/cutout.mjs token <key> <tokenSrc> [--chroma 10]
   ```

   Writes `<key>_waiting.png` / `<key>_delighted.png` (960 × 1080, same height, feet aligned)
   and `<key>_token.png` (512 × 512) to `public/characters/<key>/`.
3. **Preview** and look at both images:

   ```bash
   node .claude/skills/add-cafe-character/scripts/preview.mjs <key>
   ```

   - `_staging/preview-edges.png`: on the **dark** tiles, look for a light speckled rim (raise
     `--chroma` for that pose) or bites out of white clothes or paper (lower it). Li Bai needed
     6 for one pose and 10 for the other; `--chroma 6,10` sets them separately. Zoom into a crop
     if unsure. The token must read in grey (spent) and at 28 px.
   - `_staging/preview-cafe.png`: the character at the door, counter (waiting) and table
     (delighted). Check size against the room and that nothing looks cut off.
   If `cutout.mjs` notes the fit dropped below 0.85, a wide delighted pose shrank both sprites:
   suggest a narrower pose if it looks small.
4. Keep the sources in `_staging/` (git-ignored) and show the owner the previews.

## Phase C: seed it

1. **Build the seed** (date = today):

   ```bash
   node .claude/skills/add-cafe-character/scripts/build-seed.mjs content/characters/<key>.json
   ```

   It writes `supabase/manual/<date>-seed-cafe-<key>.sql`: one transaction that inserts the
   character (does nothing if the key exists), adds the orders only if it has none (and fails
   the whole run if a recipe slug is missing, inactive or not cookable), and adds each token
   content whose title is new. It never overwrites Shop Admin edits, so it's safe to re-run.
2. **Dev:** `npx supabase db query --linked -f supabase/manual/<date>-seed-cafe-<key>.sql`
   (the linked Management API takes the whole multi-statement file). Read it back:

   ```bash
   npx supabase db query --linked "select c.character_key, c.is_active, c.visits_cafe, jsonb_array_length(c.lines_i18n->'order') order_lines, (select count(*) from shop_character_orders o where o.character_key = c.character_key) orders, (select count(*) from shop_character_token_contents t where t.character_key = c.character_key) contents from shop_characters c where c.character_key = '<key>'"
   ```

   Then ask the owner to test in `npm run dev` → Café (serve an order) and Rewards (tap a token).
3. **Prod: only when the owner asks, and only after the art is deployed.** The images ship with
   the code, so commit and push `public/characters/<key>/*.png` (not `_staging`), the `.md`, the
   `.json` and the seed file first, when the owner asks for a commit. Then:

   ```bash
   node .claude/skills/add-cafe-character/scripts/run-prod-sql.mjs supabase/manual/<date>-seed-cafe-<key>.sql
   ```

   It uses `psql` (`supabase db query --db-url` rejects multi-statement files with "cannot
   insert multiple commands into a prepared statement") with `ON_ERROR_STOP`, so a failure
   applies nothing. Read back on prod the same way before reporting success.

## Rules

- Never generate or draw art here; the designer agent makes it.
- Never write to prod without the owner asking for that specific step.
- A character's key, once seeded, never changes (it's the tokens' giver key).
- Characters are shared content (every family sees them); wishlist rewards are per family and
  aren't part of this skill.
- No docs update is needed for a new character (no code or schema changes). Record the
  character in the Café memory note if it's the first of a new kind.
