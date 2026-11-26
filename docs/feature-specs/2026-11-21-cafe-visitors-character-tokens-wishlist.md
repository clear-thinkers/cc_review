# Feature Spec — 2026-11-21 — Café Visitors, Character Tokens and Wishlist Rewards

Proposed roadmap item **U**. Builds on Shop Kitchen (item J), the chef challenge and paw prints (item T, whose spec already planned for "selling dishes to other characters, who pay in their own tokens"), and the Rewards page (`0_ARCHITECTURE.md` Rewards Rules).

## Status

**Authorized by the owner 2026-11-21; roadmap item U.** Covers the `AI_CONTRACT.md §2` boundaries this feature crosses: new routes, tables, RPCs, RLS policies and the `shop_cooked_dishes.location` change. Dev only until the owner approves prod.

**Build state (2026-11-21):** code and migration `20261121120000` are written and **not deployed**. As built, where it differs from the draft below: no `/api` admin route (platform-admin RLS plus `save_shop_character_order`); the parent page is `/words/wishlist`; orders live in `shop_character_orders` + `shop_character_order_items`; `scripts/verify-cafe.ts` was **not written**: the RPC and RLS scenarios ran once on a throwaway local Postgres over a stub of the existing tables (60/60), which doesn't replace a run against the real dev database. `0_ARCHITECTURE.md` (Café Rules, Wishlist Rewards Rules) is authoritative.

### Wishlist photo (authorized 2026-11-26)

A parent or the platform admin can attach one optional photo of the real item to a wishlist reward; the child sees it on the Rewards page. Photos are shrunk in the browser and kept in a private, family-scoped storage bucket. Migration `20261126120000`; rules in `0_ARCHITECTURE.md` Wishlist Rewards Rule 6; checked on dev with `npm run verify:wishlist-photos` (13/13).

### Visit frequency (authorized 2026-11-25)

Each character can be limited per child to x visits a day, a week or a month, or to one visit on each of x random days a month, set in Shop Admin. A visit counts as soon as the visitor walks in, served or sent away, and a character who has used up their visits doesn't come back until the next period (owner answers 2026-11-25: 1 yes, 2 once a day, 3 doesn't return). Migration `20261125120000`; rules in `0_ARCHITECTURE.md` Café Rule 9. Checked on a throwaway local Postgres (20 frequency scenarios, 80/80 overall) and deployed to dev.

### Owner decisions (2026-11-21) — these supersede anything below that disagrees

1. **Name:** the page is the **Café** (`/words/shop/cafe`).
2. **Mixed wishlist prices:** yes. One reward can cost tokens from several characters, paw prints included.
3. **Redeeming a real-world reward:** child **and** parent signatures on the confirm screen, like the coin cash-out. Signing is the handover, so a redemption is complete at once. **There is no `requested → delivered` lifecycle**, no cancel/refund step and no admin fulfilment queue.
4. **Poems:** yes. A token can carry real content (a 诗笺 carries a poem), shown when the token is tapped. Part of this build, not a later phase.
5. **Mixed orders:** a character's order can contain **several foods with quantities** (e.g. 2 mooncakes + 1 tangyuan → 3 诗笺), set up in Shop Admin. This replaces the one-dish-per-row `shop_character_menu`: a character has **orders**, and each order has **items** (recipe + quantity) and one token price. Serving is all-or-nothing.
6. **Parents set up real-world rewards** on a simple parent page: name, price, one-time or repeatable. This replaces the Shop Admin "Wishlist" section.
7. **Sold dishes leave the shelf for good.** They never appear on the shelf or countertop again and don't count toward shelf stock.

**Defaults taken from this spec's proposals, since the owner didn't change them:** keep the `paw_print_*` table names (Q2); sending a visitor away is free (Q4); any variant of a recipe satisfies an order (Q5); a reward can target one child or the whole family (Q7); no child-entered wishes yet (Q9); visitor picks favor orders the child has unlocked (Q12). **Item Q (ledger hardening) was not authorized** and is not part of this build; the risk below stands.

## Problem

Today the reward loop ends on the shelf. Cooked dishes pile up and nothing uses them. Paw prints are the only tokens, and they buy only in-app extras (the hand-wash video). The owner wants:

