'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

/**
 * Session Guard Wrapper — Two-Layer Auth
 *
 * Route access rules:
 *   /login, /register          → always accessible (no auth required)
 *   /profile-select, /pin-entry → require Layer 1 (Supabase session) only
 *   all other routes            → require both Layer 1 AND Layer 2 (PIN verified)
 *
 * AuthContext isLayer1Ready / session are populated by the Supabase
 * onAuthStateChange listener in AuthProvider, so this guard is reactive
 * to session changes without needing to check localStorage manually.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLayer1Ready, session } = useAuth();

  // Routes that need no authentication at all
  const isPublicRoute = pathname === '/login' || pathname === '/register';

  // Routes that need only Layer 1 (Supabase Auth session)
  const isLayer1Route =
    pathname === '/profile-select' || pathname.startsWith('/pin-entry');

  useEffect(() => {
    if (isPublicRoute) return;

    if (isLayer1Route) {
      if (!isLayer1Ready) {
        router.replace('/login');
      }
      return;
    }

    // Protected route — requires full session (both layers)
    if (!isLayer1Ready) {
      router.replace('/login');
      return;
    }

    if (!session) {
      // Layer 1 done but Layer 2 not yet completed
      router.replace('/profile-select');
    }
  }, [isPublicRoute, isLayer1Route, isLayer1Ready, session, router]);

  // Public routes always render
  if (isPublicRoute) return <>{children}</>;

  // Layer 1 routes: render once Layer 1 is ready
  if (isLayer1Route) {
    if (!isLayer1Ready) return null;
    return <>{children}</>;
  }

  // Protected routes: render only when full session exists
  if (!session) return null;
  return <>{children}</>;
}
