"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { WordsWorkspaceVM } from "./WordsWorkspaceVM";

export default function WordsShell({ vm, children }: { vm: WordsWorkspaceVM; children: ReactNode }) {
  return (
    <main className="kids-page mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">Chinese Character Review Game</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border px-4 pt-4 pb-6 lg:self-start">
          <h2 className="font-medium">{vm.str.nav.menu}</h2>
          <p className="text-sm text-gray-700">{vm.str.nav.navigateBetweenPages}</p>
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
