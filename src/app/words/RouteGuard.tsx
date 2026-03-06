'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/permissions';

/**
 * RouteGuard — Role-Based Route Protection
 *
 * Enforces permission matrix by session role. Blocked routes redirect
 * to /words/review with no error message (not 403).
 *
 * Depends on SessionGuard running first (session must exist).
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    if (!session) return; // SessionGuard handles auth
    
    const allowed = canAccessRoute(
      pathname,
      session.role,
      session.isPlatformAdmin
    );
    
    if (!allowed) {
      router.replace('/words/review');
    }
  }, [pathname, session, router]);

  return <>{children}</>;
}