1. **Characters** (designed by the owner) who come to a **café** and buy food from the child's shelf. One example is 李白.
2. Each character pays in **their own token**. For example, 李白 pays with poems he wrote (诗笺).
3. The child sees the tokens collected on the **Rewards** page, the same way as Shrewy's paw prints.
4. The child exchanges tokens for **real-world rewards the owner chooses** from the child's wishlist, such as a backpack.

This closes the loop: **quiz → ingredients → cook → sell → tokens → real reward**. Every token is backed by a dish, every dish by ingredients, and ingredients come mostly from finished quiz sessions.

## Scope

- **A. Characters catalog:** a table of characters with art, bilingual copy, their token, and which dishes they buy at what price. Chef Shrewy becomes its first row.
- **B. Generalized tokens:** paw prints become one kind of character token. Balances stay **per character**, as decided for item T (7c).
- **C. The café page:** a new child-facing scene over `public/shop/shop.png`. One visitor at a time walks in and orders. The child serves a matching dish from the shelf and gets paid in that character's tokens. The dish leaves the shelf.
- **D. Rewards page:** one token sheet per character (Shrewy's paw-print sheet generalized), plus a **Wishlist** section.
- **E. Wishlist rewards:** real-world rewards with token prices. Redeeming creates a request. A grown-up delivers it and marks it delivered.
- **F. Admin:** Shop Admin manages characters, what they buy, and the wishlist.

## Out of scope

- Live AI anything (characters' lines and poems are curated, persisted content: `AI_CONTRACT.md §1`).
- Any change to coins, wallets, scheduler, quiz data or ingredient ledgers. Selling spends a **dish**, never coins or ingredients.
- Converting between token types, or between tokens and coins.
- Child-entered wishes (the child typing a wish for a parent to approve). Possible later; see Q9.
- Parent-facing pages in v1 (see Q8).
- Selling the same dish twice, buying dishes back, or prices that change over time.
- Item Q (ledger hardening), but see Risks: this feature makes it more urgent.

## Proposed behavior

### A. Characters

A character is shared/global content (like `shop_recipes`), authored by the platform admin:

- key (e.g. `li-bai`), name `{ en, zh }`, a one-line intro `{ en, zh }`
- **token**: name `{ en, zh }` (e.g. "Poem slip" / 诗笺), icon (512 px) and badge (128 px)
- **sprites**: transparent 512×512 PNGs per pose. Proposed poses: `waiting` (ordering at the counter), `delighted` (paid, holding the dish), `sad-ish` (only if declining is shown; never sad, matching Shrewy's tone rule)
- **lines** `{ en, zh }` per moment: arrive/order, served, sent away (curated, a few variants each)
- **what they buy**: a list of recipes, each with a token price (e.g. 李白: 月饼 → 2 诗笺, 汤圆 → 1 诗笺). This is the character's "menu". It gives each character a personality (李白 and the moon → mooncakes), and recipe choice becomes a strategy for the child.
- `visits_cafe` (Shrewy = false: he gives tokens through the chef challenge, not by buying)
- `is_active`

Adding a character is a Shop Admin row plus art, with no migration (see Data, which replaces the `giver in ('shrewy')` check with a foreign key).

**Optional learning hook (Q6):** each token can carry content. A 诗笺 would carry one real line or short poem by 李白 (静夜思, 望庐山瀑布 …), curated like the chef questions. Tapping that token on the Rewards page shows the poem. Tokens become a collection worth reading, not just a counter.

### B. Tokens

- Paw prints are one character's tokens. Physical table names (`paw_print_*`) stay to avoid churn (Q2); code and docs call them "character tokens".
- An award records its **giver**, **source** (`chef_challenge` or `cafe_sale`), recipe and the event that caused it (the challenge attempt or the sale). One event awards once (unique key on source event).
- Balance per character = tokens awarded − tokens spent (on that character's in-app rewards **and** on wishlist rewards) + tokens refunded by cancelled wishlist requests. No running-balance column, same as today.
- Spent tokens stay on the sheet, faded and marked "Redeemed" (item T 7a, unchanged).

### C. The café (`/words/shop/cafe`, name TBD, Q1)

**Access:** child + platform admin only, like the other shop pages. Nav item right after Rewards… or before it (Q1).

**Scene:** `shop.png` with hotspots, using the same `SceneHotspot` percentage boxes as the kitchen:

| Hotspot | Does |
|---|---|
| Green door | where the visitor enters (animation) |
| Register counter | the visitor stands here with a speech bubble showing the order |
| Display case | opens **"Your shelf"**: the child's shelved dishes as tiles (same `DishTileGrid`), the ordered one highlighted |
| Menu boards | optional: the current visitor's menu (what they buy and for how many tokens) |
| Table | after being served, the visitor sits and eats for a moment, then leaves |

**Flow:**

1. **Arrival.** Opening the café asks the server for the current visit (`get_cafe_visit`). If none is open, the server creates one: it picks an active visiting character and one dish from that character's menu. The visit is stored, so a refresh or another device shows the same visitor and order (like an open chef-challenge attempt).
2. **Order.** The visitor walks in and says the order in a bubble: dish icon + name + price in tokens ("Mooncake, please! I'll pay 2 poem slips.").
3. **Serve.** If the child has that dish on the **shelf**, serving it calls `serve_cafe_visit`. If the child doesn't have it, the bubble says so gently and the "Not now" button shows. The order can be cooked first and served later; the visit waits.
4. **Payment.** On success: the `delighted` pose, a served line, the token flies into a little "+2" counter, the celebration chime. Then the visitor sits at the table, eats, and leaves. A new visitor can arrive.
5. **Not now.** The child can send a visitor away. A new visitor arrives after a short delay (Q4: free reroll vs. cooldown).

**Which dish leaves the shelf:** the child serves a dish tile (recipe + resolved variant). The server takes the **oldest shelved row** of that recipe and variant. Countertop dishes can't be sold, so Organize stays meaningful.

**Variants (Q5):** proposed v1: any variant of the ordered recipe satisfies the order, at the same price. Later, a character could prefer or pay extra for a named variant.

**Chef Shrewy** isn't in the café in v1.

### D. Rewards page

- **Token sheets:** one paper sheet per character the child has tokens from, Shrewy first. Each uses that character's token art and heading ("李白的诗笺"). Tapping a token shows when, for which dish, and from whom. With Q6, it also shows the poem.
- **In-app rewards:** unchanged (`paw_print_rewards`, e.g. the hand-wash video).
- **Wishlist section** (new): cards for each wishlist reward, showing its picture, name, and price. A price can combine tokens from different characters (Q3).
  - **Card states:** *Redeem*, *Need more* (shows what's missing per character), *Requested — waiting for a grown-up*, *Delivered* (with date), or *Sold out* (one-time reward already redeemed).
  - **Redeem** asks for confirmation (same pattern as cash-out's confirm modal; a note/signature is optional, Q10), then calls `request_wishlist_reward`. Tokens are deducted **at request time** so the child can't spend them twice while waiting.

### E. Wishlist rewards

- A wishlist reward: name `{ en, zh }`, optional picture, price, optional `max_redemptions` (backpack = 1; "a trip for ice cream" = unlimited), `is_active`, display order.
- **Scope:** **family-scoped**, optionally for one child (Q7). A backpack is a real thing one family promised; it can't be global catalog content like recipes are.
- **Lifecycle of a request:** `requested` → `delivered` (a grown-up marks it) or `cancelled` (a grown-up cancels; the tokens come back).
- **Who marks delivered** is Q8. v1 proposal: the platform admin, from Shop Admin.

### F. Admin (Shop Admin)

Two new collapsible sections, both starting collapsed (Shop Admin Rule 13):

- **Café Characters:** add/edit a character's copy, token copy, art paths, lines, active/visiting flags, and their menu (recipe + token price). It validates that menu recipes are cookable (`cook_method` set) and that art paths exist (Debug's icon audit can extend to character art).
- **Wishlist:** add/edit/deactivate rewards; see open requests with *Mark delivered* / *Cancel and refund*. Cancel asks for confirmation, a justified exception to `0_BUILD_CONVENTIONS.md §5`, because it gives tokens back.

All admin calls go through service-role API routes that check platform admin from the token's own claims, like `/api/shop-admin/chef-questions`.

## Data and security (proposed; needs authorization)

All new writes go through **security-definer RPCs** with explicit role and ownership checks. Clients get read policies only, the same posture as the paw-print tables.

**New: `shop_characters`** (global; authenticated read, platform-admin write)
`character_key` (pk), `name_i18n`, `intro_i18n`, `token_name_i18n`, `token_icon_path`, `token_badge_path`, `sprite_paths` jsonb (pose → path), `lines_i18n` jsonb (moment → `{en, zh}[]`), `visits_cafe`, `is_active`, `display_order`, timestamps. Seeded with `shrewy` (`visits_cafe = false`).

**New: `shop_character_menu`** (global)
`character_key` fk, `recipe_id` fk, `token_price` int > 0, unique `(character_key, recipe_id)`.

**Changed: `paw_print_awards` / `paw_print_rewards` / `paw_print_redemptions`**
- Replace `check (giver in ('shrewy'))` with `references shop_characters(character_key)`.
- `paw_print_awards` gains `source` (`'chef_challenge' | 'cafe_sale'`, default `'chef_challenge'`) and `cafe_visit_id` (nullable, unique). There's a check that exactly one of `attempt_id`/`cafe_visit_id` is set for new rows (`attempt_id` can already be nulled by `on delete set null`, so the check must allow both null for old rows).
- Writers: `answer_chef_challenge` (unchanged) and `serve_cafe_visit` (new).

**New: `cafe_visits`** (family-scoped read; no client writes)
`id`, `user_id`, `family_id`, `character_key`, `recipe_id`, `token_price` (snapshotted), `status` (`open | served | dismissed`), `served_dish_id` (fk `shop_cooked_dishes`), `created_at`, `closed_at`. Partial unique index: one `open` visit per child.

**Changed: `shop_cooked_dishes.location`** gains `'sold'`.
- Only `serve_cafe_visit` sets it, and only `shelf → sold` for the caller's own row.
- The row stays, so "dishes ever cooked" (favorites, Shop Kitchen Rule 20) still counts it.
- This updates Shop Kitchen Rules 6–8 and guarantee 6b ("organize is the only updater of `location`").

**New: `wishlist_rewards`** (family-scoped read; written via admin route)
`id`, `family_id`, `user_id` (nullable = any child in the family), `name_i18n`, `image_path` (nullable), `max_redemptions` (nullable), `is_active`, `display_order`, timestamps.

**New: `wishlist_reward_prices`**
`wishlist_reward_id` fk, `character_key` fk, `token_count` int > 0. One row per character in the price (Q3).

**New: `wishlist_requests`** (family-scoped read; no client writes)
`id`, `user_id`, `family_id`, `wishlist_reward_id`, `price_snapshot` jsonb (`{ characterKey: count }`), `status` (`requested | delivered | cancelled`), `requested_at`, `resolved_at`, `resolved_by_user_id`, optional `note`.

**Balance per character** (SQL helper replacing `paw_print_balance`, same TS reference in `pawPrints.ts`):
awards − Σ `paw_print_redemptions.cost` − Σ snapshot counts of non-cancelled `wishlist_requests`.

**RPCs**
1. `get_cafe_visit()`: role check (child/platform admin). It returns the open visit, or creates one. The pick is a random active visiting character, then a random dish from their menu. Proposed: dishes the child has **unlocked** are weighted higher, so orders are achievable. It's serialized per child (advisory lock).
2. `serve_cafe_visit(p_visit_id, p_recipe_id, p_icon_rule_key)`: it locks the caller's open visit and checks the recipe matches the order. It picks the oldest matching `shelf` dish (variant per Q5), refusing `not_on_shelf` if there isn't one. In one transaction it sets the dish to `sold`, inserts `token_price` award rows (one per token, the ledger convention), and closes the visit as `served`. It returns the new balance.
3. `dismiss_cafe_visit(p_visit_id)`: closes the visit as `dismissed` (cooldown per Q4).
4. `request_wishlist_reward(p_reward_id)`: role check, then checks that the reward belongs to the caller's family (and child, if set), is active, and isn't sold out. It locks per child across **all** characters in the price, checks every balance, and inserts the request with the price snapshotted. The price never comes from the client.
5. `resolve_wishlist_request(p_request_id, p_status)`: platform admin (or parent, Q8) of that family marks it `delivered` or `cancelled`; only from `requested`.

**Hard stops respected:** none of `wallets`, `shop_recipe_unlocks`, `shop_coin_transactions`, `coin_redemptions` is touched. `AI_CONTRACT.md §1` gains a line naming the new tables and their only writers.

## Layer impact

- **Domain:** `src/lib/characterTokens.ts` (generalized from `pawPrints.ts`: balances across sources and wishlist spends, sheet building, wishlist card state, which shelf dish serves an order); `src/lib/cafe.ts` (visit/order helpers, TS reference for the server pick).
- **Service:** new functions in `supabase-service.ts`; result normalizers for every RPC. **Fix the location mapping** (`supabase-service.ts:1723`, `normalizeShopDishLocation` in `shop.ts`): today anything not `'shelf'` becomes `'countertop'`, so a sold dish would come back as a countertop dish and block cooking.
- **UI:** `src/app/words/shop/cafe/` (`page.tsx`, `CafeSection.tsx`, `CafeVisitor.tsx`, `ServeDishModal.tsx`, `cafe.strings.ts`, `cafe.types.ts`, a keyframes-only animation module only if walk/eat can't be done in Tailwind); `RewardsSection.tsx` grows token sheets per character and the wishlist; Shop Admin gains two sections; nav + `RouteGuard` + the permission matrix gain the café route.
- **Kitchen:** the helpers that already filter by `'shelf'`/`'countertop'` keep working. Shrewy's favorites still count sold dishes. Optional: Shrewy's shelf line could notice "you sold your last mooncake!" (later).
- **Scripts:** `scripts/verify-cafe.ts` (like `verify-chef-challenge.ts`); `verify-rls.ts` Section 14.

## Edge cases

- **Serving with no matching dish on the shelf** (the dish is on the countertop, or was just served on another device): the RPC refuses `not_on_shelf`; the UI suggests Organize or cooking.
- **Character deactivated, or dish removed from their menu, while a visit is open:** the open visit is still honored at its snapshotted price, or closed on next `get_cafe_visit`. Proposed: honor it.
- **No active visiting characters, or no menu dishes:** the café shows an empty state ("No one's here yet"), and no visit is created.
- **Recipe deleted:** `cafe_visits.recipe_id` set null → the visit is closed; awards keep their row with `recipe_id` null (existing behavior).
- **Two devices serve the same visit:** the row lock means one wins; the other gets `visit_closed`.
- **Wishlist price changed after a request:** the request keeps its snapshot; refunds use the snapshot.
- **A one-time reward requested on two devices at once:** serialized; the second gets `sold_out`.
- **The child leaves mid-animation:** the server already committed the sale; the next visit shows the new balance.

## Risks

- **Real-world value from a game loop.** Coins buy ingredients (`purchase_shop_ingredient`), ingredients make dishes, dishes become tokens, tokens become a backpack. So coins gain a second route to real value besides cash-out (100 coins = $1). Price wishlist rewards with that in mind (see Calibration), or make café menus favor **mystery foods** (which can't be bought with coins), so tokens trace back to quiz wins.
- **Item Q gets more urgent.** Today a client can write `wallets.total_coins` directly. Inflated coins → bought ingredients → tokens → a real backpack. Recommend authorizing item Q before or with this feature.
- **`shop_cooked_dishes` now mutates in a second way.** The location mapping bug above is the concrete trap. Every reader of `location` must be audited.
- **Generalizing `paw_print_*`** touches a shipped, verified feature. `verify:chef-challenge` must still pass 38/38 after the migration.
- **Art volume.** Each character needs sprites, token art and lines before they're usable. The catalog lets characters ship one at a time.
- **Multi-tenant scope.** Characters are global, but wishlist rewards are family-scoped. Mixing the two up would show one family's promised backpack to another family. RLS tests must cover this.

## Calibration (to fill in with the owner)

Rough pipeline today: a 10–19 item session lets the child pick 1 ingredient, and most foods need 3–5 ingredient units. So **one dish ≈ several sessions**. A worked example to react to:

| Thing | Proposal |
|---|---|
| Ordinary dish | 1 token |
| Mystery food / hard dish | 2–3 tokens |
| Small wishlist item (sticker pack) | ~5 tokens |
| Backpack | ~20–30 tokens across 2+ characters |

## Test plan

- **Unit:** balances with chef awards + café awards + in-app redemptions + wishlist requests (requested, delivered, cancelled); sheets per character; wishlist card states incl. multi-character "need more"; picking the oldest shelf dish per recipe + variant; location normalization of `'sold'`; strings parity for `cafe.strings.ts` and the new `rewards.strings.ts` keys; types companion tests.
- **Service:** every RPC normalizer, including each refusal code.
- **Live (dev) `verify-cafe.ts`:** visit creation is idempotent and per-child; serve succeeds only with a shelf dish and marks exactly one row `sold`; double serve; dismiss; awards source/giver/recipe; the wishlist request deducts, sells out, and refuses overspending; cancel refunds; parent/other-family/other-child refusals; no direct client writes to any new table.
- **Regression:** `verify:chef-challenge`, `verify:rls`, `verify:mystery-foods`; the kitchen's countertop capacity, shelf count, scene stock and favorites with sold dishes present.
- **Manual QA:** full loop on dev: quiz → cook → organize → serve 李白 → token on Rewards → request a wishlist reward → mark delivered in Shop Admin.

## Acceptance criteria

- A child can open the café, see a visitor's order, serve a shelved dish, and receive that character's tokens; the dish no longer appears on the shelf, the countertop is unaffected.
- The Rewards page shows a sheet per character; Shrewy's paw prints and the hand-wash reward behave exactly as before.
- A child can request a wishlist reward only with enough of each required token; tokens are deducted immediately; a grown-up can mark it delivered or cancel and refund.
- No new table can be written directly by a client; one family can never see another's wishlist.
- `0_ARCHITECTURE.md` (new Café Rules, Rewards Rules, Shop Kitchen Rules 6–8, Shop Admin Rule 14, schema, guarantee 6f, permission matrix), `AI_CONTRACT.md §1`, `0_BUILD_CONVENTIONS.md §10` and the roadmap are updated in the same commits.

## Build phases

1. **Characters + generalized tokens.** Migration for `shop_characters`, `shop_character_menu`, FK swap, `source` column. Rewards page renders sheets from the catalog. No visible change for the child yet; `verify:chef-challenge` must stay green.
2. **The café.** `cafe_visits`, `'sold'`, the three café RPCs, the page and scene, Shop Admin "Café Characters", `verify-cafe.ts`. Ships with the first character (李白) once art is ready.
3. **Wishlist.** Three wishlist tables, two RPCs, Rewards wishlist section, Shop Admin "Wishlist" section.
4. **Optional:** token content (poems), more characters, variant preferences, Shrewy café cameo.

Phase 3 could come before Phase 2 if the owner wants paw prints redeemable for real rewards sooner (Q3).

## Art needed from the owner (per character)

- Sprites, 512×512 transparent PNG: `waiting`, `delighted` (and optional `walking`, `eating`)
- Token icon 512×512 and badge 128×128, transparent
- Lines (EN + ZH): 3 arrival/order, 3 served, 1–2 sent away
- Their menu: which recipes and for how many tokens
- Optional: token content (e.g. 10 poem lines)
- Café scene: `shop.png` is ready; hotspots get measured in the build (the same method as the add-kitchen-scene skill's Phase B)

## Open questions (owner)

1. **Name and nav.** The page name. "Café" / 小餐馆? ("Shop" clashes with Recipe Shop.) Route `/words/shop/cafe`? Nav order: Recipe Shop → Shop Kitchen → Café → Rewards (proposed)?
2. **Table names.** Keep `paw_print_*` and call them character tokens in code/UI (proposed, less risk), or rename to `character_token_*` in the migration?
3. **Wishlist pricing.** Is a price in one character's tokens, or a mix ("10 诗笺 + 5 paw prints")? Proposed: a mix (one row per character), which also lets paw prints count toward real rewards. Should paw prints count at all?
4. **Sending a visitor away.** A free and immediate new visitor (proposed: harmless, since payment still needs the dish)? Or a cooldown, so the child has to cook what's asked?
5. **Variants.** Does any variant satisfy an order at the same price (proposed v1)?
6. **Token content.** Should 诗笺 carry real poem lines, shown when tapped (proposed, as a Phase 4 learning hook)?
7. **Wishlist scope.** Is a reward for the whole family, or for one specific child? Proposed: a nullable `user_id`.
8. **Who fulfils.** v1 is the platform admin in Shop Admin (proposed, since you're the only family). Later, should a parent manage their own family's wishlist? That means a parent-facing page, because parents are blocked from shop pages today.
9. **Child wishes.** Should the child be able to add a wish for a grown-up to approve and price? Proposed: later.
10. **Redeem ceremony.** Ask for a note + signature like coin cash-out, or just confirm?
11. **Item Q.** Authorize ledger hardening before Phase 3 (recommended, see Risks)?
12. **Visitor pick.** Uniformly random, or weighted toward dishes the child has unlocked or has on the shelf (proposed: weighted toward unlocked)?
