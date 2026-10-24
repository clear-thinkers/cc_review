#!/usr/bin/env tsx
/**
 * Mystery Foods verification (roadmap items L/M/N; spec docs/feature-specs/2026-10-24-mystery-foods.md)
 *
 * Exercises reward_session_ingredients and the mystery branches of
 * unlock_shop_recipe / purchase_shop_ingredient / reward_random_ingredients against a
 * live Supabase DEV project, as a real child JWT. The TypeScript reference
 * implementation of the reward rules lives in src/lib/mysteryFood.ts; this script
 * checks that the SQL behaves the same way.
 *
 * It creates a throwaway family + children, TEMPORARY mystery foods/ingredients
 * (keys prefixed `zz-test-`), and, for the "temp foods" phase, briefly sets the real
 * `crystal-dumpling` recipe inactive so the ordering scenarios are deterministic.
 * Everything is restored/removed in a finally block; if the script is killed hard,
 * re-run it (or set shop_recipes.is_active = true for slug 'crystal-dumpling').
 *
 * Env vars (auto-loaded from .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Dev only -- no --prod flag.
 *
 * Usage: npm run verify:mystery-foods
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

// ─── env ───────────────────────────────────────────────────────────────────
try {
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // rely on explicit env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── tracking ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${label}`);
    if (detail) console.error(`         ${detail}`);
    failed++;
  }
}
const show = (value: unknown): string => JSON.stringify(value);

// ─── state ─────────────────────────────────────────────────────────────────
const TAG = `zz-test-${Date.now()}`;
const familyIds: string[] = [];
const authUserIds: string[] = [];
const tempRecipeIds: string[] = [];
const tempIngredientKeys: string[] = [];
let realRecipeId: string | null = null;
let realWasActive = true;

type Reward = { ingredientKey: string; quantity: number; isMystery: boolean };
type RewardResult = { isWin: boolean; ingredients: Reward[]; unlockedRecipeIds: string[] };

// ─── helpers ───────────────────────────────────────────────────────────────
async function createChild(label: string): Promise<{ client: SupabaseClient; userId: string; familyId: string }> {
  const { data: fam, error: famErr } = await admin
    .from('families')
    .insert({ name: `${TAG}_${label}` })
    .select('id')
    .single();
  if (famErr || !fam) throw new Error(`family insert: ${famErr?.message}`);
  familyIds.push(fam.id);

  const { data: user, error: userErr } = await admin
    .from('users')
    .insert({ family_id: fam.id, name: `${TAG}_${label}_child`, role: 'child' })
    .select('id')
    .single();
  if (userErr || !user) throw new Error(`user insert: ${userErr?.message}`);

  const email = `${TAG}_${label}@example.test`;
  const password = 'Test1234!Rls';
  const { data: auth, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { family_id: fam.id, user_id: user.id, role: 'child', is_platform_admin: false },
  });
  if (authErr || !auth.user) throw new Error(`auth user: ${authErr?.message}`);
  authUserIds.push(auth.user.id);

  const signIn = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sess, error: signErr } = await signIn.auth.signInWithPassword({ email, password });
  if (signErr || !sess.session) throw new Error(`sign in: ${signErr?.message}`);

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });
  return { client, userId: user.id, familyId: fam.id };
}

type GradeSpec = 'easy' | 'good' | 'hard' | 'again';

async function makeSession(
  userId: string,
  familyId: string,
  grades: GradeSpec[],
  kind: 'character' | 'phrase' | 'paragraph' = 'character'
): Promise<string> {
  const id = `${TAG}_q_${Math.random().toString(36).slice(2, 10)}`;
  const gradeData = grades.map((grade, index) => ({
    wordId: `w${index}`,
    hanzi: '字',
    grade,
    ...(kind === 'phrase' ? { isVocabPhrase: true } : {}),
    ...(kind === 'paragraph' ? { isParagraphBlank: true } : {}),
  }));
  const { error } = await admin.from('quiz_sessions').insert({
    id,
    user_id: userId,
    family_id: familyId,
    session_type: 'fill-test',
    grade_data: gradeData,
    fully_correct_count: grades.filter((g) => g === 'easy').length,
    failed_count: grades.filter((g) => g === 'again').length,
    partially_correct_count: grades.filter((g) => g === 'good' || g === 'hard').length,
    total_grades: grades.length,
    duration_seconds: 60,
    coins_earned: 0,
  });
  if (error) throw new Error(`quiz_sessions insert: ${error.message}`);
  return id;
}

async function reward(client: SupabaseClient, sessionId: string): Promise<RewardResult> {
  const { data, error } = await client.rpc('reward_session_ingredients', { p_quiz_session_id: sessionId });
  if (error) throw new Error(`reward_session_ingredients: ${error.message}`);
  const raw = data as RewardResult;
  return {
    isWin: Boolean(raw.isWin),
    ingredients: (raw.ingredients ?? []).map((row) => ({
      ingredientKey: row.ingredientKey,
      quantity: Number(row.quantity),
      isMystery: Boolean(row.isMystery),
    })),
    unlockedRecipeIds: raw.unlockedRecipeIds ?? [],
  };
}

async function held(userId: string, key: string): Promise<number> {
  const count = async (table: string): Promise<number> => {
    const { count: n, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('ingredient_key', key);
    if (error) throw new Error(`${table} count: ${error.message}`);
    return n ?? 0;
  };
  return (await count('shop_ingredient_rewards')) + (await count('shop_ingredient_purchases')) - (await count('shop_ingredient_consumptions'));
}

async function insertTempIngredient(key: string): Promise<void> {
  const { error } = await admin.from('shop_ingredient_prices').insert({
    ingredient_key: key,
    cost_coins: 0,
    label_i18n: { en: key, zh: key },
    icon_path: null,
    is_mystery: true,
  });
  if (error) throw new Error(`temp ingredient ${key}: ${error.message}`);
  tempIngredientKeys.push(key);
}

async function insertTempFood(slug: string, displayOrder: number, reqs: Array<[string, number]>): Promise<string> {
  const rows = reqs.map(([ingredientKey, quantity]) => ({ ingredientKey, name: ingredientKey, quantity }));
  const { data, error } = await admin
    .from('shop_recipes')
    .insert({
      slug,
      title: slug,
      title_i18n: { en: slug, zh: slug },
      display_order: displayOrder,
      is_active: true,
      intro: 'test',
      intro_i18n: { en: 'test', zh: 'test' },
      unlock_cost_coins: 0,
      base_ingredients: rows,
      base_ingredients_i18n: { en: rows, zh: rows },
      special_ingredient_slots: [],
      special_ingredient_slots_i18n: { en: [], zh: [] },
      variant_icon_rules: [{ match: [], iconPath: '/rewards/zz-test_plain.png' }],
      cook_method: 'stove',
      food_type: 'hotmeal',
      is_mystery: true,
      teaser_i18n: { en: 'test', zh: 'test' },
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`temp food ${slug}: ${error?.message}`);
  tempRecipeIds.push(data.id);
  return data.id;
}

const keysOf = (r: RewardResult): string[] => r.ingredients.map((i) => i.ingredientKey);
const qtyOf = (r: RewardResult, key: string): number | undefined => r.ingredients.find((i) => i.ingredientKey === key)?.quantity;

// ─── phase 1: temporary mystery foods ──────────────────────────────────────
async function phase1(): Promise<void> {
  console.log('\n■ Phase 1: temporary mystery foods (real crystal-dumpling set inactive)');

  const a = `${TAG}-a`, b = `${TAG}-b`, c = `${TAG}-c`, d = `${TAG}-d`, e = `${TAG}-e`, f = `${TAG}-f`;
  for (const key of [a, b, c, d, e, f]) await insertTempIngredient(key);
  const f1 = await insertTempFood(`${TAG}-food1`, 901, [[a, 1], [b, 2]]); // 2 types
  const f2 = await insertTempFood(`${TAG}-food2`, 902, [[c, 1], [d, 1], [e, 1], [f, 1]]); // 4 types

  const kid = await createChild('p1');

  // A normal recipe unlocked so the random pool is non-empty for non-wins.
  const { data: bun } = await admin.from('shop_recipes').select('id').eq('slug', 'bun').single();
  if (!bun) throw new Error("normal recipe 'bun' not found");
  await admin.from('shop_recipe_unlocks').insert({ user_id: kid.userId, family_id: kid.familyId, recipe_id: bun.id, coins_spent: 0 });

  // Non-win (one 'again') -> random reward, no mystery.
  const nonWin = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'again', 'easy']));
  check('non-win character session: isWin=false', nonWin.isWin === false, show(nonWin));
  check('non-win: regular random reward (>=1, none mystery)', nonWin.ingredients.length >= 1 && nonWin.ingredients.every((i) => !i.isMystery), show(nonWin));
  check('non-win: no mystery ledger rows written', (await held(kid.userId, a)) === 0 && (await held(kid.userId, c)) === 0);

  // Phrase round with a wrong answer -> non-win.
  const phraseLoss = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'again'], 'phrase'));
  check('phrase round with a wrong answer: non-win', phraseLoss.isWin === false, show(phraseLoss));

  // Zero graded entries -> non-win.
  const zero = await reward(kid.client, await makeSession(kid.userId, kid.familyId, []));
  check('zero graded entries: non-win', zero.isWin === false, show(zero));

  // Paragraph quiz: bounce (good) -> non-win even though failed_count = 0.
  const paraBounce = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'good', 'easy'], 'paragraph'));
  check('paragraph quiz with a bounce: non-win', paraBounce.isWin === false, show(paraBounce));

  // Win #1 (partial/hard answers are fine): food1 (closest) then leftover starts food2.
  const win1Id = await makeSession(kid.userId, kid.familyId, ['easy', 'good', 'hard']);
  const win1 = await reward(kid.client, win1Id);
  check('win #1: isWin=true', win1.isWin === true, show(win1));
  check('win #1: all mystery, 3 types in priority order a,b,c', show(keysOf(win1)) === show([a, b, c]) && win1.ingredients.every((i) => i.isMystery), show(win1));
  check('win #1: full per-food quantities (a=1,b=2,c=1)', qtyOf(win1, a) === 1 && qtyOf(win1, b) === 2 && qtyOf(win1, c) === 1, show(win1));
  check('win #1: ledger rows = quantities', (await held(kid.userId, a)) === 1 && (await held(kid.userId, b)) === 2 && (await held(kid.userId, c)) === 1);
  check('win #1: completed food1 auto-unlocked (not food2)', win1.unlockedRecipeIds.includes(f1) && !win1.unlockedRecipeIds.includes(f2), show(win1.unlockedRecipeIds));
  const { data: u1 } = await admin.from('shop_recipe_unlocks').select('coins_spent').eq('user_id', kid.userId).eq('recipe_id', f1).single();
  check('auto-unlock cost 0 coins', u1?.coins_spent === 0, show(u1));
  const { data: tx } = await admin.from('shop_coin_transactions').select('id').eq('user_id', kid.userId).eq('recipe_id', f1);
  check('auto-unlock wrote no coin-history row', (tx ?? []).length === 0);
  const { data: wallet } = await admin.from('wallets').select('user_id').eq('user_id', kid.userId);
  check('auto-unlock created no wallet row', (wallet ?? []).length === 0);

  // Idempotency.
  const again = await reward(kid.client, win1Id);
  check('idempotent: second call for the same session returns nothing', again.ingredients.length === 0 && again.unlockedRecipeIds.length === 0, show(again));
  check('idempotent: ledger unchanged', (await held(kid.userId, a)) === 1 && (await held(kid.userId, b)) === 2);

  // Ownership: someone else's session.
  const other = await createChild('p1other');
  const foreign = await reward(kid.client, await makeSession(other.userId, other.familyId, ['easy', 'easy']));
  check("another user's session: nothing rewarded", foreign.ingredients.length === 0, show(foreign));

  // Win #2: food1 satisfied, food2 needs d,e,f -> completes + unlocks.
  const win2 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'easy', 'easy']));
  check('win #2: remaining types d,e,f', show(keysOf(win2)) === show([d, e, f]), show(win2));
  check('win #2: food2 now unlocked', win2.unlockedRecipeIds.includes(f2), show(win2.unlockedRecipeIds));

  // Win #3: everything satisfied -> stockpile, fewest types (food1: a,b) then next food slot.
  const win3 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'easy']));
  check('win #3 (all satisfied): stockpile starts with the fewest-ingredient food (a,b,...)', keysOf(win3)[0] === a && keysOf(win3)[1] === b && win3.ingredients.length === 3, show(win3));
  check('win #3: another full set (a=1,b=2)', qtyOf(win3, a) === 1 && qtyOf(win3, b) === 2, show(win3));

  // Paragraph quiz with zero bounces (every blank first-try easy) is a win.
  const paraKid = await createChild('p1para'); // fresh child so this win doesn't shift the cook-count assertions below
  const paraClean = await reward(paraKid.client, await makeSession(paraKid.userId, paraKid.familyId, ['easy', 'easy', 'easy'], 'paragraph'));
  check('paragraph quiz with zero bounces: win, mystery reward', paraClean.isWin === true && paraClean.ingredients.length >= 1 && paraClean.ingredients.every((i) => i.isMystery), show(paraClean));

  // Random pool never contains mystery ingredients, even with unlocked mystery foods.
  let leaked = false;
  for (let i = 0; i < 4; i++) {
    const res = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['again', 'easy']));
    if (res.ingredients.some((ing) => ing.isMystery || ing.ingredientKey.startsWith(`${TAG}-`))) leaked = true;
  }
  check('random reward pool never includes mystery ingredients (4 non-win sessions)', !leaked);

  // Cook the unlocked mystery food: exactly one set consumed per cook.
  const cook1 = await kid.client.rpc('cook_shop_recipe', { p_recipe_id: f1, p_special_ingredient_keys: [] });
  check('cook mystery food #1 succeeds', cook1.data?.success === true, show(cook1));
  check('cook consumed exactly one set (a: 2->1, b: 4->2)', (await held(kid.userId, a)) === 1 && (await held(kid.userId, b)) === 2);
  const cook2 = await kid.client.rpc('cook_shop_recipe', { p_recipe_id: f1, p_special_ingredient_keys: [] });
  check('cook mystery food #2 succeeds (second stocked set)', cook2.data?.success === true, show(cook2));
  const cook3 = await kid.client.rpc('cook_shop_recipe', { p_recipe_id: f1, p_special_ingredient_keys: [] });
  check('cook mystery food #3 blocked: insufficient_ingredients', cook3.data?.success === false && cook3.data?.code === 'insufficient_ingredients', show(cook3));
  const { data: stillUnlocked } = await admin.from('shop_recipe_unlocks').select('recipe_id').eq('user_id', kid.userId).eq('recipe_id', f1);
  check('food stays unlocked after its ingredients are used up', (stillUnlocked ?? []).length === 1);

  // A made food drops behind never-made foods only when closeness ties; here
  // food2 is never made. After cooking food1 twice, a stocked/stocked tie goes
  // to fewest types (food1) regardless of made count.
  const win4 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'easy']));
  check('after cooking: unsatisfied food1 is topped up first (closest to complete)', keysOf(win4)[0] === a || keysOf(win4)[0] === b, show(win4));

  // Mystery unlock / purchase guards.
  const fresh = await createChild('p1fresh');
  const unlockEarly = await fresh.client.rpc('unlock_shop_recipe', { p_recipe_id: f1 });
  check('unlock_shop_recipe on an incomplete mystery food: mystery_not_ready', unlockEarly.data?.success === false && unlockEarly.data?.code === 'mystery_not_ready', show(unlockEarly));

  // Purchase of a mystery ingredient is refused (needs the recipe unlocked first).
  const buy = await kid.client.rpc('purchase_shop_ingredient', { p_recipe_id: f1, p_ingredient_key: a, p_quantity: 1 });
  check('purchase_shop_ingredient on a mystery ingredient: ingredient_not_available', buy.data?.success === false && buy.data?.code === 'ingredient_not_available', show(buy));

  // Normal recipe unlock and purchase are unchanged.
  const normal = await createChild('p1normal');
  const { data: cake } = await admin.from('shop_recipes').select('id, unlock_cost_coins, base_ingredients').eq('slug', 'cake').single();
  if (!cake) throw new Error("normal recipe 'cake' not found");
  await admin.from('wallets').insert({ user_id: normal.userId, family_id: normal.familyId, total_coins: cake.unlock_cost_coins + 50 });
  const poor = await createChild('p1poor');
  const poorUnlock = await poor.client.rpc('unlock_shop_recipe', { p_recipe_id: cake.id });
  check('normal recipe, no coins: insufficient_coins (unchanged)', poorUnlock.data?.success === false && poorUnlock.data?.code === 'insufficient_coins', show(poorUnlock));
  const okUnlock = await normal.client.rpc('unlock_shop_recipe', { p_recipe_id: cake.id });
  check('normal recipe with coins: unlocks and charges the full cost', okUnlock.data?.success === true && okUnlock.data?.coinsSpent === cake.unlock_cost_coins, show(okUnlock));
  const { data: txRows } = await admin.from('shop_coin_transactions').select('action_type, coins_spent').eq('user_id', normal.userId).eq('recipe_id', cake.id);
  check('normal unlock wrote a coin-history row', (txRows ?? []).length === 1 && txRows?.[0].action_type === 'unlock_recipe', show(txRows));

  const baseKey = ((cake.base_ingredients as Array<{ ingredientKey?: string }>) ?? []).find((row) => row.ingredientKey)?.ingredientKey;
  if (baseKey) {
    const buyNormal = await normal.client.rpc('purchase_shop_ingredient', { p_recipe_id: cake.id, p_ingredient_key: baseKey, p_quantity: 1 });
    check('normal ingredient purchase still works', buyNormal.data?.success === true, show(buyNormal));
  } else {
    check('normal ingredient purchase still works', false, "cake has no ingredientKey to buy");
  }

  // Deactivate temporaries before the real-recipe phase.
  await admin.from('shop_recipes').update({ is_active: false }).in('id', tempRecipeIds);
}

// ─── phase 2: the real Crystal Dumplings seed ──────────────────────────────
async function phase2(): Promise<void> {
  console.log('\n■ Phase 2: real crystal-dumpling seed data');

  const { data: seed } = await admin
    .from('shop_recipes')
    .select('id, is_mystery, unlock_cost_coins, cook_method, food_type, display_order, teaser_i18n, base_ingredients')
    .eq('slug', 'crystal-dumpling')
    .single();
  check('seed: crystal-dumpling exists, is_mystery, free, stove/hotmeal', !!seed && seed.is_mystery === true && seed.unlock_cost_coins === 0 && seed.cook_method === 'stove' && seed.food_type === 'hotmeal', show(seed));
  check('seed: teaser has EN + ZH', !!seed?.teaser_i18n?.en && !!seed?.teaser_i18n?.zh);
  const { data: ingr } = await admin.from('shop_ingredient_prices').select('ingredient_key, is_mystery, cost_coins').in('ingredient_key', ['imperial-wheat-starch', 'wild-tiger-prawn', 'spring-bamboo-shoot', 'gilded-sesame-oil']);
  check('seed: 4 mystery ingredients, all free', (ingr ?? []).length === 4 && (ingr ?? []).every((row) => row.is_mystery && row.cost_coins === 0), show(ingr));

  // DB-level guards.
  const badIngredient = await admin.from('shop_ingredient_prices').insert({ ingredient_key: `${TAG}-bad`, cost_coins: 5, label_i18n: { en: 'x', zh: 'x' }, is_mystery: true });
  check('constraint: a mystery ingredient with a price is rejected', !!badIngredient.error, show(badIngredient.error));
  if (!badIngredient.error) await admin.from('shop_ingredient_prices').delete().eq('ingredient_key', `${TAG}-bad`);

  const kid = await createChild('p2');
  const [starch, prawn, bamboo, oil] = ['imperial-wheat-starch', 'wild-tiger-prawn', 'spring-bamboo-shoot', 'gilded-sesame-oil'];

  const w1 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'easy']));
  check('real win #1: starch x2, prawn x2, bamboo x1 (recipe order)', show(w1.ingredients.map((i) => [i.ingredientKey, i.quantity])) === show([[starch, 2], [prawn, 2], [bamboo, 1]]), show(w1));
  check('real win #1: not unlocked yet (oil missing)', w1.unlockedRecipeIds.length === 0, show(w1.unlockedRecipeIds));

  const w2 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'hard']));
  check('real win #2: oil completes the set', keysOf(w2)[0] === oil && qtyOf(w2, oil) === 1, show(w2));
  check('real win #2: leftover slots stockpile a second set (starch x2, prawn x2)', qtyOf(w2, starch) === 2 && qtyOf(w2, prawn) === 2 && w2.ingredients.length === 3, show(w2));
  check('real win #2: Crystal Dumplings auto-unlocked', !!seed && w2.unlockedRecipeIds.includes(seed.id), show(w2.unlockedRecipeIds));

  if (seed) {
    const cook = await kid.client.rpc('cook_shop_recipe', { p_recipe_id: seed.id, p_special_ingredient_keys: [] });
    check('cook Crystal Dumplings succeeds onto the countertop', cook.data?.success === true && cook.data?.location === 'countertop', show(cook));
    check('cook consumed one set (starch 4->2, prawn 4->2, bamboo 1->0, oil 1->0)',
      (await held(kid.userId, starch)) === 2 && (await held(kid.userId, prawn)) === 2 && (await held(kid.userId, bamboo)) === 0 && (await held(kid.userId, oil)) === 0);
    const cookAgain = await kid.client.rpc('cook_shop_recipe', { p_recipe_id: seed.id, p_special_ingredient_keys: [] });
    check('second cook blocked until bamboo + oil are earned again', cookAgain.data?.success === false && cookAgain.data?.code === 'insufficient_ingredients', show(cookAgain));

    // Made once now: the next win tops up bamboo + oil (closest to complete).
    const w3 = await reward(kid.client, await makeSession(kid.userId, kid.familyId, ['easy', 'easy']));
    check('real win #3: tops up bamboo + oil to make the next dish', keysOf(w3).includes(bamboo) && keysOf(w3).includes(oil), show(w3));
  }
}

// ─── cleanup ───────────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  console.log('\n■ Cleanup');
  if (realRecipeId) {
    const { error } = await admin.from('shop_recipes').update({ is_active: realWasActive }).eq('id', realRecipeId);
    if (error) console.error(`  ⚠️  Could not restore crystal-dumpling is_active=${realWasActive}: ${error.message}`);
    else console.log(`  restored crystal-dumpling is_active=${realWasActive}`);
  }
  for (const id of familyIds) {
    const { error } = await admin.from('families').delete().eq('id', id);
    if (error) console.error(`  ⚠️  family ${id}: ${error.message}`);
  }
  for (const id of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`  ⚠️  auth user ${id}: ${error.message}`);
  }
  if (tempRecipeIds.length) {
    const { error } = await admin.from('shop_recipes').delete().in('id', tempRecipeIds);
    if (error) console.error(`  ⚠️  temp recipes: ${error.message}`);
  }
  if (tempIngredientKeys.length) {
    const { error } = await admin.from('shop_ingredient_prices').delete().in('ingredient_key', tempIngredientKeys);
    if (error) console.error(`  ⚠️  temp ingredients: ${error.message}`);
  }
  console.log('  done');
}

async function main(): Promise<void> {
  console.log('Mystery Foods verification (dev)');
  const { data: real } = await admin.from('shop_recipes').select('id, is_active').eq('slug', 'crystal-dumpling').single();
  if (!real) {
    console.error('❌ crystal-dumpling recipe not found — has migration 20261024170000 been pushed?');
    process.exit(1);
  }
  realRecipeId = real.id;
  realWasActive = real.is_active;

  try {
    await admin.from('shop_recipes').update({ is_active: false }).eq('id', real.id);
    await phase1();
    await admin.from('shop_recipes').update({ is_active: realWasActive }).eq('id', real.id);
    await phase2();
  } catch (error) {
    failed++;
    console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await cleanup();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
