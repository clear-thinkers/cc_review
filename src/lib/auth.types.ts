/**
 * Auth & User Model Types — Feature 4
 *
 * All types for the two-layer auth system.
 * Layer 1: Supabase Auth (email + password)
 * Layer 2: Profile selection + PIN verification (server-side)
 *
 * PIN hashing: scrypt N=32768/r=8/p=1/keylen=32
 * Stored format: "{32-hex-salt}:{64-hex-hash}"
 * See: docs/feature-specs/2026-03-05-auth-and-user-model.md § Decisions Closed #4
 */

import type { Session } from '@supabase/supabase-js';

// ─── Primitive types ───────────────────────────────────────────────────────

export type UserRole = 'parent' | 'child';

/**
 * Filename stems for /public/avatar/{avatarId}.png
 * These are the source of truth — DB avatar_id must match exactly.
 */
export type AvatarId =
  | 'bubble_tea_excited_1'
  | 'bun_wink_1'
  | 'cake_sleep_1'
  | 'donut_wink_1'
  | 'ramen_calm_1'
  | 'rice_ball_sleep_1'
  | 'tangyuan_smile_1'
  | 'zongzi_smile_1';

// ─── User & session models ─────────────────────────────────────────────────

/**
 * Client-safe profile shape.
 * Never includes pin_hash or failed_pin_attempts — those stay server-side only.
 */
export interface UserProfile {
  id: string;
  familyId: string;
  name: string;
  role: UserRole;
  avatarId: AvatarId | null;
  isPlatformAdmin: boolean;
}

/**
 * Full app session. Only populated after both Layer 1 AND Layer 2 complete.
 * Stored in AuthContext React state only — never in localStorage.
 */
export interface AppSession {
  supabaseSession: Session;
  familyId: string;
  userId: string;
  role: UserRole;
  userName: string;
  avatarId: AvatarId | null;
}

// ─── API route contracts ───────────────────────────────────────────────────

/** Request body for POST /api/auth/pin-verify */
export interface PinVerifyRequest {
  userId: string;
  pin: string;
}

/** Response body from POST /api/auth/pin-verify */
export interface PinVerifyResponse {
  success: boolean;
  /** Present on success */
  profile?: UserProfile;
  /** Current failed attempt count (1–5). Present on failure. Used to show lockout UI. */
  failedAttempts?: number;
  error?: string;
}

// ─── Auth context ──────────────────────────────────────────────────────────

/** Value exposed by AuthContext via useAuth() */
export interface AuthContextValue {
  /**
   * true after Supabase Layer 1 sign-in completes.
   * SessionGuard uses this to distinguish "not logged in at all"
   * from "Layer 1 done but Layer 2 (PIN) still pending".
   */
  isLayer1Ready: boolean;

  /**
   * Populated only after both layers are complete.
   * null means either not logged in or Layer 2 not yet completed.
   */
  session: AppSession | null;

  /** All profiles for the authenticated family. Populated after Layer 1. */
  familyProfiles: UserProfile[];

  /**
   * Called from /pin-entry after a successful /api/auth/pin-verify response.
   * Completes Layer 2 and populates session.
   */
  setProfileSession: (profile: UserProfile, supabaseSession: Session) => void;

  /** Signs out of Supabase and clears all context state. */
  clearSession: () => Promise<void>;
}
