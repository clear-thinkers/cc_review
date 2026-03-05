'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { authStrings } from '@/lib/auth.strings';
import { useLocale } from '@/app/shared/locale';
import { useAuth } from '@/lib/authContext';
import type { PinVerifyResponse } from '@/lib/auth.types';

const MAX_PIN_DIGITS = 4;
const MAX_FAILED_ATTEMPTS = 5;

// Wrap the inner component with Suspense so useSearchParams is safe in
// Next.js App Router (useSearchParams requires a Suspense boundary).
export default function PinEntryPage() {
  return (
    <Suspense>
      <PinEntryInner />
    </Suspense>
  );
}

function PinEntryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const str = authStrings[locale].pinEntry;
  const shared = authStrings[locale].shared;

  const { familyProfiles, setProfileSession } = useAuth();

  const userId = searchParams.get('userId') ?? '';
  const profile = familyProfiles.find(p => p.id === userId) ?? null;

  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);

  // If no userId or profile not in family list, redirect back
  useEffect(() => {
    if (!userId) {
      router.replace('/profile-select');
    }
  }, [userId, router]);

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (digits.length === MAX_PIN_DIGITS && !isVerifying && !isLockedOut) {
      void verifyPin(digits.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const verifyPin = async (pin: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession) {
        router.replace('/login');
        return;
      }

      const res = await fetch('/api/auth/pin-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseSession.access_token}`,
        },
        body: JSON.stringify({ userId, pin }),
      });

      const data: PinVerifyResponse = await res.json();

      if (data.success && data.profile) {
        setProfileSession(data.profile, supabaseSession);
        router.push('/words');
        return;
      }

      // Failed
      const failed = data.failedAttempts ?? 0;
      if (failed >= MAX_FAILED_ATTEMPTS) {
        setIsLockedOut(true);
        setError(str.errorLockedOut);
      } else {
        setError(str.errorWrongPin);
      }
      setDigits([]);
    } catch {
      setError(str.errorUnknown);
      setDigits([]);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigit = (d: string) => {
    if (isLockedOut || isVerifying) return;
    setError(null);
    setDigits(prev => {
      if (prev.length >= MAX_PIN_DIGITS) return prev;
      return [...prev, d];
    });
  };

  const handleBackspace = () => {
    if (isLockedOut || isVerifying) return;
    setError(null);
    setDigits(prev => prev.slice(0, -1));
  };

  const profileName = profile?.name ?? '';
  const avatarId = profile?.avatarId ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-6">
        {/* Profile header */}
        <div className="flex flex-col items-center gap-2">
          {avatarId ? (
            <img src={`/avatar/${avatarId}.png`} alt={profileName} className="h-16 w-16" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
              👤
            </div>
          )}
          {profileName && (
            <p className="text-lg font-semibold">{profileName}</p>
          )}
          <p className="text-sm text-gray-600">{str.prompt}</p>
        </div>

        {/* PIN dot display */}
        <div className="flex justify-center gap-4" aria-hidden="true">
          {Array.from({ length: MAX_PIN_DIGITS }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition ${
                i < digits.length
                  ? 'border-[#5eaa75] bg-[#7bc28f]'
                  : 'border-gray-300 bg-white'
              }`}
            />
          ))}
        </div>

        {/* Error / status */}
        {isVerifying && (
          <p className="text-center text-sm text-gray-500">{str.loading}</p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error}
          </p>
        )}

        {/* PIN pad */}
        {!isLockedOut && (
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                disabled={isVerifying}
                className="rounded-xl border-2 border-gray-200 py-4 text-xl font-semibold hover:border-[#7bc28f] hover:bg-[#e8f6e8] disabled:opacity-40 transition"
              >
                {d}
              </button>
            ))}
            {/* Bottom row: empty | 0 | backspace */}
            <div />
            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={isVerifying}
              className="rounded-xl border-2 border-gray-200 py-4 text-xl font-semibold hover:border-[#7bc28f] hover:bg-[#e8f6e8] disabled:opacity-40 transition"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isVerifying || digits.length === 0}
              className="rounded-xl border-2 border-gray-200 py-4 text-xl font-semibold hover:border-[#7bc28f] hover:bg-[#e8f6e8] disabled:opacity-40 transition"
              aria-label="Backspace"
            >
              ⌫
            </button>
          </div>
        )}

        <Link
          href="/profile-select"
          className="block text-center text-sm text-gray-500 hover:underline"
        >
          {str.backToProfiles}
        </Link>
      </div>
    </main>
  );
}
