# Feature Spec — 2026-03-04 — Login & Avatar Protection Gate

_Status: Shipped 2026-03-04_  
_Tier 1 Protective Feature — Early Feedback Rollout to 1–3 Users_

---

## Problem

The current app is single-user and accessed globally — anyone visiting the URL can access the data. When deploying to Vercel for Nora (a child) to use from her iPad, the app needs to:

1. **Protect data access** — Nora's learning data should be accessible only to her, not to anyone who opens the URL
2. **Simple security** — A PIN-based login is sufficient for early feedback (not production-grade)
3. **Minimal friction** — Quick login + avatar selection; no email, password managers, or recovery flows

---

## Scope

### In scope

1. **First-visit setup wizard**
   - User visits the app for the first time (no PIN stored)
   - Redirected to `/login` setup page
   - Prompts to create a 4-digit PIN (entry only; no confirmation repeat)
   - Shows 10 avatar options to select
   - On submission, PIN + selected avatar ID stored locally; session token created
   - User redirected to `/words` (main app)

2. **Subsequent-visit login**
   - User visits app (localStorage contains stored PIN)
   - Redirected to `/login` with PIN entry + avatar selection form
   - User enters PIN; if correct, shows 10 avatar options
   - User selects avatar (pre-populated with last-selected avatar if available)
   - On submission, session token created and stored
   - User redirected to `/words`

3. **Session token management**
   - Session token stored in localStorage after successful PIN/avatar selection
   - Token checked on app startup (in root layout); if invalid or missing, redirect to `/login`
   - Token is opaque string (e.g., `sessionToken_TIMESTAMP_RANDOM`)
   - Token persists across browser restarts/refreshes until user logs out or localStorage is cleared
   - No token expiration in Phase 1 (sessions valid indefinitely)

4. **Logout action**
   - Link in main nav or user menu to "Logout"
   - Clicking logout clears session token from localStorage
   - Redirects to `/login` setup page
   - User can create a new PIN or log in with existing PIN

5. **3 Avatar options**
   - Simple images stored in \public\avatar
   - Options: bubble_tea, cake, donut
   - Avatar ID stored as `avatarId: number` (0–9)
   - Avatar displayed in nav bar or user profile area on main app

6. **PIN security**
   - 4-digit PIN (0000–9999) stored in localStorage as hashed value (using `crypto.subtle.digest('SHA-256', ...)`; client-side only)
   - User input is hashed before comparison (not stored as plaintext)
   - PIN entry is masked (dots/asterisks) as user types

