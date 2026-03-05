#!/usr/bin/env node

/**
 * Platform Admin Bootstrap Script
 *
 * Creates the platform admin Supabase Auth account, family row, and users row.
 * Idempotent: safe to run multiple times. Existing records are updated, not duplicated.
 *
 * Required env vars (auto-loaded from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service role key (bypasses RLS)
 *   ADMIN_EMAIL                  — Email for platform admin Supabase Auth account
 *   ADMIN_PASSWORD               — Password for platform admin Supabase Auth account
 *   ADMIN_PIN                    — 4-digit PIN for platform admin profile login
 *
 * PowerShell usage:
 *   node scripts/seed-platform-admin.mjs
 *   (ensure .env.local is present, or set env vars explicitly before running)
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

// ─── auto-load .env.local ──────────────────────────────────────────────────
try {
  if (existsSync('.env.local')) {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
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
  // .env.local unreadable — rely on explicit env vars
}

// ─── env validation ────────────────────────────────────────────────────────
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_PIN',
];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(k => console.error(`   ${k}`));
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PIN = process.env.ADMIN_PIN;

if (!/^\d{4}$/.test(ADMIN_PIN)) {
  console.error('❌ ADMIN_PIN must be exactly 4 digits (e.g. 1234)');
  process.exit(1);
}

// ─── PIN hashing ───────────────────────────────────────────────────────────
// Format: "{32-hex-salt}:{64-hex-hash}"
// Algorithm: scrypt (N=32768, r=8, p=1, keylen=32)
// Verified server-side in /api/auth/pin-verify using timingSafeEqual.
function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('🌱 Bootstrapping platform admin account...\n');

  // ── Step 1: Supabase Auth account ─────────────────────────────────────
  console.log('Step 1: Supabase Auth account');
  let authUserId;

  const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (createErr) {
    if (!createErr.message.includes('already been registered')) {
      console.error(`❌ Auth user creation failed: ${createErr.message}`);
      process.exit(1);
    }
    // Already exists — look it up by email
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error(`❌ Could not list auth users: ${listErr.message}`);
      process.exit(1);
    }
    const existing = users.find(u => u.email === ADMIN_EMAIL);
    if (!existing) {
      console.error('❌ Auth user reportedly exists but could not be found in list');
      process.exit(1);
    }
    authUserId = existing.id;
    console.log(`  ℹ️  Auth account already exists: ${authUserId}`);
  } else {
    authUserId = authData.user.id;
    console.log(`  ✅ Auth account created: ${authUserId}`);
  }

  // ── Step 2: families row ───────────────────────────────────────────────
  console.log('\nStep 2: families row');
  const { data: existingFamily } = await supabase
    .from('families')
    .select('id')
    .eq('name', 'Platform Admin')
    .maybeSingle();

  let familyId;
  if (existingFamily) {
    familyId = existingFamily.id;
    console.log(`  ℹ️  Family already exists: ${familyId}`);
  } else {
    const { data: newFamily, error: famErr } = await supabase
      .from('families')
      .insert({ name: 'Platform Admin' })
      .select('id')
      .single();
    if (famErr) {
      console.error(`❌ Family creation failed: ${famErr.message}`);
      process.exit(1);
    }
    familyId = newFamily.id;
    console.log(`  ✅ Family created: ${familyId}`);
  }

  // ── Step 3: users row ──────────────────────────────────────────────────
  console.log('\nStep 3: users row');
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  const pinHash = hashPin(ADMIN_PIN);

  if (existingUser) {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ pin_hash: pinHash, is_platform_admin: true, family_id: familyId })
      .eq('id', existingUser.id);
    if (updateErr) {
      console.error(`❌ User update failed: ${updateErr.message}`);
      process.exit(1);
    }
    console.log(`  ℹ️  Admin user updated (PIN refreshed): ${existingUser.id}`);
  } else {
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        family_id: familyId,
        auth_user_id: authUserId,
        name: 'Platform Admin',
        role: 'parent',
        is_platform_admin: true,
        pin_hash: pinHash,
        avatar_id: 'bubble_tea_excited_1',
      })
      .select('id')
      .single();
    if (userErr) {
      console.error(`❌ User creation failed: ${userErr.message}`);
      process.exit(1);
    }
    console.log(`  ✅ Admin user created: ${newUser.id}`);
  }

  console.log('\n✅ Platform admin bootstrap complete!');
  console.log(`   Email:     ${ADMIN_EMAIL}`);
  console.log(`   Family ID: ${familyId}`);
  console.log(`   Auth ID:   ${authUserId}`);
  console.log('\n   Next: run npx tsx scripts/verify-rls.ts to confirm schema + RLS.');
}

run().catch(err => {
  console.error('❌ Unexpected error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
