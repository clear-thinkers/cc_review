'use client';

/**
 * AuthContext — Two-Layer Session Provider
 *
 * Layer 1: Supabase Auth (email + password) — managed by Supabase client
 * Layer 2: Profile selection + PIN verification — managed by this context
 *
 * isLayer1Ready: true after Supabase sign-in; family profiles are loaded
 * session:       populated only after PIN is verified (both layers complete)
 *
 * Family profiles are fetched server-side via /api/auth/family-profiles
 * because RLS rules require custom JWT claims that don't exist until Layer 2.
 * The browser Supabase client cannot read the users table without those claims.
 *
 * On page reload:
 *   onAuthStateChange fires with the persisted Supabase session →
 *   isLayer1Ready = true, family profiles loaded →
 *   SessionGuard redirects to /profile-select to complete Layer 2.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { AppSession, AuthContextValue, UserProfile } from './auth.types';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [isLayer1Ready, setIsLayer1Ready] = useState(false);
  const [session, setSession] = useState<AppSession | null>(null);
  const [familyProfiles, setFamilyProfiles] = useState<UserProfile[]>([]);

  /**
   * Fetch all profiles for the authenticated family.
   * Called after Layer 1 completes (and on page reload when Supabase
   * restores the persisted session). Uses the server-side API route so
   * the service role client can bypass RLS.
   */
  const loadFamilyProfiles = useCallback(async (accessToken: string): Promise<void> => {
    try {
      const res = await fetch('/api/auth/family-profiles', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setFamilyProfiles([]);
        return;
      }
      const profiles: UserProfile[] = await res.json();
      setFamilyProfiles(profiles);
    } catch {
      setFamilyProfiles([]);
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, supabaseSession) => {
      if (supabaseSession) {
        setIsLayer1Ready(true);
        await loadFamilyProfiles(supabaseSession.access_token);
      } else {
        // Signed out or session expired
        setIsLayer1Ready(false);
        setSession(null);
        setFamilyProfiles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFamilyProfiles]);

  /**
   * Called by /pin-entry after a successful /api/auth/pin-verify response.
   * Completes Layer 2 — caller passes the verified profile and the current
   * Supabase session so both are stored together.
   */
  const setProfileSession = useCallback(
    (profile: UserProfile, supabaseSession: Session): void => {
      setSession({
        supabaseSession,
        familyId: profile.familyId,
        userId: profile.id,
        role: profile.role,
        userName: profile.name,
        avatarId: profile.avatarId,
        isPlatformAdmin: profile.isPlatformAdmin,
      });
    },
    []
  );

  /**
   * Signs out of Supabase and clears all context state.
   * The onAuthStateChange listener will fire SIGNED_OUT and clear the rest.
   */
  const clearSession = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    // onAuthStateChange handles clearing isLayer1Ready, session, familyProfiles
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLayer1Ready,
      session,
      familyProfiles,
      setProfileSession,
      clearSession,
    }),
    [isLayer1Ready, session, familyProfiles, setProfileSession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the full AuthContext value.
 * Must be called within an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Convenience hook — returns the full AppSession or null.
 * null means either not logged in or Layer 2 not yet completed.
 */
export function useSession(): AppSession | null {
  return useAuth().session;
}
