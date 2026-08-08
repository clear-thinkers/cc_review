#!/usr/bin/env tsx
/**
 * Session-Scoped Profile Claims Verification Script
 *
 * Verifies custom_access_token_hook against a live Supabase dev project:
 * that a Layer 2 profile switch (auth_session_profiles upsert, what
 * /api/auth/pin-verify does) on one Auth session never affects the claims a
 * DIFFERENT, concurrently active Auth session receives on its own token
 * refresh -- the exact scenario that caused two real incidents, see
 * docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md and
 * docs/feature-specs/2026-08-08-session-scoped-profile-claims.md.
 *
 * This bypasses the pin-verify HTTP route (same precedent as
 * scripts/verify-rls.ts's createTestAuthClient) and upserts
 * auth_session_profiles directly via the service-role client, since the
 * behavior under test is the hook + table, not the route's PIN-checking
 * logic (already covered by src/app/api/auth/pin-verify/route.test.ts).
 *
 * Requires the custom_access_token_hook to already be registered as a
 * Custom Access Token Hook on the target project (Dashboard: Authentication
 * -> Hooks, or `supabase config push` -- see the feature spec's Edge Cases).
 * If the hook isn't registered, every assertion below will fail with claims
 * missing family_id/user_id, which is itself a useful signal.
 *
 * Env vars (auto-loaded from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — Anon key (for the two device sign-ins)
 *   SUPABASE_SERVICE_ROLE_KEY       — Service role key (bypasses RLS)
 *
 * Usage:
 *   npx tsx scripts/verify-session-scoped-claims.ts
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

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach((k) => console.error(`   ${k}`));
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

function decodeAppMetadata(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  return (payload.app_metadata as Record<string, unknown>) ?? null;
}

function decodeSessionId(accessToken: string): string | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  return typeof payload.session_id === 'string' ? payload.session_id : null;
}

const TEST_TAG = `session_claims_verify_${Date.now()}`;
const TEST_EMAIL = `${TEST_TAG}@example.invalid`;
const TEST_PASSWORD = 'Test1234!SessionClaims';

let familyId: string | null = null;
let parentUserId: string | null = null;
let childUserId: string | null = null;
let authUserId: string | null = null;

async function setup(): Promise<void> {
  console.log('\n■ Setup: one shared family login, one parent profile, one child profile');

  const { data: family, error: familyErr } = await admin
    .from('families')
    .insert({ name: TEST_TAG })
    .select('id')
    .single();
  if (familyErr || !family) throw new Error(`Failed to create test family: ${familyErr?.message}`);
  familyId = family.id;

  const { data: parentRow, error: parentErr } = await admin
    .from('users')
    .insert({ family_id: familyId, name: `${TEST_TAG}_parent`, role: 'parent' })
    .select('id')
    .single();
  if (parentErr || !parentRow) throw new Error(`Failed to create parent user: ${parentErr?.message}`);
  parentUserId = parentRow.id;

  const { data: childRow, error: childErr } = await admin
    .from('users')
    .insert({ family_id: familyId, name: `${TEST_TAG}_child`, role: 'child' })
    .select('id')
    .single();
  if (childErr || !childRow) throw new Error(`Failed to create child user: ${childErr?.message}`);
  childUserId = childRow.id;

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw new Error(`Failed to create auth user: ${authErr?.message}`);
  authUserId = authUser.user.id;

  pass('created test family, parent, child, and shared Layer 1 auth user');
}

async function signIn(): Promise<{ client: SupabaseClient; sessionId: string; accessToken: string }> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);
  const sessionId = decodeSessionId(data.session.access_token);
  if (!sessionId) throw new Error('Signed-in token is missing a session_id claim');
  return { client, sessionId, accessToken: data.session.access_token };
}

async function enrichSession(sessionId: string, role: 'parent' | 'child'): Promise<void> {
  const userId = role === 'parent' ? parentUserId : childUserId;
  const { error } = await admin.from('auth_session_profiles').upsert(
    {
      session_id: sessionId,
      auth_user_id: authUserId,
      family_id: familyId,
      user_id: userId,
      role,
      is_platform_admin: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  );
  if (error) throw new Error(`Failed to upsert auth_session_profiles for ${role}: ${error.message}`);
}

async function main(): Promise<void> {
  await setup();

  console.log('\n■ Two independent Auth sessions under the same shared family login (simulating two devices)');
  const deviceA = await signIn();
  const deviceB = await signIn();

  if (deviceA.sessionId === deviceB.sessionId) {
    fail(
      'device A and device B received distinct session_ids',
      `both were ${deviceA.sessionId} — Supabase did not issue independent sessions for the two sign-ins, the rest of this test is meaningless`
    );
    return;
  }
  pass(`device A (${deviceA.sessionId}) and device B (${deviceB.sessionId}) have distinct session_ids`);

  console.log('\n■ Device A switches to the parent profile');
  await enrichSession(deviceA.sessionId, 'parent');
  const { data: refreshA1, error: refreshA1Err } = await deviceA.client.auth.refreshSession();
  if (refreshA1Err || !refreshA1.session) {
    fail('device A refreshSession after parent switch', refreshA1Err?.message);
    return;
  }
  const claimsA1 = decodeAppMetadata(refreshA1.session.access_token);
  if (claimsA1?.user_id === parentUserId && claimsA1?.role === 'parent') {
    pass('device A claims reflect the parent profile after its own switch');
  } else {
    fail('device A claims reflect the parent profile after its own switch', JSON.stringify(claimsA1));
  }

  console.log('\n■ Device B switches to the child profile');
  await enrichSession(deviceB.sessionId, 'child');
  const { data: refreshB1, error: refreshB1Err } = await deviceB.client.auth.refreshSession();
  if (refreshB1Err || !refreshB1.session) {
    fail('device B refreshSession after child switch', refreshB1Err?.message);
    return;
  }
  const claimsB1 = decodeAppMetadata(refreshB1.session.access_token);
  if (claimsB1?.user_id === childUserId && claimsB1?.role === 'child') {
    pass('device B claims reflect the child profile after its own switch');
  } else {
    fail('device B claims reflect the child profile after its own switch', JSON.stringify(claimsB1));
  }

  console.log(
    '\n■ THE REGRESSION CHECK: device A refreshes again AFTER device B switched — must still show parent'
  );
  const { data: refreshA2, error: refreshA2Err } = await deviceA.client.auth.refreshSession();
  if (refreshA2Err || !refreshA2.session) {
    fail('device A second refreshSession (post device-B switch)', refreshA2Err?.message);
    return;
  }
  const claimsA2 = decodeAppMetadata(refreshA2.session.access_token);
  if (claimsA2?.user_id === parentUserId && claimsA2?.role === 'parent') {
    pass('device A claims are UNCHANGED by device B\'s later profile switch (bug is fixed)');
  } else {
    fail(
      'device A claims are unchanged by device B\'s later profile switch',
      `expected parent (${parentUserId}), got ${JSON.stringify(claimsA2)} — this is exactly the original bug`
    );
  }
}

async function cleanup(): Promise<void> {
  console.log('\n■ Cleanup');
  if (authUserId) {
    // Cascades to auth_session_profiles (session_id -> auth.sessions FK) via
    // auth.sessions being removed when the auth user is deleted.
    await admin.auth.admin.deleteUser(authUserId);
  }
  if (familyId) {
    // Cascades to users, and (defensively) any leftover auth_session_profiles
    // rows scoped to this family_id.
    await admin.from('families').delete().eq('id', familyId);
  }
  console.log('  done');
}

main()
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error instanceof Error ? error.message : error);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
