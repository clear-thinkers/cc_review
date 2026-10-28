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

## Open questions (owner)

**The challenge**
1. **When is it "during cooking"?** While any recipe is selected? Only in interactive recipe scenes (today: Crystal Pear Dew)? Only during the ~3 s boil? On the default kitchen scene too, where the chef sprite stands on the ladder?
2. **Where do questions come from?** Suggested: the child's own characters and phrases from saved content (`words` / `flashcard_contents` / `vocab_phrases`), e.g. weighted toward low familiarity. Or a fixed, curated question set? Or recipe-themed vocabulary?
3. **Format?** Multiple choice on meaning, multiple choice on pinyin, pick the character for a picture or word, fill a blank in an example sentence? How many options? Is there pinyin or audio support?
4. **Does an answer touch review scheduling?** Recommended **no**: it keeps scheduler rules clean (`0_ARCHITECTURE.md` §4 guarantee 8) and makes this a game rather than a review.
5. **Wrong answer:** retry, reveal the answer, or end the challenge? **Limits:** cap paw prints per day or per cook so a child can't farm them? Cooldown between challenges?
6. **What does the chef say?** Bilingual prompt, praise and try-again lines in `kitchenChef.strings.ts`, with chef poses for each.

**Paw prints and redemption**
7. **What is a paw print?** One generic counter, or distinct "signatures" (per recipe, per chef pose, seasonal) that are collected like stamps?
8. **The redemption catalog:** which rewards exist at launch, and what each costs? Is redeeming permanent (it unlocks for good) or consumable? Who adds rewards later: hard-coded, or a Shop Admin catalog? Can parents see a child's paw prints and redemptions?
9. **A separate economy?** Recommended **yes**: paw prints never convert to or from coins or ingredients, like the kitchen's ingredient economy.
10. **Where does the page live?** Suggested a sub-page of the shop (e.g. `/words/shop/paw-prints`), children and the platform admin only, matching `/words/shop`. Any new route needs the `AI_CONTRACT.md §2` route/RLS review.

## Data and security (proposed — for review)

- **A new append-only ledger** of earned paw prints and a redemption record, family/user-scoped, with **no client write policies**. They're written only by `security definer` RPCs that validate the caller. This is the same posture as the Shop Kitchen tables and the reward offers, and deliberately avoids the client-writable pattern that item Q (ledger write hardening) exists to fix.
- **The server decides whether an answer is correct.** If the client reports "correct", a child could forge paw prints. Options:
  - the server issues the question and checks the answer;
  - the server re-derives the expected answer from saved content.

  To decide with question 2.
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
