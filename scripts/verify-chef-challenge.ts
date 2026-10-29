#!/usr/bin/env tsx
/**
 * Chef challenge + paw prints verification (roadmap item T; spec
 * docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md)
 *
 * Exercises get_chef_challenge / answer_chef_challenge / redeem_paw_print_reward against a
 * live Supabase DEV project as real child JWTs: unlock and role checks, the hidden answer,
 * the reused open challenge, the one-per-cook rule, round rotation (checked against the
 * TypeScript reference pickNextChallengeQuestion in src/lib/pawPrints.ts), awards and
 * balances, and redemption with its refusals.
 *
 * It creates throwaway families/users and one TEMPORARY, inactive recipe (slug prefixed
 * `zz-test-`) with its own questions. Everything is removed in a finally block.
 *
 * Env vars (auto-loaded from .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Dev only -- no --prod flag.
 *
 * Usage: npm run verify:chef-challenge
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { pickNextChallengeQuestion } from '../src/lib/pawPrints';

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
let tempRecipeId: string | null = null;

type Person = { client: SupabaseClient; userId: string; familyId: string };
type Rpc = Record<string, unknown> & { success: boolean; code?: string };

// ─── helpers ───────────────────────────────────────────────────────────────
async function createPerson(label: string, role: 'child' | 'parent'): Promise<Person> {
  const { data: fam, error: famErr } = await admin.from('families').insert({ name: `${TAG}_${label}` }).select('id').single();
  if (famErr || !fam) throw new Error(`family insert: ${famErr?.message}`);
  familyIds.push(fam.id);

  const { data: user, error: userErr } = await admin
    .from('users')
    .insert({ family_id: fam.id, name: `${TAG}_${label}`, role })
    .select('id')
    .single();
  if (userErr || !user) throw new Error(`user insert: ${userErr?.message}`);

  const email = `${TAG}_${label}@example.test`;
  const password = 'Test1234!Chef';
  const { data: auth, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { family_id: fam.id, user_id: user.id, role, is_platform_admin: false },
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

async function rpc(person: Person, name: string, args: Record<string, unknown>): Promise<Rpc> {
  const { data, error } = await person.client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as Rpc;
}

const getChallenge = (person: Person) => rpc(person, 'get_chef_challenge', { p_recipe_id: tempRecipeId });
const answer = (person: Person, attemptId: unknown, value: string) =>
  rpc(person, 'answer_chef_challenge', { p_attempt_id: attemptId, p_answer: value });

type AttemptRow = { id: string; question_id: string | null; round: number; issued_at: string; answered_at: string | null };

async function attemptsOf(userId: string): Promise<AttemptRow[]> {
  const { data, error } = await admin
    .from('chef_challenge_attempts')
    .select('id, question_id, round, issued_at, answered_at')
    .eq('user_id', userId)
    .eq('recipe_id', tempRecipeId)
    .order('issued_at', { ascending: true });
  if (error) throw new Error(`attempts: ${error.message}`);
  return data ?? [];
}

async function questionOf(attemptId: unknown): Promise<{ id: string; correct_answer: string; wrong_answers: string[] }> {
  const { data: attempt } = await admin.from('chef_challenge_attempts').select('question_id').eq('id', attemptId).single();
  const { data: question, error } = await admin
    .from('chef_challenge_questions')
    .select('id, correct_answer, wrong_answers')
    .eq('id', attempt?.question_id)
    .single();
  if (error || !question) throw new Error(`question for attempt: ${error?.message}`);
  return question as { id: string; correct_answer: string; wrong_answers: string[] };
}

async function activeQuestionIds(): Promise<string[]> {
  const { data } = await admin.from('chef_challenge_questions').select('id').eq('recipe_id', tempRecipeId).eq('is_active', true);
  return (data ?? []).map((row) => row.id as string);
}

/** Issues a challenge and checks the SQL picked a question the TypeScript reference allows. */
async function issueAndCheckRotation(person: Person, label: string): Promise<Rpc> {
  // Only called when a NEW challenge is due, so any open attempt is about to be dropped
  // by the server (its question was deactivated) -- leave it out, as the server does.
  const before = (await attemptsOf(person.userId)).filter((a) => a.answered_at !== null);
  const expected = pickNextChallengeQuestion({
    activeQuestionIds: await activeQuestionIds(),
    attempts: before.map((a) => ({ questionId: a.question_id, round: a.round, issuedAt: Date.parse(a.issued_at) })),
  });
  const result = await getChallenge(person);
  const issued = (await attemptsOf(person.userId)).find((a) => a.id === result.attemptId);
  check(
    `${label}: SQL rotation agrees with pickNextChallengeQuestion`,
    Boolean(result.success && issued && expected && expected.eligible.includes(issued.question_id ?? '') && issued.round === expected.round),
    `expected ${show(expected)}, issued ${show(issued)}`
  );
  return result;
}

