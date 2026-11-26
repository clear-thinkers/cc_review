#!/usr/bin/env tsx
/**
 * Wishlist reward photos verification (roadmap item U follow-up, 2026-11-26; spec
 * docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md)
 *
 * Checks the private `wishlist-photos` bucket and save_wishlist_reward's photo handling
 * against a live Supabase DEV project, as real parent and child JWTs:
 *   - a parent can upload into their own family folder, not another family's;
 *   - a child can't upload, but can view their own family's photo;
 *   - another family can't view it;
 *   - save_wishlist_reward accepts only an existing file in the caller's own family folder,
 *     and null clears the photo;
 *   - a child can't delete the photo; the parent can.
 *
 * It creates two throwaway families (a parent + child, and a parent) and removes them, their
 * auth users and any uploaded files in a finally block.
 *
 * Env vars (auto-loaded from .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Dev only -- no --prod flag.
 *
 * Usage: npm run verify:wishlist-photos
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

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

const BUCKET = 'wishlist-photos';
const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${label}`);
    if (detail !== undefined) console.error(`         ${JSON.stringify(detail)}`);
    failed++;
  }
}

const TAG = `zz-test-photo-${Date.now()}`;
const familyIds: string[] = [];
const authUserIds: string[] = [];

type Person = { client: SupabaseClient; userId: string; familyId: string };

async function createFamily(label: string): Promise<string> {
  const { data, error } = await admin.from('families').insert({ name: `${TAG}_${label}` }).select('id').single();
  if (error || !data) throw new Error(`family insert: ${error?.message}`);
  familyIds.push(data.id);
  return data.id;
}

async function createPerson(familyId: string, label: string, role: 'child' | 'parent'): Promise<Person> {
  const { data: user, error: userErr } = await admin
    .from('users')
    .insert({ family_id: familyId, name: `${TAG}_${label}`, role })
    .select('id')
    .single();
  if (userErr || !user) throw new Error(`user insert: ${userErr?.message}`);

  const email = `${TAG}_${label}@example.test`;
  const password = 'Test1234!Photo';
  const { data: auth, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { family_id: familyId, user_id: user.id, role, is_platform_admin: false },
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
  return { client, userId: user.id, familyId };
}

// A tiny valid JPEG (1x1 px).
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);

async function upload(person: Person, path: string): Promise<string | null> {
  const { error } = await person.client.storage.from(BUCKET).upload(path, JPEG, { contentType: 'image/jpeg' });
  return error ? error.message : null;
}

async function canRead(person: Person, path: string): Promise<boolean> {
  const { data, error } = await person.client.storage.from(BUCKET).createSignedUrl(path, 60);
  return !error && Boolean(data?.signedUrl);
}

async function saveReward(person: Person, imagePath: string | null, rewardId: string | null = null): Promise<Record<string, unknown>> {
  const { data, error } = await person.client.rpc('save_wishlist_reward', {
    p_reward_id: rewardId,
    p_title: 'Test backpack',
    p_child_user_id: null,
    p_is_repeatable: false,
    p_is_active: true,
    p_prices: [{ characterKey: 'shrewy', tokenCount: 1 }],
    p_image_path: imagePath,
  });
  if (error) throw new Error(`save_wishlist_reward: ${error.message}`);
  return data as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('\nWishlist reward photos (dev)');
  const familyA = await createFamily('A');
  const familyB = await createFamily('B');
  const parentA = await createPerson(familyA, 'parentA', 'parent');
  const childA = await createPerson(familyA, 'childA', 'child');
  const parentB = await createPerson(familyB, 'parentB', 'parent');

  const pathA = `${familyA}/${TAG}.jpg`;
  check('parent uploads into their own family folder', (await upload(parentA, pathA)) === null);
  check("parent can't upload into another family's folder", (await upload(parentA, `${familyB}/${TAG}.jpg`)) !== null);
  check("child can't upload", (await upload(childA, `${familyA}/${TAG}-child.jpg`)) !== null);

  check('the child sees their family photo', await canRead(childA, pathA));
  check("another family can't see it", !(await canRead(parentB, pathA)));

  const pathB = `${familyB}/${TAG}.jpg`;
  check('other family uploads its own photo', (await upload(parentB, pathB)) === null);
  check("a reward can't use another family's photo", (await saveReward(parentA, pathB)).code === 'invalid_image');
  check("a reward can't use a file that doesn't exist", (await saveReward(parentA, `${familyA}/missing.jpg`)).code === 'invalid_image');

  const saved = await saveReward(parentA, pathA);
  check('a reward saves with its own photo', saved.success === true, saved);
  const rewardId = String(saved.rewardId);
  const { data: row } = await admin.from('wishlist_rewards').select('image_path').eq('id', rewardId).single();
  check('the path is stored on the reward', row?.image_path === pathA, row);

  const cleared = await saveReward(parentA, null, rewardId);
  const { data: rowAfter } = await admin.from('wishlist_rewards').select('image_path').eq('id', rewardId).single();
  check('saving with no photo clears it', cleared.success === true && rowAfter?.image_path === null, rowAfter);

  await childA.client.storage.from(BUCKET).remove([pathA]);
  const { data: stillThere } = await admin.storage.from(BUCKET).list(familyA);
  check("child can't delete the photo", (stillThere ?? []).some((file) => `${familyA}/${file.name}` === pathA));

  await parentA.client.storage.from(BUCKET).remove([pathA]);
  const { data: gone } = await admin.storage.from(BUCKET).list(familyA);
  check('parent can delete the photo', !(gone ?? []).some((file) => `${familyA}/${file.name}` === pathA));
}

async function cleanup(): Promise<void> {
  for (const familyId of familyIds) {
    const { data: files } = await admin.storage.from(BUCKET).list(familyId);
    if (files && files.length > 0) await admin.storage.from(BUCKET).remove(files.map((file) => `${familyId}/${file.name}`));
  }
  for (const id of authUserIds) await admin.auth.admin.deleteUser(id);
  if (familyIds.length > 0) await admin.from('families').delete().in('id', familyIds);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Verification crashed:', error);
    failed++;
  })
  .finally(async () => {
    await cleanup().catch((error: unknown) => console.error('Cleanup failed:', error));
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
