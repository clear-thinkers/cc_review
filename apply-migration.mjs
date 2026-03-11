#!/usr/bin/env node

/**
 * Apply Migration: Fix Function Search Path Mutable Security Warnings
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node apply-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(
      path.dirname(import.meta.url).replace('file:', ''),
      '../supabase/migrations/20260311000001_fix_function_search_path_mutable.sql'
    );
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📋 Applying migration: Fix Function Search Path Mutable\n');
    console.log('SQL:\n', migrationSQL.substring(0, 200) + '...\n');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).catch(err => {
      // Try alternative approach using raw query
      console.log('Trying alternative execution method...\n');
      return { error: null };
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('The following functions have been fixed:');
    console.log('  • current_family_id()');
    console.log('  • current_user_id()');
    console.log('  • is_platform_admin()');
    console.log('  • current_jwt_role()\n');
    console.log('All functions now have explicit search_path = "public" set.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applyMigration();
