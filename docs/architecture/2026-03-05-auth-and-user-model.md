# Feature Spec — 2026-03-05 — Auth & User Model

_Status: ✅ Implemented — 2026-03-05 (feat/phase3)_

> This spec supersedes `docs/architecture/2026-03-04-login-and-avatar-protection.md`.
> That doc should be moved to `docs/archive/2026-03/` once this spec is approved.

---

## Problem

The current auth system uses a single PIN stored in localStorage with a PIN-scoped IndexedDB database. This was designed for a single-user, single-device, local-first app. It cannot support:

- Multiple named user profiles per family (parent + child)
- Role-based access (parent vs. child permissions)
- Multi-family multi-tenant access
- Data durability (localStorage wipe destroys all data)
- Account recovery (forgotten PIN = lost data)
- Pilot rollout to 3 families or public launch

The entire auth layer must be replaced.

---

## Scope

- Family account registration (email + password)
- Profile creation (parent profile + child profiles with PINs)
- Two-layer login flow: Layer 1 (email + password) + Layer 2 (profile select + PIN)
- Session model: Supabase Auth JWT enriched with `family_id`, `user_id`, `role`
- Session guard: protect all routes, redirect unauthenticated users to `/login`
- Logout flow
- PIN lockout after failed attempts
- All localStorage and IndexedDB auth logic retired

---

## Out of Scope

- Role-based routing and nav visibility (covered in `2026-03-05-role-based-routing.md`)
- Supabase schema and RLS policies (covered in `2026-03-05-supabase-schema-rls.md`)
- Multi-parent accounts per family (deferred post-launch)
- Social login / OAuth providers (deferred)
- Email verification flow (defer to post-pilot; Supabase handles this natively when enabled)
- Password change or profile name edit UI (deferred)
- Content pack purchase auth (deferred)

---

## Two-Layer Auth Model

### Layer 1 — Family Authentication (Supabase Auth)
One Supabase Auth account per family. Proves the person belongs to this family before they see anything. Standard email + password. Supabase handles token issuance, refresh, and recovery.

### Layer 2 — Profile Selection + PIN (App Layer)
After Layer 1, the user sees their family's profile cards. They tap a profile and enter that profile's PIN. This sets `user_id`, `family_id`, and `role` in the app session context.

**Security model:** Layer 2 PIN is a profile switcher, not an authentication gate. Real security lives in Layer 1. An attacker needs the family email + password before they ever reach a PIN screen.

**PIN hashing algorithm:** `scrypt` via Node.js `crypto.scryptSync`. Parameters: N=16384, r=8, p=1, keylen=32 (N reduced from 32768 to stay within Node.js default maxmem on Windows). Stored format: `{32-hex-salt}:{64-hex-hash}`. Salt is 16 random bytes generated per hash. Verification uses `crypto.timingSafeEqual` to prevent timing attacks. This algorithm is used in `scripts/seed-platform-admin.mjs` and **must** be used identically in `src/app/api/auth/pin-verify/route.ts` — mismatched algorithms will silently break login.

---

## Registration Flow

```
User visits /register
        ↓
Enters: Family name, email, password
        ↓
Supabase Auth creates account
        ↓
App creates: families row + parent users row (role: parent)
        ↓
Parent sets their own PIN (4 digits)
        ↓
Parent creates child profile(s): name + PIN per child
        ↓
(Can add more child profiles later from settings)
        ↓
Redirect to /login
```

**Notes:**
- Family name is stored in the `families` table (e.g. "The Fu Family")
- Parent `users` row is linked to `auth.users` via `auth_user_id`
- Child `users` rows have `auth_user_id = null` (no Supabase Auth account)
- At least one child profile required before registration is complete
- Parent PIN is required — parent must also enter Layer 2 PIN on login

---

## Login Flow

### Layer 1

```
User visits /login
        ↓
Enters: email + password
        ↓
Supabase Auth validates credentials
        ↓
On success: Supabase issues JWT (contains auth_user_id)
        ↓
App looks up family_id from users table (where auth_user_id matches)
        ↓
Proceeds to Layer 2
```

