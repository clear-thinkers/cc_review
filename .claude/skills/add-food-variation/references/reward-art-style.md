# Reward (dish) icon art style

Derived by inspecting actual files in `public/rewards/` (bun_pork_excited.png,
zongzi_plain.png, donut_cinnamon_happy.png) -- don't re-derive this from
scratch each run, and don't assume a cleaner convention than what's actually
there. This is a **different asset family from ingredient icons**
(`public/ingredients/`, see the add-ingredient skill's own
`references/art-style.md`) -- don't reuse that style guide here, the two
look deliberately different.

## What's consistent across the set

**Corrected 2026-08-31**, after this claim caused a real defect (a food
created by the add-food skill was flattened to a hard-edged opaque square,
visibly boxed against the app's card background, then had to be reverted):
verify against `sharp(...).metadata()` / raw pixel alpha, not just this
doc, before trusting any claim below about transparency. This section
previously asserted these files are NOT transparent -- that was checked
against the wrong evidence (or the files changed since) and was simply
wrong for every file re-inspected, **including the exact three files this
doc originally cited as its source** (`bun_pork_excited.png`,
`zongzi_pork.png`, `donut_cinnamon_happy.png` all have `hasAlpha: true`
with `alpha = 0` at every corner).

- Roughly **1024x1024 px** (square), RGBA, **genuinely transparent** at the
  canvas edges/corners (`alpha = 0`) -- same as ingredient icons in that
  respect. The transition from transparent to opaque is a hard cutout (a
  couple pixels of antialiasing, not a soft alpha ramp) into a large,
  roughly circular/organic **opaque blob** (`alpha = 255`) that contains
  both the subject and its glow -- so most of the canvas ends up opaque,
  but the actual corners and a meaningful margin around them do not.
- **Cute/kawaii chibi food-character style**: the dish itself has a simple
  face (two round dot eyes with a small white highlight, a small simple
  mouth, soft blush circles on the cheeks) painted directly onto the food,
  not a separate character next to the food.
- **Soft radial-glow vignette, painted as an RGB gradient inside the opaque
  blob** (not an alpha effect): a warm/colored glow emanating from behind
  the subject, fading toward the blob's own edge -- gives the icon a
  "spotlight" feel appropriate for a reward, then that opaque region simply
  ends (real transparency beyond it), rather than the glow itself fading
  into transparency. The glow color tends to echo the dish's own palette
  (warm gold behind a bun, soft green behind a zongzi).
- **Soft drop shadow / glow ellipse beneath the subject**, reinforcing it
  sitting in the spotlight rather than floating on a flat color field.
- Thick, warm, rounded outlines and soft painterly shading -- same painterly
  family as ingredient icons, but applied to a food-with-a-face rather than
  a food-in-a-container.
- Centered, single subject, filling most of the frame.

## The "mood" naming convention

Named variant files follow `<recipe-slug>_<ingredient-key(s)>_<mood>.png`
(e.g. `donut_cinnamon_happy.png`, `bubble-tea_matcha_sleep.png`,
`ramen_shrimp_calm.png`) -- observed moods include `happy`, `excited`,
`sleep`, `wink`, `calm`, `ambitious`. This is a **filename convention only**,
not a stored field -- the mood is expressed purely through the character's
face/expression in the art itself, matched loosely to the ingredient's
"personality" (e.g. spicy/energetic ingredients skew `excited`/`ambitious`,
mellow ones skew `sleep`/`calm`). The **plain/fallback** rule for a recipe
(`match: []`) always uses `<recipe-slug>_plain.png` with no mood suffix and
a neutral/content expression.

Picking a mood is a judgment call, not a strict rule -- ask the user if they
have a preference, otherwise pick whichever observed mood best fits the
ingredient's character, or fall back to no mood suffix (matching the plain
convention) if none fits well.

## Default for a new named variant (use unless the user says otherwise)

- 1024x1024, single centered dish-with-a-face subject, thick warm outline,
  soft painterly shading.
- **Transparent canvas (`alpha = 0`) at the edges/corners**, with an opaque,
  vignette-shaped blob behind the subject carrying a soft radial-glow RGB
  gradient — see the corrected note above. Not a flat opaque full-canvas
  background.
- A simple kawaii face (dot eyes + highlight, small mouth, blush) expressing
  the chosen mood, painted onto the dish itself.
- Visually incorporate the special ingredient that defines this variant
  (e.g. visible pork filling peeking from a bun, a sprinkle of cinnamon
  swirl) so the variant reads as distinct from the recipe's plain icon at a
  glance.

## Prompt template

The user attaches their own reference PNGs (picked from `public/rewards/`)
to whatever design agent/image tool they run the prompt through -- so the
prompt text itself should refer to **"the attached reward icons"**
generically, never name specific sibling files by filename.

> A cute kawaii-style illustration of [dish], personified with a simple
> happy face (round dot eyes with a small highlight, a small smile, soft
> blush cheeks) painted onto the food itself, visibly featuring [special
> ingredient] as part of the dish, in the same soft painterly style as the
> attached reward icons: warm thick rounded outlines, soft gradient shading,
> centered single subject filling the frame, soft radial-glow vignette
> background in a color that complements the dish, soft glow/shadow beneath
> the subject, 1024x1024, transparent PNG canvas with a soft-edged opaque
> vignette glow behind the subject (not a flat opaque background filling
> the whole frame).
