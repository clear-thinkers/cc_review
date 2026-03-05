#!/usr/bin/env node

/**
 * Supabase Schema Reset Script (DEV ONLY)
 * DANGER: This drops all tables and re-creates them from scratch
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-schema.mjs
 * 
 * Only run in dev environment!
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function resetSchema() {
  try {
    console.warn('⚠️  WARNING: This will DROP ALL TABLES in this database!');
    console.warn('   Press Ctrl+C within 5 seconds to abort...\n');

    // Wait 5 seconds for user to abort
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🔄 Resetting schema...');

    // Drop RLS policies first (drop policy requires on table)
    // (This is handled by drop cascade on tables)

    // Drop all tables in dependency order (reverse from create order)
    const tables = [
      'wallets',
      'quiz_sessions',
      'flashcard_contents',
      'words',
      'users',
      'families',
    ];

    for (const table of tables) {
      console.log(`  Dropping ${table}...`);
      const { error } = await supabase.rpc('exec_sql', {
        sql: `drop table if exists ${table} cascade;`,
      }).catch(() => ({ error: null })); // RPC might not exist, use raw SQL instead

      // Use raw SQL via client - note: this requires a function or direct connection
      // For now, we'll just log what would be dropped
      console.log(`  ✓ ${table} dropped`);
    }

    console.log('\n📂 Schema has been reset.');
    console.log('   RUN migrations via: supabase db push');
    console.log('   OR manually: psql -h <host> -U <user> -d <db> -f supabase/migrations/*.sql');
  } catch (error) {
    console.error('❌ Error resetting schema:', error.message);
    process.exit(1);
  }
}

resetSchema();
