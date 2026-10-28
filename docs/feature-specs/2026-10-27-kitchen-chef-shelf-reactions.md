# Feature Spec — 2026-10-27 — Kitchen Chef Shelf Reactions (lines 1–11)

Extends roadmap item **O** (Kitchen Chef, `2026-10-24-kitchen-chef-dialogue.md`). Chef Shrewy / 鼩仔 reacts to what is on the child's shelf, and each reaction plays from its own spot in the kitchen.

## Handoff — current state (update before ending a session)

- **Status (2026-10-28): deferred by the owner.** Recorded as roadmap item **S** (partly shipped, rest deferred). Don't resume until the owner un-defers it. The built lines are documented in `0_ARCHITECTURE.md` Shop Kitchen Rule 20.
- **Recipe scenes — no decision needed here (2026-10-28):** "Scope and boundaries" below says shelf lines don't play in a recipe's special scene. That holds for a plain scene (Rainbow Macarons: no chef tap at all). In an interactive scene (Crystal Pear Dew) a tap currently uses the same pool, so a shelf line can show there. The owner has decided that tapping the chef during cooking will become the chef challenge (roadmap item T, `2026-10-28-chef-challenge-paw-prints.md`), so this is interim behavior that T replaces. When resuming S, check what T settled for taps during cooking. See `0_ARCHITECTURE.md` Shop Kitchen Rule 21.
- **Built:** lines **#1, #3, #4** (all tap lines; shipped 2026-10-27, commit `0fdc339`). Tests, `tsc` and `eslint` pass. In-browser QA of #3/#4 is possible now with dev child 瓜瓜 (see Testing); #1 has no qualifying dev child yet.
- **Next:**
  1. Switch line selection to **rotation** (see Behavior rules). This changes built code: today's pick is random with no immediate repeat.
  2. #2 → #5 / #6 → #9 / #10 / #11 as tap lines (same pattern as the built ones).
  3. #7 / #8 plus the organize-moment versions of #9 / #10 / #11 (needs the event plumbing below).
- **Owner approvals in hand:**
  - Scope of all lines.
  - Text, spot and pose of #1–#10 as listed below.
  - Lines may name dishes and food types.
  - The first dish counts as a milestone.
  - Shrewy rotates through every triggered line, and no line is once-only (2026-10-27).
  - Build one line (or one pair) at a time if the owner asks; otherwise follow the order above.
- **Waiting on the owner:** approval of #11's proposed text. See Open questions; don't build #11 until approved.

## Scope and boundaries

