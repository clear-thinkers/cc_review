import { NextRequest, NextResponse } from 'next/server';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { supabase, getServerSupabaseClient } from '@/lib/supabaseClient';
import type { PinVerifyRequest, PinVerifyResponse, UserProfile, AvatarId, UserRole } from '@/lib/auth.types';

/**
 * POST /api/auth/pin-verify
 *
 * Server-side PIN verification — Layer 2 of the two-layer auth flow.
 *
 * Security model:
 *   - Layer 1 JWT (Supabase session) must be present and valid in Authorization header.
 *     This ensures only authenticated family members can attempt PIN verification.
 *   - PIN is verified server-side using scrypt + timingSafeEqual (no client-side trust).
 *   - failed_pin_attempts is incremented on every wrong PIN and reset on success.
 *   - After 5 failures the account is locked. The counter resets only on success.
 *
 * PIN hashing algorithm: scrypt (N=32768, r=8, p=1, keylen=32)
 * Stored format: "{32-hex-salt}:{64-hex-hash}"
 * Must match the algorithm used in scripts/seed-platform-admin.mjs.
 */
export async function POST(request: NextRequest): Promise<NextResponse<PinVerifyResponse>> {
  // ── 1. Verify Layer 1 JWT ────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  // ── 2. Parse + validate body ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { userId, pin } = body as Partial<PinVerifyRequest>;

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 }
    );
  }

  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { success: false, error: 'pin must be exactly 4 digits' },
      { status: 400 }
    );
  }

  // ── 3. Fetch the users row (service role — RLS bypassed) ─────────────
  const adminClient = getServerSupabaseClient();

  const { data: userRow, error: userErr } = await adminClient
    .from('users')
    .select('id, family_id, name, role, avatar_id, is_platform_admin, pin_hash, failed_pin_attempts')
    .eq('id', userId)
    .single();

  if (userErr || !userRow) {
    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 }
    );
  }

  // ── 4. Confirm this user belongs to the caller's family ──────────────
  // Look up the authenticated parent's family_id to prevent cross-family PIN guessing.
  const { data: callerRow, error: callerErr } = await adminClient
    .from('users')
    .select('family_id')
    .eq('auth_user_id', user.id)
    .single();

  if (callerErr || !callerRow || callerRow.family_id !== userRow.family_id) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  // ── 5. Check lockout ─────────────────────────────────────────────────
  const MAX_ATTEMPTS = 5;
  const currentAttempts: number = userRow.failed_pin_attempts ?? 0;

  if (currentAttempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { success: false, failedAttempts: currentAttempts, error: 'Account locked' },
      { status: 403 }
    );
  }

  // ── 6. Verify PIN using scrypt + timingSafeEqual ─────────────────────
  const pinHash: string | null = userRow.pin_hash;

  if (!pinHash) {
    return NextResponse.json(
      { success: false, error: 'No PIN set for this user' },
      { status: 400 }
    );
  }

  const [storedSalt, storedHash] = pinHash.split(':');
  if (!storedSalt || !storedHash) {
    return NextResponse.json(
      { success: false, error: 'Malformed PIN hash' },
      { status: 500 }
    );
  }

  let pinMatches: boolean;
  try {
    const derivedKey = scryptSync(pin, storedSalt, 32, { N: 32768, r: 8, p: 1 });
    const storedKeyBuf = Buffer.from(storedHash, 'hex');
    // buffers must be same length for timingSafeEqual
    pinMatches = derivedKey.length === storedKeyBuf.length &&
      timingSafeEqual(derivedKey, storedKeyBuf);
  } catch {
    return NextResponse.json(
      { success: false, error: 'PIN verification failed' },
      { status: 500 }
    );
  }

  if (!pinMatches) {
    // Increment failed attempts counter
    const newAttempts = currentAttempts + 1;
    await adminClient
      .from('users')
      .update({ failed_pin_attempts: newAttempts })
      .eq('id', userId);

    return NextResponse.json(
      { success: false, failedAttempts: newAttempts },
      { status: 200 }
    );
  }

  // ── 7. PIN matched — reset counter and return profile ────────────────
  await adminClient
    .from('users')
    .update({ failed_pin_attempts: 0 })
    .eq('id', userId);

  const profile: UserProfile = {
    id: userRow.id as string,
    familyId: userRow.family_id as string,
    name: userRow.name as string,
    role: userRow.role as UserRole,
    avatarId: userRow.avatar_id as AvatarId | null,
    isPlatformAdmin: userRow.is_platform_admin as boolean,
  };

  return NextResponse.json({ success: true, profile }, { status: 200 });
}
