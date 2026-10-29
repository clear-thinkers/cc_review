# Feature Spec — 2026-10-28 — Chef Challenge + Paw-Print Collectibles

Roadmap item **T**. Builds on Shop Kitchen (item J), the kitchen chef (item O) and recipe scenes / interactive cooking (`0_ARCHITECTURE.md` Shop Kitchen Rule 21).

## Status

**Shipped 2026-10-29.** Owner QA passed on dev. All five migrations are on dev and prod, and 65 owner-reviewed questions with 小知识 are live on prod. The decisions and follow-ups below are the build record.

**Full design drafted 2026-10-28 and approved by the owner the same day,** including the one-per-cook rule (`cook_required`), no scheduler impact (Q4), a separate economy (Q9), and confirm-on-delete for questions. **Authorized by the owner 2026-10-28 and built on dev the same day.** Migration `20261028160000` is on dev only; `verify:chef-challenge` passes 30/30 and `verify:rls` Section 13 12/12. **Recipe Book marker (authorized 2026-10-29):** the kitchen's Recipe Book marks each recipe where the child can actually meet the challenge (an interactive scene **and** active questions) with the small paw badge. The marker updates automatically as scenes or questions are added or removed. Migration `20261029170000` adds `chef_challenge_recipe_ids()`, which returns recipe ids only.

**Art update (owner, 2026-10-29), superseding decision 7c's art:**
- **New stamp:** a round sage-green badge with a paw, a chef's hat on top, sparkles and leaves. Source: `public/paw-prints/_staging/chef-shrewy-stamp-v2-source.jpg`, local only. It's cut to `shrewy_paw.png` (512) and `shrewy_paw_badge.png` (128).
- **No signature:** the owner found the signature image too messy, so `shrewy_signature.png` was removed. A "来自" line isn't needed either: the sheet's heading "鼩仔的爪印" plus the small paw badge beside it is enough.
- **Givers:** the rule that every paw print records its giver is unchanged.

**Three questions per challenge (authorized 2026-10-29), superseding decisions 1d, 2d, 5 and the hand-wash price.**
- **The challenge:** still one per cook. It asks up to **3 questions**, drawn at random from all of the recipe's active questions (the per-child rotation is dropped), never repeating within one challenge; a recipe with fewer than 3 asks them all.
- **Answering:** questions come one at a time. A **wrong answer shows that question's answer and ends the challenge**. Only a **fully correct** challenge earns **1 paw print**. Closing mid-way resumes later.
- **Price:** "Shrewy washes his hands" now costs **2** paw prints (was 10).
- **Migrations:** `20261029150000` and `20261029160000`. The second is a fix so a finished challenge can't reopen; see the fix log.
- **Behavior sections below:** where they describe one question per challenge or round rotation, this paragraph and `0_ARCHITECTURE.md` Shop Kitchen Rule 22 / guarantee 6e are authoritative.

**Follow-up authorized 2026-10-29:** each question may carry a 小知识 (`explanation`, Chinese, ≤ 300 chars), shown to the child after answering, right or wrong. It's stored in a new column (migration `20261029120000`), returned only by `answer_chef_challenge`, and edited in Shop Admin. 66 curated questions with 小知识 (`content/chef-challenges/questions.zh.json`) are imported to dev. Pending: in-browser QA by the owner, then the prod migrations (both) and the question import. Shipped behavior is recorded in `0_ARCHITECTURE.md` (Shop Kitchen Rule 22, Rewards Rules, Shop Admin Rule 13, data schema, guarantee 6e). All owner decisions are recorded inline under Open questions. The sections from "Data and security" down turn them into the build design. **Not authorized for build yet:** this feature needs a schema migration and a new page, both `AI_CONTRACT.md §2` boundaries. Implementation starts only after the spec is approved and the owner's reply contains the word "authorized".

## Problem

While cooking, tapping Chef Shrewy only gets a chat line. The owner wants that moment to become a small learning challenge: the chef quizzes the child, and a correct answer earns a **paw print** — the chef's signature — as a collectible. Paw prints are saved up and redeemed on their own page for kitchen rewards such as new background music or new Shrewy interactions. This gives the kitchen a learning hook and gives collecting a goal.

## Scope (rough, from the owner)

