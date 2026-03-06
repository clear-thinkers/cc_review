'use client';

import { useRouter } from 'next/navigation';
import { authStrings } from '@/lib/auth.strings';
import { useLocale } from '@/app/shared/locale';
import { useAuth } from '@/lib/authContext';

export default function ProfileSelectPage() {
  const router = useRouter();
  const locale = useLocale();
  const str = authStrings[locale].profileSelect;
  const shared = authStrings[locale].shared;

  const { familyProfiles, isLayer1Ready } = useAuth();

  if (!isLayer1Ready) {
    // Should not render here; SessionGuard redirects to /login if Layer 1 is missing.
    // Render nothing to avoid a flash.
    return null;
  }

  const handleProfileSelect = (userId: string) => {
    router.push(`/pin-entry?userId=${encodeURIComponent(userId)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-center text-2xl font-semibold">{shared.appName}</h1>
        <h2 className="text-center text-lg font-medium">{str.heading}</h2>
        <p className="text-center text-sm text-gray-600">{str.subheading}</p>

        {familyProfiles.length === 0 ? (
          <p className="text-center text-sm text-gray-500">{shared.loading}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {familyProfiles.map(profile => (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileSelect(profile.id)}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-transparent p-4 hover:border-[#7bc28f] hover:bg-[#e8f6e8] transition"
              >
                {profile.avatarId ? (
                  <img
                    src={`/avatar/${profile.avatarId}.png`}
                    alt={profile.name}
                    className="h-16 w-16"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                    👤
                  </div>
                )}
                <span className="text-sm font-semibold">{profile.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
