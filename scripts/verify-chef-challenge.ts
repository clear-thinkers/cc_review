#!/usr/bin/env tsx
/**
 * Chef challenge + paw prints verification (roadmap item T; spec
 * docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md)
 *
 * Exercises get_chef_challenge / answer_chef_challenge / redeem_paw_print_reward against a
 * live Supabase DEV project as real child JWTs: unlock and role checks, the hidden answer,
 * three-question challenges (one at a time, resumable, no repeats, a wrong answer ends
 * them, fewer than 3 when a recipe has fewer), the one-per-cook rule, the paw print for a
 * fully correct challenge -- every verdict checked against the TypeScript reference
 * isChefChallengeFinished / earnsPawPrint in src/lib/pawPrints.ts -- and redemption.
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
import { earnsPawPrint, isChefChallengeFinished } from '../src/lib/pawPrints';

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

/** The latest challenge's progress as the TypeScript reference sees it, from the raw rows. */
async function referenceProgress(
  userId: string,
  justAnsweredAttemptId: unknown
): Promise<{ correct: number; wrong: number; unasked: number; alreadyEarned: boolean }> {
  const attempts = await attemptsOf(userId);
  const round = Math.max(...attempts.map((a) => a.round));
  const inRound = attempts.filter((a) => a.round === round);
  const asked = new Set(inRound.map((a) => a.question_id));
  const { data: answers } = await admin
    .from('chef_challenge_attempts')
    .select('is_correct')
    .eq('user_id', userId)
    .eq('recipe_id', tempRecipeId)
    .eq('round', round)
    .not('answered_at', 'is', null);
  // Earned BEFORE this answer: any award on the challenge's other attempts.
  const otherIds = inRound.map((a) => a.id).filter((id) => id !== justAnsweredAttemptId);
  const { data: earlierAwards } = otherIds.length
    ? await admin.from('paw_print_awards').select('id').in('attempt_id', otherIds)
    : { data: [] };
  return {
    alreadyEarned: (earlierAwards ?? []).length > 0,
    correct: (answers ?? []).filter((a) => a.is_correct === true).length,
    wrong: (answers ?? []).filter((a) => a.is_correct === false).length,
    unasked: (await activeQuestionIds()).filter((id) => !asked.has(id)).length,
  };
}

/** Answers, then checks the SQL's finished / paw-print verdict against the TypeScript reference. */
async function answerAndCheck(person: Person, attemptId: unknown, value: string, label: string): Promise<Rpc> {
  const result = await answer(person, attemptId, value);
  const progress = await referenceProgress(person.userId, attemptId);
  check(
    `${label}: SQL agrees with isChefChallengeFinished / earnsPawPrint`,
    result.success === true &&
      result.challengeFinished === isChefChallengeFinished(progress) &&
      result.pawPrintEarned === earnsPawPrint(progress),
    `sql ${show({ finished: result.challengeFinished, earned: result.pawPrintEarned })}, reference ${show(progress)}`
  );
  return result;
}