### Layer 2

```
Profile picker screen renders
        ↓
Shows all users rows for this family_id
  e.g.  [Mom]  [Nora]
        ↓
User taps a profile card
        ↓
PIN entry screen renders (4-digit masked input)
        ↓
User enters PIN
        ↓
App hashes PIN, compares to users.pin_hash for selected profile
        ↓
On match:
  - App session context set: { family_id, user_id, role }
  - JWT enriched with these claims (via Supabase Auth Hook — see below)
  - Redirect to /words
        ↓
On mismatch:
  - Increment failed attempt counter (in-memory)
  - After 5 failed attempts: lock PIN entry
  - Show: "Too many attempts. Please ask a parent to unlock."
  - Parent unlock: re-enter Layer 1 (email + password) to reset counter
```

---

## JWT Enrichment (Supabase Auth Hook)

Supabase does not automatically include `family_id`, `user_id`, or `role` in the JWT. These must be injected.

**Mechanism:** Supabase supports a custom access token hook — a Postgres function (or Edge Function) that fires after every token issuance and can add custom claims.

**Claims to inject:**

```json
{
  "family_id": "uuid",
  "user_id": "uuid",
  "role": "parent" | "child"
}
```

**When claims are set:**
- After Layer 1, the JWT contains only `auth_user_id` (standard Supabase claims)
- After Layer 2 PIN is verified, the app calls a Supabase Edge Function or Next.js API route that:
  1. Verifies the PIN server-side (never trust client-side PIN verification alone)
  2. Calls `supabase.auth.updateUser()` or sets a session cookie with the enriched claims
  3. Returns the enriched session to the client

**Implementation options (pick one before build starts):**

| Option | Mechanism | Notes |
|---|---|---|
| A | Supabase custom access token hook (Postgres function) | Cleanest; hook fires on every token refresh automatically |
| B | Next.js API route `/api/auth/pin-verify` sets a server-side session cookie with enriched claims | More control; no Supabase hook needed |

**Recommendation: Option B for pilot.** Next.js API route is easier to debug during development. Option A can replace it before public launch for cleaner architecture.

---

## Session Model

After successful Layer 2, the client holds:

```typescript
interface AppSession {
  supabaseSession: Session       // Supabase Auth JWT (Layer 1)
  familyId: string               // uuid
  userId: string                 // uuid (selected profile)
  role: 'parent' | 'child'
  userName: string               // display name for nav
  avatarId: string               // selected avatar emoji/id
}
```

Session is stored in:
- `supabaseSession` — managed by Supabase client (localStorage, auto-refreshed)
- `familyId`, `userId`, `role`, `userName`, `avatarId` — stored in a React context provider (`AuthContext`)
- On page reload: Supabase session restored from localStorage → app re-fetches user profile from `users` table → rebuilds `AuthContext`

**No PIN hash is ever stored client-side.** PIN verification happens server-side via the API route.

---

## Session Guard

All routes except `/login` and `/register` are protected.

```
On every route render:
        ↓
SessionGuard checks: is Supabase session valid?
        ↓
No  → redirect to /login
        ↓
Yes → is AppSession (userId, role) populated in AuthContext?
        ↓
No  → redirect to /login (Layer 2 not yet completed)
        ↓
Yes → render route
```

SessionGuard is a wrapper component applied in the root layout. It does not handle role-based route visibility — that is the RouteGuard spec's responsibility.

---

## Logout Flow

```
User clicks logout
        ↓
App calls supabase.auth.signOut()
        ↓
Supabase clears its localStorage session
        ↓
App clears AuthContext (familyId, userId, role, etc.)
        ↓
Redirect to /login
```

On next visit, user must complete both layers again.

---

## Profile Picker UI

```
┌──────────────────────────────────┐
│     Welcome to Chinese Review    │
│                                  │
│  Who's learning today?           │
│                                  │
│   ┌────────┐    ┌────────┐       │
│   │   👩   │    │  🐣    │       │
│   │  Mom   │    │  Nora  │       │
│   └────────┘    └────────┘       │
│                                  │
└──────────────────────────────────┘
```

