# Feature Spec — 2026-10-24 — Kitchen Chef Dialogue (art requirements first)

Roadmap item **O**. Separate from the Mystery Foods build (`2026-10-24-mystery-foods.md`, items L/M/N) — it does not block or depend on it, though the launch mystery food (Crystal Dumplings) supplies the first set of lines.

## Status

**Shipped 2026-10-24 — manual in-browser QA passed on dev.** Art delivered and processed, lines written, behavior agreed and built. No code, schema, or route is touched until the owner approves the behavior sections and the art exists.

## Problem

Shop Kitchen is silent. A cartoon chef who reacts to key moments would make cooking — and especially the rare mystery-food unlock — feel rewarding and give the kitchen a personality.

## Scope

- One new recurring character, the **kitchen chef**, shown as an overlay on `/words/shop/kitchen` with a speech bubble (bubble is plain Tailwind UI, no art).
- Five sprite poses, one per moment (below).
- Localized EN + ZH lines, authored per recipe where a recipe has its own, with generic fallback lines.

## Out of scope

- Voice/audio, animation beyond simple CSS transitions, chef customization, parent-facing visibility.
- Any change to cooking, ingredients, coins, or RPCs — purely presentational.

## Art requirements (the part ready to commission)

**Character concept (recommended default):** a tiny kawaii **food-mascot chef** — a small steamed-bun / dumpling-like body with a tall chef hat (toque) and a little apron — in the same family as the existing profile avatars (`public/avatar/*`: simple dot eyes, pink cheeks, small smile) and the faced appliances already in the kitchen illustration (`public/kitchen/kitchen_empty.png`: smiling fridge and stove). A design agent may propose a different species if it stays in that visual family; **no realistic or human-proportioned chef.**

**Poses (one sprite each, identical canvas, scale, and ground anchor so they can be swapped in place):**

| Pose key | When shown | Expression / body language |
|---|---|---|
| `idle` | default; also after any line expires | calm, gentle smile, relaxed stance |
| `amazed` | mystery food unlocks | wide sparkling eyes, open mouth, arms up, little golden sparkles |
| `careful` | child picks a recipe to cook | focused, tongue/eyebrows "concentrating", holding a spatula/ladle at the ready |
| `celebrate` | cook success | joyful closed-eye grin, arms raised, tiny confetti/steam puff |
| `hungry` | child taps the chef while a dish is served | drooling slightly, hungry eyes, rubbing belly |

**Technical:** 1024×1024 PNG, **real alpha transparency** (no baked-in white/dark background, glow, or vignette — the existing avatar PNGs have opaque glow backgrounds; do not copy that), subject centered with feet on the same baseline in every pose, full body. Must stay legible down to ~160 px tall. Thick warm-brown rounded outlines, soft painterly shading, pastel-leaning palette to match the kitchen. Files: `chef_<pose>.png` → final `public/kitchen/chef_<pose>.png`, staged in `public/kitchen/staging/`; run through the repo's transparency normalization (same step as `add-food`) before use.

## Art delivered (2026-10-24)

Concept chosen by the artists/owner: a plump **grey tabby cat chef** (tall white toque, sage-green apron, pink cheeks, dot eyes) — a deliberate departure from the recommended food-mascot default, accepted because it stays in the same kawaii-outline family. Files are in `public/rewards/staging/` (not the `public/kitchen/staging/` this spec named), as **2048×2048 opaque JPEGs on a near-white background**:

| Staged file | Pose key | Notes |
|---|---|---|
| `c1.jpeg` | `idle` | calm smile, paws on apron |
| `c2.jpeg` | `amazed` | star eyes, arms up, sparkles — **re-done 2026-10-24** (ears now consistent; re-exported at ~1330×1330) |
| `c3.jpeg` | `careful` | **re-done 2026-10-24**: holds slotted spatula with both paws, furrowed brows, pursed mouth — now reads as focused (slightly stern; acceptable, spec asked for "never stern" so watch it at small size) |
| `c4.jpeg` | `celebrate` | closed-eye grin, arms up, confetti + steam puff |
| `c5.jpeg` | `hungry` | big eyes, drool, paws on belly |
| `chef_cook.jpeg` | — | 2752×1536 scene of the cat cooking soup on a stool in a rustic kitchen; **not requested, not in any pose list, and a different art style from the game's isometric kitchen** — no planned use |

**Done 2026-10-24:** processed into `public/kitchen/chef_<pose>.png` — real transparency, normalized to one canvas with an identical hat column (x=512), hat top (y=80) and feet line (y=930), then downscaled to **512×512** (the chef displays at ~150 px, and all five poses preload; ~150 KB each instead of ~550 KB). Originally to do: convert the five poses to real-transparency PNGs at `public/kitchen/chef_<pose>.png` (same transparency normalization as the `add-food` skill). `c2`/`c3` were re-exported smaller (~1330×1330) than `c1`/`c4`/`c5` (2048×2048) — normalize all five to one canvas size and a shared feet baseline during processing. `lineup.jpeg` was deleted.