async function correctOf(attemptId: unknown): Promise<string> {
  return (await questionOf(attemptId)).correct_answer;
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
  const { data: idsBefore } = await childA.client.rpc('chef_challenge_recipe_ids');
  check('chef_challenge_recipe_ids leaves out a recipe with no questions', Array.isArray(idsBefore) && !idsBefore.includes(tempRecipeId), show(idsBefore));

  const seedRows = ['一', '二', '三', '四', '五'].map((n, i) => ({
    recipe_id: tempRecipeId,
    prompt: `问题${n}`,
    correct_answer: `对${n}`,
    wrong_answers: [`错${n}甲`, `错${n}乙`],
    explanation: `小知识${n}`,
    display_order: i,
  }));
  const { data: seeded, error: seedErr } = await admin.from('chef_challenge_questions').insert(seedRows).select('id');
  if (seedErr || !seeded) throw new Error(`questions: ${seedErr?.message}`);
  const { data: idsAfter } = await childA.client.rpc('chef_challenge_recipe_ids');
  check(
    'chef_challenge_recipe_ids lists it once it has questions, and returns ids only',
    Array.isArray(idsAfter) && idsAfter.includes(tempRecipeId) && idsAfter.every((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)),
    show(idsAfter)
  );

  console.log('\n■ A fully correct challenge (3 questions, one at a time)');
  const { data: visible } = await childA.client.from('chef_challenge_questions').select('id');
  check('a child cannot read the question bank at all', (visible ?? []).length === 0, show(visible));

  const q1 = await getChallenge(childA);
  const q1Question = await questionOf(q1.attemptId);
  check(
    'question 1 of 3: every option, shuffled, and no answer or 小知识',
    q1.questionNumber === 1 &&
      q1.questionCount === 3 &&
      ((q1.options ?? []) as string[]).includes(q1Question.correct_answer) &&
      !('correctAnswer' in q1) &&
      !('explanation' in q1),
    show(q1)
  );
  check('asking again returns the same open question', (await getChallenge(childA)).attemptId === q1.attemptId);
  check('another child cannot answer it', (await answer(childB, q1.attemptId, q1Question.correct_answer)).code === 'no_attempt');

  const a1 = await answerAndCheck(childA, q1.attemptId, q1Question.correct_answer, 'answer 1 (correct)');
  check(
    'a correct answer with more to come: not finished, no paw print, 小知识 shown',
    a1.isCorrect === true && a1.challengeFinished === false && a1.pawPrintEarned === false && a1.explanation === '小知识' + q1Question.correct_answer.slice(1),
    show(a1)
  );
  check('answering twice is refused', (await answer(childA, q1.attemptId, q1Question.correct_answer)).code === 'already_answered');

  const q2 = await getChallenge(childA);
  check('the next question is question 2 of 3, a different one', q2.questionNumber === 2 && q2.questionCount === 3 && (await questionOf(q2.attemptId)).id !== q1Question.id, show(q2));
  check('closing mid-way and coming back resumes the same question', (await getChallenge(childA)).attemptId === q2.attemptId);
  await answerAndCheck(childA, q2.attemptId, await correctOf(q2.attemptId), 'answer 2 (correct)');

  const q3 = await getChallenge(childA);
  const askedInFirst = new Set([q1Question.id, (await questionOf(q2.attemptId)).id, (await questionOf(q3.attemptId)).id]);
  check('question 3 of 3, and no question repeats within the challenge', q3.questionNumber === 3 && askedInFirst.size === 3, show(q3));
  const a3 = await answerAndCheck(childA, q3.attemptId, ` ${await correctOf(q3.attemptId)} `, 'answer 3 (correct)');
  check(
    'the last correct answer (whitespace ignored) finishes the challenge and earns 1 paw print',
    a3.challengeFinished === true && a3.pawPrintEarned === true && a3.collected === 1 && a3.available === 1,
    show(a3)
  );
  const { data: awardRows } = await admin.from('paw_print_awards').select('giver, recipe_id, attempt_id').eq('user_id', childA.userId);
  check(
    'the award records its giver, recipe and the last attempt',
    (awardRows ?? []).length === 1 && awardRows?.[0].giver === 'shrewy' && awardRows?.[0].recipe_id === tempRecipeId && awardRows?.[0].attempt_id === q3.attemptId,
    show(awardRows)
  );
  check('no new challenge until the recipe is cooked', (await getChallenge(childA)).code === 'cook_required');
  const short = await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' });
  check('1 paw print is not enough for the 2-print reward', short.code === 'insufficient_paw_prints' && short.available === 1, show(short));

  console.log('\n■ A wrong answer ends the challenge');
  await cook(childA);
  const w1 = await getChallenge(childA);
  check('after a cook, a new challenge starts at question 1', w1.success === true && w1.questionNumber === 1, show(w1));
  const w1Question = await questionOf(w1.attemptId);
  const wrong = await answerAndCheck(childA, w1.attemptId, w1Question.wrong_answers[0], 'wrong answer');
  check(
    'a wrong answer shows the correct one and its 小知识, ends the challenge, and awards nothing',
    wrong.isCorrect === false &&
      wrong.correctAnswer === w1Question.correct_answer &&
      typeof wrong.explanation === 'string' &&
      wrong.challengeFinished === true &&
      wrong.pawPrintEarned === false &&
      wrong.collected === 1,
    show(wrong)
  );
  check('no more questions after a wrong answer, until the next cook', (await getChallenge(childA)).code === 'cook_required');

  console.log('\n■ A recipe with fewer than 3 questions');
  await cook(childA);
  await admin.from('chef_challenge_questions').update({ is_active: false }).in('id', seeded.slice(2).map((row) => row.id));
  const s1 = await getChallenge(childA);
  check('only 2 active questions: the challenge asks 2', s1.questionNumber === 1 && s1.questionCount === 2, show(s1));
  await answerAndCheck(childA, s1.attemptId, await correctOf(s1.attemptId), 'short challenge, answer 1');
  const s2 = await getChallenge(childA);
  const s2Answer = await answerAndCheck(childA, s2.attemptId, await correctOf(s2.attemptId), 'short challenge, answer 2');
  check('answering both correctly earns the paw print', s2Answer.pawPrintEarned === true && s2Answer.collected === 2, show(s2Answer));

  console.log('\n■ A question deactivated mid-challenge');
  await cook(childA);
  await admin.from('chef_challenge_questions').update({ is_active: true }).eq('recipe_id', tempRecipeId);
  const d1 = await getChallenge(childA);
  await admin.from('chef_challenge_questions').update({ is_active: false }).eq('id', (await questionOf(d1.attemptId)).id);
  const d1b = await getChallenge(childA);
  check(
    'a finished short challenge does not reopen when questions come back: a new 3-question challenge starts',
    d1.success === true && d1.questionNumber === 1 && d1.questionCount === 3,
    show(d1)
  );
  check(
    'an open question whose question was deactivated is replaced, still question 1',
    d1b.success === true && d1b.attemptId !== d1.attemptId && d1b.questionNumber === 1,
    show(d1b)
  );
  check('the dropped question left no trace', !(await attemptsOf(childA.userId)).some((a) => a.id === d1.attemptId));

  console.log('\n■ Redemption (now 2 paw prints)');
  check('an unknown reward is refused', (await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'nope' })).code === 'unknown_reward');
  const redeemed = await rpc(childA, 'redeem_paw_print_reward', { p_reward_key: 'shrewy-hand-wash' });
  check('redeeming at exactly 2 succeeds and leaves 0', redeemed.success === true && redeemed.available === 0, show(redeemed));
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
  check('a child cannot change a reward price (still 2)', (costRows ?? []).length === 0 && catalog?.cost === 2, show({ costRows, catalog }));
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
