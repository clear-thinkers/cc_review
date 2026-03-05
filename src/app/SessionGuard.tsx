'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSessionData, getPinHash } from '@/lib/auth';
import { initializeDatabaseForPin } from '@/lib/db';

/**
 * Session Guard Wrapper
 * 
 * Checks for valid session token on mount.
 * If invalid/missing, redirects to /login.
 * Allows /login page to bypass this check.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Skip session check on login page
    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    // Check for valid session
    const session = getSessionData();
    if (session) {
      // Session is valid - initialize database for this PIN (returning user)
      const pinHash = getPinHash();
      if (pinHash) {
        // Only initialize if not already done (check if currentDb is ready)
        // This prevents double-initialization when redirecting from login
        try {
          initializeDatabaseForPin(pinHash).then(() => {
            setIsLoggedIn(true);
            setIsLoading(false);
          }).catch((error) => {
            console.error('Failed to initialize database:', error);
            // On database init failure, redirect to login
            router.push('/login');
            setIsLoading(false);
          });
        } catch (error) {
          console.error('Database initialization error:', error);
          router.push('/login');
          setIsLoading(false);
        }
      } else {
        // Session exists but no PIN hash - inconsistent state, redirect to login
        console.warn('Session token exists but no PIN hash found');
        router.push('/login');
        setIsLoading(false);
      }
    } else {
      // No valid session, redirect to login
      router.push('/login');
      setIsLoading(false);
    }
  }, [pathname, router]);

  // Show nothing while checking (avoid flash of unauthorized content)
  if (isLoading && pathname !== '/login') {
    return null;
  }

  // Allow login page to render without session
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show children only if logged in
  if (isLoggedIn) {
    return <>{children}</>;
  }

  // Waiting for redirect
  return null;
}