## Proposed behavior (for discussion)

- Chef sits as an overlay on the kitchen page, **standing on the middle rung of the ladder** (owner request 2026-10-24; the ladder is part of all three existing scene illustrations at the same spot, so no new kitchen image is needed), clickable.
- Four triggers: **unlock** (a mystery food just auto-unlocked — shown on the next kitchen visit if it happened during a quiz), **start cooking** (as built: played when the child returns to the scene with a recipe chosen, because picking happens inside full-screen modals), **cook success** (celebration burst), **idle tap** (child taps the chef while at least one dish is served). Each plays its pose + bubble for a few seconds, then returns to `idle`.
- Lines per recipe: if a recipe has its own lines, use them; otherwise a small generic set. Storage: a localized `chef_lines_i18n` jsonb on `shop_recipes` (needs a migration and `AI_CONTRACT.md §2` authorization) **or** a static strings entry in `words.strings.ts` keyed by recipe slug (no migration). Recommend the strings file for v1.
- Respect `prefers-reduced-motion`; never block cooking, never required to dismiss.

## Layer impact

UI only if lines live in `words.strings.ts`; UI + DB if `chef_lines_i18n` is chosen. No scheduler/coins/RPC changes. Spec required (new UI surface; DB if column chosen).

## Edge cases

- Unlock happens during a quiz, not in the kitchen: the unlock line must be shown on the child's next kitchen visit, not lost. Needs a "seen" flag (local state is acceptable; a missed flourish is low-stakes).
- Recipe with no lines → generic lines; chef never shows an empty bubble.
- Rapid taps → cooldown so lines don't stack.
- Small screens: chef must not cover the hotspots (fridge, recipe book, stove, oven, shelf); allow collapsing/hiding.

## Risks

- Overlay can collide with the percentage-positioned `SceneHotspot` boxes — verify in-browser at phone and desktop widths.
- Art inconsistency across five separately generated poses is the main production risk; commission all five from one agent in one pass with a locked reference sheet.

## Test plan

Pure helper tests for line selection (recipe-specific vs. generic, locale fallback, cooldown); strings parity test; manual QA of all four triggers, reduced-motion, and hotspot overlap.

## Acceptance criteria

- [ ] Five transparent PNG poses delivered, consistent character, same canvas/baseline.
- [ ] Each of the four triggers shows the right pose + localized line, then returns to idle.
- [ ] Recipes without custom lines use generic ones.
- [ ] Chef never blocks hotspots or cooking; reduced-motion respected.
- [ ] `tsc`, `eslint`, `npm test`, `check:encoding` pass; docs updated in the same commit.

## Chef lines

**Rules.** The chef has four triggers: unlock (mystery food only), start cooking, cook success, idle tap. For each trigger the chef uses the recipe's own lines if it has any, otherwise the generic set below. Every trigger has 3 variants (except where noted); the next line is picked at random but never repeats the one just shown. Bubble text stays short (EN about 45 characters or fewer, ZH about 22 or fewer) so it fits a small bubble on a phone. No line names a specific food, an ingredient, or coins.

### Generic lines

| Trigger / pose | EN | ZH |
|---|---|---|
| Start cooking (`careful`) | "Okay, let's cook! Stay focused!" | 好，开始做饭啦！专心哦！ |
| | "Careful with the heat. Here we go!" | 小心火候，我们开始吧！ |
| | "I've got the spatula ready!" | 锅铲准备好啦！ |
| Cook success (`celebrate`) | "Ta-da! That looks delicious!" | 当当当！看起来好好吃！ |
| | "Perfect! You're a real chef now!" | 太棒了！你已经是真正的大厨啦！ |
| | "Yum! Another tasty dish done!" | 好香呀！又做好一道美味！ |
| Idle tap, dish served (`hungry`) | "Mmm, that smells so good..." | 嗯～好香啊…… |
| | "My tummy is rumbling!" | 我的肚子咕咕叫啦！ |
| | "Can I have a taste? Please?" | 我可以尝一口吗？拜托啦！ |
| Idle tap, nothing served yet (`idle`) | "Let's cook something yummy together!" | 我们一起做点好吃的吧！ |
| | "What shall we make today?" | 今天做点什么好呢？ |
| Unlock, fallback for a mystery food with no lines of its own (`amazed`) | "Wow! A brand-new dish just unlocked!" | 哇！一道新菜解锁啦！ |

### Crystal Dumplings (recipe-specific, from the design agent)

Used for `crystal-dumpling` in place of the generic lines for that trigger. Lightly edited for tone; the one rewrite below is owner-approved.