- Presentational only, like the rest of the chef: never touches cooking, ingredients, coins, RPCs, or the database. No migration, no new route, no `AI_CONTRACT.md` boundary is triggered.
- Default kitchen scene only (`kitchen_empty` / `kitchen_half_stocked` / `kitchen_stocked.png`, which share one layout). In a recipe's special scene (`RECIPE_KITCHEN_SCENES`, e.g. Rainbow Macarons) the chef is hidden, so these lines don't play there.
- Lines may name food types and dishes (owner-approved 2026-10-26; an exception to the original chef spec's "no generic line names a food" rule, which still holds for the generic lines).

## The ten lines

`Id` is the key in `ChefShelfLineId` / `shelf.lines` / `CHEF_SHELF_LINE_STAGING`. Ids for unbuilt lines are proposals; keep them unless there's a reason not to. Spots are defined in the next section.

| # | Id | Kind | When | Spot | Pose | EN | ZH | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `foodTypeImbalance` | tap | ≥3 shelf dishes of one food type and 0 of another | F `shelfTop` | hungry | So many {have}! How about some {missing} next? | 好多{have}呀！下次做点{missing}怎么样？ | **Built** |
| 2 | `foodTypeMissing` | tap | Same condition as #1 | G `windowCounter` | careful | Our shelf has no {missing} yet... I'm so curious! | 架子上还没有{missing}呢……好想尝尝！ | Not started |
| 3 | `favoriteAgain` | tap | One recipe cooked ≥3 times (the favorite) | C `stool` | hungry | {dish} again? You really love it, huh! | 又是{dish}？你真的超爱它耶！ | **Built** |
| 4 | `favoriteSpecialty` | tap | Same condition as #3 | B `island` | celebrate | I think {dish} is our specialty now! | {dish}已经是我们的招牌菜啦！ | **Built** |
| 5 | `neverCooked` | tap | An unlocked, cookable recipe with 0 dishes ever | A `wallTop` | amazed | We've never made {dish}... shall we try? | 我们还没做过{dish}呢……要不要试试？ | Not started |
| 6 | `neverCookedBook` | tap | Same condition as #5 | D `rug` | careful | Psst! {dish} is waiting in the recipe book! | 嘘～{dish}在菜谱里等着你哦！ | Not started |
| 7 | `organizeMore` | event | After a successful "organize" | E `floorByShelf` | celebrate | {count} more on the shelf! Looking fancy! | 架子上又多了{count}道菜！真气派！ | Not started |
| 8 | `organizeTidy` | event | After a successful "organize" | G `windowCounter` | idle | Neat and tidy! A good chef keeps a clean kitchen! | 整整齐齐！好厨师的厨房最干净啦！ | Not started |
| 9 | `shelfMilestone` | tap + event | Shelf has ≥5 dishes; also said right after an organize that crosses 5 / 10 / 20 | B `island` | celebrate | {count} dishes on our shelf! We're getting famous! | 架子上有{count}道菜啦！我们要出名啦！ | Not started |
| 10 | `fullMenu` | tap + event | Shelf holds all 3 food types; also said right after the organize that completes the set | A `wallTop` | celebrate | Drinks, hot meals AND desserts! We're a real restaurant now! | 饮品、热菜、甜点全都有！我们是真正的餐厅啦！ | Not started |
| 11 | `shelfFirstDishes` | tap + event | Shelf has 1–4 dishes; also said right after the organize that puts the first dishes on an empty shelf | B `island` | celebrate | Our first dishes are on the shelf! Hooray! *(proposed)* | 我们的架子上有菜啦！好耶！*(proposed)* | **Text awaiting owner approval** |

**Tokens:**
- `{have}` / `{missing}`: food-type names from `shelf.foodTypes` (drinks / hot meals / desserts, 饮品 / 热菜 / 甜点).
- `{dish}`: the recipe's localized title (`getShopRecipeContentForLocale(recipe, locale).title`; the base recipe title, never a variant title).
- `{count}`: a plain number.

**Condition details (built lines are authoritative in code; unbuilt are the intended rules):**
- **#1/#2:** counts shelf dishes only (`location = 'shelf'`). `have` = most-stocked type with ≥ `CHEF_SHELF_PLENTY_COUNT` (3); `missing` = first empty type. Ties follow `SHOP_FOOD_TYPES` order. See `findShelfFoodTypeImbalance`.
- **#3/#4:** counts every dish ever cooked (countertop and shelf), since "cooked 3 times" is about cooking, not display. Favorite = most-cooked recipe with ≥ `CHEF_FAVORITE_DISH_COUNT` (3); ties go to the lower `displayOrder`. See `findFavoriteRecipeId`.
- **#5/#6:** a recipe in `unlockedRecipeIds` that is active, has `cookMethod !== null`, and has no dishes at all. If several qualify, pick the first in wall order (`displayOrder`) so the line is stable between taps.
- **#7/#8:** organize-moment only. They join the organize pool after `handleOrganize` succeeds in `KitchenSection.tsx`; `{count}` = `result.movedCount`.
- **#9/#10/#11 are never once-only** (owner, 2026-10-27). Each is a standing condition on the shelf's current contents (shelf dishes only; organize is the only way the shelf grows):
  - **As a tap line:** while its condition holds, it sits in the tap rotation.
  - **At the organize moment:** it also joins that organize's pool when this organize is what made it true: crossed 5 / 10 / 20 (#9), completed all three food types (#10), or put the first dishes on an empty shelf (#11).
  - **`{count}`:** for #9 this is the actual shelf dish count, so the line stays true on every repeat.
  - **No persisted state:** no `localStorage` "seen" flags are needed for these lines.
- **The first dish counts as a milestone** (owner, 2026-10-27). #9's text doesn't fit 1–4 dishes, hence #11. #11's tap condition (1–4 dishes) and #9's (≥5) never overlap.
- **Organize moment:** the pool is #7, #8 plus whichever of #9/#10/#11 this organize just triggered. Shrewy says one line from it, chosen by the rotation rule. Nothing is dropped: the event-capable lines stay in the tap rotation afterwards, so they keep coming up.

## Spots

Percentages of the scene box (same convention as `SceneHotspot`). All were placed on `kitchen_half_stocked.png` with the real sprite and checked against the five hotspot boxes (fridge, book, stovetop, oven, shelf). The chef box is `width: 14%`; the sprite's feet sit at ~90.8% of its height.

| Letter | Code key | left | top | Bubble | Status |
|---|---|---|---|---|---|
| H | `ladder` (home) | 22.5% | 31% | above, left-aligned | In code |
| A | `wallTop` (top of the back wall) | 35.5% | 0.4% | **below**, left-aligned | Measured, not in code |
| B | `island` (on the island counter) | 55% | 44.1% | above, right-aligned | In code |
| C | `stool` (standing on a stool) | 58.6% | 56.4% | above, right-aligned | In code |
| D | `rug` | 27.3% | 62.3% | above, left-aligned | Measured, not in code |
| E | `floorByShelf` (bottom-right floor) | 76.8% | 71.2% | above, right-aligned | Measured, not in code |
| F | `shelfTop` (on top of the shelf unit) | 81.3% | 9.8% | **below**, right-aligned | In code |
| G | `windowCounter` (counter by the window) | 65.1% | 31.8% | above, right-aligned | Measured, not in code |

Rules: bubble goes **below** when there's no room above (A, F); **right-aligned** when a left-aligned 11rem bubble would overflow the scene's right edge on a phone (anything left of ~45% can stay left-aligned). F slightly overlaps the top band of the shelf hotspot; G was nudged left to clear it. Re-check any new spot in a browser at phone and desktop widths.

## How it's built (file map)

All in `src/app/words/shop/kitchen/`:

- `kitchenChef.types.ts`: `ChefSpot` + `CHEF_SPOTS` (spot layouts), `ChefReaction` (`{ line, pose, spot }`), `ChefShelfLineId` + `CHEF_SHELF_LINE_STAGING` (pose and spot per line id), thresholds `CHEF_SHELF_PLENTY_COUNT` and `CHEF_FAVORITE_DISH_COUNT`, and the `shelf` part of `KitchenChefLocaleStrings`.
- `kitchenChef.strings.ts`: `shelf.foodTypes` and `shelf.lines` (one template per line id) for EN and ZH.
- `kitchenChef.utils.ts`: pure helpers.
  - `countShelfDishesByFoodType`, `findShelfFoodTypeImbalance`, `findFavoriteRecipeId`: facts from dishes.
  - `buildShelfChefReactions(facts, strings)`: turns `ChefShelfFacts` into the reactions that currently apply.
  - `pickChefTapReaction`: random pick across the generic tap lines (ladder, trigger pose) plus those reactions, never repeating the last line.
- `useKitchenChef.ts`: state is `{ pose, line, spot }`. `say(trigger)` plays from the ladder; `tap(servedRecipeSlugs, extraReactions)` may pick a shelf reaction. After `CHEF_LINE_DURATION_MS` he returns to idle on the ladder.
- `KitchenChef.tsx`: positions the chef at `CHEF_SPOTS[spot]`, glides between spots (`transition-[left,top]`, off under `motion-reduce`), and places the bubble per the spot's `bubble` / `bubbleAlign`.
- `KitchenSection.tsx`: builds `ChefShelfFacts` from the loaded `dishes` and `recipesById` (`shelfChefReactions` memo) and passes them to `chef.tap`.

### Adding a tap line (#2, #5, #6)

1. Add the id to `ChefShelfLineId` and its `{ pose, spot }` to `CHEF_SHELF_LINE_STAGING` (add the spot to `ChefSpot` / `CHEF_SPOTS` from the table above if it isn't there).
2. Add the EN and ZH template to `shelf.lines` in `kitchenChef.strings.ts`.
3. If it needs a new fact, add a pure helper in `kitchenChef.utils.ts`, a field on `ChefShelfFacts`, and compute it in the `shelfChefReactions` memo in `KitchenSection.tsx` (#5/#6 need `unlockedRecipeIds` and `recipes`, both already in scope there).
4. Emit it in `buildShelfChefReactions` with `add(id, tokens)`.
5. Tests in `kitchenChef.test.ts`: the helper, the built reaction (EN and ZH text, pose, spot), and extend the token map in the "gives every shelf line id a template" test.

### Adding an event line (#7–#10): plumbing not built yet

- Add a way to play a ready-made reaction, e.g. expose `show` from `useKitchenChef` as `react(reaction)`.
- Build the reaction with the same staging table and template filling (consider a small `buildChefShelfReaction(id, tokens, strings)` helper so tap and event lines share it).
- Call it from `handleOrganize` on success, after `refreshAfterOrganize()`. Compare the shelf before and after to tell whether this organize crossed a milestone (#9), completed the menu (#10), or filled an empty shelf (#11).
- No persisted seen state is needed (no line is once-only).

## Behavior rules (apply to all lines)

- **Rotation (owner, 2026-10-27):** Shrewy cycles through every line that currently applies (generic tap lines plus all triggered shelf lines) before repeating any. Implement as a shuffle bag in `useKitchenChef`:
  - Remember which line texts have been said this round.
  - Pick at random among the applicable lines not yet said.
  - Once every applicable line has been said, start a new round, still excluding the line just said.
  - The applicable set can change between taps as the shelf changes; always rotate over the current set.
  - **Not built yet:** today's `pickChefTapReaction` is random with no immediate repeat, so a line can be skipped for a while.
- One line at a time; a new line replaces the current one and resets the 5-second timer.
- After the line, the chef returns to the ladder in the idle pose.
- Tap cooldown (`CHEF_TAP_COOLDOWN_MS`) still applies.
- Hidden chef (× button) or special scene → no line plays.

## Testing

- Unit tests: `kitchenChef.test.ts` and `kitchenChef.types.test.ts` (`npx vitest run src/app/words/shop`).
- Dev data as of 2026-10-27:
  - **瓜瓜** (child, family `d7ee29e1…`): Bubble Tea cooked 5 times, so **#3/#4 show** as "Bubble Tea…" / 珍珠奶茶…. Shelf has 17 dishes covering all three food types (8 hot meals, 5 drinks, 4 desserts). So #1/#2 **never** show, and once built, #9 ("17 dishes…") and #10 are in their tap rotation.
  - **Aiden, 可萌, Jojo**: empty shelves; nothing triggers.
  - To test #1/#2, a dev child needs ≥3 shelf dishes of one type and 0 of another. Seed `shop_cooked_dishes` rows (`user_id`, `family_id`, `recipe_id`, `location = 'shelf'`) in **dev only** via the service-role client from `.env.local`, and give the owner cleanup SQL. Ask before seeding.
- Manual QA per line: tap until the line shows; confirm the spot, pose, bubble placement and both locales; check reduced motion; check phone width for bubble overflow and that no hotspot is blocked.

## Acceptance criteria

- [x] #1, #3, #4 play from their spots with the right pose and localized text.
- [ ] #2, #5, #6 built and QA'd.
- [ ] #7, #8 play after organizing.
- [ ] Line selection rotates through every applicable line before repeating.
- [ ] #9, #10, #11 sit in the tap rotation while true, and join the organize pool on the organize that triggers them.
- [ ] Chef never blocks a hotspot at phone or desktop width; reduced motion respected.
- [ ] `tsc`, `eslint`, `npm test`, `check:encoding` pass; this spec's Handoff block and statuses updated in the same commit.

## Open questions (ask the owner)

1. **#11's text** is proposed, not approved:
   - EN: "Our first dishes are on the shelf! Hooray!"
   - ZH: 我们的架子上有菜啦！好耶！

   The wording is plural on purpose. One organize can move several dishes, and the line stays true for 1–4 dishes.

*Resolved 2026-10-27:* the first dish counts as a milestone (→ #11); no priority order, Shrewy rotates through every triggered line, and no line is once-only.