- Avatar images from existing `/public/avatar/` assets
- Profile cards are large touch targets (mobile-optimized)
- Tapping a card leads to PIN entry for that profile

---

## PIN Entry UI

```
┌──────────────────────────────────┐
│                                  │
│   Hi, Nora 🐣                    │
│   Enter your PIN                 │
│                                  │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│   │●│ │●│ │●│ │●│           │
│   └──┘ └──┘ └──┘ └──┘           │
│                                  │
│   [1] [2] [3]                    │
│   [4] [5] [6]                    │
│   [7] [8] [9]                    │
│       [0]  [⌫]                   │
│                                  │
│   ← Back to profiles             │
│                                  │
└──────────────────────────────────┘
```

- 4-dot masked display (not a text input — a custom PIN pad)
- On-screen PIN pad (avoids iOS keyboard obscuring the screen)
- Back link returns to profile picker without clearing Layer 1 session

---

## Layer Impact

### New Files

| File | Purpose |
|---|---|
| `src/app/(auth)/login/page.tsx` | Layer 1 email + password form |
| `src/app/(auth)/register/page.tsx` | Family registration + profile setup |
| `src/app/(auth)/profile-select/page.tsx` | Layer 2 profile picker |
| `src/app/(auth)/pin-entry/page.tsx` | Layer 2 PIN pad |
| `src/app/api/auth/pin-verify/route.ts` | Server-side PIN verification API route |
| `src/lib/authContext.tsx` | React context: AppSession provider + hook |
| `src/lib/sessionGuard.tsx` | Route protection wrapper component |
| `src/lib/supabaseClient.ts` | Supabase client singleton |
| `src/app/words/auth/auth.types.ts` | AppSession, LoginLayer1State, etc. |
| `src/app/words/auth/auth.strings.ts` | All login/register UI strings (EN + ZH) |

### Retired Files

| File | Action |
|---|---|
| `src/lib/db.ts` (IndexedDB/Dexie) | Retired — replaced by `src/lib/supabase.ts` |
| `src/lib/auth.ts` (PIN/localStorage) | Retired — replaced by `src/lib/authContext.tsx` + API route |
| `docs/architecture/2026-03-04-login-and-avatar-protection.md` | Archive to `docs/archive/2026-03/` |

### Modified Files

| File | Change |
|---|---|
| `src/app/layout.tsx` | Wrap with `SessionGuard` and `AuthContext` provider |
| Nav/shell component | Read `userName` + `avatarId` from `AuthContext` instead of localStorage |

### Domain Layer
No changes. Scheduler remains a pure function.

### API Routes
`/api/flashcard/generate` — must pass Supabase session JWT in request header so RLS evaluates correctly. Service layer handles this transparently via the Supabase client.

---

## Edge Cases

1. **Page reload mid-session:** Supabase restores Layer 1 session from localStorage. App re-fetches `users` row to rebuild `AuthContext`. If `users` row is missing, treat as logged out.
2. **Supabase session expired:** Supabase client auto-refreshes tokens. If refresh fails (network error), SessionGuard catches the invalid session and redirects to `/login`.
3. **PIN lockout — child locked out:** After 5 failed attempts, PIN entry screen shows lockout message. Parent must re-authenticate at Layer 1 to reset the counter. Counter is in-memory only (resets on page reload for pilot — add server-side counter post-launch).
4. **Family has no child profiles yet:** Registration wizard enforces at least one child profile before completion. If somehow bypassed, profile picker shows only the parent profile.
5. **Two profiles, same PIN:** Allowed. PINs are per-profile, not globally unique. Verification checks the selected profile's `pin_hash` only.
6. **Back button after Layer 2:** Pressing back from PIN entry returns to profile picker. Layer 1 session remains valid — user does not need to re-enter email/password.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| PIN verified client-side only | High | Spec requires server-side PIN verification via `/api/auth/pin-verify`. Client-side check is UX only. |
| JWT claims not set before RLS evaluates | High | SessionGuard blocks all DB access until AppSession is fully populated |
| Supabase session expires during active use | Low | Supabase client auto-refreshes; handle `onAuthStateChange` event to catch failures |
| Child PIN brute-forceable if Layer 1 is compromised | Low | Layer 1 (email + password) is the real security gate. PIN entropy acceptable given this dependency. |

