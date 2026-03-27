#!/usr/bin/env tsx
/**
 * RLS Verification Script
 *
 * Verifies schema structure, RLS table accessibility, platform admin bypass,
 * unenriched session isolation, cross-family isolation, child write scope,
 * and quiz session immutability against a live Supabase dev project.
 *
 * RLS acceptance criteria mapped to test sections:
 *   ✅ Table accessibility           → Section 1 (service role SELECT on all tables)
 *   ✅ Platform admin bypass         → Section 2 (service role CRUD)
 *   ✅ Unenriched session isolation  → Section 3 (anon client sees nothing)
 *   ✅ Cross-family isolation        → Section 4a (JWT-enriched, Family A cannot read Family B)
 *   ✅ Child write scope             → Section 4b (child JWT INSERT into words rejected)
 *   ✅ Quiz session immutability     → Section 4c (UPDATE on quiz_sessions affects 0 rows)
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

function pass(label: string): void {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  ❌ FAIL  ${label}`);
  if (detail) console.error(`         ${detail}`);
  failed++;
}


// ─── test data state ───────────────────────────────────────────────────────
const TEST_TAG = `rls_verify_${Date.now()}`;
let testFamilyAId: string | null = null;
let testFamilyBId: string | null = null;
let testParentAUserId: string | null = null;
let testChildAUserId: string | null = null;
let testWordBId: string | null = null;
let testAuthUserParentId: string | null = null;  // auth.users.id for cleanup
let testAuthUserChildId: string | null = null;   // auth.users.id for cleanup

// ─── Enriched client helper ────────────────────────────────────────────────
//
// Creates a real Supabase auth.users entry with the enriched app_metadata
// (family_id, user_id, role) already set, signs in to get a real JWT, and
// returns a Supabase client that sends that JWT on every request.
//
// This mirrors exactly what /api/auth/pin-verify does via updateUserById +
// the client's subsequent refreshSession call.

async function createTestAuthClient(opts: {
  email: string;
  familyId: string;
  userId: string;
  role: 'parent' | 'child';
  isPlatformAdmin?: boolean;
}): Promise<{ client: SupabaseClient; authUserId: string }> {
  const TEST_PASSWORD = 'Test1234!Rls';

  // Create the auth user with enriched app_metadata already embedded.
  // Supabase includes app_metadata in every JWT it issues for this user.
  const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
    email: opts.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: {
      family_id: opts.familyId,
      user_id: opts.userId,
      role: opts.role,
      is_platform_admin: opts.isPlatformAdmin ?? false,
    },
  });

  if (createErr || !authUser.user) {
    throw new Error(`Failed to create auth user ${opts.email}: ${createErr?.message ?? 'unknown'}`);
  }

  // Sign in to get a real Supabase-issued JWT that carries the app_metadata claims.
  const signInClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({
    email: opts.email,
    password: TEST_PASSWORD,
  });

  if (signInErr || !signInData.session) {
    throw new Error(`Failed to sign in as ${opts.email}: ${signInErr?.message ?? 'unknown'}`);
  }

  const jwt = signInData.session.access_token;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  return { client, authUserId: authUser.user.id };
}

// ─── Section 1: Table accessibility ───────────────────────────────────────
async function section1_tableAccessibility(): Promise<void> {
  console.log('\n■ Section 1: Table accessibility (service role SELECT)');

  const tables = [
    'families',
    'users',
    'words',
    'flashcard_contents',
    'hidden_admin_targets',
    'review_test_sessions',
    'review_test_session_targets',
    'quiz_sessions',
    'wallets',
    'shop_recipes',
    'shop_recipe_unlocks',
    'shop_coin_transactions',
    'shop_ingredient_prices',
    'prompt_templates',
    'textbooks',
    'lesson_tags',
    'word_lesson_tags',
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

  // INSERT test users for Family A (parent + child) — needed for Section 4 tests
  const { data: parentARow, error: parentAErr } = await admin
    .from('users')
    .insert({ family_id: testFamilyAId, name: `${TEST_TAG}_parent_a`, role: 'parent' })
    .select('id')
    .single();
  if (parentAErr || !parentARow) {
    fail('service role INSERT parent user for Family A', parentAErr?.message);
  } else {
    testParentAUserId = parentARow.id;
    pass('service role INSERT parent user for Family A');
  }

  const { data: childARow, error: childAErr } = await admin
    .from('users')
    .insert({ family_id: testFamilyAId, name: `${TEST_TAG}_child_a`, role: 'child' })
    .select('id')
    .single();
  if (childAErr || !childARow) {
    fail('service role INSERT child user for Family A', childAErr?.message);
  } else {
    testChildAUserId = childARow.id;
    pass('service role INSERT child user for Family A');
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

// ─── Section 4: JWT-enriched tests ────────────────────────────────────────
async function section4_enrichedTests(): Promise<void> {
  console.log('\n■ Section 4: JWT-enriched RLS tests');

  if (!testFamilyAId || !testFamilyBId || !testParentAUserId || !testChildAUserId) {
    fail(
      'section4 setup incomplete — Section 2 must have succeeded',
      'testFamilyAId, testFamilyBId, testParentAUserId, testChildAUserId must all be set'
    );
    return;
  }

  // Create real auth users with enriched app_metadata; failures are fatal for this section.
  let clientA: SupabaseClient;
  let childClient: SupabaseClient;
  let parentClient: SupabaseClient;

  try {
    const parentResult = await createTestAuthClient({
      email: `${TEST_TAG}-parent@test.invalid`,
      familyId: testFamilyAId,
      userId: testParentAUserId,
      role: 'parent',
    });
    clientA = parentResult.client;
    parentClient = parentResult.client;
    testAuthUserParentId = parentResult.authUserId;

    const childResult = await createTestAuthClient({
      email: `${TEST_TAG}-child@test.invalid`,
      familyId: testFamilyAId,
      userId: testChildAUserId,
      role: 'child',
    });
    childClient = childResult.client;
    testAuthUserChildId = childResult.authUserId;
  } catch (e: unknown) {
    fail('section4 auth user setup failed', e instanceof Error ? e.message : String(e));
    return;
  }

  // ── 4a. Cross-family isolation ───────────────────────────────────────
  // Insert a word for Family B so there is data to (fail to) read
  const { data: wordBRow, error: wordBErr } = await admin
    .from('words')
    .insert({ id: `${TEST_TAG}_word_b`, family_id: testFamilyBId, hanzi: '隔' })
    .select('id')
    .single();

  if (wordBErr || !wordBRow) {
    fail('section4 setup: admin INSERT word for Family B', wordBErr?.message);
  } else {
    testWordBId = wordBRow.id;
  }

  if (testWordBId) {
    const { data: wordsSeenByA, error: crossErr } = await clientA
      .from('words')
      .select('id');

    if (crossErr) {
      fail('cross-family isolation: Family A client query failed', crossErr.message);
    } else {
      const seenIds = (wordsSeenByA ?? []).map((r: { id: string }) => r.id);
      const familyAWordId = `${TEST_TAG}_word`;
      if (!seenIds.includes(familyAWordId)) {
        fail(
          'cross-family isolation: Family A JWT cannot see its OWN words — JWT claims not being read',
          `Expected to find ${familyAWordId} but got ids: ${seenIds.join(', ') || '(none)'}`
        );
      } else if (seenIds.includes(testWordBId)) {
        fail(
          'cross-family isolation: Family A JWT can read Family B words — RLS not enforcing!',
          `Family B word id ${testWordBId} is visible to Family A client`
        );
      } else {
        pass('cross-family isolation: Family A JWT cannot read Family B words');
      }
    }
  }

  // ── 4b. Child write scope ────────────────────────────────────────────
  // Child JWT for Family A tries to INSERT a word — policy requires role='parent'
  const { error: childInsertErr } = await childClient.from('words').insert({
    id: `${TEST_TAG}_child_word`,
    family_id: testFamilyAId,
    hanzi: '童',
  });

  if (childInsertErr) {
    pass(`child write scope: child JWT INSERT into words rejected by RLS: "${childInsertErr.message}"`);
  } else {
    // Also check whether a row was actually written (some RLS violations return no error but 0 rows)
    const { data: leaked } = await admin
      .from('words')
      .select('id')
      .eq('id', `${TEST_TAG}_child_word`);
    if (leaked && leaked.length > 0) {
      fail('child write scope: child JWT INSERT into words SUCCEEDED — role policy not enforced!');
      // Clean up the leaked row
      await admin.from('words').delete().eq('id', `${TEST_TAG}_child_word`);
    } else {
      pass('child write scope: child JWT INSERT into words rejected by RLS (0 rows written)');
    }
  }

  // ── 4c. Quiz session immutability ────────────────────────────────────
  // Parent inserts a quiz session (INSERT policy allows it), then tries UPDATE (no UPDATE policy)
  const { data: sessionRow, error: sessionInsertErr } = await parentClient
    .from('quiz_sessions')
    .insert({
      id: `${TEST_TAG}_session`,
      user_id: testParentAUserId,
      family_id: testFamilyAId,
      session_type: 'fill-test',
      grade_data: [],
      fully_correct_count: 8,
      failed_count: 2,
      partially_correct_count: 0,
      total_grades: 10,
      duration_seconds: 60,
      coins_earned: 5,
    })
    .select('id')
    .single();

  if (sessionInsertErr || !sessionRow) {
    fail(
      'quiz session immutability: parent JWT INSERT into quiz_sessions failed (setup step)',
      sessionInsertErr?.message
    );
  } else {
    // Now attempt UPDATE — no UPDATE policy exists, so this should silently affect 0 rows
    const { data: updateData, error: updateErr } = await parentClient
      .from('quiz_sessions')
      .update({ coins_earned: 999 })
      .eq('id', sessionRow.id)
      .select('id');

    if (updateErr) {
      // An explicit RLS error is also correct immutability behaviour
      pass(`quiz session immutability: UPDATE rejected with error: "${updateErr.message}"`);
    } else if (!updateData || updateData.length === 0) {
      pass('quiz session immutability: UPDATE on quiz_sessions silently affected 0 rows (immutable)');
    } else {
      // Rows were returned — confirm the value actually changed (vs selection artefact)
      const { data: unchanged } = await admin
        .from('quiz_sessions')
        .select('coins_earned')
        .eq('id', sessionRow.id)
        .single();
      if (unchanged && (unchanged as { coins_earned: number }).coins_earned === 999) {
        fail('quiz session immutability: UPDATE on quiz_sessions SUCCEEDED — record was mutated!');
      } else {
        pass('quiz session immutability: UPDATE on quiz_sessions silently affected 0 rows (immutable)');
      }
    }
  }
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

  // Delete test auth users created in Section 4
  const authIds = [testAuthUserParentId, testAuthUserChildId].filter((id): id is string => id !== null);
  for (const authId of authIds) {
    const { error: authDelErr } = await admin.auth.admin.deleteUser(authId);
    if (authDelErr) {
      console.error(`  ⚠️  Failed to delete auth user ${authId}: ${authDelErr.message}`);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  RLS Verification');
  console.log('  Schema · Admin Bypass · Isolation · Child Scope · Immutability');
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
    `  Results:  ${passed} passed  ·  ${failed} failed`
  );
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('RLS verification FAILED. Fix the errors above before proceeding.\n');
    process.exit(1);
  } else {
    console.log('RLS verification PASSED.\n');
  }
}

main().catch((err: unknown) => {
  console.error('❌ Unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
