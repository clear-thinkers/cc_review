"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSessionData, clearAllAuthData } from "@/lib/auth";
import { clearDatabaseState } from "@/lib/db";
import type { WordsWorkspaceVM } from "./WordsWorkspaceVM";
import { AVATAR_OPTIONS } from "@/app/login/LoginForm";

export default function WordsShell({ vm, children }: { vm: WordsWorkspaceVM; children: ReactNode }) {
  const router = useRouter();
  const session = getSessionData();
  
  const selectedAvatar = session 
    ? AVATAR_OPTIONS.find(a => a.id === session.selectedAvatarId)
    : null;

  const handleLogout = async () => {
    // Close the database before clearing auth data
    try {
      await clearDatabaseState();
    } catch (error) {
      console.error('Error clearing database state on logout:', error);
    }
    
    clearAllAuthData();
    router.push('/login');
  };

  return (
    <main className="kids-page mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">{vm.str.nav.appTitle}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border px-4 pt-4 pb-6 lg:self-start">
          <h2 className="font-medium">{vm.str.nav.menu}</h2>
          <p className="text-sm text-gray-700">{vm.str.nav.navigateBetweenPages}</p>
          
          {selectedAvatar && (
            <div className="flex flex-col items-center gap-2 border-t pt-3">
              <img
                src={`/avatar/${selectedAvatar.filename}.png`}
                alt={selectedAvatar.filename}
                className="h-12 w-12"
              />
              <button
                onClick={handleLogout}
                className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-gray-100"
              >
                {vm.str.nav.logout ?? 'Logout'}
              </button>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {vm.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  vm.activeMenuPage === item.page
                    ? "rounded-md border-2 border-[#7bc28f] bg-[#e8f6e8] px-4 py-2 text-sm font-semibold text-[#2d4f3f]"
                    : "rounded-md border px-4 py-2 text-sm font-medium"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="stats-gold select-none space-y-1 rounded-md border p-3 text-sm text-gray-700">
            <p>
              <strong>{vm.str.sidebar.totalCharacters}</strong> {vm.allWordsSummary.totalWords}
            </p>
            <p>
              <strong>{vm.str.sidebar.dueNow}</strong> {vm.allWordsSummary.dueNow}
            </p>
            <p>
              <strong>{vm.str.sidebar.avgFamiliarity}</strong>{" "}
              {vm.formatProbability(vm.allWordsSummary.averageFamiliarity)}
            </p>
          </div>
        </section>

        <div className="space-y-6">{children}</div>
      </div>
    </main>
  );
}