- **Chef challenge:** tapping the chef during cooking starts a short challenge/quiz instead of a chat line.
- **Paw prints:** a correct answer earns a paw print, a collectible kept per child.
- **Redemption page:** like the coin cash-out, it shows how many paw prints each reward costs, and the child can redeem them.
- **Rewards (candidates):** a new background-music track (item R's player), new Shrewy interactions. Each reward is likely its own small feature with its own spec or row.

## Out of scope (proposed — confirm)

- Any change to review scheduling, quiz sessions, coins or ingredients (see open question 4 and 9).
- Live AI generation of questions (`AI_CONTRACT.md §1`: persisted content only).
- Parent-side management of rewards (see open question 8).
- Rewards other than the hand-wash video: the launch catalog is **only "Shrewy washes his hands" (10 paw prints)** (owner, 2026-10-28). Others, e.g. new music tracks, come later as catalog rows plus their own small builds.
- An admin UI for the reward catalog; launch rewards are seeded by migration.
- **Future, not in this spec (owner, 2026-10-28):**
  - Other characters: a child can **sell cooked dishes** in a shop to other characters, who pay in **their own tokens**, each redeemable for that character's own rewards.
  - This spec should leave room for that: every token records its giver, balances and redemption catalogs are per giver, and the paw-print page can grow a section per character.
  - Selling dishes would also be the first time a cooked dish leaves the shelf (today `shop_cooked_dishes` only ever moves countertop → shelf). That needs its own spec and authorization.

## Open questions (owner)

**The challenge**
1. ~~**When is it "during cooking"?**~~ **Decided 2026-10-28:**
   - **Only in interactive recipe scenes** (a `RECIPE_KITCHEN_SCENES` entry with `effects`; today only Crystal Pear Dew).
   - **Only in the prep phase:** while the child is adding ingredients to the pot, before the stove is tapped and the ~3 s boil starts.
   - **Opt-in:** the child taps Shrewy to accept the challenge; nothing pops up on its own.
   - Not on the default kitchen scene, not in plain recipe scenes, and not during the boil or the dish reveal.

   **Follow-ups, all decided 2026-10-28:**
   - **1a. Prep finished:** the challenge stays available until the stove is tapped, even if every ingredient is already in the pot.
   - **1b. Signal:** while a challenge is available, a small paw or "?" badge shows over Shrewy. No pop-up or line pushes it on the child.
   - **1c. During the challenge:** it opens as a pop-up over the scene, so ingredient dragging pauses. Closing it without answering costs nothing, and the challenge stays available.
   - **1d. How often:** at most **one challenge per cook.** The child gets one go per cook. Once answered, the badge goes away until the next cook. (What a wrong answer does, such as retry or reveal, is still question 5.)
   - **1e. Other taps in an interactive scene:** keep today's chat lines. This applies whenever no challenge is on offer: during the boil, after this cook's challenge is used, or when there's no prep phase.
2. ~~**Where do questions come from?**~~ **Decided 2026-10-28: a curated question set about Chinese culture, written by the owner.** It is not drawn from the child's own words. The owner curates it in a new platform-admin interface. This makes the question bank **shared/global content**, like the shop catalog, not family-scoped.

   **Follow-ups this raises:**
   - **2a. Where the admin interface lives — decided 2026-10-28:**
     - A **new third collapsible section on Shop Admin** (`/words/shop-admin`), below "Recipe Management — Link Ingredients To Recipes". It has the same card style, an Expand/Collapse button, and its own heading (e.g. "Chef Challenges — Curate Recipe Questions"; wording TBD). No new route.
     - **All three sections start collapsed** when the page opens. Today only the ingredient section does (`isIngredientSectionCollapsed` defaults to `true`, `isRecipeSectionCollapsed` to `false`, `ShopAdminSection.tsx`), so the recipe section's default changes too. Shop Admin Rules in `0_ARCHITECTURE.md` get updated when this ships.
     - **Layout — decided 2026-10-28:** a recipe picker first, like the recipe section's "Selected recipe: …", then that recipe's question list. Editing tools are still question 2f.
   - **2b. Languages — decided 2026-10-28: questions and their options are Chinese only.** They are learning content, like the Hanzi themselves, so the bilingual-strings rule (`0_BUILD_CONVENTIONS.md §4`) doesn't apply to them. The surrounding UI (pop-up buttons, Shrewy's prompt and praise lines, the redemption page) stays EN + ZH as usual. **No pinyin** on questions or options (decided 2026-10-28), so there's no pinyin field to curate.
   - **2c. Linked to recipes — decided 2026-10-28: every question belongs to a recipe.** There is no general pool. The challenge during a recipe's cook asks only that recipe's questions. A recipe with no questions offers no challenge: no badge, and taps keep the chat lines (1e). This matches the owner's rule for the chef in recipe scenes: no designed content, no interaction.
   - **2d. Which question — decided 2026-10-28: rounds through all of the recipe's questions.** The rotation is per child and per recipe, not per cook.
     - **A round:** each cook of the recipe asks a question this child hasn't been asked yet in the current round. **No question repeats within a round.**
     - **New round:** once every question has been asked, a new round starts and they can all come up again (proposed: in a fresh order).
     - **Earning again:** a question answered correctly in an earlier round earns a paw print again when it comes back in a later round.
     - A wrongly answered question waits for the next round like any other; within a round it doesn't come back.
     - **Questions added or deactivated mid-round:** proposed that a new question joins the current round and a deactivated one is skipped.
     - Proposed storage: the rotation lives on the server, from the record of questions handed out, so it works across devices and can't be gamed.
   - **2e. Images:** can a question carry a picture (a lantern, a zodiac animal)? If yes, the art goes in `public/`, the same way ingredient icons are handled.
   - **2f. Admin tools — decided 2026-10-28:** add, edit, turn active/inactive, delete, and preview a question as the child will see it. Questions are entered one at a time; no bulk import.
   - **2g. Hidden answers:** the question bank must not show the correct answer to the child's browser. Otherwise a child could read it from the network traffic. Proposed: a server function hands out a question without the answer, and a second one checks the child's choice.
3. ~~**Format?**~~ **Decided 2026-10-28: multiple choice.** The owner writes one correct option plus **2–3 wrong ones** per question (3–4 options in all), shown in a fresh shuffled order each time. Chinese only, with no pinyin (2b).
4. **Does an answer touch review scheduling?** **Decided 2026-10-28: no**: it keeps scheduler rules clean (`0_ARCHITECTURE.md` §4 guarantee 8) and makes this a game rather than a review.
5. ~~**Wrong answer.**~~ **Decided 2026-10-28:** the pop-up **shows the correct answer**, and Shrewy says a "try again next time" line. There's no retry. That cook's challenge is used up (1d), and the question comes back in a later round (2d).
   - **Limits:** decisions 1d and 2d already cap earning at one paw print per cook, and cooking is limited by ingredients. Proposed: no extra daily cap or cooldown.
