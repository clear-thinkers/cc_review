'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSessionData } from '@/lib/auth';

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
      setIsLoggedIn(true);
      setIsLoading(false);
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
