#!/usr/bin/env tsx
/**
 * Import Chef Shrewy's curated challenge questions (roadmap item T) from
 * content/chef-challenges/questions.zh.json into chef_challenge_questions.
 *
 * - Validates EVERY question (known recipe slug, the same rules as Shop Admin's editor)
 *   before writing anything; one bad row aborts the whole run.
 * - Idempotent: a question whose recipe already has the same prompt is not added again,
 *   so re-running never duplicates. Edit or delete existing questions in Shop Admin.
 * - New questions are appended after a recipe's existing ones, in file order.
 * - 小知识 (`explanation`, migration 20261029120000) is imported with new questions, and
 *   filled in on existing ones that have none yet. An explanation already set (e.g.
 *   edited in Shop Admin) is never overwritten.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local (dev, the
 * default) or .env.production.local (`prod` / `--env prod`).
 *
 * The database (as reviewed in Shop Admin) is the source of truth once questions are in it.
 * Importing can't tell a question that was DELETED in Shop Admin from a new one, so a
 * whole-file import re-adds deleted questions (this happened once on 2026-10-29). So:
 *   - after reviewing in Shop Admin, run --export to write the database back to the file;
 *   - when adding new questions, use --recipe to import only that recipe's questions.
 *
 * Usage:
 *   npm run seed:chef-challenge-questions -- --dry-run                 # dev, report only
 *   npm run seed:chef-challenge-questions -- --recipe fried-egg-over-rice   # dev, one recipe
 *   npm run seed:chef-challenge-questions                              # dev, whole file
 *   npm run seed:chef-challenge-questions -- --export                  # dev → content file
 *   npm run seed:chef-challenge-questions -- prod                      # production, whole file
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizeChefChallengeQuestionDraft, validateChefChallengeQuestionDraft } from '../src/lib/pawPrints';

const CONTENT_FILE = 'content/chef-challenges/questions.zh.json';

const args = process.argv.slice(2);
const isProd = args.includes('prod') || args.includes('--prod') || args[args.indexOf('--env') + 1] === 'prod';
const isDryRun = args.includes('--dry-run');
const isExport = args.includes('--export');
const recipeArg = args.indexOf('--recipe') >= 0 ? args[args.indexOf('--recipe') + 1] ?? '' : '';
const recipeFilter = new Set(recipeArg.split(',').map((slug) => slug.trim()).filter(Boolean));
const envFile = isProd ? '.env.production.local' : '.env.local';

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (looked in ${envFile})`);
  process.exit(1);
}

type ContentQuestion = {
  recipe: string;
  prompt: string;
  correct_answer: string;
  wrong_answers: string[];
  explanation?: string;
  /** Omitted means active; the export writes `false` for questions turned off in Shop Admin. */
  is_active?: boolean;
};

/** Writes the database's questions (as reviewed in Shop Admin) back to the content file. */
async function exportToFile(admin: SupabaseClient): Promise<void> {
  const { data: recipes, error: recipeError } = await admin.from('shop_recipes').select('id, slug, display_order');
  if (recipeError) throw new Error(`shop_recipes: ${recipeError.message}`);
  const recipeById = new Map((recipes ?? []).map((row) => [row.id as string, row as { slug: string; display_order: number }]));
  const { data: rows, error } = await admin
    .from('chef_challenge_questions')
    .select('recipe_id, prompt, correct_answer, wrong_answers, explanation, is_active, display_order, created_at');
  if (error) throw new Error(`chef_challenge_questions: ${error.message}`);
  const questions = (rows ?? [])
    .filter((row) => recipeById.has(row.recipe_id as string) && !String(recipeById.get(row.recipe_id as string)?.slug).startsWith('zz-test-'))
    .sort((a, b) => {
      const ra = recipeById.get(a.recipe_id as string)!;
      const rb = recipeById.get(b.recipe_id as string)!;
      return ra.display_order - rb.display_order || (a.display_order as number) - (b.display_order as number) || String(a.created_at).localeCompare(String(b.created_at));
    })
    .map((row) => {
      const question: ContentQuestion = {
        recipe: recipeById.get(row.recipe_id as string)!.slug,
        prompt: row.prompt as string,
        correct_answer: row.correct_answer as string,
        wrong_answers: row.wrong_answers as string[],
      };
      if (row.explanation) question.explanation = row.explanation as string;
      if (row.is_active === false) question.is_active = false;
      return question;
    });
  if (isDryRun) {
    console.log(`  Dry run: would write ${questions.length} question(s) to ${CONTENT_FILE}.`);
    return;
  }
  writeFileSync(CONTENT_FILE, `${JSON.stringify(questions, null, 2)}
`, 'utf8');
  console.log(`✅ Wrote ${questions.length} question(s) to ${CONTENT_FILE}.`);
}