6. ~~**What does the chef say?**~~ **Designed 2026-10-28** (the owner delegated the design; the owner may revise wording).
   - **Where the poses show:** the challenge only runs in interactive scenes, where Shrewy is **painted into the artwork**, so the scene can't change his pose. The **challenge pop-up** therefore shows his sprite (`public/kitchen/chef_<pose>.png`) beside a speech bubble, and the pose changes there.
   - **Storage:** lines live in `kitchenChef.strings.ts` under a new `challenge` group (EN + ZH).
   - **Picking a line:** one variant at random, never repeating the previous line (the same rule as the other chef lines).
   - **Answer options:** the question and its options stay Chinese only (2b); only Shrewy's lines and the pop-up's buttons are bilingual.

   | Moment | Where | Pose | EN | ZH |
   |---|---|---|---|---|
   | **Offer** — pop-up opens | pop-up | `careful` | Chef's challenge! Get them all right and I'll give you my paw print! | 大厨挑战！全部答对，就送你一个爪印！ |
   | | | | Before we cook, a little culture quiz! Get them all right for a paw print! | 开火之前，先来几道文化小问题！全部答对就能得到一个爪印哦！ |
   | | | | Psst... I have a secret question for you. Get them all right for a paw print! | 嘘……我有一个秘密问题，全部答对就能得到一个爪印哦！ |
   | **Correct** — paw print earned | pop-up | `celebrate` | Paw-fect! Here's my paw print for you! | 答对啦！送你我的爪印！ |
   | | | | You know so much! Stamp! One paw print for you! | 你懂得真多！啪——盖个爪印给你！ |
   | | | | Wow, a true little culture chef! Take my paw print! | 哇，真是文化小厨神！我的爪印送给你！ |
   | **Wrong** — correct answer shown (5) | pop-up | `idle` (gentle smile, never sad) | Oops, not this time! Now you know the answer. Try again next time! | 哎呀，这次没答对！现在你知道答案啦，下次再来！ |
   | | | | So close! Remember this one, and we'll try again next cook! | 差一点点！记住这个答案，下次做菜再挑战！ |
   | | | | That was a tricky one! Let's try again next time! | 这题有点难哦！下次再试试吧！ |
   | **Closed without answering** (1c) | scene bubble | n/a (painted) | No rush! Tap me when you're ready. | 不着急！准备好了再点我哦。 |

   - **Tone rules:** the wrong-answer lines never scold. They point to the shown answer and the next cook, so a miss still teaches. The correct-answer lines name the paw print, so the reward is clear.
   - **The badge over Shrewy (1b)** needs bilingual ARIA text, e.g. "Chef's challenge: tap Shrewy" / "大厨挑战：点一点鼩仔". The pop-up buttons are close, and possibly "Next". That copy goes in `kitchen.strings.ts` or `kitchenChef.strings.ts`, per `0_BUILD_CONVENTIONS.md §4`.
   - **Earning moment (7d, proposed):**
     - the correct line plays while the paw stamp "thumps" onto a small paper strip in the pop-up;
     - the shared celebration chime plays (which, by decision R, the music mute does not silence);
     - a "+1" next to the paw-print count.

**Paw prints and redemption**
7. ~~**What is a paw print?**~~ **Decided 2026-10-28: both a count and a visual collection.**
   - The child sees **how many** paw prints they've collected.
   - They also see a **paper-style sheet** with one stamped print per paw print.
   - The stamp art is the owner's "Chef Shrewy" rainbow paw: a crayon-textured rainbow paw pad with a chef's hat, three tabby stripes and blush marks, sparkles, and a "Chef Shrewy ♡" script signature with a whisk, on cream paper. One design for every paw print (not distinct stamps).

   **Follow-ups this raises:**
   - **7a. Spending vs. the sheet — decided 2026-10-28:** the sheet keeps **every print ever earned**, as a lifetime collection. Spent prints stay on it but look "used" (faded, or under a small "redeemed" mark; exact look to be designed). A separate "available to spend" number shows what's left. Spending never removes a stamp from the child's collection.
   - **7b. Sheet layout — decided 2026-10-28:** a **neat grid** of stamps on the paper sheet, not scattered.
     - **Columns:** about **5 per row**, adjusting to screen width (proposed: fewer on a narrow phone, 5 on a typical screen, more on a wide desktop).
     - **Tapping any stamp, used ones included,** shows **when** it was earned, **for which recipe**, and **from whom** (the giver, e.g. Chef Shrewy). So each ledger row stores its date, recipe and giver (Data and security).
   - **7c. Art and givers — decided 2026-10-28:**
     - **Each stamp is the paw only.** The **signature is shown for who gave it**: the sheet displays the giver's signature ("Chef Shrewy ♡" with the whisk) alongside that giver's prints, not on every stamp.
     - **Future givers:** the owner plans signature collectibles from **other characters** later. So every paw print records **who gave it** (a giver/character key; `shrewy` for now). Each giver has its own stamp art and signature art, and the sheet groups prints by giver.
     - Proposed: build a small character catalog in code now (Shrewy only) so a new character doesn't need a migration. **Balances are separate per character** (decided 2026-10-28). Shrewy's paw prints are spent only on Shrewy's rewards, and each future character has its own tokens and its own redemption list.
     - **Source art:** copied to `public/paw-prints/_staging/chef-shrewy-stamp-source.jpg` (local only, since `_staging` folders are git-ignored; 2048×2048 JPEG; paw, hat, sparkles, splatter and signature on cream paper).
     - **Final art, cut from the source 2026-10-28** (all real RGBA PNGs with transparent corners, checked on dark and cream backgrounds):
       - `public/paw-prints/shrewy_paw.png`: 512×512, the paw stamp. Pads, chef's hat, stripes and blush; the sparkles and splatter were dropped. The hat's white is kept solid. Pale crayon specks inside the pads are part of the texture.
       - `public/paw-prints/shrewy_paw_badge.png`: 128×128, the same paw for the badge over Shrewy (1b).
       - `public/paw-prints/shrewy_signature.png`: 1024×356, "Chef Shrewy ♡" with the whisk and the rainbow smudges under the letters, with open letter loops.
     - **How they were made:** the repo's `normalize-reward-icon.mjs` targets checkerboard or black backgrounds, so it doesn't fit this cream paper. Instead the paper was separated by colour distance from the paper tone. For the paw, the shapes were filled solid and small flecks dropped; the signature kept its open loops. Soft edges are unblended from the paper so there's no cream fringe.
     - **"Used" look (7a):** proposed in CSS (reduced opacity/desaturation plus a small mark), so no extra art is needed.
   - **7d. Earning moment:** when a correct answer earns a print, is there an animation, such as the stamp thumping onto a mini sheet in the pop-up, plus a Shrewy celebrate line?
