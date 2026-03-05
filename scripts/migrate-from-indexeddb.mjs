#!/usr/bin/env node

/**
 * IndexedDB to Supabase Migration Script
 * Migrates data from an IndexedDB export (JSON) to Supabase Postgres
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-indexeddb.mjs \
 *     --input=path/to/indexeddb-export.json \
 *     --family-id=<uuid> \
 *     --user-id=<uuid>
 * 
 * The IndexedDB export.json should be a Dexie export containing:
 *   - words
 *   - flashcardContents
 *   - quizSessions
 *   - wallets (optional)
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Parse command-line arguments
const args = process.argv.slice(2);
const opts = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  opts[key.replace('--', '')] = value;
});

if (!opts.input || !opts['family-id'] || !opts['user-id']) {
  console.error('❌ Missing required arguments');
  console.error('   --input=<path>     Path to IndexedDB JSON export');
  console.error('   --family-id=<uuid> Target family UUID');
  console.error('   --user-id=<uuid>   Target user UUID (parent)');
  process.exit(1);
}

async function migrateFromIndexedDB() {
  try {
    const inputPath = opts.input;
    const familyId = opts['family-id'];
    const userId = opts['user-id'];

    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    console.log('📖 Loading IndexedDB export...');
    const fileContent = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(fileContent);

    const stats = {
      words: 0,
      flashcardContents: 0,
      quizSessions: 0,
      wallets: 0,
      errors: [],
    };

    // Migrate words
    if (data.words && Array.isArray(data.words)) {
      console.log(`📝 Migrating ${data.words.length} words...`);
      const wordsWithFamily = data.words.map(word => ({
        ...word,
        family_id: familyId,
        // Convert camelCase to snake_case
        interval_days: word.intervalDays ?? 0,
        next_review_at: word.nextReviewAt ?? 0,
        review_count: word.reviewCount ?? 0,
        test_count: word.testCount ?? 0,
        fill_test: word.fillTest ?? null,
      }));

      const { error } = await supabase
        .from('words')
        .insert(wordsWithFamily);

      if (error) {
        stats.errors.push(`words: ${error.message}`);
      } else {
        stats.words = wordsWithFamily.length;
        console.log(`  ✅ ${stats.words} words migrated`);
      }
    }

    // Migrate flashcard contents
    if (data.flashcardContents && Array.isArray(data.flashcardContents)) {
      console.log(`📚 Migrating ${data.flashcardContents.length} flashcard contents...`);
      const contentsWithFamily = data.flashcardContents.map(content => ({
        id: content.id,
        family_id: familyId,
        meanings: content.meanings ?? [],
        phrases: content.phrases ?? [],
        examples: content.examples ?? [],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('flashcard_contents')
        .insert(contentsWithFamily);

      if (error) {
        stats.errors.push(`flashcardContents: ${error.message}`);
      } else {
        stats.flashcardContents = contentsWithFamily.length;
        console.log(`  ✅ ${stats.flashcardContents} flashcard contents migrated`);
      }
    }

    // Migrate quiz sessions
    if (data.quizSessions && Array.isArray(data.quizSessions)) {
      console.log(`📊 Migrating ${data.quizSessions.length} quiz sessions...`);
      const sessionsWithFamily = data.quizSessions.map(session => ({
        ...session,
        user_id: userId,
        family_id: familyId,
        // Convert camelCase to snake_case
        fully_correct_count: session.fullyCorrectCount ?? 0,
        failed_count: session.failedCount ?? 0,
        partially_correct_count: session.partiallyCorrectCount ?? 0,
        total_grades: session.totalGrades ?? 0,
        duration_seconds: session.durationSeconds ?? 0,
        coins_earned: session.coinsEarned ?? 0,
        grade_data: session.gradeData ?? [],
      }));

      const { error } = await supabase
        .from('quiz_sessions')
        .insert(sessionsWithFamily);

      if (error) {
        stats.errors.push(`quizSessions: ${error.message}`);
      } else {
        stats.quizSessions = sessionsWithFamily.length;
        console.log(`  ✅ ${stats.quizSessions} quiz sessions migrated`);
      }
    }

    // Migrate wallets (optional)
    if (data.wallets && Array.isArray(data.wallets) && data.wallets.length > 0) {
      console.log(`💰 Migrating wallet data...`);
      const wallet = data.wallets[0]; // IndexedDB has singleton wallet with id='wallet'
      const walletData = {
        user_id: userId,
        family_id: familyId,
        total_coins: wallet.totalCoins ?? 0,
        last_updated_at: wallet.lastUpdatedAt
          ? new Date(wallet.lastUpdatedAt).toISOString()
          : new Date().toISOString(),
        version: wallet.version ?? 1,
      };

      const { error } = await supabase
        .from('wallets')
        .insert([walletData]);

      if (error) {
        stats.errors.push(`wallets: ${error.message}`);
      } else {
        stats.wallets = 1;
        console.log(`  ✅ Wallet migrated`);
      }
    }

    // Summary
    console.log('\n✅ Migration complete!');
    console.log(`   Words: ${stats.words}`);
    console.log(`   Flashcard contents: ${stats.flashcardContents}`);
    console.log(`   Quiz sessions: ${stats.quizSessions}`);
    console.log(`   Wallets: ${stats.wallets}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateFromIndexedDB();
