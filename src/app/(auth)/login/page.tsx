'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { authStrings } from '@/lib/auth.strings';
import { useLocale } from '@/app/shared/locale';

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const str = authStrings[locale].login;
  const shared = authStrings[locale].shared;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        const msg = signInError.message?.toLowerCase() ?? '';
        if (
          msg.includes('invalid login') ||
          msg.includes('invalid credentials') ||
          msg.includes('email not confirmed') ||
          msg.includes('wrong password')
        ) {
          setError(str.errorInvalidCredentials);
        } else if (msg.includes('network') || msg.includes('fetch')) {
          setError(str.errorNetworkFailure);
        } else {
          setError(str.errorUnknown);
        }
        return;
      }

      // Layer 1 done — AuthContext onAuthStateChange will fire and load profiles.
      // SessionGuard will redirect to /profile-select automatically.
      router.push('/profile-select');
    } catch {
      setError(str.errorNetworkFailure);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold">{shared.appName}</h1>
        <h2 className="text-center text-lg font-medium">{str.pageTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              {str.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={str.emailPlaceholder}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              {str.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={str.passwordPlaceholder}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#7bc28f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5eaa75] disabled:opacity-50"
          >
            {isSubmitting ? shared.loading : str.submitButton}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          {str.noAccountPrompt}{' '}
          <Link href="/register" className="font-medium text-[#5eaa75] hover:underline">
            {str.registerLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
