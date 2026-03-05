'use client';

import { useState } from 'react';
import { loginStrings } from './login.strings';
import { useLocale } from '@/app/shared/locale';
import type { AvatarOption } from './login.types';
import styles from './LoginForm.module.css';

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 0, filename: 'bubble_tea_excited_1', label: 'avatarBubbleTea' },
  { id: 1, filename: 'cake_sleep_1', label: 'avatarCake' },
  { id: 2, filename: 'donut_wink_1', label: 'avatarDonut' },
];

interface LoginFormProps {
  isSetup: boolean; // true = first-time setup, false = returning user login
  onSubmit: (pin: string, avatarId: number) => Promise<void>;
  error?: string | null;
}

export function LoginForm({ isSetup, onSubmit, error }: LoginFormProps) {
  const locale = useLocale();
  const str = loginStrings[locale];

  const [pin, setPin] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null);
  const [step, setStep] = useState<'pin' | 'avatar'>('pin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(error || null);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
    setLocalError(null);
  };

  const handlePinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!pin) {
      setLocalError(str.pinRequired);
      return;
    }

    if (pin.length !== 4) {
      setLocalError(str.pinLengthError);
      return;
    }

    // PIN is validated server-side on next step (before showing avatar grid)
    setStep('avatar');
    setLocalError(null);
  };

  const handleAvatarSelect = (avatarId: number) => {
    setSelectedAvatarId(avatarId);
    setLocalError(null);
  };

  const handleAvatarSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (selectedAvatarId === null) {
      setLocalError(str.avatarRequired);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(pin, selectedAvatarId);
    } catch (err) {
      const message = err instanceof Error ? err.message : str.incorrectPin;
      setLocalError(message);
      setIsSubmitting(false);
    }
  };

  if (step === 'pin') {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{isSetup ? str.setupTitle : str.loginTitle}</h1>
        <p className={styles.description}>
          {isSetup ? str.setupDescription : str.loginDescription}
        </p>

        <form onSubmit={handlePinSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="pin" className={styles.label}>
              {isSetup ? str.pinLabel : str.enterPinLabel}
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder={str.pinPlaceholder}
              value={pin}
              onChange={handlePinChange}
              maxLength={4}
              className={styles.pinInput}
              autoFocus
              disabled={isSubmitting}
            />
            {localError && <div className={styles.error}>{localError}</div>}
          </div>

          <button
            type="submit"
            className={styles.button}
            disabled={isSubmitting || pin.length !== 4}
          >
            {str.submitButton}
          </button>
        </form>

        {isSetup && (
          <p className={styles.helpText}>{str.pinReminder}</p>
        )}
      </div>
    );
  }

  // Avatar selection step
  return (
    <div className={styles.container}>
      <h2 className={styles.subtitle}>{str.chooseAvatarLabel}</h2>

      <form onSubmit={handleAvatarSubmit} className={styles.form}>
        <div className={styles.avatarGrid}>
          {AVATAR_OPTIONS.map(avatar => (
            <button
              key={avatar.id}
              type="button"
              className={`${styles.avatarButton} ${
                selectedAvatarId === avatar.id ? styles.avatarSelected : ''
              }`}
              onClick={() => handleAvatarSelect(avatar.id)}
              disabled={isSubmitting}
              title={str[avatar.label as keyof typeof str]}
            >
              <img
                src={`/avatar/${avatar.filename}.png`}
                alt={str[avatar.label as keyof typeof str]}
                className={styles.avatarImage}
              />
              <span className={styles.avatarLabel}>
                {str[avatar.label as keyof typeof str]}
              </span>
            </button>
          ))}
        </div>

        {localError && <div className={styles.error}>{localError}</div>}

        <button
          type="submit"
          className={styles.button}
          disabled={isSubmitting || selectedAvatarId === null}
        >
          {isSubmitting ? str.loggingIn : str.enterAppButton}
        </button>
      </form>

      <button
        type="button"
        className={styles.backButton}
        onClick={() => {
          setStep('pin');
          setLocalError(null);
        }}
        disabled={isSubmitting}
      >
        ← {str.pinLabel}
      </button>

      <p className={styles.helpText}>{str.selectAvatarReminder}</p>
    </div>
  );
}
