import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServerSupabaseClient } from '@/lib/supabaseClient';
import type { UserProfile, AvatarId, UserRole } from '@/lib/auth.types';

/**
 * GET /api/auth/family-profiles
 *
 * Returns all profiles (users rows) for the family of the authenticated user.
 * Called by AuthContext after Layer 1 sign-in to populate the profile picker.
 *
 * Security:
 *   - Verifies the Supabase JWT from the Authorization header.
 *   - Uses the service role client only after the token is validated.
 *   - Never returns pin_hash or failed_pin_attempts.
 *
 * Why server-side: the browser Supabase client cannot read the users table
 * after Layer 1 because the JWT lacks the custom family_id/user_id claims
 * that RLS requires. Those claims are only injected after Layer 2 PIN verify.
 *
 * Returns: UserProfile[] (empty array if no family found — not an error)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Extract token ────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  // ── 2. Verify token via Supabase ────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  // ── 3. Look up the family for this auth user (service role) ─────────
  let adminClient;
  try {
    adminClient = getServerSupabaseClient();
  } catch {
    console.error('[family-profiles] Server configuration error — SUPABASE_SERVICE_ROLE_KEY is missing');
    return NextResponse.json(
      { error: 'Server configuration error. Please contact the administrator.' },
      { status: 500 }
    );
  }

  const { data: parentRow, error: parentErr } = await adminClient
    .from('users')
    .select('family_id')
    .eq('auth_user_id', user.id)
    .single();

  if (parentErr || !parentRow) {
    // No family row yet (registration incomplete) — return empty, not an error
    return NextResponse.json([]);
  }

  // ── 4. Fetch all profiles for this family ───────────────────────────
  const { data: rows, error: rowsErr } = await adminClient
    .from('users')
    .select('id, family_id, name, role, avatar_id, is_platform_admin')
    .eq('family_id', parentRow.family_id)
    // parent profiles first, then children; stable order within each role
    .order('role', { ascending: false })
    .order('created_at', { ascending: true });

  if (rowsErr || !rows) {
    return NextResponse.json(
      { error: 'Failed to load family profiles' },
      { status: 500 }
    );
  }

  const profiles: UserProfile[] = rows.map(r => ({
    id: r.id as string,
    familyId: r.family_id as string,
    name: r.name as string,
    role: r.role as UserRole,
    avatarId: r.avatar_id as AvatarId | null,
    isPlatformAdmin: r.is_platform_admin as boolean,
  }));

  return NextResponse.json(profiles);
}