async function main(): Promise<void> {
  console.log(`Chef challenge questions → ${isProd ? 'PRODUCTION' : 'dev'} (${SUPABASE_URL})${isDryRun ? ' [dry run]' : ''}`);
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

  if (isExport) {
    await exportToFile(admin);
    return;
  }

  const questions = (JSON.parse(readFileSync(CONTENT_FILE, 'utf8')) as ContentQuestion[]).filter(
    (question) => recipeFilter.size === 0 || recipeFilter.has(question.recipe)
  );
  if (recipeFilter.size > 0) console.log(`  Only recipe(s): ${[...recipeFilter].join(', ')}`);

  const { data: recipes, error: recipeError } = await admin.from('shop_recipes').select('id, slug');
  if (recipeError) throw new Error(`shop_recipes: ${recipeError.message}`);
  const recipeIdBySlug = new Map((recipes ?? []).map((row) => [row.slug as string, row.id as string]));

  // 1. Validate everything first.
  const problems: string[] = [];
  const drafts = questions.map((question, index) => {
    const recipeId = recipeIdBySlug.get(question.recipe) ?? '';
    if (!recipeId) problems.push(`#${index + 1}: unknown recipe slug "${question.recipe}"`);
    const draft = normalizeChefChallengeQuestionDraft({
      recipeId,
      prompt: question.prompt ?? '',
      correctAnswer: question.correct_answer ?? '',
      wrongAnswers: Array.isArray(question.wrong_answers) ? question.wrong_answers : [],
      explanation: question.explanation ?? '',
      isActive: question.is_active !== false,
    });
    const problem = recipeId ? validateChefChallengeQuestionDraft(draft) : null;
    if (problem) problems.push(`#${index + 1} (${question.recipe}) "${question.prompt}": ${problem}`);
    return draft;
  });
  if (problems.length > 0) {
    console.error('❌ Nothing imported; fix these first:');
    problems.forEach((problem) => console.error(`   ${problem}`));
    process.exit(1);
  }

  // 2. Skip prompts each recipe already has; append the rest in file order.
  const recipeIds = [...new Set(drafts.map((draft) => draft.recipeId))];
  const { data: existing, error: existingError } = await admin
    .from('chef_challenge_questions')
    .select('id, recipe_id, prompt, display_order, explanation')
    .in('recipe_id', recipeIds);
  if (existingError) throw new Error(`chef_challenge_questions: ${existingError.message}`);
  const existingPrompts = new Set((existing ?? []).map((row) => `${row.recipe_id}|${row.prompt}`));
  const nextOrder = new Map<string, number>();
  for (const row of existing ?? []) {
    nextOrder.set(row.recipe_id as string, Math.max(nextOrder.get(row.recipe_id as string) ?? 0, (row.display_order as number) + 1));
  }

  const rows = drafts
    .filter((draft) => !existingPrompts.has(`${draft.recipeId}|${draft.prompt}`))
    .map((draft) => {
      const order = nextOrder.get(draft.recipeId) ?? 0;
      nextOrder.set(draft.recipeId, order + 1);
      return {
        recipe_id: draft.recipeId,
        prompt: draft.prompt,
        correct_answer: draft.correctAnswer,
        wrong_answers: draft.wrongAnswers,
        explanation: draft.explanation || null,
        is_active: draft.isActive,
        display_order: order,
      };
    });

  const perRecipe = new Map<string, number>();
  for (const question of questions) {
    const draftKey = `${recipeIdBySlug.get(question.recipe)}|${question.prompt.trim()}`;
    if (!existingPrompts.has(draftKey)) perRecipe.set(question.recipe, (perRecipe.get(question.recipe) ?? 0) + 1);
  }
  // Existing questions with no 小知识 yet get the file's (never overwriting one already set).
  const explanationByKey = new Map(drafts.map((draft) => [`${draft.recipeId}|${draft.prompt}`, draft.explanation]));
  const backfills = (existing ?? []).flatMap((row) => {
    const explanation = explanationByKey.get(`${row.recipe_id}|${row.prompt}`);
    return !row.explanation && explanation ? [{ id: row.id as string, explanation }] : [];
  });

  console.log(`  ${questions.length} in file · ${questions.length - rows.length} already present · ${rows.length} to add`);
  for (const [slug, count] of perRecipe) console.log(`    ${slug}: +${count}`);
  const slugById = new Map([...recipeIdBySlug].map(([slug, id]) => [id, slug]));
  for (const row of rows) console.log(`      + [${slugById.get(row.recipe_id)}] ${row.prompt}`);
  console.log(`  小知识 to fill in on existing questions: ${backfills.length}`);

  if (isDryRun || (rows.length === 0 && backfills.length === 0)) {
    console.log(isDryRun ? '  Dry run: nothing written.' : '  Nothing to do.');
    return;
  }

  if (rows.length > 0) {
    const { error: insertError } = await admin.from('chef_challenge_questions').insert(rows);
    if (insertError) throw new Error(`insert: ${insertError.message}`);
  }
  for (const backfill of backfills) {
    const { error: updateError } = await admin
      .from('chef_challenge_questions')
      .update({ explanation: backfill.explanation, updated_at: new Date().toISOString() })
      .eq('id', backfill.id)
      .is('explanation', null);
    if (updateError) throw new Error(`explanation update: ${updateError.message}`);
  }
  console.log(`✅ Added ${rows.length} question(s); filled in 小知识 on ${backfills.length}.`);
}

main().catch((error: unknown) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