8. **The redemption catalog** (per character, since balances are separate — 7c). Still being thought through by the owner. **First reward, decided 2026-10-28:**
   - **"Shrewy washes his hands" — 10 paw prints.** The idea came from the owner's child, who wants Shrewy clean before he cooks.
   - Once unlocked, a short video of Shrewy washing his hands at the sink plays **before the cooking scene starts**.

   **Design partly decided (2026-10-28)**: 8a is decided, 8b is delivered and settled, and 8c/8d are proposed. A prompt for generating the video is in the appendix.

   **Open for this reward:**
   - **8a. When it plays — decided 2026-10-28:**
     - It plays **once, right after a recipe is chosen** in the Recipe Book, every time a recipe is chosen.
     - It applies to **every cookable recipe**, in any scene (default, plain or interactive), not only interactive ones.
     - It **can't be skipped.** There's no on/off switch either; once unlocked, it always plays.
     - It plays only after the reward has been redeemed. Before that, choosing a recipe works exactly as today.
     - **Proposed order:** the book closes → the video plays (~6 s) → then whatever follows today: the special-ingredient picker if the child has any special ingredients, otherwise the kitchen with Shrewy's start line (Shop Kitchen Rules 18 and 21). Picking the selected recipe again to deselect it doesn't play the video.
     - **Must never block cooking:** if the video can't load or play (network error, a browser refusing playback), the flow carries on as if it had finished, perhaps after a short timeout (proposed ~2 s to start). Choosing a recipe is a tap, so the browser normally allows playback with sound.
     - **Music:** the kitchen music dips (or pauses) while the video's own sound plays, then comes back. The kitchen music mute doesn't affect the video's sound (item R: the mute covers the music only).
   - **8b. The video file:**
     - **Delivered 2026-10-28:** `public/video/shrewy_hand_wash.mp4`, reviewed the same day.
       - **Specs:** 6.0 s, 1280×720 (16:9, not the 1:1 asked for), 24 fps, H.264 High + AAC stereo, `moov` before `mdat` (streams while downloading), 2.73 MB.
       - **Picture:** on-model and on-style, with no text or watermark. The sequence runs faucet on → soap → bubbles → rinse → proud paws-up final pose; the final pose makes a good end frame to hold.
       - **Settled 2026-10-28:**
         - **Size:** re-encoded to **0.61 MB** (H.264 CRF 26, AAC 96 kbps, still streams while downloading) with no visible difference. The owner's original (2.73 MB) is kept locally at `public/video/_staging/shrewy_hand_wash_original.mp4` (`_staging` folders are git-ignored).
         - **Audio:** kept as is (the owner confirmed it has sound). When it plays, the kitchen music should dip, as it does under the dish reveal.
         - **Continuity:** accepted as is, including Shrewy drying his paws on his apron.
         - **Aspect:** 16:9 suits a pop-up or full-screen placement and would letterbox over the artwork; an input for 8c.
     - With sound? If so, the kitchen music should dip while it plays, the same way it does under the dish reveal.
     - Format: MP4 (H.264). It lives in `public/video/` (the owner's choice), not `public/kitchen/`.
     - Size matters: the music track already takes ~5 s to load on a first visit.
     - **Reduced-motion users — decided 2026-10-28:** the video plays regardless of the device's reduce-motion setting. The owner's reason: the app currently has one active child user, who doesn't need it. This is a deliberate exception to the kitchen's other animations, which respect reduced motion (Shop Kitchen Rules 18, 21). Revisit if the app opens to more families.
   - **8c. Placement (proposed):** since it plays in every scene, and each scene's artwork puts the sink in a different spot (or has none), a **pop-up over the kitchen** fits best: the 16:9 video centered on a dimmed backdrop, the same style as the dish reveal, with no close button.
   - **8d. Permanent?** Proposed: redeeming unlocks it **for good**; it is not consumed.

   **Still open for the whole catalog:**
   - Which other Shrewy rewards (e.g. a second music track) and their costs?
   - Is redeeming always permanent, or are some rewards consumable?
   - Who adds rewards later: hard-coded, or a Shop Admin catalog?
   - ~~Can parents see a child's paw prints and redemptions?~~ No — the Rewards page is child + platform-admin only (decision 10).
9. **A separate economy?** **Decided 2026-10-28: yes**: paw prints never convert to or from coins or ingredients, like the kitchen's ingredient economy.
10. ~~**Where does the page live?**~~ **Decided 2026-10-28:** a new page named **Rewards** (nav label EN "Rewards", ZH proposed 奖励), placed in the nav **right after Shop Kitchen**.
    - **Access:** child + platform admin only. Parents are route-blocked and the page is hidden from their nav, like `/words/shop` and `/words/shop/kitchen`. So parents don't see a child's paw prints or redemptions.
    - **Path:** proposed `/words/shop/rewards`, a sibling of `/words/shop/kitchen`.
    - This is a **new route**: it needs the `AI_CONTRACT.md §2` review and authorization. When it ships, `0_ARCHITECTURE.md` gets a Role-Based Routing permission-matrix row and a "Rewards Rules" section.
    - **What it shows:**
      - the paw-print count and available-to-spend number;
      - the stamp sheet (neat grid, 7b) with Shrewy's signature;
      - Shrewy's rewards with costs and Redeem buttons;
      - room for a section per future character.

## Data and security

New migration `supabase/migrations/<timestamp>_chef_challenge_paw_prints.sql`: five tables and three RPCs. Every table has RLS enabled, and **no table has a client insert/update/delete policy**. The RPCs are `security definer` and check the caller themselves, the same posture as the Shop Kitchen tables and reward offers. This deliberately avoids the client-writable pattern item Q exists to fix.

**`chef_challenge_questions`**: the shared question bank (decisions 2, 2c, 3).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `recipe_id` | uuid | FK → `shop_recipes.id`, cascades on delete |
| `prompt` | text | The question, Chinese only; 1–200 chars |
| `correct_answer` | text | 1–60 chars |
| `wrong_answers` | jsonb | Array of 2–3 strings, each 1–60 chars, all distinct from each other and from `correct_answer` (checked in the API route's validation; array length checked in the DB) |
| `is_active` | boolean | Default `true`; inactive questions are never issued |
| `display_order` | integer | Admin list order within a recipe |
| `created_at` / `updated_at` | timestamptz | |
| **RLS** | | **Platform-admin read and write only.** Children and parents can't select it at all, so the correct answer never reaches a child's browser (2g). Admin edits go through API routes (see Shop Admin below). |

**`chef_challenge_attempts`**: one row per challenge handed to a child.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` / `family_id` | uuid | The child; cascades on delete |
| `recipe_id` | uuid | FK → `shop_recipes.id`, cascades |
| `question_id` | uuid | FK → `chef_challenge_questions.id`, **on delete set null** (history survives a deleted question) |
| `round` | integer | The child's round number for this recipe (decision 2d) |
| `issued_at` | timestamptz | |
| `answered_at` | timestamptz (nullable) | Null = still open |
| `chosen_answer` | text (nullable) | |
| `is_correct` | boolean (nullable) | |
| **Constraint** | | At most one open attempt per `(user_id, recipe_id)` (partial unique index where `answered_at is null`) |
| **RLS** | | Family-scoped read (no answers stored here beyond the child's own choice); no client writes |

**`paw_print_awards`**: the earned-paw-print ledger, append-only (decisions 7, 7a, 7b, 7c).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` / `family_id` | uuid | Cascades on delete |
| `giver` | text | Character key; check `giver in ('shrewy')`. The check grows when a character is added |
| `recipe_id` | uuid (nullable) | FK, on delete set null; shown on tap (7b) |
| `attempt_id` | uuid | FK → `chef_challenge_attempts.id`, **unique**, so one attempt can never award twice |
| `earned_at` | timestamptz | Shown on tap (7b) |
| **RLS** | | Family-scoped read; no client writes |

**`paw_print_rewards`**: the reward catalog. It's server-side so the client can never set a price.

| Field | Type | Notes |
|---|---|---|
| `reward_key` | text | PK; launch row `shrewy-hand-wash` |
| `giver` | text | `shrewy` |
| `cost` | integer | > 0; launch row `10` |
| `is_active` | boolean | |
| **RLS** | | Authenticated read; writes by migration only (no admin UI for the catalog yet) |

**`paw_print_redemptions`**: what a child has redeemed. Redemptions are permanent (8d).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` / `family_id` | uuid | Cascades on delete |
| `reward_key` | text | FK → `paw_print_rewards` |
| `giver` | text | Copied from the reward |
| `cost` | integer | The price paid, snapshotted |
| `redeemed_at` | timestamptz | |
| **Constraint** | | Unique `(user_id, reward_key)`: a reward is unlocked once, for good |
| **RLS** | | Family-scoped read; no client writes |

**Balances (per giver, decision 7c):**
- **Available** = count of the child's `paw_print_awards` for that giver − sum of `cost` in their `paw_print_redemptions` for that giver.
- **Collected** = the award count.
- No running-balance column, the same convention as the ingredient ledgers.

**RPCs** (all `security definer`, `set search_path = public`, caller from `current_user_id()`; role must be `child` or the caller must be platform admin, the same check as `claim_session_ingredient_offer`). Each returns `jsonb` with `success` plus a `code` on failure.

1. **`get_chef_challenge(p_recipe_id uuid)`**: get the open challenge, or issue a new one.
   - **Refuses:** `forbidden`; `not_unlocked` (no `shop_recipe_unlocks` row for the caller); `no_questions` (no active question for the recipe).
   - **Refuses `cook_required`** (see the **one-per-cook rule** below).
   - **If an open attempt exists** for this child and recipe, it returns that same attempt, so closing and reopening never re-rolls the question (1c).
   - **Otherwise** it picks the next question: the active questions of this recipe not yet issued to this child in their current round. When none are left, the round number goes up and all active questions are eligible again (2d). The pick is random among the eligible ones. A question added mid-round is eligible at once, and a deactivated one is skipped.
   - **It inserts** the attempt and returns `{ attemptId, prompt, options }`. `options` is the correct and wrong answers **shuffled**, with no marker of which is right.
2. **`answer_chef_challenge(p_attempt_id uuid, p_answer text)`** locks the caller's own open attempt (`for update`). It refuses `no_attempt` or `already_answered`. It compares `p_answer` with the question's `correct_answer` and records the result. On a correct answer it inserts one `paw_print_awards` row (giver `shrewy`). It returns `{ isCorrect, correctAnswer, collected, available }`. The correct answer is revealed only **after** answering, so the pop-up can show it (decision 5).
3. **`redeem_paw_print_reward(p_reward_key text)`** locks the caller's redemption rows for that giver. It refuses `unknown_reward` (missing or inactive), `already_redeemed`, or `insufficient_paw_prints` (available < cost). Otherwise it inserts the redemption and returns the new `available`.
4. Reads (awards, redemptions, catalog) are plain selects through the RLS read policies; the service layer filters to the current user.

**One-per-cook rule (anti-farming; approved by the owner 2026-10-28).** The server never sees a "cook" until `cook_shop_recipe` runs, since the prep phase is client-only. Without a rule, a child could Cancel and re-pick a recipe over and over, answering a fresh challenge each time and never cooking. Proposed: **after answering a challenge for a recipe, the child must actually cook that recipe** before `get_chef_challenge` issues the next one for it. In SQL: refuse `cook_required` when the child's latest answered attempt for the recipe is newer than their latest `shop_cooked_dishes.cooked_at` for that recipe. Answering, then cancelling the cook, simply means no new challenge for that recipe until it's cooked once. This makes decision 1d hold on the server, not just in the UI.

## Layer impact

- **Database:** the migration above, deployed to dev, then prod, after `db:push:prod:dry`.
- **Service** (`src/lib/supabase-service.ts`):
  - `getChefChallenge`, `answerChefChallenge`, `redeemPawPrintReward`;
  - `listPawPrintAwards`, `listPawPrintRedemptions`, `listPawPrintRewards`.
- **Domain (pure, tested):** new `src/lib/pawPrints.ts`:
  - balance per giver;
  - which stamps show as used;
  - stamp ordering;
  - a TypeScript reference for the question-rotation rule (verified against the SQL by a dev script, like `mysteryFood.ts` / `verify-mystery-foods.ts`).
- **API (admin):** new `src/app/api/shop-admin/chef-questions/route.ts`: GET (one recipe's questions), POST (create), PATCH (edit/activate), DELETE. Uses the existing `authorizePlatformAdmin` pattern and the service-role client, like `shop-admin/recipes`.
- **UI:**
  - kitchen: challenge badge + pop-up, hand-wash video pop-up;
  - the new Rewards page;
  - the new Shop Admin section;
  - nav and permissions.
- **AI:** none.

## Proposed behavior

### A. The challenge in the kitchen
1. **Where:** only on an **interactive** recipe scene (one with `effects`; Shop Kitchen Rule 21), during **prep**. That means a recipe is selected, the stove hasn't been tapped, and no cook is running, including the time after every ingredient is in the pot (1, 1a).
2. **Checking availability:** when such a scene opens, the kitchen calls `get_chef_challenge(recipe)`. If it returns a challenge, a small **paw badge** (`shrewy_paw_badge.png`) shows over the painted chef's tap area, with bilingual ARIA "Chef's challenge: tap Shrewy" (1b). Any refusal means no badge, and taps keep today's chat lines (1e, 2c).
3. **Tapping Shrewy while the badge shows** opens the **challenge pop-up** (portal, dimmed backdrop, like the dish reveal). Ingredient dragging pauses underneath it (1c). The pop-up shows:
   - Shrewy's sprite in the `careful` pose with an **offer** line (6);
   - the Chinese question (no pinyin) and its 3–4 options as large tappable buttons (3);
   - a Close button.
4. **Closing without answering** costs nothing. The badge stays, the same question comes back on the next tap, and Shrewy says the **dismiss** line in the scene bubble (1c, 6).
5. **Answering** calls `answer_chef_challenge`. The buttons lock while it's in flight.
   - **Correct:** the chosen option turns green. Shrewy switches to `celebrate` with a **correct** line, a paw stamp "thumps" onto a small paper strip, the celebration chime plays, and "+1" shows next to the collected count (7d).
   - **Wrong:** the chosen option is marked wrong and the correct one is highlighted. Shrewy shows `idle` with a **wrong** line, and there's no retry (5).
   - **Either way:** the pop-up then shows a **Done** button. The badge disappears, the challenge for this cook is used (1d), and taps go back to chat lines.
6. **If the answer call fails** (network or server error), the pop-up shows a bilingual "Couldn't check your answer. Try again." with a retry. A failure never awards anything and never blocks cooking.
7. **Leaving the scene** (cooking, Cancel, leaving the page) closes the pop-up. An unanswered challenge stays open on the server and comes back next time.

### B. The Rewards page (`/words/shop/rewards`)
1. **Nav:** "Rewards" / 奖励, right after Shop Kitchen. **Child and platform admin only**; parents are route-blocked, and the link is hidden for them (10). `canAccessRoute` gains the path next to `/words/shop/kitchen`.
2. **Header:** Shrewy's signature (`shrewy_signature.png`), **Collected N** and **Available M**.
3. **Stamp sheet:** a cream paper card with a neat grid of `shrewy_paw.png` stamps, one per award, oldest first. It's about 5 per row on a typical screen, fewer on a narrow phone, and more on wide screens (7b).
   - **Used stamps:** the oldest *spent* ones (count = total cost redeemed) look used: faded and desaturated, with a small "redeemed" mark (7a).
   - **No stamps yet:** an empty sheet with a hint, e.g. "Cook a recipe with Shrewy's challenge to earn paw prints!"
4. **Tapping any stamp**, used ones included, opens a small detail card: the date earned, the recipe's localized title, and "From Chef Shrewy" (7b).
5. **Rewards list:** for launch, one card, **"Shrewy washes his hands"**, cost **10**. It has a short description and a still frame or the paw icon.
   - **States:** *Redeem* (enough paw prints), *Need N more* (disabled), *Unlocked ✓* (already redeemed).
   - **Redeem** opens a confirmation ("Spend 10 paw prints?"), then calls `redeem_paw_print_reward`. On success the card flips to Unlocked and Available drops by 10. Server refusals map to bilingual messages.
6. The layout leaves room for a section per future character (7c), but only Shrewy's renders now.

### C. The hand-wash reward
1. **When it plays:** once the child has redeemed `shrewy-hand-wash`, **every time a recipe is chosen** in the Recipe Book (any recipe, any scene). It plays once, **can't be skipped**, has no on/off switch, and plays even with reduced motion (8a).
2. **Flow:** the book closes → a pop-up plays `/video/shrewy_hand_wash.mp4` (16:9, centered on a dimmed backdrop, no close button) → on `ended`, the flow continues as today: the special-ingredient picker if any, otherwise the kitchen and Shrewy's start line. Deselecting a recipe doesn't play it (8a, 8c).
3. **Sound:** the video plays with its sound, and the kitchen music dips while it plays (`setKitchenMusicDucked`, as under the dish reveal). The music mute doesn't silence it (item R).
4. **Never blocks:** if playback hasn't started within ~2 s, or errors, the pop-up closes and the flow continues as if it had finished. If the browser refuses to play with sound, it retries muted once before giving up.
5. **Knowing it's unlocked:** the kitchen loads the child's redemptions with its other data.

### D. Shop Admin: curating questions
1. **New third section:** "Chef Challenges — Curate Recipe Questions", below "Link Ingredients To Recipes". It has the same card style and Expand/Collapse. **All three sections start collapsed** (2a); `isRecipeSectionCollapsed` now defaults to `true`.
2. **Recipe picker:** like "Selected recipe: …", listing every recipe (2a layout). The section then lists that recipe's questions in `display_order`, each with its prompt, the correct answer marked, the wrong answers, and an active toggle.
3. **Editing:** add, edit, activate/deactivate and delete, one question at a time (2f). The form has a prompt plus a **correct answer** field and **2–3 wrong answer** fields.
   - **Validation:** no blanks, no duplicates, length limits.
   - **Delete:** asks for confirmation, since it's destructive for content the owner wrote by hand.
4. **Preview:** shows the question as the child will see it: shuffled options in the challenge pop-up's style (2f).
5. **A note in the section:** questions only appear for recipes with an **interactive scene** (today: Crystal Pear Dew). That way the admin isn't surprised when questions for other recipes never show up.

### E. Strings
- **Bilingual EN/ZH** for all UI copy, in the feature's strings files:
  - kitchen and chef: `kitchen.strings.ts` / `kitchenChef.strings.ts` (the `challenge` lines from decision 6);
  - the new `rewards.strings.ts`;
  - Shop Admin's existing strings.
- **Parity tests** for each touched file.
- **Questions and options are Chinese only** (2b). They're content, not UI copy.

## Edge cases
- **No unlocked recipe has questions:** no badge anywhere; the Rewards page just shows an empty sheet.
- **A recipe's last active question is deactivated mid-round:** `no_questions`, so no badge. Reactivating it resumes the same round.
- **A question is edited after being issued:** the open attempt shows the edited text and is checked against the edited correct answer, since it reads by `question_id`. A deleted question with an open attempt closes that attempt unanswered: no award, and the next call issues a new one.
- **Two devices, same child:** the open-attempt unique index plus `for update` locking means only one answer counts, and the other gets `already_answered`.
- **Answer, then Cancel the cook:** no new challenge for that recipe until it's cooked once (the `cook_required` rule).
- **Not enough paw prints, or redeeming twice:** the server refuses; the UI disables the button anyway.
- **The video file is missing or fails:** cooking continues (C4).
- **Platform admin testing:** the admin can play and earn like a child (same role rule as the kitchen). The debug page could later grant paw prints, but that's not in scope.

## Risks
- **Farming:** handled by one attempt per cook (server rule) plus no awards without a server-checked answer.
- **Answer leakage:** handled by the question table being unreadable to children; options are shuffled; the answer is only returned after answering.
- **The unskippable video gets tiresome:** an accepted owner decision; revisit if the child complains.
- **Reduced-motion exception:** accepted for the current single-child usage; revisit if more families join.
- **Interactive-scene-only availability:** today that's one recipe, so earning is slow (10 prints = 10 Crystal Pear Dew cooks). That's acceptable for launch; more interactive scenes widen it.

## Test plan
- **Unit:** `pawPrints.ts`: balance per giver, used-stamp derivation, ordering, the rotation reference (rounds, no repeat within a round, new or deactivated questions mid-round).
- **Unit:** the admin draft validation (blank or duplicate answers, 2–3 wrong answers, length limits).
- **Unit:** the kitchen helpers: when the badge shows (interactive scene, prep phase, challenge available, not yet answered this cook), and the video-gate decision (unlocked + recipe chosen).
- **Unit:** strings parity for every touched or new strings file. Rewards page helpers (stamp detail formatting, reward card state).
- **API route:** the chef-questions route: success, plus 401/403 for a non-admin, plus validation errors (mocked Supabase).
- **Live on dev:** `scripts/verify-rls.ts` gains a section showing that a child JWT:
  - can't read `chef_challenge_questions`;
  - can't insert, update or delete any of the five tables;
  - can only read their own family's rows.
- **Live on dev:** new `scripts/verify-chef-challenge.ts`. It runs as a throwaway child and checks:
  - issue/answer/award;
  - the same open attempt is returned;
  - `already_answered`, `cook_required` and `not_unlocked`;
  - round rotation with no repeats;
  - redeem and its refusals;
  - balances.
  It cleans up after itself.
- **Manual QA in the browser:**
  - Crystal Pear Dew: the badge appears during prep; close/reopen shows the same question; a correct answer gives the stamp, chime and +1, and a wrong one shows the answer; the badge is gone after answering.
  - Rewards: the grid, tapping stamps, redeeming at 10.
  - The hand-wash video plays on the next recipe choice, can't be skipped, ducks the music, and doesn't block when the file is renamed.
  - Shop Admin: collapsed sections, curating questions, preview.
  - Phone width.
- **Before push:** `tsc`, `eslint`, `npm test`, `check:encoding`.

## Acceptance criteria
- [ ] Migration deployed to dev (then prod after review); `verify:rls` passes the new section (existing known failures unchanged); `verify-chef-challenge` all green on dev.
- [ ] Badge and challenge work only on interactive scenes during prep, once per cook, with every decision 1–6 behavior above.
- [ ] Paw prints are earned only through a server-checked correct answer; children can't read answers or write any of the five new tables.
- [ ] The Rewards page is in the nav after Shop Kitchen for child/admin only, shows the counts, grid, used stamps and tap details, and redeems the hand-wash reward for 10.
- [ ] The hand-wash video plays after every recipe choice once unlocked, unskippable, music ducked, never blocking.
- [ ] The Shop Admin question section works (add/edit/toggle/delete/preview, one recipe at a time), with all three sections collapsed on load.
- [ ] Bilingual UI with parity tests; questions Chinese only.
- [ ] `tsc`, `eslint`, `npm test`, `check:encoding` pass.
- [ ] `0_ARCHITECTURE.md` updated at ship: data schema (five tables), RLS, system guarantees, Shop Kitchen rules (challenge + video), a new Rewards Rules section, Shop Admin rules, the permission matrix, and the localStorage note if any. Roadmap row T updated.

## Appendix A — Video prompt: "Shrewy washes his hands" (reward 8)

For an AI video generator. Use **image-to-video** if the tool supports it, with `public/kitchen/chef_idle.png` as the character reference. If the tool takes a scene reference too, add `public/kitchen/kitchen_crystal-pear-dew.png` for style, palette and the sink. Placement (8c) isn't decided, so this asks for a standalone square clip that can sit in a pop-up or over the scene.

**Prompt**

> A short, gentle, looping-friendly animation in a cozy hand-painted storybook style: soft watercolor and colored-pencil textures, warm cream and honey-wood palette, thin warm-brown outlines, soft lighting, no harsh shadows.
>
> The character is **Chef Shrewy**, a round, chubby gray tabby cat with darker gray stripes on his head, back and tail, a small cream-colored belly, tiny dot eyes, a little "w"-shaped smile, pink blush cheeks, and thin whiskers. He wears a tall puffy white chef's hat and a sage-green apron. He has small rounded paws and a striped curling tail. Keep his proportions chibi and cute (big head, short limbs), exactly like the reference image.
>
> Setting: a close-up of a white farmhouse kitchen sink with a brass gooseneck faucet, set in a cream countertop under a small window with soft green leaves outside. A little bar of soap sits on the counter, and a sage-green hand towel hangs nearby.
>
> Action, in order, over about 5 seconds, with a static camera:
> 1. Shrewy hops onto a small wooden step stool in front of the sink and turns the faucet on with one paw; a thin, sparkling stream of water flows.
> 2. He picks up the soap and rubs his paws together, making a puff of round, shiny soap bubbles that float up around him.
> 3. He rinses his paws under the water, eyes happily closed.
> 4. He gives his paws a quick little shake, flicking a few water droplets, then pats them dry on the green towel.
> 5. He holds up both clean paws toward the viewer with a proud, happy face as tiny sparkles twinkle around his paws.
>
> Mood: wholesome, calm, playful, made for young children. Smooth, simple motion with no fast cuts.

**Negative prompt**

> realistic fur, photorealism, 3D render, human hands, extra limbs, extra fingers, distorted face, scary, dark lighting, messy water splashing everywhere, text, letters, watermark, logo, camera shake, fast cuts, different character design, collar, clothing other than chef's hat and apron

**Technical asks**
- **Aspect ratio 1:1**, at least 1024×1024. If the generator only offers 16:9, keep Shrewy and the sink centered with empty margins.
- **Length ~5 s** (3–6 s is fine). The first and last frames should be calm poses so the clip can start and end cleanly.
- **No baked-in text or music.** If sound is wanted (8b), a soft water trickle and bubble "pop" sounds only.
- **Export** MP4 (H.264). Keep the file small (ideally under ~2 MB) — it plays inside the kitchen, which already loads a 3.3 MB music file.

**If results drift off-model:** generate the five actions as separate short clips from the same reference image and join them, or lower the motion strength.
