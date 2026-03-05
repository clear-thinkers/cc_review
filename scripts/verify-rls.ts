#!/usr/bin/env tsx
/**
 * RLS Verification Script — Feature 4: Auth & User Model (Phase 1)
 *
 * Verifies schema structure, RLS table accessibility, platform admin bypass,
 * and unenriched session isolation against a live Supabase dev project.
 *
 * RLS acceptance criteria mapped to test sections:
 *   ✅ Platform admin bypass         → Section 2 (service role CRUD)
 *   ✅ Unenriched session isolation  → Section 3 (anon client sees nothing)
 *   ⏭️ Cross-family isolation        → Section 4 SKIP (requires Phase 3 JWT enrichment)
 *   ⏭️ Child write scope             → Section 4 SKIP (requires Phase 3 JWT enrichment)
 *   ⏭️ Quiz session immutability     → Section 4 SKIP (requires Phase 3 JWT enrichment)
 *
 * Env vars (auto-loaded from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — Anon key (for unenriched isolation test)
 *   SUPABASE_SERVICE_ROLE_KEY       — Service role key (bypasses RLS)
 *
 * Usage:
 *   npx tsx scripts/verify-rls.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  // unreadable — rely on explicit env vars
}

// ─── env validation ────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missing = REQUIRED_VARS.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(k => console.error(`   ${k}`));
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// ─── clients ───────────────────────────────────────────────────────────────
const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── result tracking ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

function pass(label: string): void {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  ❌ FAIL  ${label}`);
  if (detail) console.error(`         ${detail}`);
  failed++;
}

function skip(label: string, reason: string): void {
  console.log(`  ⏭️  SKIP  ${label}`);
  console.log(`         → ${reason}`);
  skipped++;
}

// ─── test data state ───────────────────────────────────────────────────────
const TEST_TAG = `rls_verify_${Date.now()}`;
let testFamilyAId: string | null = null;
let testFamilyBId: string | null = null;

// ─── Section 1: Table accessibility ───────────────────────────────────────
async function section1_tableAccessibility(): Promise<void> {
  console.log('\n■ Section 1: Table accessibility (service role SELECT)');

  const tables = [
    'families',
    'users',
    'words',
    'flashcard_contents',
    'quiz_sessions',
    'wallets',
  ];

  for (const table of tables) {
    // limit(0) returns no rows but confirms the table exists and is reachable
    const { error } = await admin.from(table).select('*').limit(0);
    if (error) {
      fail(`'${table}' accessible via service role`, error.message);
    } else {
      pass(`'${table}' accessible via service role`);
    }
  }
}

// ─── Section 2: Platform admin bypass ─────────────────────────────────────
async function section2_adminBypass(): Promise<void> {
  console.log('\n■ Section 2: Platform admin bypass (service role CRUD)');

  // INSERT Family A
  const { data: famA, error: errA } = await admin
    .from('families')
    .insert({ name: `${TEST_TAG}_A` })
    .select('id')
    .single();

  if (errA || !famA) {
    fail('service role INSERT into families', errA?.message);
    return;
  }
  testFamilyAId = famA.id;
  pass('service role INSERT into families');

  // INSERT Family B
  const { data: famB, error: errB } = await admin
    .from('families')
    .insert({ name: `${TEST_TAG}_B` })
    .select('id')
    .single();

  if (errB || !famB) {
    fail('service role INSERT second family', errB?.message);
  } else {
    testFamilyBId = famB.id;
    pass('service role INSERT second family');
  }

  // INSERT test word for Family A
  const { error: wordErr } = await admin.from('words').insert({
    id: `${TEST_TAG}_word`,
    family_id: testFamilyAId,
    hanzi: '验',
  });

  if (wordErr) {
    fail('service role INSERT into words', wordErr.message);
  } else {
    pass('service role INSERT into words');
  }

  // SELECT — service role must see the inserted word (bypass confirmed)
  const { data: words, error: readErr } = await admin
    .from('words')
    .select('id')
    .eq('family_id', testFamilyAId);

  if (readErr) {
    fail('service role SELECT words bypasses RLS', readErr.message);
  } else if (!words || words.length === 0) {
    fail('service role SELECT returned 0 rows despite inserting test word');
  } else {
    pass(`service role SELECT sees inserted word (${words.length} row)`);
  }
}

// ─── Section 3: Unenriched session isolation ───────────────────────────────
async function section3_unenrichedIsolation(): Promise<void> {
  console.log('\n■ Section 3: Unenriched session isolation (anon client, no JWT claims)');

  if (!testFamilyAId) {
    fail('isolation test skipped — no test data from Section 2');
    return;
  }

  // Anon SELECT words — data exists (Section 2 inserted it) but should not be visible
  const { data: words, error: wordErr } = await anon
    .from('words')
    .select('id')
    .eq('family_id', testFamilyAId);

  if (wordErr) {
    // RLS raising an error is also correct isolation behaviour
    pass(`anon SELECT words blocked by RLS error: ${wordErr.message}`);
  } else if (!words || words.length === 0) {
    pass('anon SELECT words returns empty set (data isolated from unenriched sessions)');
  } else {
    fail(
      'anon SELECT words returned rows — RLS not blocking unenriched sessions!',
      `Got ${words.length} row(s) for family ${testFamilyAId}`
    );
  }

  // Anon SELECT families — should also return nothing
  const { data: families, error: famErr } = await anon
    .from('families')
    .select('id')
    .eq('id', testFamilyAId);

  if (famErr) {
    pass(`anon SELECT families blocked by RLS error: ${famErr.message}`);
  } else if (!families || families.length === 0) {
    pass('anon SELECT families returns empty set (data isolated)');
  } else {
    fail(
      'anon SELECT families returned rows — RLS not blocking unenriched sessions!',
      `Got ${families.length} row(s)`
    );
  }

  // Anon INSERT words — should fail (RLS check clause rejects it)
  const { error: insertErr } = await anon.from('words').insert({
    id: `${TEST_TAG}_anon_word`,
    family_id: testFamilyAId,
    hanzi: '拒',
  });

  if (insertErr) {
    pass(`anon INSERT words rejected by RLS: "${insertErr.message}"`);
  } else {
    fail('anon INSERT words succeeded — RLS write policy is not blocking!');
  }
}

// ─── Section 4: JWT-enriched tests (SKIP — requires Phase 3) ──────────────
async function section4_enrichedTests(): Promise<void> {
  console.log('\n■ Section 4: JWT-enriched RLS tests (Phase 3 required)');

  skip(
    'cross-family isolation: Family A JWT cannot read Family B words',
    'Requires Phase 3: /api/auth/pin-verify must inject family_id into JWT claims.'
  );
  skip(
    'child write scope: child JWT cannot INSERT into words',
    'Requires Phase 3: role claim in JWT; child role enforcement is application-layer.'
  );
  skip(
    'quiz session immutability: no UPDATE allowed on quiz_sessions',
    'Requires Phase 3: user_id claim in JWT to test user-scoped insert-only policy.'
  );
}

// ─── Cleanup ───────────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  console.log('\n■ Cleanup: Removing synthetic test data');

  const ids = [testFamilyAId, testFamilyBId].filter((id): id is string => id !== null);

  if (ids.length === 0) {
    console.log('  (no test data to clean up)');
    return;
  }

  // Cascade delete: families → words, users, wallets, quiz_sessions
  const { error } = await admin.from('families').delete().in('id', ids);
  if (error) {
    console.error(`  ⚠️  Cleanup failed: ${error.message}`);
    console.error(
      `  Manual cleanup: DELETE FROM families WHERE name LIKE '${TEST_TAG}%'`
    );
  } else {
    pass('synthetic test data deleted (cascade removed words, users, wallets)');
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  RLS Verification — Feature 4: Auth & User Model');
  console.log('  Phase 1: Schema · Admin Bypass · Unenriched Isolation');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Project: ${SUPABASE_URL}`);

  try {
    await section1_tableAccessibility();
    await section2_adminBypass();
    await section3_unenrichedIsolation();
    await section4_enrichedTests();
  } finally {
    await cleanup();
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(
    `  Results:  ${passed} passed  ·  ${failed} failed  ·  ${skipped} skipped`
  );
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('Phase 1 verification FAILED. Fix the errors above before proceeding.\n');
    process.exit(1);
  } else {
    console.log('Phase 1 verification PASSED. Ready to proceed to Phase 2.\n');
  }
}

main().catch((err: unknown) => {
  console.error('❌ Unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
