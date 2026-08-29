# Ingredient icon art style

Derived by inspecting actual files in `public/ingredients/` (strawberry_base.png,
butter_base.png, milk_base.png, egg_base.png, sugar_base.png, flour_base.png,
chocolate.png) — don't re-derive this from scratch each run, and don't assume
a cleaner convention than what's actually there.

## What's consistent across the set

- **1024x1024 px**, RGBA.
- **Cute/kawaii illustrated style**: soft painterly shading, thick warm
  brown/tan outlines, rounded shapes, pastel palette.
- **The ingredient is shown *contained*, not as bare clip-art**: a basket of
  strawberries (with a bow and daisies), a wrapped butter package with a
  label, a sugar jar with a gingham lid and a "SUGAR" wordmark, a flour sack
  with a wheat-sprig emblem, a milk carton/jar with a cow-face label. Pick a
  vessel appropriate to the new ingredient (jar, sack, basket, wrapped
  package, carton, tin) rather than drawing the raw item floating alone.
- Centered, single subject, roughly square bounding box within the canvas
  (some padding on all sides).

## What's genuinely inconsistent (don't blindly copy)

- **Background is not standardized.** Most icons (strawberry, butter, sugar,
  flour) sit on a **plain flat white square background**. A minority (milk,
  egg, chocolate) instead have a **dark radial-vignette background** baked
  into the pixels. Neither is real alpha transparency — both are opaque
  pixels — despite the files being RGBA.
- Because the vignette variant looks like a dark square badge when placed
  next to the white-background icons in the UI, treat it as legacy
  inconsistency, not a style to replicate.

## Default for new ingredients (use unless the user says otherwise)

- **Transparent background** — a deliberate improvement over the legacy set,
  not a continuation of it: none of the existing icons actually have real
  alpha transparency (see above), but new ones should, since it composites
  correctly wherever the icon is placed instead of carrying a baked-in white
  or dark square.
- 1024x1024, single centered subject, same cute/kawaii/painterly treatment,
  contained in a fitting vessel, thick warm outline, soft shading.

## Prompt template

The user attaches their own reference PNGs (picked from `public/ingredients/`)
to whatever design agent/image tool they run the prompt through — so the
prompt text itself should refer to **"the attached ingredient icons"**
generically, never name specific sibling files by filename. Naming files in
the prompt text only makes sense if the tool receiving it can't take
attachments at all; the current assumption is that it can, so don't do that
by default.

> A cute kawaii-style illustration of [ingredient] in [a fitting container —
> jar / sack / basket / wrapped package], in the same soft painterly style as
> the attached ingredient icons: warm pastel colors, thick rounded brown
> outlines, soft gradient shading, small decorative details
> (ribbon/emblem/label) appropriate to the ingredient, centered single
> subject, transparent background, 1024x1024.
