'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authStrings } from '@/lib/auth.strings';
import { useLocale } from '@/app/shared/locale';
import type { AvatarId } from '@/lib/auth.types';

// ─── Avatar picker data ────────────────────────────────────────────────────

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

// ─── Form state types ──────────────────────────────────────────────────────

interface ChildDraft {
  name: string;
  pin: string;
  avatarId: AvatarId | null;
}

interface FormState {
  familyName: string;
  email: string;
  password: string;
  parentName: string;
  parentPin: string;
  parentAvatarId: AvatarId | null;
  children: ChildDraft[];
}

type Step = 1 | 2 | 3;

const EMPTY_CHILD: ChildDraft = { name: '', pin: '', avatarId: null };

// ─── Sub-components ────────────────────────────────────────────────────────

function AvatarPicker({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: AvatarId | null;
  onSelect: (id: AvatarId) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {AVATAR_IDS.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`rounded-full border-2 p-1 transition ${
              selected === id ? 'border-[#7bc28f] bg-[#e8f6e8]' : 'border-gray-200'
            }`}
            aria-label={id}
            aria-pressed={selected === id}
          >
            <img
              src={`/avatar/${id}.png`}
              alt={id}
              className="h-10 w-10"
            />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PinInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
        autoComplete="new-password"
      />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const str = authStrings[locale].register;
  const shared = authStrings[locale].shared;

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    familyName: '',
    email: '',
    password: '',
    parentName: '',
    parentPin: '',
    parentAvatarId: null,
    children: [{ ...EMPTY_CHILD }],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Field helpers ──────────────────────────────────────────────────

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const setChildField = (index: number, key: keyof ChildDraft, value: string | AvatarId | null) => {
    setForm(prev => {
      const updated = [...prev.children];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, children: updated };
    });
    setError(null);
  };

  const addChild = () => {
    setForm(prev => ({ ...prev, children: [...prev.children, { ...EMPTY_CHILD }] }));
    setError(null);
  };

  // ── Step validation ────────────────────────────────────────────────

  const validateStep1 = (): string | null => {
    if (!form.familyName.trim()) return str.errorFamilyNameRequired;
    if (!form.email.trim()) return str.errorEmailRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return str.errorEmailInvalid;
    if (form.password.length < 8) return str.errorPasswordTooShort;
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!form.parentName.trim()) return str.errorNameRequired;
    if (!form.parentPin) return str.errorPinRequired;
    if (!/^\d{4}$/.test(form.parentPin)) return str.errorPinLength;
    if (!form.parentAvatarId) return str.errorAvatarRequired;
    return null;
  };

  const validateStep3 = (): string | null => {
    if (form.children.length === 0) return str.errorAtLeastOneChild;
    for (const child of form.children) {
      if (!child.name.trim()) return str.errorNameRequired;
      if (!child.pin) return str.errorPinRequired;
      if (!/^\d{4}$/.test(child.pin)) return str.errorPinLength;
      if (!child.avatarId) return str.errorAvatarRequired;
    }
    return null;
  };

  // ── Navigation ─────────────────────────────────────────────────────

  const handleNext = () => {
    let validationError: string | null = null;
    if (step === 1) validationError = validateStep1();
    if (step === 2) validationError = validateStep2();

    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(prev => (prev + 1) as Step);
  };

  // ── Submit (step 3) ────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validateStep3();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName: form.familyName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          parent: {
            name: form.parentName.trim(),
            pin: form.parentPin,
            avatarId: form.parentAvatarId,
          },
          children: form.children.map(c => ({
            name: c.name.trim(),
            pin: c.pin,
            avatarId: c.avatarId,
          })),
        }),
      });

      const data: { success: boolean; error?: string } = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 409 || data.error?.includes('already exists')) {
          setError(str.errorEmailAlreadyRegistered);
        } else {
          setError(data.error ?? str.errorUnknown);
        }
        return;
      }

      // Registration successful — redirect to login
      router.push('/login');
    } catch {
      setError(str.errorUnknown);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  const stepLabel = step === 1 ? str.stepFamily : step === 2 ? str.stepParent : str.stepChild;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{shared.appName}</h1>
          <p className="text-sm italic text-gray-500">{shared.appSubtitle}</p>
        </div>
        <h2 className="text-center text-lg font-medium">{str.pageTitle}</h2>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full ${s <= step ? 'bg-[#7bc28f]' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <p className="text-center text-sm font-medium text-gray-600">{stepLabel}</p>

        {/* ── Step 1: Family details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="familyName" className="block text-sm font-medium">
                {str.familyNameLabel}
              </label>
              <input
                id="familyName"
                type="text"
                value={form.familyName}
                onChange={e => setField('familyName', e.target.value)}
                placeholder={str.familyNamePlaceholder}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium">
                {str.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
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
                autoComplete="new-password"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                placeholder={str.passwordPlaceholder}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
              />
              <p className="text-xs text-gray-500">{str.passwordHint}</p>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="w-full rounded-md bg-[#7bc28f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5eaa75]"
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Step 2: Parent profile ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="parentName" className="block text-sm font-medium">
                {str.parentNameLabel}
              </label>
              <input
                id="parentName"
                type="text"
                value={form.parentName}
                onChange={e => setField('parentName', e.target.value)}
                placeholder={str.parentNamePlaceholder}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
              />
            </div>

            <AvatarPicker
              label={str.parentAvatarLabel}
              selected={form.parentAvatarId}
              onSelect={id => setField('parentAvatarId', id)}
            />

            <PinInput
              id="parentPin"
              label={str.parentPinLabel}
              value={form.parentPin}
              onChange={v => setField('parentPin', v)}
            />

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                {shared.back}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 rounded-md bg-[#7bc28f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5eaa75]"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Child profiles ── */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {form.children.map((child, i) => (
              <div key={i} className="space-y-4 rounded-lg border p-4">
                <p className="text-sm font-semibold text-gray-700">
                  {str.childHeading} {form.children.length > 1 ? i + 1 : ''}
                </p>

                <div className="space-y-1">
                  <label htmlFor={`childName-${i}`} className="block text-sm font-medium">
                    {str.childNameLabel}
                  </label>
                  <input
                    id={`childName-${i}`}
                    type="text"
                    value={child.name}
                    onChange={e => setChildField(i, 'name', e.target.value)}
                    placeholder={str.childNamePlaceholder}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bc28f]"
                  />
                </div>

                <AvatarPicker
                  label={str.childAvatarLabel}
                  selected={child.avatarId}
                  onSelect={id => setChildField(i, 'avatarId', id)}
                />

                <PinInput
                  id={`childPin-${i}`}
                  label={str.childPinLabel}
                  value={child.pin}
                  onChange={v => setChildField(i, 'pin', v)}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addChild}
              className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              + {str.addAnotherChild}
            </button>

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(2); setError(null); }}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                {shared.back}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-[#7bc28f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5eaa75] disabled:opacity-50"
              >
                {isSubmitting ? shared.loading : str.submitButton}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-600">
          {str.alreadyHaveAccount}{' '}
          <Link href="/login" className="font-medium text-[#5eaa75] hover:underline">
            {str.signInLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
