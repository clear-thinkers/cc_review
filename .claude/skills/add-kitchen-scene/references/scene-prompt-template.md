# Kitchen-scene prompt template

Every prompt goes to the owner's designer agent (an image model with
reference-image input). It is written **for that agent**: plain, concrete,
visual instructions, numbered reference images, nothing about code.

The canonical example is the owner's own Golden Mooncake prompt, kept verbatim
at the bottom. Match its structure, tone and level of detail.

## Structure (always in this order)

1. **Title line:** `<English title> kitchen scene`
2. **Reference images (in attached order):** numbered exactly as
   `scene-pack.ts` numbered the files in `refs/`:
   1. Empty kitchen (`kitchen_empty.png`)
   2. Shrewy (`chef_idle.png`)
   3. The finished dish (the recipe's plain reward icon)
   4. … one per **base ingredient, in recipe order**
   5. Last: the Crystal Pear Dew scene (the finished example)

   One line each: **Name.** what it is, then the details the artist must
   match, described from the actual image (view the contact sheet). Don't
   describe it from the name alone.
3. **Prompt:** with the blocks below, in this order:
   style → Room → Shrewy → the star → the other appliance → Ingredients →
   Finished dish → Mood → Technical.

## Standard blocks: reuse word for word unless the recipe needs otherwise

**Style (opening paragraph):**
> Paint the kitchen from image 1 in the same soft, hand-painted isometric
> storybook style as image N. Use the same warm cream and butter-yellow
> palette, sage-green accents, gentle brown linework and twinkling sparkles.
> Today the kitchen is making <Title> (<中文>).

**Room:**
> Room: keep everything from image 1 in the same place and at the same size.
> That means the smiling green fridge, the ladder, the cabinets, the smiling
> yellow stove and oven, the recipe book on its stand, the window and sink,
> the rug, the island with its green towel, and the tall shelf on the right.
> Fill the right-hand shelf the same way image N does: bubble tea, a cake
> slice, flan and a ramen bowl.

**Shrewy:** always include both sentences below, then the action:
> Shrewy (image 2): standing on a small wooden stool at the island, back
> half-turned to us, in the same spot and pose as in image N. Keep Shrewy at
> the island, never in front of the stove or oven, and don't let them hide
> any appliance or ingredient.

*Why:* the Popcorn Chicken art put Shrewy on a stool in front of the stove,
which left only slivers of the stove and oven to tap. The scene still works,
but it's cramped.

**Technical:**
> Technical:
> - Same framing and aspect ratio as image N: 1600 × 1391 px, about 8:7.
> - Plain cream background outside the room cutaway.
> - No text, labels or watermark anywhere, including on jars, bottles and
>   packets (leave their labels blank).
> - Don't move or resize the fridge, recipe book, stove, oven or right-hand
>   shelf, because the game puts tap targets over them.

## Recipe-specific decisions

**The vessel (the drop target).** In the game the child drags each ingredient
into ONE painted vessel, so the prompt must make it big, clear and unblocked.
Pick one and describe it in detail:

- `pot`: a pot, saucepan, kettle or steamer **on the front stovetop burner**.
  The default for stove recipes.
- `pan`: a frying pan on the stovetop, for things that are fried.
- `bowl`: a large mixing bowl **on the island in front of Shrewy**. The
  default for oven recipes, and for stove recipes where the work is clearly
  mixing or shaping by hand (dough, filling, shaping rice).

Record the choice in the prompt file's front matter (`vessel:`). The wiring
step uses it. If none of the three fits, `pot | bowl | pan` can be extended
(type in `kitchen.types.ts`, `prepVessel*` strings in `kitchen.strings.ts`,
the label pick in `KitchenSection.tsx`). Popcorn Chicken added `pan` that way.

**The star.** Stove recipes: the vessel on the stove steams and glows, with
sparkles. Oven recipes: the oven window glows warm gold with the food baking
inside, plus sparkles and a wisp of steam from the door ("Keep the oven's
smiling face"). The other appliance gets one short line ("Stovetop: no soup
pot. Leave it clear or put a small, simple kettle on it." / "Oven: closed,
just its smiling face.").

**Ingredients.** One line per ingredient, each in its own spot, so no two sit
close together (the game draws a round token on each one, about 8% of the
image's width). Use these spots, in this order of preference:

| Spot | Where |
|---|---|
| A | on the island near the front-left corner |
| B | on the island's front corner, near Shrewy |
| C | on the back counter, left of the sink |
| D | on the back counter, right of the sink |
| E | on the island's middle, between A and Shrewy |
| F | on the small counter between the stove and the ladder |

Never on the fridge, recipe book, stove, oven or right-hand shelf (those are
tap targets), and never in the vessel itself. Close with: "Draw each one to
match its reference, small and in scale with the room."

**Finished dish.** Always: one serving from image 3 on a small plate (or in its
own cup/bowl) on the counter beside the recipe book, with a few sparkles
around it.

**Mood.** One or two sentences fitting the dish: a festival it belongs to, a
time of day or a feeling. Always add: "It's still the same bright daytime
room." An optional subtle extra touch (a lantern, a paper cutting) is fine if
it stays small and away from the tap targets.

**Front matter** (top of each saved prompt file, for the wiring step):

```yaml
---
slug: <slug>
cook_method: stove | oven
vessel: pot | bowl | pan
vessel_description: <one line: what and where the vessel is>
ingredient_order: [<key>, <key>, ...]   # base ingredients, recipe order
---
```

## Canonical example (the owner's own, verbatim)

> Golden Mooncake kitchen scene
>
> Reference images (in attached order):
>
> Empty kitchen. The base room. Keep its layout, camera angle and proportions exactly.
> Shrewy. The chef character, a chubby grey tabby cat in a white chef hat and dark apron. Keep the look on model.
> Golden Mooncake. The finished dish. Match its golden crust, pressed flower pattern and glowing molten golden filling.
> Moonlit Lotus Paste. A celadon bowl of creamy white paste with a wooden spoon.
> Osmanthus Honey. A hexagonal glass jar of amber honey with a cloth-tied lid and a tag.
> Gilded Salted Yolk. A glowing golden-orange yolk resting in a little woven nest.
> Frosted Pastry Flour. A mound of sparkly white flour on a green lotus-shaped dish with a scoop.
> Crystal Pear Dew scene. The finished example of this kind of image. Follow how it adds food props, sparkles, steam and Shrewy cooking at the island to the empty room. This new image is the same idea for a different recipe.
>
> Prompt:
> Paint the kitchen from image 1 in the same soft, hand-painted isometric storybook style as image 8. Use the same warm cream and butter-yellow palette, sage-green accents, gentle brown linework and twinkling sparkles. Today the kitchen is making Golden Mooncakes (金箔流心月饼).
>
> Room: keep everything from image 1 in the same place and at the same size. That means the smiling green fridge, the ladder, the cabinets, the smiling yellow stove and oven, the recipe book on its stand, the window and sink, the rug, the island with its green towel, and the tall shelf on the right. Fill the right-hand shelf the same way image 8 does: bubble tea, a cake slice, flan and a ramen bowl.
> Shrewy (image 2): standing on a small wooden stool at the island, back half-turned to us, in the same spot and pose as in image 8. They hold a wooden spoon over a large celadon mixing bowl of soft golden dough. A carved wooden mooncake mold sits beside the bowl, with a light dusting of flour on the counter.
> The oven is the star. Its window glows warm gold, with a tray of round mooncakes from image 3 baking inside. Golden sparkles and a soft wisp of warm steam rise from the oven door. Keep the oven's smiling face.
> Stovetop: no soup pot. Leave it clear or put a small, simple kettle on it.
> Ingredients: place the four ingredients from images 4–7 so each one stands clearly apart from the others and is easy to pick out:
> Lotus paste (4) on the island near the front-left corner.
> Frosted flour (7) on the island's front corner, near Shrewy.
> Salted yolk in its nest (6) on the back counter, left of the sink.
> Honey jar (5) on the back counter, right of the sink.
> Draw each one to match its reference, small and in scale with the room.
> Finished mooncake: put one mooncake from image 3, cut open with golden filling flowing, on a small celadon plate on the counter beside the recipe book, with a few sparkles around it.
> Mood: warm, magical and festive, like Mid-Autumn. It's still the same bright daytime room, and the golden glow comes from the food. An optional subtle touch: one small round paper lantern hanging near the window.
> Technical:
>
> Same framing and aspect ratio as image 8: 1600 × 1391 px, about 8:7.
> Plain cream background outside the room cutaway.
> No text, labels or watermark.
> Don't move or resize the fridge, recipe book, stove, oven or right-hand shelf, because the game puts tap targets over them.
