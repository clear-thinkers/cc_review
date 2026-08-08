import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServerSupabaseClient } from '@/lib/supabaseClient';
import { getJwtAppMetadataUserId } from '@/lib/decodeJwtPayload';
import type { AvatarId } from '@/lib/auth.types';

const VALID_AVATAR_IDS: AvatarId[] = [
  'bubble_tea_excited_1',
  'bun_wink_1',
  'cake_sleep_1',
  'donut_wink_1',
  'ramen_calm_1',
  'rice_ball_sleep_1',
  'tangyuan_smile_1',
  'zongzi_smile_1',
];

/**
 * PATCH /api/auth/update-avatar
 *
 * Updates the avatar_id for the currently active profile (Layer 2 user).
 *
 * Security:
 *   - Requires valid Supabase Layer 1 JWT in Authorization header.
 *   - The target user_id is read from app_metadata.user_id in the JWT
 *     (written by /api/auth/pin-verify after Layer 2 completes).
 *     This means only the currently active profile can be updated —
 *     no userId body parameter is accepted from the client.
 *   - avatarId is validated against the known-good set before writing.
 *
 * Body: { avatarId: AvatarId }
 * Returns: { success: true } | { error: string }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify Layer 1 JWT ────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // ── 2. Extract the active profile user_id from THIS token's own claims ──
  // Decoded from the caller's own already-verified token (not a fresh
  // auth.users lookup) so it reflects session-scoped claims injected by
  // custom_access_token_hook per this session's own auth_session_profiles
  // row -- see docs/feature-specs/2026-08-08-session-scoped-profile-claims.md.
  // supabase.auth.getUser(token) above returns a LIVE auth.users read,
  // whose app_metadata is no longer written by pin-verify and would be
  // permanently stale.
  const userId = getJwtAppMetadataUserId(token);
  if (!userId) {
    return NextResponse.json(
      { error: 'Profile session not established. Complete PIN entry first.' },
      { status: 403 }
    );
  }

  // ── 3. Parse and validate body ───────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { avatarId } = body as { avatarId?: unknown };

  if (typeof avatarId !== 'string' || !VALID_AVATAR_IDS.includes(avatarId as AvatarId)) {
    return NextResponse.json(
      { error: `avatarId must be one of: ${VALID_AVATAR_IDS.join(', ')}` },
      { status: 400 }
    );
  }

  // ── 4. Update the users row (service role) ───────────────────────────
  let adminClient;
  try {
    adminClient = getServerSupabaseClient();
  } catch {
    console.error('[update-avatar] SUPABASE_SERVICE_ROLE_KEY is missing');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const { error: updateErr } = await adminClient
    .from('users')
    .update({ avatar_id: avatarId })
    .eq('id', userId);

  if (updateErr) {
    console.error('[update-avatar] DB update error:', updateErr.message);
    return NextResponse.json({ error: 'Failed to update avatar.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
