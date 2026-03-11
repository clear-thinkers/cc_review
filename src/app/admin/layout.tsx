"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/authContext";

/**
 * Admin layout — platform admin only.
 * Redirects any non-admin user to /words/review.
 * SessionGuard in the root layout has already ensured a full session exists.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session && !session.isPlatformAdmin) {
      router.replace("/words/review");
    }
  }, [session, router]);

  // Wait for session to resolve before rendering
  if (!session) return null;
  if (!session.isPlatformAdmin) return null;

  return <>{children}</>;
}
