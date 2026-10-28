# Feature Spec — 2026-10-28 — Chef Challenge + Paw-Print Collectibles

Roadmap item **T**. Builds on Shop Kitchen (item J), the kitchen chef (item O) and recipe scenes / interactive cooking (`0_ARCHITECTURE.md` Shop Kitchen Rule 21).

## Status

**Skeleton — open questions only (2026-10-28).** Problem and rough scope come from the owner. Everything under "Proposed behavior" waits on the answers below. **Not authorized for build:** this feature needs a schema migration and a new page, both `AI_CONTRACT.md §2` boundaries. Implementation starts only after the spec is approved and the owner's reply contains the word "authorized".

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
- Building the individual rewards themselves; this spec covers earning, storing and redeeming.
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
4. **Does an answer touch review scheduling?** Recommended **no**: it keeps scheduler rules clean (`0_ARCHITECTURE.md` §4 guarantee 8) and makes this a game rather than a review.
5. ~~**Wrong answer.**~~ **Decided 2026-10-28:** the pop-up **shows the correct answer**, and Shrewy says a "try again next time" line. There's no retry. That cook's challenge is used up (1d), and the question comes back in a later round (2d).
   - **Limits:** decisions 1d and 2d already cap earning at one paw print per cook, and cooking is limited by ingredients. Proposed: no extra daily cap or cooldown.