7. **Login page styling**
   - Minimal, simple and warm design (similar to game Animal Crossing)
   - Mobile-optimized (Nora's iPad)
   - Light theme with large touch targets
   - Single column layout: title → PIN entry → Avatar grid → Submit button
   - Clear, child-friendly language

8. **Bilingual support**
   - All login strings in `login.strings.ts` (English + Simplified Chinese)
   - Same locale context as main app

### Out of scope

1. **Password reset** — If PIN is forgotten, user must clear localStorage manually (documented in error message)
2. **Multiple accounts** — Single PIN/avatar per browser instance
3. **Backend authentication** — No server-side validation or API calls
4. **Multi-device sync** — Each device has its own PIN and avatar
5. **Email recovery** — No email or account recovery flow
6. **Biometric auth** — Fingerprint or face ID not in Phase 1
7. **Session expiration** — No timeout in Phase 1 (will be added if feedback warrants)

---

## Proposed Behavior

### Data Flow (First Visit)

```
User opens app
        ↓
Root layout checks for session token in localStorage
        ↓
Token not found or invalid
        ↓
Redirect to /login
        ↓
/login detects no stored PIN
        ↓
Display setup wizard: "Enter a 4-digit PIN + Select your avatar"
        ↓
User enters PIN, selects avatar, submits
        ↓
Hash PIN, store in localStorage: { storedPinHash, selectedAvatarId, sessionToken }
        ↓
Create & store session token
        ↓
Redirect to /words
        ↓
User can review words
```

### Data Flow (Subsequent Visit)

```
User opens app
        ↓
Root layout checks for session token in localStorage
        ↓
Token found and valid
        ↓
Allow access to /words (no redirect)
        ↓
Avatar displayed in nav bar
```

### Data Flow (Subsequent Visit — Token Expired/Cleared)

```
User opens app
        ↓
Root layout checks for session token in localStorage
        ↓
Token not found or invalid
        ↓
Redirect to /login
        ↓
/login detects stored PIN
        ↓
Display login form: "Enter your PIN + Select your avatar"
        ↓
User enters PIN; if hash matches stored hash, show avatar grid
        ↓
User selects avatar, submits
        ↓
Create & store new session token
        ↓
Redirect to /words
```

### Data Flow (Logout)

```
User clicks "Logout" in nav/menu
        ↓
Clear session token, PIN hash, and avatar selection from localStorage
        ↓
Redirect to /login
        ↓
/login detects no stored PIN (shows setup wizard)
```

---

## Visual Design

### Login Page Layout (Mobile-Optimized)

```
┌─────────────────────────────┐
│       Chinese Review        │
│                             │
│   Protect Your Learning     │
│                             │
│  ┌─────────────────────┐   │
│  │ Enter 4-digit PIN   │   │
│  │ ••••                │   │
│  └─────────────────────┘   │
│                             │
│  Choose your avatar:        │
│  ⭐ 🌙 🎨 🎭 🎪            │
│  🎸 🎮 🏃 🚀 🦄            │
│                             │
│  [Selected: ⭐]             │
│                             │
│  ┌─────────────────────┐   │
│  │    Enter App        │   │
│  └─────────────────────┘   │
│                             │
│  [Logout] (if logged in)    │
│                             │
└─────────────────────────────┘
```

### Main App Nav (With Avatar)

```
┌─────────────────────────────┐
│  Chinese Review Game        │
│                             │
│  ┌─────────────────────┐   │
│  │ Menu                │   │
│  │ Navigate...         │   │
│  │                     │   │
│  │      [Avatar]       │   │ ← Avatar centered
│  │   [Logout Button]   │   │ ← Logout in menu
│  │                     │   │
│  │ Add | All | Review  │   │
│  │ Admin | Results     │   │
│  └─────────────────────┘   │
│                             │
│  [Main content area]        │
│                             │
└─────────────────────────────┘
```

---

## Layer Impact

### UI Layer (`src/app/login/...`)

**New components:**

1. **`LoginPage.tsx`** (entry component)
   - Route: `/login`
   - Props: `vm: WordsWorkspaceVM` (for locale context)
   - Logic: Detect first-visit vs. returning user; conditionally render setup wizard vs. login form
   - On successful submission, create session token and redirect to `/words`

2. **`LoginForm.tsx` (or combined in LoginPage)**
   - PIN entry input (masked dots)
   - Avatar selection grid (10 emoji options)
   - Submit button
   - Error message for incorrect PIN

3. **`login.types.ts`**
   - `LoginSession` — `{ sessionToken: string; selectedAvatarId: number; createdAt: number }`
   - `AvatarOption` — `{ id: number; emoji: string; label: string }`

4. **`login.strings.ts`**
   - Setup wizard strings (EN + ZH): "Enter 4-digit PIN", "Choose your avatar", "Enter App", etc.
   - Login strings: "Enter your PIN", "Incorrect PIN", "Try again", etc.

5. **Root layout update** (`src/app/layout.tsx` or new auth wrapper)
   - Check for valid session token on mount
   - If missing/invalid, redirect to `/login`
   - Pass `selectedAvatarId` to nav/header component for display

6. **Nav/Header update** (`src/app/words/shell/...` or similar)
   - Display selected avatar emoji + simple label (e.g., "⭐ Nora")
   - Add logout link to nav or user menu

### Service Layer (`src/lib/auth.ts` — new module)

**New functions:**

1. **`hashPin(pin: string): Promise<string>`**
   - Hash 4-digit PIN using SHA-256 (crypto.subtle)
   - Returns hex-encoded hash

2. **`verifyPin(pin: string, storedHash: string): Promise<boolean>`**
   - Hash input PIN, compare to stored hash
   - Returns true if match

3. **`createSessionToken(): string`**
   - Generate opaque session token (e.g., `sessionToken_${Date.now()}_${randomString(12)}`)
   - Return token

4. **`getSessionData(): LoginSession | null`**
   - Read session token + avatar ID from localStorage
   - Return session object or null if invalid

5. **`setSessionData(token: string, avatarId: number): void`**
   - Store session token + avatar ID in localStorage

6. **`clearSessionData(): void`**
   - Remove session token + PIN hash + avatar from localStorage

7. **`getPinHash(): string | null`**
   - Read stored PIN hash from localStorage (if exists)

8. **`setPinHash(hash: string): void`**
   - Store PIN hash in localStorage

### Domain Layer

No changes — login is purely service/UI concern.

### AI Layer

No changes.

---

## localStorage Schema

```typescript
// Session token (transient; cleared on logout or cache clear)
localStorage.setItem('sessionToken', 'sessionToken_1709552400000_x7k9a2m3');
localStorage.setItem('selectedAvatarId', '2'); // 0–9

// PIN hash (persistent; cleared on logout)
localStorage.setItem('storedPinHash', 'a8f9e3c2d1b5f6a7...'); // SHA-256 hex

// Optional: Last selected avatar (for UX; pre-populate dropdown on next login)
localStorage.setItem('lastSelectedAvatarId', '2');
```

---

## Edge Cases

1. **PIN forgotten**
   - User enters wrong PIN 3 times in a row
   - Display error: "Incorrect PIN. If you forgot your PIN, clear your browser cache and set a new one."
   - No lockout; user can retry

2. **localStorage is cleared by browser or user**
   - Session token gone → redirect to `/login`
   - PIN hash gone → /login shows setup wizard
   - User can create a new 4-digit PIN

3. **Invalid session token on return**
   - Token malformed or missing → treat as no session
   - Redirect to `/login`

4. **User changes avatar mid-session**
   - Logout and log in again, select new avatar
   - Avatar persists in `lastSelectedAvatarId` for next login (UX convenience)

5. **Multiple browser tabs**
   - Each tab maintains independent session token in localStorage
   - Logout in one tab clears localStorage → other tabs lose session on next action
   - Expected behavior; no special handling

6. **PIN entry on mobile**
   - Large input field for touch; numeric keyboard (inputmode="numeric")
   - Masked input for privacy

---

## Risks

1. **4-digit PIN is weak** (10k combinations)
   - Mitigation: This is early-feedback deployment, not production. Nora's iPad will be physically protected. If feedback warrants stronger auth, Phase 2 will add password or biometric.
   - Risk level: Low (local device only, no cloud sync)

2. **localStorage can be inspected in DevTools/browser console**
   - Mitigation: PIN is hashed (not plaintext); session token is opaque. Hash is difficult to reverse, but determined attacker can brute-force 10k PINs in seconds.
   - Risk level: Low (Nora's trusted environment; not internet-facing auth)
   - Recommendation: Document warning in README that this is not production-grade security

3. **No session expiration**
   - If Nora's iPad is left unlocked and unattended, anyone with device access can use the app
   - Mitigation: Phase 2 can add idle timeout (e.g., log out after 30 min of inactivity) if feedback warrants
   - Risk level: Medium (child's learning data at risk)
   - Recommendation: Warn Nora or parent to log out after use; consider adding logout reminder

4. **localStorage shared across all origins on same domain** (if Vercel subdomain)
   - Other apps on subdomain could theoretically access localStorage
   - Mitigation: Vercel domain will be separate; no other apps. Not a practical risk.

5. **No recovery mechanism**
   - Forgetting PIN or clearing cache means losing all app data (words, progress, session)
   - Mitigation: Educate Nora/parent to not clear cache; PIN setup is one-time (remember it)
   - Risk level: Medium (data loss potential)
   - Recommendation: Display helpful message on setup: "Remember your 4-digit PIN — you'll need it next time"

---

## Test Plan

### Manual Testing

1. **First-visit setup**
   - Clear localStorage
   - Open app
   - Verify redirected to `/login` with setup wizard
   - Enter PIN: 1234
   - Select avatar: ⭐
   - Submit
   - Verify redirected to `/words`
   - Verify ⭐ displayed in nav
   - Verify localStorage contains: `storedPinHash`, `sessionToken`, `selectedAvatarId`

2. **Subsequent login**
   - Refresh page
   - Verify NOT redirected (session token valid)
   - Verify avatar still displayed
   - Navigate to different page in app; verify session persists

3. **Login after token cleared**
   - Clear localStorage manually (DevTools)
   - Refresh page
   - Verify redirected to `/login` login form (not setup wizard)
   - Enter correct PIN: 1234
   - Select new avatar: 🚀
   - Submit
   - Verify redirected to `/words`
   - Verify 🚀 displayed in nav

4. **Incorrect PIN**
   - Refresh page
   - Clear session token from localStorage (keep PIN hash)
   - Redirect to `/login` login form
   - Enter wrong PIN: 9999
   - Submit
   - Verify error message: "Incorrect PIN"
   - Avatar grid does NOT appear until correct PIN entered
   - Try correct PIN: 1234
   - Verify avatar grid appears and submission succeeds

5. **Logout**
   - Click logout link in nav
   - Verify redirected to `/login`
   - Verify localStorage cleared (no session token, PIN hash, avatar)
   - Verify /login shows setup wizard

6. **Avatar persistence**
   - Login with avatar ⭐
   - Logout
   - Login again (logs back in, re-enter PIN)
   - Verify last-selected avatar (⭐) is pre-populated in grid (nice-to-have UX)
   - Select different avatar: 🎮
   - Verify 🎮 displayed in nav
   - Logout and login again
   - Verify 🎮 is pre-populated (persisted)

7. **Mobile/iPad responsiveness**
   - Test on iPad (or mobile simulator)
   - Verify PIN input is large and touch-friendly
   - Verify avatar grid is readable and selectable on small screen
   - Verify nav displays avatar emoji clearly

8. **Bilingual support**
   - Switch app locale to Simplified Chinese (if locale switch exists)
   - Verify all login strings are in Chinese
   - Try login flow in both languages

9. **Session across browser restart**
   - Login with PIN
   - Close browser completely
   - Reopen browser
   - Navigate to app URL
   - Verify session is still active (no redirect to /login)
   - Verify avatar displayed

10. **DevTools inspection**
   - Open DevTools
   - Inspect localStorage
   - Verify PIN is NOT stored as plaintext (should be hash)
   - Verify session token is present

### Automated Testing

1. **Types file**: `login.types.test.ts`
   - Verify `LoginSession` object construction
   - Verify `AvatarOption` shape

2. **Auth functions**: `src/lib/auth.test.ts`
   - `hashPin('1234')` produces consistent hex hash
   - `verifyPin('1234', hash)` returns true for correct PIN and false for wrong
   - `createSessionToken()` produces unique non-empty string
   - `getSessionData()` returns null when localStorage is empty
   - `setSessionData()` stores and retrieves values correctly

---

## Acceptance Criteria

- [ ] New page **`/login` accessible** at app startup if no session token
- [ ] **Setup wizard displays** on first visit (no stored PIN in localStorage)
- [ ] **PIN entry accepts 4 digits** (0–9 only, reject non-numeric input)
- [ ] **PIN input is masked** with dots/asterisks as user types
- [ ] **10 avatar options display** as emoji grid with labels
- [ ] **Avatar selection persists** — last-selected avatar pre-populated on next login (nice-to-have)
- [ ] **PIN is hashed with SHA-256** before storage (not plaintext)
- [ ] **Login form displays** on subsequent visits (not setup wizard)
- [ ] **Incorrect PIN shows error** and prevents proceed until correct PIN entered
- [ ] **Correct PIN unlocks avatar selection grid**
- [ ] **Session token created and stored** in localStorage on successful login
- [ ] **Session token checked on app startup** in root layout
- [ ] **Valid session token allows access** to `/words` without redirect
- [ ] **Invalid/missing session token redirects** to `/login`
- [ ] **Avatar image displayed in menu section** (centered, above navigation links)
- [ ] **Logout button displayed in menu section** (centered, below avatar image)
- [ ] **Logout link clears all auth data** and redirects to `/login`
- [ ] **After logout, /login shows setup wizard** (because PIN is cleared)
- [ ] **localStorage schema correct:** `sessionToken`, `selectedAvatarId`, `storedPinHash`
- [ ] **All login strings bilingual** (EN + ZH in `login.strings.ts`)
- [ ] **Login page mobile-optimized** (large touch targets, responsive layout)
- [ ] **No console errors** on login/logout/session check
- [ ] **Session persists across page refresh** and browser restarts (until logout or cache clear)

---

## Open Questions

1. **Avatar emoji set finalized?**
   - Decision: Use 10 emoji set above (⭐ 🌙 🎨 🎭 🎪 🎸 🎮 🏃 🚀 🦄)
   - Alternative: Allow customization or emoji picker (deferred)

2. **PIN retry limits?**
   - Decision: No hard limit; user can retry unlimited times
   - Justification: Weak PIN, trusted environment; soft lockout not needed

3. **Session expiration?**
   - Decision: No expiration in Phase 1
   - Justification: Early feedback; add based on usage patterns
   - Phase 2: Consider 30-min idle timeout if feedback warrants

4. **Name/identifier for Nora?**
   - Decision: Hard-code "Nora" in nav for now (simple)
   - Alternative: Let parent set a name on setup (future)

5. **Logout location in nav?**
   - Decision: Logout button centered in menu section (menu bar), below avatar
   - Rationale: Keeps user profile area (avatar + logout) grouped together in sidebar menu
   - Finalized in implementation: Avatar and logout button displayed together in menu section, centered

---

## Related Documents

- [0_ARCHITECTURE.md](../architecture/0_ARCHITECTURE.md) — Layer boundaries, no changes needed
- [0_PRODUCT_ROADMAP.md](../architecture/0_PRODUCT_ROADMAP.md) — Authentication explicitly deferred; this is early-feedback exception
- [0_BUILD_CONVENTIONS.md](../architecture/0_BUILD_CONVENTIONS.md) — Bilingual strings, type organization
