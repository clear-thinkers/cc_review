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
 *   ✅ review_session_progress RLS   → Section 5 (family-scoped read incl. cross-family
 *                                       isolation, user-scoped insert/update/delete)
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
let testParentBUserId: string | null = null;
let testWordBId: string | null = null;
let testAuthUserParentId: string | null = null;  // auth.users.id for cleanup
let testAuthUserChildId: string | null = null;   // auth.users.id for cleanup
let testAuthUserParentBId: string | null = null; // auth.users.id for cleanup

// JWT-enriched clients created in Section 4, reused by Section 5.
let familyAParentClient: SupabaseClient | null = null;
let familyAChildClient: SupabaseClient | null = null;

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
    'review_session_progress',
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
    'vocab_phrases',
    'vocab_phrase_lesson_tags',
    'paragraphs',
    'paragraph_test_modes',
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

    // Persist to module scope so Section 5 can reuse these JWT-enriched clients
    // instead of creating new auth users.
    familyAParentClient = parentClient;
    familyAChildClient = childClient;
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

// ─── Section 5: review_session_progress RLS ────────────────────────────────
//
// review_session_progress uses a different policy shape than most tables in
// this app: SELECT is family-scoped (parents see children's rows, matching
// the read-only paused-session visibility from the feature spec), but
// INSERT/UPDATE/DELETE are user-scoped — a family member can only write their
// own rows, not another family member's, even within the same family. This
// is modeled after the quiz_sessions user-scoped insert check in Section 4c,
// extended to also cover UPDATE/DELETE and a second same-family user.
async function section5_reviewSessionProgress(): Promise<void> {
  console.log('\n■ Section 5: review_session_progress RLS (family-scoped read, user-scoped write)');

  if (
    !testFamilyAId ||
    !testFamilyBId ||
    !testParentAUserId ||
    !testChildAUserId ||
    !familyAParentClient ||
    !familyAChildClient
  ) {
    fail(
      'section5 setup incomplete — Section 2/4 must have succeeded',
      'testFamilyAId, testFamilyBId, testParentAUserId, testChildAUserId, and Section 4 clients must all be set'
    );
    return;
  }

  // ── Setup: a Family B parent user + JWT-enriched client ──────────────
  const { data: parentBRow, error: parentBErr } = await admin
    .from('users')
    .insert({ family_id: testFamilyBId, name: `${TEST_TAG}_parent_b`, role: 'parent' })
    .select('id')
    .single();

  let familyBParentClient: SupabaseClient | null = null;
  if (parentBErr || !parentBRow) {
    fail('section5 setup: service role INSERT parent user for Family B', parentBErr?.message);
  } else {
    const parentBUserId: string = parentBRow.id;
    testParentBUserId = parentBUserId;
    try {
      const parentBResult = await createTestAuthClient({
        email: `${TEST_TAG}-parent-b@test.invalid`,
        familyId: testFamilyBId,
        userId: parentBUserId,
        role: 'parent',
      });
      familyBParentClient = parentBResult.client;
      testAuthUserParentBId = parentBResult.authUserId;
    } catch (e: unknown) {
      fail('section5 setup: Family B auth client creation failed', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Setup: Family A child inserts their own paused-session progress row ──
  const progressKey = `${TEST_TAG}_progress_a`;
  const { data: progressRow, error: progressInsertErr } = await familyAChildClient
    .from('review_session_progress')
    .insert({
      user_id: testChildAUserId,
      family_id: testFamilyAId,
      client_session_key: progressKey,
      source_type: 'due_review',
      packaged_session_id: null,
      progress_data: { quizIndex: 1 },
    })
    .select('id')
    .single();

  if (progressInsertErr || !progressRow) {
    fail(
      'review_session_progress setup: child JWT INSERT own progress row failed',
      progressInsertErr?.message
    );
    return;
  }
  pass('review_session_progress setup: child JWT INSERT own progress row succeeded');
  const progressRowId = (progressRow as { id: string }).id;

  // ── (a) Family-scoped read: parent can read the child's paused-session row ──
  const { data: seenByParent, error: parentReadErr } = await familyAParentClient
    .from('review_session_progress')
    .select('id, user_id')
    .eq('id', progressRowId);

  if (parentReadErr) {
    fail('family-scoped read: parent JWT SELECT review_session_progress failed', parentReadErr.message);
  } else if (!seenByParent || seenByParent.length === 0) {
    fail(
      'family-scoped read: parent JWT cannot see child\'s progress row — expected read-only visibility'
    );
  } else {
    pass('family-scoped read: parent JWT can read child\'s paused-session progress row');
  }

  // ── (b) Cross-family isolation: Family B cannot read Family A's progress row ──
  if (familyBParentClient) {
    const { data: seenByFamilyB, error: familyBReadErr } = await familyBParentClient
      .from('review_session_progress')
      .select('id')
      .eq('id', progressRowId);

    if (familyBReadErr) {
      pass(`cross-family isolation: Family B JWT SELECT blocked by RLS error: "${familyBReadErr.message}"`);
    } else if (!seenByFamilyB || seenByFamilyB.length === 0) {
      pass('cross-family isolation: Family B JWT cannot read Family A progress row');
    } else {
      fail(
        'cross-family isolation: Family B JWT can read Family A progress row — RLS not enforcing!',
        `Row id ${progressRowId} is visible to Family B client`
      );
    }
  } else {
    fail('cross-family isolation check skipped — Family B client was not created');
  }

  // ── (c) User-scoped write: another Family A user cannot write the child's row ──

  // Parent (different user, same family) attempts to UPDATE the child's row.
  const { data: parentUpdateData, error: parentUpdateErr } = await familyAParentClient
    .from('review_session_progress')
    .update({ progress_data: { quizIndex: 999 } })
    .eq('id', progressRowId)
    .select('id');

  if (parentUpdateErr) {
    pass(`user-scoped write: parent JWT UPDATE of child's row rejected by RLS: "${parentUpdateErr.message}"`);
  } else if (!parentUpdateData || parentUpdateData.length === 0) {
    pass('user-scoped write: parent JWT UPDATE of child\'s row silently affected 0 rows');
  } else {
    const { data: mutated } = await admin
      .from('review_session_progress')
      .select('progress_data')
      .eq('id', progressRowId)
      .single();
    const mutatedData = (mutated as { progress_data: { quizIndex?: number } } | null)?.progress_data;
    if (mutatedData && mutatedData.quizIndex === 999) {
      fail('user-scoped write: parent JWT UPDATE of child\'s row SUCCEEDED — user-scoped policy not enforced!');
    } else {
      pass('user-scoped write: parent JWT UPDATE of child\'s row silently affected 0 rows');
    }
  }

  // Parent (different user, same family) attempts to DELETE the child's row.
  const { data: parentDeleteData, error: parentDeleteErr } = await familyAParentClient
    .from('review_session_progress')
    .delete()
    .eq('id', progressRowId)
    .select('id');

  if (parentDeleteErr) {
    pass(`user-scoped write: parent JWT DELETE of child's row rejected by RLS: "${parentDeleteErr.message}"`);
  } else if (!parentDeleteData || parentDeleteData.length === 0) {
    pass('user-scoped write: parent JWT DELETE of child\'s row silently affected 0 rows');
  } else {
    const { data: stillThere } = await admin
      .from('review_session_progress')
      .select('id')
      .eq('id', progressRowId)
      .maybeSingle();
    if (!stillThere) {
      fail('user-scoped write: parent JWT DELETE of child\'s row SUCCEEDED — user-scoped policy not enforced!');
    } else {
      pass('user-scoped write: parent JWT DELETE of child\'s row silently affected 0 rows');
    }
  }

  // Child attempts to INSERT a row claiming to belong to the parent (different user_id, same family).
  const { error: childForgedInsertErr } = await familyAChildClient
    .from('review_session_progress')
    .insert({
      user_id: testParentAUserId,
      family_id: testFamilyAId,
      client_session_key: `${TEST_TAG}_progress_forged`,
      source_type: 'due_review',
      packaged_session_id: null,
      progress_data: {},
    });

  if (childForgedInsertErr) {
    pass(`user-scoped write: child JWT INSERT with another user's user_id rejected by RLS: "${childForgedInsertErr.message}"`);
  } else {
    const { data: leaked } = await admin
      .from('review_session_progress')
      .select('id')
      .eq('client_session_key', `${TEST_TAG}_progress_forged`);
    if (leaked && leaked.length > 0) {
      fail('user-scoped write: child JWT INSERT with another user\'s user_id SUCCEEDED — user-scoped policy not enforced!');
      await admin.from('review_session_progress').delete().eq('client_session_key', `${TEST_TAG}_progress_forged`);
    } else {
      pass('user-scoped write: child JWT INSERT with another user\'s user_id rejected by RLS (0 rows written)');
    }
  }
}

// ─── Section 6: vocab_phrases / vocab_phrase_lesson_tags RLS ───────────────
//
// vocab_phrases mirrors the `words` posture exactly: INSERT/DELETE are
// parent-only, UPDATE is family-scoped (children grade phrases during
// fill-test the same way gradeWord() updates `words`). vocab_phrase_lesson_tags
// mirrors word_lesson_tags: full CRUD is family-scoped, no role restriction.
async function section6_vocabPhrases(): Promise<void> {
  console.log('\n■ Section 6: vocab_phrases / vocab_phrase_lesson_tags RLS');

  if (!testFamilyAId || !testFamilyBId || !familyAParentClient || !familyAChildClient) {
    fail(
      'section6 setup incomplete — Section 2/4 must have succeeded',
      'testFamilyAId, testFamilyBId, and Section 4 clients must all be set'
    );
    return;
  }

  // ── Child cannot INSERT a vocab_phrase (parent-only, like words) ──
  const { error: childInsertErr } = await familyAChildClient.from('vocab_phrases').insert({
    family_id: testFamilyAId,
    phrase: `${TEST_TAG}_child`.slice(0, 10),
  });

  if (childInsertErr) {
    pass(`vocab_phrases child write scope: child JWT INSERT rejected by RLS: "${childInsertErr.message}"`);
  } else {
    fail('vocab_phrases child write scope: child JWT INSERT SUCCEEDED — parent-only policy not enforced!');
  }

  // ── Parent CAN INSERT a vocab_phrase ──
  const { data: phraseRow, error: parentInsertErr } = await familyAParentClient
    .from('vocab_phrases')
    .insert({ family_id: testFamilyAId, phrase: '谢谢' })
    .select('id')
    .single();

  if (parentInsertErr || !phraseRow) {
    fail('vocab_phrases parent scoped insert: parent JWT INSERT failed', parentInsertErr?.message);
    return;
  }
  pass('vocab_phrases parent scoped insert: parent JWT INSERT succeeded');
  const phraseId = (phraseRow as { id: string }).id;

  // ── Cross-family isolation: Family B cannot read Family A's phrase ──
  const { data: familyBPhrase, error: familyBReadErr } = await anon
    .from('vocab_phrases')
    .select('id')
    .eq('id', phraseId);
  // (anon has no JWT claims at all — reuses the unenriched-isolation posture from Section 3)
  if (familyBReadErr) {
    pass(`vocab_phrases isolation: unenriched SELECT blocked by RLS error: "${familyBReadErr.message}"`);
  } else if (!familyBPhrase || familyBPhrase.length === 0) {
    pass('vocab_phrases isolation: unenriched session cannot read the phrase');
  } else {
    fail('vocab_phrases isolation: unenriched session can read the phrase — RLS not enforcing!');
  }

  // ── Child CAN UPDATE (grading a phrase during fill-test) ──
  const { data: childUpdateData, error: childUpdateErr } = await familyAChildClient
    .from('vocab_phrases')
    .update({ test_count: 1 })
    .eq('id', phraseId)
    .select('id');

  if (childUpdateErr) {
    fail('vocab_phrases family-scoped update: child JWT UPDATE (grading) rejected', childUpdateErr.message);
  } else if (!childUpdateData || childUpdateData.length === 0) {
    fail('vocab_phrases family-scoped update: child JWT UPDATE (grading) affected 0 rows — grading would silently fail');
  } else {
    pass('vocab_phrases family-scoped update: child JWT UPDATE (grading) succeeded');
  }

  // ── Child cannot DELETE a vocab_phrase (parent-only, like words) ──
  const { data: childDeleteData, error: childDeleteErr } = await familyAChildClient
    .from('vocab_phrases')
    .delete()
    .eq('id', phraseId)
    .select('id');

  if (childDeleteErr) {
    pass(`vocab_phrases child write scope: child JWT DELETE rejected by RLS: "${childDeleteErr.message}"`);
  } else if (!childDeleteData || childDeleteData.length === 0) {
    pass('vocab_phrases child write scope: child JWT DELETE silently affected 0 rows');
  } else {
    fail('vocab_phrases child write scope: child JWT DELETE SUCCEEDED — parent-only policy not enforced!');
  }

  // ── vocab_phrase_lesson_tags: family-scoped write (any family role, like word_lesson_tags) ──
  const { data: textbookRow } = await admin
    .from('textbooks')
    .select('id')
    .eq('is_shared', true)
    .limit(1)
    .maybeSingle();

  if (!textbookRow) {
    fail('vocab_phrase_lesson_tags setup skipped — no shared textbook found for lesson_tags FK');
  } else {
    const { data: lessonTagRow, error: lessonTagErr } = await admin
      .from('lesson_tags')
      .insert({
        textbook_id: (textbookRow as { id: string }).id,
        grade: `${TEST_TAG}_grade`,
        unit: `${TEST_TAG}_unit`,
        lesson: `${TEST_TAG}_lesson`,
      })
      .select('id')
      .single();

    if (lessonTagErr || !lessonTagRow) {
      fail('vocab_phrase_lesson_tags setup: service role INSERT lesson_tag failed', lessonTagErr?.message);
    } else {
      const lessonTagId = (lessonTagRow as { id: string }).id;
      const { error: tagAssignErr } = await familyAChildClient.from('vocab_phrase_lesson_tags').insert({
        vocab_phrase_id: phraseId,
        lesson_tag_id: lessonTagId,
        family_id: testFamilyAId,
      });

      if (tagAssignErr) {
        fail(
          'vocab_phrase_lesson_tags family-scoped insert: child JWT INSERT rejected',
          tagAssignErr.message
        );
      } else {
        pass('vocab_phrase_lesson_tags family-scoped insert: child JWT INSERT succeeded');
      }
    }
  }
}

// ─── Section 7: paragraphs RLS ──────────────────────────────────────────────
//
// paragraphs is parent-only for INSERT/UPDATE/DELETE — unlike vocab_phrases,
// whose UPDATE policy is family-scoped so children can grade a phrase during
// fill-test. A paragraph is never graded or written to by a child, so its
// UPDATE policy is parent-scoped too (see supabase/migrations/20260817000000_paragraphs.sql).
async function section7_paragraphs(): Promise<void> {
  console.log('\n■ Section 7: paragraphs RLS');

  if (!testFamilyAId || !testFamilyBId || !familyAParentClient || !familyAChildClient || !testParentAUserId) {
    fail(
      'section7 setup incomplete — Section 2/4 must have succeeded',
      'testFamilyAId, testFamilyBId, testParentAUserId, and Section 4 clients must all be set'
    );
    return;
  }

  // ── Child cannot INSERT a paragraph (parent-only) ──
  const { error: childInsertErr } = await familyAChildClient.from('paragraphs').insert({
    family_id: testFamilyAId,
    raw_text: `${TEST_TAG}_child`,
    created_by_user_id: testChildAUserId,
  });

  if (childInsertErr) {
    pass(`paragraphs child write scope: child JWT INSERT rejected by RLS: "${childInsertErr.message}"`);
  } else {
    fail('paragraphs child write scope: child JWT INSERT SUCCEEDED — parent-only policy not enforced!');
  }

  // ── Parent CAN INSERT a paragraph ──
  const { data: paragraphRow, error: parentInsertErr } = await familyAParentClient
    .from('paragraphs')
    .insert({ family_id: testFamilyAId, raw_text: '我喜欢图书馆。', created_by_user_id: testParentAUserId })
    .select('id')
    .single();

  if (parentInsertErr || !paragraphRow) {
    fail('paragraphs parent scoped insert: parent JWT INSERT failed', parentInsertErr?.message);
    return;
  }
  pass('paragraphs parent scoped insert: parent JWT INSERT succeeded');
  const paragraphId = (paragraphRow as { id: string }).id;

  // ── Cross-family isolation: unenriched session cannot read Family A's paragraph ──
  const { data: unenrichedRead, error: unenrichedReadErr } = await anon
    .from('paragraphs')
    .select('id')
    .eq('id', paragraphId);
  if (unenrichedReadErr) {
    pass(`paragraphs isolation: unenriched SELECT blocked by RLS error: "${unenrichedReadErr.message}"`);
  } else if (!unenrichedRead || unenrichedRead.length === 0) {
    pass('paragraphs isolation: unenriched session cannot read the paragraph');
  } else {
    fail('paragraphs isolation: unenriched session can read the paragraph — RLS not enforcing!');
  }

  // ── Child cannot UPDATE a paragraph (parent-only, unlike vocab_phrases) ──
  const { data: childUpdateData, error: childUpdateErr } = await familyAChildClient
    .from('paragraphs')
    .update({ title: 'child edit' })
    .eq('id', paragraphId)
    .select('id');

  if (childUpdateErr) {
    pass(`paragraphs child write scope: child JWT UPDATE rejected by RLS: "${childUpdateErr.message}"`);
  } else if (!childUpdateData || childUpdateData.length === 0) {
    pass('paragraphs child write scope: child JWT UPDATE silently affected 0 rows');
  } else {
    fail('paragraphs child write scope: child JWT UPDATE SUCCEEDED — parent-only policy not enforced!');
  }

  // ── Parent CAN UPDATE their own family's paragraph ──
  const { data: parentUpdateData, error: parentUpdateErr } = await familyAParentClient
    .from('paragraphs')
    .update({ title: 'parent edit' })
    .eq('id', paragraphId)
    .select('id');

  if (parentUpdateErr || !parentUpdateData || parentUpdateData.length === 0) {
    fail('paragraphs parent scoped update: parent JWT UPDATE failed or affected 0 rows', parentUpdateErr?.message);
  } else {
    pass('paragraphs parent scoped update: parent JWT UPDATE succeeded');
  }

  // ── Child cannot DELETE a paragraph (parent-only) ──
  const { data: childDeleteData, error: childDeleteErr } = await familyAChildClient
    .from('paragraphs')
    .delete()
    .eq('id', paragraphId)
    .select('id');

  if (childDeleteErr) {
    pass(`paragraphs child write scope: child JWT DELETE rejected by RLS: "${childDeleteErr.message}"`);
  } else if (!childDeleteData || childDeleteData.length === 0) {
    pass('paragraphs child write scope: child JWT DELETE silently affected 0 rows');
  } else {
    fail('paragraphs child write scope: child JWT DELETE SUCCEEDED — parent-only policy not enforced!');
  }
}

// ─── Section 8: paragraph_test_modes RLS ────────────────────────────────────
//
// Same posture as `paragraphs`: parent-only INSERT/UPDATE/DELETE, family-
// scoped read. Also verifies the new (paragraph_id, name) unique constraint
// -- a departure from every other named/unique thing in this app, which is
// family-wide unique -- behaves as designed: same name rejected on the same
// paragraph, but the same name succeeds on a second, different paragraph.
async function section8_paragraphTestModes(): Promise<void> {
  console.log('\n■ Section 8: paragraph_test_modes RLS');

  if (!testFamilyAId || !testFamilyBId || !familyAParentClient || !familyAChildClient || !testParentAUserId) {
    fail(
      'section8 setup incomplete — Section 2/4 must have succeeded',
      'testFamilyAId, testFamilyBId, testParentAUserId, and Section 4 clients must all be set'
    );
    return;
  }

  const { data: paragraphA, error: paragraphAErr } = await familyAParentClient
    .from('paragraphs')
    .insert({ family_id: testFamilyAId, raw_text: '第一篇短文。', created_by_user_id: testParentAUserId })
    .select('id')
    .single();
  const { data: paragraphB, error: paragraphBErr } = await familyAParentClient
    .from('paragraphs')
    .insert({ family_id: testFamilyAId, raw_text: '第二篇短文。', created_by_user_id: testParentAUserId })
    .select('id')
    .single();

  if (paragraphAErr || !paragraphA || paragraphBErr || !paragraphB) {
    fail('section8 setup: creating two test paragraphs failed', paragraphAErr?.message ?? paragraphBErr?.message);
    return;
  }
  const paragraphAId = (paragraphA as { id: string }).id;
  const paragraphBId = (paragraphB as { id: string }).id;

  // ── Child cannot INSERT a test mode (parent-only) ──
  const { error: childInsertErr } = await familyAChildClient.from('paragraph_test_modes').insert({
    paragraph_id: paragraphAId,
    family_id: testFamilyAId,
    name: `${TEST_TAG}_child`,
    created_by_user_id: testChildAUserId,
  });
  if (childInsertErr) {
    pass(`paragraph_test_modes child write scope: child JWT INSERT rejected by RLS: "${childInsertErr.message}"`);
  } else {
    fail('paragraph_test_modes child write scope: child JWT INSERT SUCCEEDED — parent-only policy not enforced!');
  }

  // ── Parent CAN INSERT a test mode ──
  const { data: modeRow, error: parentInsertErr } = await familyAParentClient
    .from('paragraph_test_modes')
    .insert({
      paragraph_id: paragraphAId,
      family_id: testFamilyAId,
      name: 'Quiz 1',
      created_by_user_id: testParentAUserId,
    })
    .select('id')
    .single();
  if (parentInsertErr || !modeRow) {
    fail('paragraph_test_modes parent scoped insert: parent JWT INSERT failed', parentInsertErr?.message);
    return;
  }
  pass('paragraph_test_modes parent scoped insert: parent JWT INSERT succeeded');
  const modeId = (modeRow as { id: string }).id;

  // ── Unique constraint: same name on the SAME paragraph is rejected ──
  const { error: duplicateSameParagraphErr } = await familyAParentClient.from('paragraph_test_modes').insert({
    paragraph_id: paragraphAId,
    family_id: testFamilyAId,
    name: 'Quiz 1',
    created_by_user_id: testParentAUserId,
  });
  if (duplicateSameParagraphErr) {
    pass(
      `paragraph_test_modes unique constraint: same name on the same paragraph rejected: "${duplicateSameParagraphErr.message}"`
    );
  } else {
    fail('paragraph_test_modes unique constraint: duplicate (paragraph_id, name) INSERT SUCCEEDED — constraint not enforced!');
  }

  // ── Unique constraint: same name on a DIFFERENT paragraph succeeds (per-paragraph, not family-wide) ──
  const { error: sameNameOtherParagraphErr } = await familyAParentClient.from('paragraph_test_modes').insert({
    paragraph_id: paragraphBId,
    family_id: testFamilyAId,
    name: 'Quiz 1',
    created_by_user_id: testParentAUserId,
  });
  if (sameNameOtherParagraphErr) {
    fail(
      'paragraph_test_modes unique constraint: same name on a DIFFERENT paragraph FAILED — constraint is wrongly family-wide',
      sameNameOtherParagraphErr.message
    );
  } else {
    pass('paragraph_test_modes unique constraint: same name on a different paragraph succeeded (per-paragraph scoping confirmed)');
  }

  // ── Cross-family isolation: unenriched session cannot read Family A's test mode ──
  const { data: unenrichedRead, error: unenrichedReadErr } = await anon
    .from('paragraph_test_modes')
    .select('id')
    .eq('id', modeId);
  if (unenrichedReadErr) {
    pass(`paragraph_test_modes isolation: unenriched SELECT blocked by RLS error: "${unenrichedReadErr.message}"`);
  } else if (!unenrichedRead || unenrichedRead.length === 0) {
    pass('paragraph_test_modes isolation: unenriched session cannot read the test mode');
  } else {
    fail('paragraph_test_modes isolation: unenriched session can read the test mode — RLS not enforcing!');
  }

  // ── Child cannot UPDATE a test mode (parent-only) ──
  const { data: childUpdateData, error: childUpdateErr } = await familyAChildClient
    .from('paragraph_test_modes')
    .update({ name: 'child edit' })
    .eq('id', modeId)
    .select('id');
  if (childUpdateErr) {
    pass(`paragraph_test_modes child write scope: child JWT UPDATE rejected by RLS: "${childUpdateErr.message}"`);
  } else if (!childUpdateData || childUpdateData.length === 0) {
    pass('paragraph_test_modes child write scope: child JWT UPDATE silently affected 0 rows');
  } else {
    fail('paragraph_test_modes child write scope: child JWT UPDATE SUCCEEDED — parent-only policy not enforced!');
  }

  // ── Child cannot DELETE a test mode (parent-only) ──
  const { data: childDeleteData, error: childDeleteErr } = await familyAChildClient
    .from('paragraph_test_modes')
    .delete()
    .eq('id', modeId)
    .select('id');
  if (childDeleteErr) {
    pass(`paragraph_test_modes child write scope: child JWT DELETE rejected by RLS: "${childDeleteErr.message}"`);
  } else if (!childDeleteData || childDeleteData.length === 0) {
    pass('paragraph_test_modes child write scope: child JWT DELETE silently affected 0 rows');
  } else {
    fail('paragraph_test_modes child write scope: child JWT DELETE SUCCEEDED — parent-only policy not enforced!');
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

  // Delete test auth users created in Sections 4 and 5
  const authIds = [testAuthUserParentId, testAuthUserChildId, testAuthUserParentBId].filter(
    (id): id is string => id !== null
  );
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
    await section5_reviewSessionProgress();
    await section6_vocabPhrases();
    await section7_paragraphs();
    await section8_paragraphTestModes();
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
