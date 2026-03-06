# Auth Layer Patch — JWT Enrichment (Path A)

_Created: 2026-03-05_
_Reason: Service layer migration requires RLS-compatible JWT. Current JWT contains only standard Supabase claims after Layer 2. This patch enriches the JWT with `family_id`, `user_id`, and `role` after PIN verification so the browser Supabase client can make direct RLS-protected calls._

---

## Problem

After Layer 2 PIN verification, `family_id`, `user_id`, and `role` are stored in React `AppSession` state only. The Supabase JWT never receives these claims. This means:

- RLS helper functions `current_family_id()` and `current_user_id()` return `NULL` for browser client calls
- All RLS-protected reads return empty rows silently
- All RLS-protected writes are rejected
- The service layer must use the service role key via API routes, with manual family isolation checks on every route

This patch fixes the root cause.

---

## Solution

After PIN verification succeeds, the server calls `supabase.auth.admin.updateUserById()` to write `family_id`, `user_id`, and `role` as custom claims into the user's app_metadata. The client then calls `supabase.auth.refreshSession()` to get a new JWT containing those claims. All subsequent browser Supabase client calls carry the enriched JWT, and RLS works automatically.

On every token auto-refresh, Supabase reissues the JWT from app_metadata — so the claims persist without any re-enrichment needed.

---

## Exact Changes Required

### Change 1 — Update `/api/auth/pin-verify/route.ts`

After PIN verification succeeds and `failed_pin_attempts` is reset, add:

```typescript
// Write family_id, user_id, role into the Supabase Auth user's app_metadata
// This persists across token refreshes — Supabase includes app_metadata in every JWT
const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
  authUserId,  // the auth.users.id linked to this family's Supabase Auth account
  {
    app_metadata: {
      family_id: userProfile.familyId,
      user_id: userProfile.userId,
      role: userProfile.role,
      is_platform_admin: userProfile.isPlatformAdmin
    }
  }
);

if (updateError) {
  return NextResponse.json(
    { verified: false, error: 'Session enrichment failed' },
    { status: 500 }
  );
}

// Return verified: true — client must call refreshSession() next
return NextResponse.json({ verified: true });
```

**Note:** `authUserId` is the `auth.users.id` (Layer 1 identity), not the `users.id` (app user row). The agent must look up which field on the session carries this — it's available from `supabase.auth.getUser()` server-side using the request JWT.

---

### Change 2 — Update RLS helper functions in Supabase

The existing helpers read from `request.jwt.claims`. Supabase puts `app_metadata` claims at the top level of the JWT. Update the helpers to read from the correct path:

```sql
-- Run this in Supabase SQL editor or add as a new migration file

create or replace function current_family_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'family_id',
    ''
  )::uuid
$$;

create or replace function current_user_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_id',
    ''
  )::uuid
$$;

create or replace function is_platform_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  )
$$;
```

Save this as `supabase/migrations/YYYYMMDDHHMMSS_fix_rls_helpers_app_metadata.sql` and run `npx supabase db push`.

---

### Change 3 — Update client after PIN verification

In the component or hook that calls `/api/auth/pin-verify`, after receiving `{ verified: true }`, add a `refreshSession()` call before populating `AuthContext`:

```typescript
const pinResponse = await fetch('/api/auth/pin-verify', {
  method: 'POST',
  body: JSON.stringify({ userId, pinAttempt })
});

const { verified } = await pinResponse.json();

if (verified) {
  // Force Supabase client to fetch a new JWT with enriched app_metadata claims
  const { data: { session }, error } = await supabase.auth.refreshSession();

  if (error || !session) {
    // Handle refresh failure — redirect to /login
    return;
  }

  // Now set the profile session in AuthContext as before
  // The JWT in session.access_token now contains family_id, user_id, role
  setProfileSession(userProfile);
  router.push('/words');
}
```

---

### Change 4 — Handle token refresh persistence

Supabase auto-refreshes the JWT every ~1 hour. Because claims are in `app_metadata` (server-side, persisted), Supabase includes them automatically in every refreshed token. **No client-side handling needed** — this is the key advantage of `app_metadata` over `user_metadata`.

However, add a safeguard in `AuthContext` using `onAuthStateChange`:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearProfileSession();
    router.push('/login');
  }

  if (event === 'TOKEN_REFRESHED' && session) {
    // Claims persist via app_metadata — no re-enrichment needed
    // But verify family_id is still present as a safety check
    const familyId = session.user.app_metadata?.family_id;
    if (!familyId && isLayer2Ready) {
      // Claims lost unexpectedly — force re-login
      clearProfileSession();
      router.push('/profile-select');
    }
  }
});
```

---

### Change 5 — Update browser Supabase client calls in supabase-service.ts

Once the JWT is enriched, the browser client works directly with RLS. The service layer uses the standard browser client — no API routes needed for data operations:

```typescript
// src/lib/supabase-service.ts
import { createClient } from '@supabase/supabase-js';

// Browser client — uses anon key + enriched JWT — RLS enforces family isolation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Example — RLS automatically filters by family_id from JWT
export async function getAllWords(): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toWord);  // snake_case → camelCase
}
```

Note: `familyId` no longer needs to be passed as a parameter — RLS reads it from the JWT automatically.

---

## Verification Steps

After implementing all 5 changes, verify in this order:

**1. Check JWT claims are present after Layer 2**
```typescript
// In browser console after logging in through both layers:
const { data } = await supabase.auth.getSession();
console.log(data.session.user.app_metadata);
// Must show: { family_id: "...", user_id: "...", role: "...", is_platform_admin: false }
```

**2. Verify RLS helpers return correct values**
Run in Supabase SQL editor while authenticated:
```sql
select current_family_id();   -- must return your family's UUID, not NULL
select current_user_id();     -- must return your user's UUID, not NULL
select is_platform_admin();   -- must return false (or true for admin)
```

**3. Run verify-rls.ts**
The 3 previously skipped tests should now pass:
```bash
npm run verify:rls
# Target: 17 passed · 0 failed · 0 skipped
```

**4. typecheck + build**
```bash
npm run typecheck  # 0 errors
npm run build      # success
```

---

## Sequence

```
1. Agent implements Changes 1–4 (auth layer patch)
        ↓
2. Run migration for Change 2 (updated RLS helpers)
        ↓
3. Verify JWT claims present in browser console
        ↓
4. Run verify-rls.ts → 17 passed, 0 skipped
        ↓
5. typecheck + build pass
        ↓
6. THEN begin service layer migration (supabase-service.ts)
   — no API routes needed for data operations
   — familyId param removed from all service functions
   — browser client calls Supabase directly
```

Do not begin the service layer migration until Step 4 shows 17/17 passing. The skipped tests are the proof that RLS is working correctly with the enriched JWT.

---

## Impact on Service Layer Migration Spec

Once this patch is applied, update `2026-03-05-service-layer-migration.md`:

1. **Open Question 1** → Closed: JWT is enriched via `app_metadata`. Browser client works directly with RLS.
2. **RLS and Auth Strategy section** → Replace Path B language with Path A: all service calls use browser Supabase client directly.
3. **Function signatures** → Remove `familyId` and `userId` parameters from all functions — RLS provides isolation automatically.
4. **No `/api/data/*` routes needed** — delete that approach from the spec entirely.
