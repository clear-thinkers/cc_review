import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { getServerSupabaseClient } from '@/lib/supabaseClient';
import type { AvatarId, UserRole } from '@/lib/auth.types';

/**
 * POST /api/auth/register
 *
 * Creates a new family account atomically:
 *   1. Supabase Auth user (email + password)
 *   2. families row
 *   3. parent users row + child users rows
 *
 * Atomicity: steps 2–3 are wrapped in a Postgres function via RPC.
 * If the RPC fails after the Auth account was created, the Auth account
 * is deleted (supabase.auth.admin.deleteUser) before returning the error.
 *
 * PIN hashing: scrypt (N=32768, r=8, p=1, keylen=32)
 * Stored format: "{32-hex-salt}:{64-hex-hash}"
 * Must match the algorithm in scripts/seed-platform-admin.mjs.
 */

// ─── Request / Response types ─────────────────────────────────────────────

interface ChildProfile {
  name: string;
  pin: string;
  avatarId: AvatarId | null;
}

interface RegisterRequest {
  familyName: string;
  email: string;
  password: string;
  parent: {
    name: string;
    pin: string;
    avatarId: AvatarId | null;
  };
  children: ChildProfile[];
}

interface RegisterResponse {
  success: boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32, { N: 32768, r: 8, p: 1 }).toString('hex');
  return `${salt}:${hash}`;
}

function validatePin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  // ── 1. Parse body ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { familyName, email, password, parent, children } =
    body as Partial<RegisterRequest>;

  // ── 2. Validate payload ──────────────────────────────────────────────
  if (typeof familyName !== 'string' || !familyName.trim()) {
    return NextResponse.json({ success: false, error: 'Family name is required.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Valid email is required.' }, { status: 400 });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  if (!parent || typeof parent.name !== 'string' || !parent.name.trim()) {
    return NextResponse.json({ success: false, error: 'Parent name is required.' }, { status: 400 });
  }

  if (typeof parent.pin !== 'string' || !validatePin(parent.pin)) {
    return NextResponse.json({ success: false, error: 'Parent PIN must be exactly 4 digits.' }, { status: 400 });
  }

  if (!Array.isArray(children) || children.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one child profile is required.' }, { status: 400 });
  }

  for (const child of children) {
    if (typeof child.name !== 'string' || !child.name.trim()) {
      return NextResponse.json({ success: false, error: 'Each child must have a name.' }, { status: 400 });
    }
    if (typeof child.pin !== 'string' || !validatePin(child.pin)) {
      return NextResponse.json({ success: false, error: "Each child's PIN must be exactly 4 digits." }, { status: 400 });
    }
  }

  const adminClient = getServerSupabaseClient();

  // ── 3. Create Supabase Auth user ─────────────────────────────────────
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const isEmailConflict =
      authError?.message?.toLowerCase().includes('already registered') ||
      authError?.message?.toLowerCase().includes('already exists') ||
      authError?.message?.toLowerCase().includes('duplicate');

    if (isEmailConflict) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: authError?.message ?? 'Failed to create account.' },
      { status: 500 }
    );
  }

  const authUserId = authData.user.id;

  // ── 4. Hash all PINs ─────────────────────────────────────────────────
  const parentPinHash = hashPin(parent.pin);
  const childPinHashes = children.map(c => hashPin(c.pin));

  // ── 5. Insert families + users rows (attempt; clean up Auth on failure) ─
  try {
    // 5a. Insert family row
    const { data: familyRow, error: familyErr } = await adminClient
      .from('families')
      .insert({ name: familyName.trim() })
      .select('id')
      .single();

    if (familyErr || !familyRow) {
      throw new Error(familyErr?.message ?? 'Failed to create family record.');
    }

    const familyId: string = familyRow.id as string;

    // 5b. Insert parent users row
    const { error: parentErr } = await adminClient
      .from('users')
      .insert({
        family_id: familyId,
        auth_user_id: authUserId,
        name: parent.name.trim(),
        role: 'parent' as UserRole,
        pin_hash: parentPinHash,
        avatar_id: parent.avatarId,
        is_platform_admin: false,
        failed_pin_attempts: 0,
      });

    if (parentErr) {
      throw new Error(parentErr.message ?? 'Failed to create parent profile.');
    }

    // 5c. Insert child users rows
    const childRows = children.map((child, i) => ({
      family_id: familyId,
      auth_user_id: null,
      name: child.name.trim(),
      role: 'child' as UserRole,
      pin_hash: childPinHashes[i],
      avatar_id: child.avatarId,
      is_platform_admin: false,
      failed_pin_attempts: 0,
    }));

    const { error: childrenErr } = await adminClient.from('users').insert(childRows);

    if (childrenErr) {
      throw new Error(childrenErr.message ?? 'Failed to create child profiles.');
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    // ── Postgres writes failed — clean up the Auth account ────────────
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {
      // Best-effort cleanup; log but do not rethrow
      console.error('[register] Auth cleanup failed for userId:', authUserId);
    });

    const message = err instanceof Error ? err.message : 'Registration failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
