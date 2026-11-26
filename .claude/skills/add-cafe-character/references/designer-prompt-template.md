# Café character designer prompt template

The prompt goes to the owner's designer agent (an image model with reference-image input).
Write it **for that agent**: plain, concrete, visual instructions, numbered reference images,
nothing about code. The canonical example is [content/characters/li-bai.md](../../../../content/characters/li-bai.md):
match its structure, tone and level of detail.

## Front matter

```yaml
---
character_key: <key>
deliverables:
  - public/characters/<key>/<key>_waiting.png     # 960 x 1080, transparent
  - public/characters/<key>/<key>_delighted.png   # 960 x 1080, transparent
  - public/characters/<key>/<key>_token.png       # 512 x 512, transparent
reference_images:
  - public/shop/shop.png
  - public/kitchen/chef_idle.png
  - public/paw-prints/shrewy_paw.png
  - public/characters/li-bai/li-bai_waiting.png
---
```

## Reference images (always these, in this order)

1. **Café.** "The room they visit. A soft, hand-painted isometric storybook café in warm cream and
   butter-yellow, with sage-green accents (the door, the register, the towel), honey-coloured wood
   and gentle brown linework. Match this style and palette exactly."
2. **Shrewy.** "The game's chef, a chubby grey tabby cat in a white chef hat and a sage-green apron.
   Match his proportions and finish: a big round head about a third of his height, a small soft
   body, rosy cheeks, clean soft outlines, gentle shading, no harsh shadows."
3. **Shrewy's paw stamp.** "Another character's token. A round sage-green badge with a cream paw, a
   chef hat and small sparkles. <Name>'s token should feel like a matching set: the same round
   badge shape and finish, in their own colours and motif."
4. **Li Bai** (an approved visitor). "Another visitor to the same café. Match his size, chibi
   proportions, line weight and finish, so the two look like they belong to one game."

## Prompt blocks (in this order)

1. **Opening:** who they are, "as a visitor to the café in image 1", same style as images 1, 2 and 4.
   Always include: *"They're an original cute character for a children's Chinese-learning game.
   Don't model them on any existing video game's characters or art style."*
2. **The character:** chibi proportions (image 2), clothing and colours, one or two props that say
   who they are, and a theme motif (Li Bai: the moon). Describe from real history or the story
   they come from, kept child-friendly.
3. **Not allowed:** no alcohol or anything to drink from (cups, jugs, gourds), no weapons, nothing
   scary. Add anything specific to this character (Li Bai's poems are famous for wine; the prompt
   ruled it out by name).
4. **Three images:**
   - **Waiting** (`<key>_waiting.png`): standing politely, three-quarter view turned slightly to
     the left, holding a prop, a small hopeful smile, as if about to order. Full body.
   - **Delighted** (`<key>_delighted.png`): same character, same size and spot on the canvas,
     thrilled with the meal, a few golden sparkles. Keep raised arms and props **close to the
     body**: a wide pose (Li Bai's unrolled scroll) makes both sprites smaller in the game.
   - **Token** (`<key>_token.png`): the payment, as a round badge matching image 3, in the
     character's colours with one simple motif. Big, bold shapes.
5. **Technical** (copy word for word, changing only names):

   > - **Waiting and Delighted:** 960 × 1080 px PNG with a real transparent background (alpha),
   >   not a white or checkerboard background. Full body, centred left to right. The feet sit
   >   about 30 px above the bottom edge, the top of the head or hat about 40 px below the top.
   >   Both images use the same scale and feet position.
   > - **Token:** 512 × 512 px PNG with a real transparent background. The round badge fills
   >   about 90% of the canvas, centred. It must still read at 28 px wide, and in grey at
   >   one-third opacity (that's how a spent token looks).
   > - **Small on screen:** in the game the character is shown only about 220 px wide over the
   >   café. Keep shapes big and clear.
   > - **Isolated only:** no background, floor, floor shadow, room, speech bubble or dialogue box.
   >   The game draws the café and the speech bubble itself.
   > - **No text anywhere:** no letters, Chinese characters, names, labels or watermark. On
   >   paper or scrolls, use soft wavy strokes that only suggest writing.
   > - **If you can't give real transparency,** use a flat pure green background (#00FF00) with
   >   nothing else on it, never a checkerboard.

## What usually comes back (and what the skill does about it)

The Li Bai round returned 1376 × 768 JPGs with a **checkerboard painted into the image**, the
character scaled differently in each pose, and the name written on the token. `cutout.mjs`
fixes the first two; text on the token is the owner's call (Li Bai's 诗笺 was kept because the
characters were correct). A first draft painted **into a café scene** can't be cut out cleanly.
Ask for an isolated redraw, attaching that draft as the approved design.
