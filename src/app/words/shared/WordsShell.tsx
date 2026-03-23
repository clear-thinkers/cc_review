"use client";

import Link from "next/link";
import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession, useAuth } from "@/lib/authContext";
import type { AvatarId } from "@/lib/auth.types";
import type { WordsWorkspaceVM } from "./WordsWorkspaceVM";

const AVATAR_IDS: AvatarId[] = [
  'bubble_tea_excited_1',
  'bun_wink_1',
  'cake_sleep_1',
  'donut_wink_1',
  'ramen_calm_1',
  'rice_ball_sleep_1',
  'tangyuan_smile_1',
  'zongzi_smile_1',
];

export default function WordsShell({ vm, children }: { vm: WordsWorkspaceVM; children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const { clearSession, switchProfile, updateSessionAvatar } = useAuth();

  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!isAvatarPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsAvatarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarPickerOpen]);

  const handleSelectAvatar = async (avatarId: AvatarId) => {
    setIsSavingAvatar(true);
    setIsAvatarPickerOpen(false);
    await updateSessionAvatar(avatarId);
    setIsSavingAvatar(false);
  };

  const handleLogout = async () => {
    vm.requestQuizExit(async () => {
      await clearSession();
      router.push('/login');
    });
  };

  const handleSwitchProfile = () => {
    vm.requestQuizExit(() => {
      switchProfile();
    });
  };

  const handleNavClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (!vm.shouldWarnOnQuizExit) {
      return;
    }

    event.preventDefault();
    vm.requestQuizExit(() => {
      router.push(href);
    });
  };

  return (
    <main className="kids-page mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">{vm.str.nav.appTitle}</h1>
      <p className="text-sm italic text-gray-500">{vm.str.nav.appSubtitle}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border px-4 pt-4 pb-6 lg:self-start">
          <h2 className="font-medium">{vm.str.nav.menu}</h2>
          <p className="text-sm text-gray-700">{vm.str.nav.navigateBetweenPages}</p>
          
          {session && (
            <div ref={pickerRef} className="flex flex-col items-center gap-2 border-t pt-3">
              {/* Avatar — click to open picker */}
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen(prev => !prev)}
                disabled={isSavingAvatar}
                title={vm.str.nav.changeAvatar}
                className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7bc28f]"
              >
                {session.avatarId ? (
                  <img
                    src={`/avatar/${session.avatarId}.png`}
                    alt={session.userName}
                    className="h-24 w-24 transition group-hover:opacity-70"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-4xl transition group-hover:opacity-70">
                    👤
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 bg-black/40">
                  ✏️
                </span>
              </button>

              {/* Inline avatar picker — renders in-flow so it never overlaps buttons */}
              {isAvatarPickerOpen && (
                <div className="w-full rounded-xl border bg-white p-2 shadow-md">
                  <p className="mb-2 text-center text-xs font-medium text-gray-600">
                    {vm.str.nav.changeAvatar}
                  </p>
                  <div className="max-h-52 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_IDS.map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleSelectAvatar(id)}
                          className={`rounded-lg border-2 p-1 transition hover:border-[#7bc28f] hover:bg-[#e8f6e8] ${
                            session.avatarId === id
                              ? 'border-[#7bc28f] bg-[#e8f6e8]'
                              : 'border-transparent'
                          }`}
                          aria-label={id}
                          aria-pressed={session.avatarId === id}
                        >
                          <img src={`/avatar/${id}.png`} alt={id} className="w-full aspect-square object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs font-medium text-gray-700">{session.userName}</p>
              <button
                onClick={handleSwitchProfile}
                className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-[#e8f6e8] hover:border-[#7bc28f]"
              >
                {vm.str.nav.switchProfile}
              </button>
              <button
                onClick={handleLogout}
                className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-gray-100"
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
                onClick={(event) => handleNavClick(event, item.href)}
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

        <div className="space-y-6">
          {vm.loadError ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{vm.loadError}</p>
          ) : null}
          {children}
        </div>
      </div>
      {vm.quizExitWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-exit-warning-title"
            className="w-full max-w-xl rounded-[2rem] border-4 border-red-400 bg-[#fff8f6] p-5 shadow-[0_24px_80px_rgba(127,29,29,0.28)]"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="mx-auto w-full max-w-[12rem] shrink-0 md:mx-0">
                <img
                  src="/icon/warning1_sad-milk-puddle.png"
                  alt={vm.str.fillTest.warning.imageAlt}
                  className="w-full object-contain"
                />
              </div>
              <div className="space-y-3 text-center md:text-left">
                <div className="flex items-center justify-center gap-3 md:justify-start">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-3xl font-black text-white">
                    !
                  </div>
                  <h2 id="quiz-exit-warning-title" className="text-2xl font-semibold text-red-900">
                    {vm.str.fillTest.warning.title}
                  </h2>
                </div>
                <p className="text-base leading-7 text-red-900">{vm.quizExitWarningBody}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={vm.closeQuizExitWarning}
                    className="rounded-full border-2 border-red-200 bg-white px-5 py-2.5 font-semibold text-red-800 transition hover:bg-red-50"
                  >
                    {vm.str.fillTest.warning.stayButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => void vm.confirmQuizExit()}
                    className="rounded-full border-2 border-red-600 bg-red-600 px-5 py-2.5 font-semibold text-white transition hover:bg-red-700"
                  >
                    {vm.str.fillTest.warning.leaveButton}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