6. ~~**What does the chef say?**~~ **Designed 2026-10-28** (the owner delegated the design; the owner may revise wording).
   - **Where the poses show:** the challenge only runs in interactive scenes, where Shrewy is **painted into the artwork**, so the scene can't change his pose. The **challenge pop-up** therefore shows his sprite (`public/kitchen/chef_<pose>.png`) beside a speech bubble, and the pose changes there.
   - **Storage:** lines live in `kitchenChef.strings.ts` under a new `challenge` group (EN + ZH).
   - **Picking a line:** one variant at random, never repeating the previous line (the same rule as the other chef lines).
   - **Answer options:** the question and its options stay Chinese only (2b); only Shrewy's lines and the pop-up's buttons are bilingual.

   | Moment | Where | Pose | EN | ZH |
   |---|---|---|---|---|
   | **Offer** — pop-up opens | pop-up | `careful` | Chef's challenge! Answer my question and I'll give you my paw print! | 大厨挑战！答对我的问题，就送你一个爪印！ |
   | | | | Before we cook, a little culture quiz! Ready? | 开火之前，先来一道文化小问题！准备好了吗？ |
   | | | | Psst... I have a secret question for you. Get it right for a paw print! | 嘘……我有一个秘密问题，答对就送你爪印哦！ |
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
   - **7b. Sheet layout — decided 2026-10-28: a neat grid** of stamps on the paper sheet, not scattered. Still open (minor):
     - stamps per row/page on a phone vs. a desktop;
     - whether tapping a stamp shows when and for which recipe it was earned.
   - **7c. Art and givers — decided 2026-10-28:**
     - **Each stamp is the paw only.** The **signature is shown for who gave it**: the sheet displays the giver's signature ("Chef Shrewy ♡" with the whisk) alongside that giver's prints, not on every stamp.
     - **Future givers:** the owner plans signature collectibles from **other characters** later. So every paw print records **who gave it** (a giver/character key; `shrewy` for now). Each giver has its own stamp art and signature art, and the sheet groups prints by giver.
     - Proposed: build a small character catalog in code now (Shrewy only) so a new character doesn't need a migration. **Balances are separate per character** (decided 2026-10-28). Shrewy's paw prints are spent only on Shrewy's rewards, and each future character has its own tokens and its own redemption list.
     - **Source art:** copied to `public/paw-prints/_staging/chef-shrewy-stamp-source.jpg` (local only, since `_staging` folders are git-ignored; 2048×2048 JPEG; paw, hat, sparkles, splatter and signature on cream paper).
     - **Still needed**, derived from it:
       - a transparent paw-only PNG (paw pad with hat, stripes and blush; whether the sparkles and splatter stay is the owner's call);
       - a transparent signature PNG ("Chef Shrewy ♡" + whisk);
       - a small version of the paw for the badge over Shrewy (1b).
     - Finals go to `public/paw-prints/` through the repo's usual transparency step.
   - **7d. Earning moment:** when a correct answer earns a print, is there an animation, such as the stamp thumping onto a mini sheet in the pop-up, plus a Shrewy celebrate line?
8. **The redemption catalog** (per character, since balances are separate — 7c). Still being thought through by the owner. **First reward, decided 2026-10-28:**
   - **"Shrewy washes his hands" — 10 paw prints.** The idea came from the owner's child, who wants Shrewy clean before he cooks.
   - Once unlocked, a short video of Shrewy washing his hands at the sink plays **before the cooking scene starts**.

   **Design deferred by the owner (2026-10-28)** — the questions below are parked until the owner returns to them. A prompt for generating the video is in the appendix.

   **Open for this reward:**
   - **8a. When it plays:**
     - when an interactive recipe scene opens (a recipe was just selected)?
     - before every cook, in every scene?
     - Every time, or with an on/off toggle after unlocking?
     - Can the child tap to skip it?
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
     - Reduced-motion users: proposed to skip the video.
   - **8c. Placement:** full-screen over the scene, or played in place over the sink area of the artwork?
   - **8d. Permanent?** Proposed: redeeming unlocks it **for good**; it is not consumed.

   **Still open for the whole catalog:**
   - Which other Shrewy rewards (e.g. a second music track) and their costs?
   - Is redeeming always permanent, or are some rewards consumable?
   - Who adds rewards later: hard-coded, or a Shop Admin catalog?
   - ~~Can parents see a child's paw prints and redemptions?~~ No — the Rewards page is child + platform-admin only (decision 10).
9. **A separate economy?** Recommended **yes**: paw prints never convert to or from coins or ingredients, like the kitchen's ingredient economy.
10. ~~**Where does the page live?**~~ **Decided 2026-10-28:** a new page named **Rewards** (nav label EN "Rewards", ZH proposed 奖励), placed in the nav **right after Shop Kitchen**.
    - **Access:** child + platform admin only. Parents are route-blocked and the page is hidden from their nav, like `/words/shop` and `/words/shop/kitchen`. So parents don't see a child's paw prints or redemptions.
    - **Path:** proposed `/words/shop/rewards`, a sibling of `/words/shop/kitchen`.
    - This is a **new route**: it needs the `AI_CONTRACT.md §2` review and authorization. When it ships, `0_ARCHITECTURE.md` gets a Role-Based Routing permission-matrix row and a "Rewards Rules" section.
    - **What it shows:**
      - the paw-print count and available-to-spend number;
      - the stamp sheet (neat grid, 7b) with Shrewy's signature;
      - Shrewy's rewards with costs and Redeem buttons;
      - room for a section per future character.

## Data and security (proposed — for review)

- **A new append-only ledger** of earned paw prints (each row records its **giver** — decision 7c — and the question/recipe it was earned on) and a redemption record, family/user-scoped, with **no client write policies**. They're written only by `security definer` RPCs that validate the caller. This is the same posture as the Shop Kitchen tables and the reward offers, and deliberately avoids the client-writable pattern that item Q (ledger write hardening) exists to fix.
- **A shared question bank** (decision 2), global like `shop_recipes`, each question tied to a recipe (2c). It is **platform-admin write only**, and the correct answer must not be readable by children (2g).
  - Either children get no direct read access at all and all reads go through RPCs, or the answer lives in a column or table they can't read.
  - Admin edits go through API routes, the same pattern as Shop Admin's recipe and catalog routes.
- **The server decides whether an answer is correct**, never the client. Otherwise a child could forge paw prints.
  - Proposed: one RPC hands out a question (without the answer) and records which question was given for this cook.
  - A second RPC checks the chosen option, enforces one challenge per cook (decision 1d), and on a correct answer appends one paw print to the ledger, all atomically.
- New tables/RPCs need `verify-rls.ts` coverage and a migration on dev, then prod.

## Layer impact (expected)

- **UI:** chef challenge UI in the kitchen; redemption page; bilingual strings.
- **Service:** new `supabase-service.ts` functions for the RPCs.
- **Database:** migration (tables, RLS, RPCs).
- **Domain:** a pure question-building/checking helper with tests.
- No AI layer change.

## Proposed behavior

*To be written once the open questions are answered.*

## Edge cases

*To be written.* Known so far:
- The child cancels cooking mid-challenge.
- A plain recipe scene (no chef interaction today).
- A child with too little saved content to build a question.
- Offline, or a failed RPC during an award.

## Risks

*To be written.* Known so far:
- Farming (limits).
- Forged awards (server-side checking).
- Distraction from the cooking flow.

## Test plan

*To be written.*

## Acceptance criteria

*To be written.*

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