async function cook(person: Person): Promise<void> {
  // A real cook needs ingredients; a dish row is all the one-per-cook rule reads.
  const { error } = await admin.from('shop_cooked_dishes').insert({
    user_id: person.userId,
    family_id: person.familyId,
    recipe_id: tempRecipeId,
    location: 'countertop',
  });
  if (error) throw new Error(`cooked dish insert: ${error.message}`);
}

// ─── scenarios ─────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  const { data: ingredient } = await admin
    .from('shop_ingredient_prices')
    .select('ingredient_key')
    .eq('is_mystery', false)
    .limit(1)
    .single();
  const { data: maxOrder } = await admin
    .from('shop_recipes')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();
  const rows = [{ ingredientKey: ingredient?.ingredient_key, name: 'test', quantity: 1 }];
  const { data: recipe, error: recipeErr } = await admin
    .from('shop_recipes')
    .insert({
      slug: TAG,
      title: TAG,
      title_i18n: { en: TAG, zh: TAG },
      display_order: (maxOrder?.display_order ?? 0) + 1000,
      is_active: false,
      intro: 'test',
      intro_i18n: { en: 'test', zh: 'test' },
      unlock_cost_coins: 0,
      base_ingredients: rows,
      base_ingredients_i18n: { en: rows, zh: rows },
      special_ingredient_slots: [],
      special_ingredient_slots_i18n: { en: [], zh: [] },
      variant_icon_rules: [{ match: [], iconPath: '/rewards/zz-test_plain.png' }],
      cook_method: 'stove',
      food_type: 'drinks',
    })
    .select('id')
    .single();
  if (recipeErr || !recipe) throw new Error(`temp recipe: ${recipeErr?.message}`);
  tempRecipeId = recipe.id;

  const childA = await createPerson('child_a', 'child');
  const childB = await createPerson('child_b', 'child');
  const parent = await createPerson('parent', 'parent');
  await admin.from('shop_recipe_unlocks').insert({
    user_id: childA.userId,
    family_id: childA.familyId,
    recipe_id: tempRecipeId,
    coins_spent: 0,
  });

  console.log('\n■ Refusals before play');
  check('a parent is forbidden', (await getChallenge(parent)).code === 'forbidden');
  check('a child who has not unlocked the recipe gets not_unlocked', (await getChallenge(childB)).code === 'not_unlocked');
  check('a recipe with no questions gets no_questions', (await getChallenge(childA)).code === 'no_questions');

  const { data: seeded, error: seedErr } = await admin
    .from('chef_challenge_questions')
    .insert([
      { recipe_id: tempRecipeId, prompt: '问题一', correct_answer: '对一', wrong_answers: ['错一甲', '错一乙'], display_order: 0 },
      { recipe_id: tempRecipeId, prompt: '问题二', correct_answer: '对二', wrong_answers: ['错二甲', '错二乙', '错二丙'], display_order: 1 },
      { recipe_id: tempRecipeId, prompt: '问题三', correct_answer: '对三', wrong_answers: ['错三甲', '错三乙'], display_order: 2 },
    ])
    .select('id');
  if (seedErr || !seeded) throw new Error(`questions: ${seedErr?.message}`);

  console.log('\n■ Issue, hidden answer, reuse');
  const { data: visible } = await childA.client.from('chef_challenge_questions').select('id');
  check('a child cannot read the question bank at all', (visible ?? []).length === 0, show(visible));

  const first = await issueAndCheckRotation(childA, 'first challenge');
  const firstQuestion = await questionOf(first.attemptId);
  const options = (first.options ?? []) as string[];
  check(
    'the challenge has every option, shuffled, and no answer field',
    options.length === 1 + firstQuestion.wrong_answers.length &&
      options.includes(firstQuestion.correct_answer) &&
      !('correctAnswer' in first) &&
      !('correct_answer' in first),
    show(first)
  );
  const again = await getChallenge(childA);
  check('asking again returns the same open challenge', again.attemptId === first.attemptId, show(again));

  console.log('\n■ Answering and the one-per-cook rule');
  const wrongPick = firstQuestion.wrong_answers[0];
  const wrong = await answer(childA, first.attemptId, wrongPick);
  check(
    'a wrong answer is marked wrong, reveals the correct one, and awards nothing',
    wrong.success && wrong.isCorrect === false && wrong.correctAnswer === firstQuestion.correct_answer && wrong.collected === 0,
    show(wrong)
  );
  check('answering twice is refused', (await answer(childA, first.attemptId, firstQuestion.correct_answer)).code === 'already_answered');
  check('no new challenge until the recipe is cooked', (await getChallenge(childA)).code === 'cook_required');

  await cook(childA);
  const second = await issueAndCheckRotation(childA, 'after a cook');
  const secondQuestion = await questionOf(second.attemptId);
  check('round 1 does not repeat the first question', secondQuestion.id !== firstQuestion.id);
  check('another child cannot answer it', (await answer(childB, second.attemptId, secondQuestion.correct_answer)).code === 'no_attempt');
  const right = await answer(childA, second.attemptId, ` ${secondQuestion.correct_answer} `);
  check('a correct answer (whitespace ignored) earns one paw print', right.isCorrect === true && right.collected === 1 && right.available === 1, show(right));
  const { data: awardRows } = await admin.from('paw_print_awards').select('giver, recipe_id, attempt_id').eq('user_id', childA.userId);
  check(
    'the award records its giver, recipe and attempt',
    (awardRows ?? []).length === 1 &&
      awardRows?.[0].giver === 'shrewy' &&
      awardRows?.[0].recipe_id === tempRecipeId &&
      awardRows?.[0].attempt_id === second.attemptId,
    show(awardRows)
  );

  console.log('\n■ Rounds');
  await cook(childA);
  const third = await issueAndCheckRotation(childA, 'third challenge');
  const thirdQuestion = await questionOf(third.attemptId);
  check('round 1 asks all three distinct questions', new Set([firstQuestion.id, secondQuestion.id, thirdQuestion.id]).size === 3);
  await answer(childA, third.attemptId, thirdQuestion.correct_answer);
  await cook(childA);
  const fourth = await issueAndCheckRotation(childA, 'new round');
  const fourthAttempt = (await attemptsOf(childA.userId)).find((a) => a.id === fourth.attemptId);
  check('the fourth challenge starts round 2', fourthAttempt?.round === 2, show(fourthAttempt));
  check('round 2 does not open with the question just asked', fourthAttempt?.question_id !== thirdQuestion.id);

  console.log('\n■ A deactivated question');
  await admin.from('chef_challenge_questions').update({ is_active: false }).eq('id', fourthAttempt?.question_id);
  const replaced = await issueAndCheckRotation(childA, 'after deactivation');
  const replacedQuestion = await questionOf(replaced.attemptId);
  check(
    'an open challenge whose question was deactivated is replaced',
    replaced.attemptId !== fourth.attemptId && replacedQuestion.id !== fourthAttempt?.question_id,
    show(replaced)
  );
  check(
    'the dropped challenge left no trace',
    !(await attemptsOf(childA.userId)).some((a) => a.id === fourth.attemptId)
  );

  console.log('\n■ Redemption');
  check('an unknown reward is refused', (await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'nope' })).code === 'unknown_reward');
  const short = await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' });
  check('redeeming with too few paw prints is refused', short.code === 'insufficient_paw_prints' && short.available === 2, show(short));
  const topUp = Array.from({ length: 8 }, () => ({ user_id: childA.userId, family_id: childA.familyId, giver: 'shrewy' }));
  await admin.from('paw_print_awards').insert(topUp);
  const redeemed = await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' });
  check('redeeming at exactly 10 succeeds and leaves 0', redeemed.success === true && redeemed.available === 0, show(redeemed));
  check(
    'redeeming the same reward again is refused',
    (await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' })).code === 'already_redeemed'
  );
  check('a parent cannot redeem', (await rpc(parent, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' })).code === 'forbidden');

  console.log('\n■ Direct writes');
  const { error: awardInsertErr } = await childA.client
    .from('paw_print_awards')
    .insert({ user_id: childA.userId, family_id: childA.familyId, giver: 'shrewy' });
  check('a child cannot insert a paw print directly', Boolean(awardInsertErr), 'insert succeeded');
  const { data: costRows } = await childA.client.from('paw_print_rewards').update({ cost: 1 }).eq('reward_key', 'shrewy-hand-wash').select();
  const { data: catalog } = await admin.from('paw_print_rewards').select('cost').eq('reward_key', 'shrewy-hand-wash').single();
  check('a child cannot change a reward price', (costRows ?? []).length === 0 && catalog?.cost === 10, show({ costRows, catalog }));
}

async function cleanup(): Promise<void> {
  console.log('\n■ Cleanup');
  for (const id of familyIds) {
    const { error } = await admin.from('families').delete().eq('id', id);
    if (error) console.error(`  ⚠️  family ${id}: ${error.message}`);
  }
  for (const id of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`  ⚠️  auth user ${id}: ${error.message}`);
  }
  if (tempRecipeId) {
    const { error } = await admin.from('shop_recipes').delete().eq('id', tempRecipeId);
    if (error) console.error(`  ⚠️  temp recipe: ${error.message}`);
  }
  console.log('  done');
}

async function main(): Promise<void> {
  console.log('Chef challenge + paw prints verification (dev)');
  try {
    await run();
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