| Trigger / pose | EN | ZH |
|---|---|---|
| Unlock (`amazed`) | "Whoa! Look at that golden glow! You gathered every secret ingredient. The imperial kitchen is open!" | 哇！快看这道金光！你集齐了所有神秘食材，御膳房的大门打开啦！ |
| Start cooking (`careful`) | "Careful now! When the steam clears, these little dumplings shine just like real jade crystals!" | 小心烫哦！等蒸汽散开，虾饺就会像水晶一样透亮！ *(owner-approved rewrite; replaces the agent's original 小厨师准备好！…, which disagreed with the English)* |
| Cook success (`celebrate`) | "Perfection! Tender, sweet, and glowing! Even the Emperor would ask for seconds!" | 太棒啦！皮薄馅大，晶莹剔透！连皇帝吃了都要再来一笼！ |
| Idle tap (`hungry`) | "Mmm, that crunchy bamboo shoot and sweet tiger prawn... my mouth is watering!" | 吸溜……脆生生的笋尖配上大虾仁，看得我都流口水啦！ |

The unlock and idle-tap lines are over the length guide; allow the bubble to wrap to two lines for recipe-specific lines (generic lines are written to fit on one).

### Crystal Pear Dew (recipe-specific, added 2026-10-27)

Used for `crystal-pear-dew` (mystery drink, stove). Drafted 2026-10-27; pending owner review.

| Trigger / pose | EN | ZH |
|---|---|---|
| Unlock (`amazed`) | "Whoa! Smell that? Snow pears and golden blossoms... a secret royal tea is ready to brew!" | 哇！闻到了吗？雪梨和金菊的香气……神秘的御用甜饮可以开炖啦！ |
| Start cooking (`careful`) | "Low and slow now! When the amber crystals melt, the whole pot turns sparkly gold!" | 小火慢慢炖哦！等琥珀冰晶化开，整锅都会变得金灿灿的！ |
| Cook success (`celebrate`) | "Ahh, so warm and sweet! One sip and you feel cozy all the way to your toes!" | 好暖好甜呀！喝一口，从头暖到脚趾头！ |
| Idle tap (`hungry`) | "Sweet pear, ruby goji berries, a little floating flower... can I have just one sip?" | 清甜的雪梨，红红的杞果，还漂着一朵小金菊……让我喝一小口嘛！ |

**Recipe scenes that draw the chef (2026-10-27).** A recipe's own kitchen scene hides the chef sprite because the art already paints him. A scene with an `effects` layout (`RECIPE_KITCHEN_SCENES` in `kitchen.types.ts`, rendered by `KitchenSceneEffects.tsx`) shows his lines in a bubble over the painted chef and makes him tappable, alongside steam/glow/sparkles, a prep step (the child drags each needed ingredient unit from its spot into the pot -- a tap or Enter also sends one in -- and the stove refuses to cook until the pot is full; owner request 2026-10-27, motion slowed to 1.4 s), a ~3 s boil, and then the finished dish full-size (`KitchenDishReveal.tsx`), which stays until the child presses Finish -- that plays the shared celebration chime with confetti, then the success notice and chef line follow. Picking a recipe in the book now closes the book straight away. A "Cancel cooking" button (any recipe, any time before the server cook) clears the selection and empties the pot; on a recipe scene the server cook runs at the END of the boil, so cancelling mid-boil consumes nothing. Crystal Pear Dew is the first; Rainbow Macarons has no `effects` yet, so its start line still goes unseen.

**Chef name (decided 2026-10-24):** "Chef Shrewy" / 鼩仔. Lines are written so no name is needed; the name is available for UI labels (e.g. the chef's `aria-label`) and future copy.

## Decisions (all confirmed by the owner 2026-10-24)

1. Character: tabby-cat chef; name Chef Shrewy / 鼩仔.
2. Generic lines: **yes, for every food** (decided 2026-10-24); recipe-specific lines override per trigger.
3. Line storage: **`words.strings.ts`** (new `kitchenChef` section: `generic` plus `recipes[slug]`), no migration, no `AI_CONTRACT.md §2` trigger. Revisit a database column only if lines must be edited without a deploy.
4. Placement: **Shop Kitchen page only** for v1. Not on the recipe wall.
5. Idle-tap variants: **rotate, no immediate repeat** (3 variants per trigger as above).
6. Unlock line timing: shown on the **next kitchen visit** after the unlock, since the win happens in a quiz, not in the kitchen. Tracked with a local "seen" flag (acceptable if lost).

## Open questions

None. Spec is ready to build on the owner's go-ahead (UI-only: new `kitchenChef` strings section with EN/ZH parity test, five processed PNG sprites, a chef overlay component with speech bubble, and pure line-selection helpers).

## Shelf-aware reactions (2026-10-26)

Ten owner-approved lines in which the chef reacts to the child's shelf from different spots in the kitchen. Specced and tracked separately, with a handoff block: `2026-10-27-kitchen-chef-shelf-reactions.md`.
