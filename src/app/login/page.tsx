'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from './LoginForm';
import {
  hashPin,
  verifyPin,
  createSessionToken,
  setSessionData,
  getPinHash,
  setPinHash,
  hasPinSet,
  setLastSelectedAvatarId,
  getLastSelectedAvatarId,
  hasMigrationCompleted,
} from '@/lib/auth';
import { initializeDatabaseForPin } from '@/lib/db';
import { loginStrings } from './login.strings';
import { useLocale } from '@/app/shared/locale';

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const str = loginStrings[locale];

  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Detect if this is first-time setup or returning user
    const pinExists = hasPinSet();
    setIsSetup(!pinExists);
    setIsLoading(false);
  }, []);

  const handleSubmit = async (pin: string, avatarId: number) => {
    try {
      setError(null);

      if (isSetup) {
        // First-time setup: hash and store PIN, create session
        const pinHash = await hashPin(pin);
        setPinHash(pinHash);

        // Initialize PIN-scoped database and migrate legacy data only once
        const shouldMigrate = !hasMigrationCompleted();
        await initializeDatabaseForPin(pinHash, shouldMigrate);

        // Create and store session token
        const token = createSessionToken();
        setSessionData(token, avatarId);
        setLastSelectedAvatarId(avatarId);

        // Redirect to app
        router.push('/words');
      } else {
        // Returning user: verify PIN
        const storedHash = getPinHash();
        if (!storedHash) {
          setError(str.incorrectPin);
          return;
        }

        const isValid = await verifyPin(pin, storedHash);
        if (!isValid) {
          setError(str.incorrectPin);
          return;
        }

        // Initialize PIN-scoped database (no migration for returning users)
        await initializeDatabaseForPin(storedHash);

        // PIN is correct: create session
        const token = createSessionToken();
        setSessionData(token, avatarId);
        setLastSelectedAvatarId(avatarId);

        // Redirect to app
        router.push('/words');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : str.incorrectPin;
      setError(message);
      console.error('Login error:', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>{str.loggingIn}</p>
      </div>
    );
  }

  return <LoginForm isSetup={isSetup} onSubmit={handleSubmit} error={error} />;
}