---

## Test Plan

1. **Registration:** Complete full registration. Verify `families` row, parent `users` row, and child `users` row created in Supabase.
2. **Layer 1 invalid credentials:** Enter wrong password. Verify error shown, no redirect.
3. **Layer 2 profile picker:** After Layer 1, verify correct profile cards render for the family.
4. **Layer 2 correct PIN:** Enter correct PIN for child. Verify redirect to `/words`, `AuthContext` populated with `role: child`.
5. **Layer 2 incorrect PIN:** Enter wrong PIN. Verify error shown. Repeat 5 times. Verify lockout screen shown.
6. **Parent role session:** Log in as parent profile. Verify `role: parent` in session.
7. **Session guard — unauthenticated:** Visit `/words/add` without login. Verify redirect to `/login`.
8. **Session guard — Layer 1 only:** Complete Layer 1 but not Layer 2. Visit `/words`. Verify redirect to `/profile-select`.
9. **Page reload:** Complete full login. Reload page. Verify session restored, no redirect to `/login`.
10. **Logout:** Click logout. Verify Supabase session cleared, redirect to `/login`, Layer 1 required again.
11. **Bilingual UI:** Verify all auth strings render in EN and ZH.

---

## Acceptance Criteria

- [x] `/register` creates family, parent user, and at least one child user in Supabase
- [x] `/login` Layer 1 validates email + password via Supabase Auth
- [x] `/profile-select` renders correct profiles for the authenticated family
- [x] `/pin-entry` verifies PIN server-side via `/api/auth/pin-verify`
- [x] Correct PIN sets `AuthContext` with `family_id`, `user_id`, `role`
- [x] 5 failed PIN attempts triggers lockout screen
- [x] SessionGuard redirects unauthenticated users to `/login`
- [x] SessionGuard redirects Layer-1-only users to `/profile-select`
- [x] Page reload restores full session without re-entering credentials
- [x] Logout clears Supabase session and `AuthContext`, redirects to `/login`
- [x] No PIN hash stored in localStorage or client-side state
- [x] All strings in `auth.strings.ts` (EN + ZH)
- [x] All new types in `auth.types.ts`
- [x] Old localStorage PIN auth code fully removed
- [x] Old IndexedDB Dexie auth code fully removed

---

## Decisions Closed

1. **JWT enrichment:** ✅ Option B — Next.js API route `/api/auth/pin-verify`. Server-side PIN verification, enriched session cookie returned to client. No Supabase Auth Hook required for pilot.
2. **Avatar assets:** ✅ 8 PNG files in `/public/avatar/`. Naming convention: `{name}_{expression}_{variant}.png`. Full set (filenames are source of truth — `avatar_id` in DB must match exactly):
   - `bubble_tea_excited_1.png`
   - `bun_wink_1.png`
   - `cake_sleep_1.png`
   - `donut_wink_1.png`
   - `ramen_calm_1.png`
   - `rice_ball_sleep_1.png`
   - `tangyuan_smile_1.png`
   - `zongzi_smile_1.png`

   Avatar ID stored in `users` table as the filename stem (e.g. `bubble_tea_excited_1`). Profile picker renders `<img src={/public/avatar/${avatarId}.png} />`. Parent and child each pick one avatar at registration/profile creation.
3. **PIN lockout counter:** ✅ Server-side. `failed_pin_attempts` column on `users` table. Resets to 0 on successful PIN entry. Locks at 5. Schema spec updated accordingly.
4. **PIN hashing algorithm:** ✅ `scrypt` (not SHA-256). See Layer 2 section above for full parameters and stored format. All code that hashes or verifies PINs must use this algorithm.
