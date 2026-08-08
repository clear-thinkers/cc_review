# Feature Spec — 2026-08-08 — Session-Scoped Profile Claims

## Problem

HanziQuest's two-layer auth model has one Supabase Auth account (Layer 1)
shared by an entire family; a Layer 2 PIN unlocks a specific profile
(parent/child) on top of it. `/api/auth/pin-verify` currently enriches the
active profile's `family_id`/`user_id`/`role`/`is_platform_admin` by writing
them into `app_metadata` on the shared `auth.users` row via
`admin.updateUserById()`, then the client calls `refreshSession()` to pull a
fresh JWT carrying those claims.

Because Supabase supports multiple concurrent sessions per Auth account (a
parent's device and a child's device signing in with the same family
email/password each get their own distinct Auth session), but `app_metadata`
is a single value on the shared `auth.users` row, a Layer 2 profile switch on
*any* device overwrites the claims every *other* device will receive on its
next token refresh — with no signal to either device that this happened.

Confirmed incident: a parent did PIN entry as herself on her own device while
her child's device was mid-fill-test-session on the child's profile. The
child's device kept displaying the child's name/avatar (that's local React
state, unaffected), but its next background token auto-refresh (tokens
expire hourly — `jwt_expiry = 3600` in `supabase/config.toml`) pulled a fresh
JWT carrying the *parent's* claims. From that point, every write the child's
device made (grading, quiz completion, coin awards) was silently attributed
to the parent. See `docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md`
for two real incidents this caused, both requiring manual data repair.

## Scope

Replace the shared-`app_metadata` claims mechanism with a per-Auth-session
mechanism, so a profile switch on one device can never affect another
device's active session, including across background token refreshes.

## Out of scope

- Any UI warning/confirmation before switching profiles (a different,
  smaller mitigation considered and explicitly not chosen this round — see
  the conversation this spec originates from).
- Retroactively repairing further already-misattributed rows — those are
  handled per-incident via the existing repair-script pattern
  (`0_BUILD_CONVENTIONS.md §10`), not by this spec.
- Changing the two-layer model itself (one Auth account per family, PIN
  picks the active profile) — only *where the active profile is stored* and
  *how it reaches the JWT* changes.

## Proposed behavior

**New table `auth_session_profiles`** — one row per Supabase Auth session,
not per family:

| Field | Type | Notes |
|---|---|---|
| `session_id` | uuid, PK | `auth.sessions.id` — stable for the life of that specific login (survives token refresh, which is the property this depends on), unique per device/browser sign-in even under the same shared Layer-1 account |
| `auth_user_id` | uuid | FK → `auth.users.id`; the shared Layer-1 identity, kept for cascade/audit |
| `family_id` | uuid | FK → `families.id` |
| `user_id` | uuid | FK → `users.id`; the active app-level profile |
| `role` | text | `'parent'` or `'child'`, mirrors `users.role` at enrichment time |
| `is_platform_admin` | boolean | mirrors `users.is_platform_admin` at enrichment time |
| `created_at` / `updated_at` | timestamptz | |

RLS enabled, **no policies for `authenticated`/`anon`** (default deny) — only
`service_role` (used server-side by the API routes below) and
`supabase_auth_admin` (used by the hook function, via an explicit `select`
policy) can read/write it. `session_id references auth.sessions(id) on
delete cascade` means the row is automatically cleaned up when Supabase Auth
invalidates that session.

**New Postgres function `custom_access_token_hook(event jsonb) returns
jsonb`**, registered as a Supabase Auth "Custom Access Token" hook. Runs on
every token mint/refresh for every session. Reads `event->'claims'->>'session_id'`
(part of GoTrue's standard draft-claims payload passed into the hook),
looks it up in `auth_session_profiles`, and — if found — sets
`claims.app_metadata.family_id/user_id/role/is_platform_admin` to that row's
values before returning the claims. If no row is found (Layer 2 not yet
completed for this session), claims pass through unchanged, matching today's
"no `family_id` → redirect to `/profile-select`" behavior in `AuthProvider`.

Critically, this reproduces the **exact same JWT claim shape**
(`app_metadata.family_id` / `.user_id` / `.role` / `.is_platform_admin`) the
four RLS helper functions already read
(`supabase/migrations/20260311000001_fix_function_search_path_mutable.sql`):
`current_family_id()`, `current_user_id()`, `current_jwt_role()`,
`is_platform_admin()`. **None of those functions change.** Only where the
claims are *sourced from* changes — per-session instead of per-family.

**`/api/auth/pin-verify` changes:** after PIN match, instead of
`admin.updateUserById({ app_metadata: {...} })`, decode the caller's own
verified access token (already validated moments earlier via
`supabase.auth.getUser(token)` in the same handler) to extract its
`session_id` claim, then upsert (`session_id` as conflict target) into
`auth_session_profiles`. The existing client-side `refreshSession()` call
right after (`pin-entry/page.tsx`) is unchanged — it now picks up the new
per-session claims via the hook instead of the old shared `app_metadata`.

**`/api/auth/update-avatar` changes:** currently resolves the active
profile's `user_id` by calling `supabase.auth.getUser(token)` and reading
`user.app_metadata` — that call does a *live* read of `auth.users`, which
this spec makes permanently stale (we stop writing to it). Fix: decode the
same already-verified token's own embedded `app_metadata.user_id` claim
instead (now correctly hook-injected per session) rather than doing a fresh
`auth.users` lookup.

**Removed:** the `admin.updateUserById({ app_metadata })` write in
pin-verify. `auth.users.app_metadata` becomes inert going forward (no new
writes); existing stale values are harmless since nothing will read them
once the hook and the two route changes above ship together.

## Layer impact

- **AI/API layer** (`src/app/api/auth/pin-verify/route.ts`,
  `src/app/api/auth/update-avatar/route.ts`): claims source changes; no
  change to their external request/response contracts.
- **Service layer**: none — `getSessionMetadata()` in `supabase-service.ts`
  keeps reading `session.user.app_metadata` from the *client's own current
  session object* (populated from the JWT the client already holds), which
  is correct either way since that JWT now carries the right per-session
  claims post-hook.
- **Database**: new table + new function + Supabase Auth Hook registration
  (`supabase/config.toml`). No existing table's schema changes. No existing
  RLS policy changes — the four helper functions RLS policies depend on are
  unchanged in behavior, just re-sourced.
- **UI layer**: no changes.

## Edge cases

- **First token mint before any PIN entry** (fresh Layer 1 login, no
  `auth_session_profiles` row yet for that session): hook finds nothing,
  claims pass through unchanged (no `app_metadata.family_id`) — same as
  today's brief window before Layer 2 completes.
- **Session_id stability across `refreshSession()`**: this design assumes
  Supabase's `session_id` claim is stable across token refreshes within one
  login (only a fresh `signInWithPassword()` mints a new one). This is
  standard GoTrue behavior but will be verified empirically against the
  linked dev project before this ships (see Test plan).
- **Switching profiles without signing out** (`switchProfile()` in
  `authContext.tsx` — clears local React state only, no server call): the
  `auth_session_profiles` row for that session still holds the *previous*
  profile until the next successful PIN entry overwrites it via upsert. A
  token refresh in that in-between window would still carry the old
  profile's claims — this matches today's existing behavior (no regression)
  and is bounded by the fact no protected UI is reachable without a
  completed profile session.
- **Row accumulation**: `auth_session_profiles` rows for abandoned/expired
  sessions are cleaned up automatically via `on delete cascade` from
  `auth.sessions` whenever Supabase Auth's own session cleanup or explicit
  sign-out removes the underlying session row. No separate cleanup job is
  planned for this spec; can be revisited if row count becomes a concern.
- **Hosted-project hook registration**: for the linked dev/prod Supabase
  projects, Custom Access Token Hooks may require enabling via the Supabase
  Dashboard (Authentication → Hooks) in addition to the `supabase/config.toml`
  entry, similar to the existing manual `supabase login` / RLS-verification
  steps already documented in `0_BUILD_CONVENTIONS.md §9`. This is called
  out explicitly as a manual deployment step, not something the migration
  alone can guarantee.

## Risks

- If the hook function has a bug and throws, **all token refreshes for the
  entire project fail** (Custom Access Token Hooks are on the critical path
  for every session). The hook function must be defensive: any lookup miss
  or unexpected shape returns claims unchanged rather than raising.
- Misconfiguring the hook registration (wrong function name/schema in
  `config.toml`, or forgetting the dashboard toggle on the hosted project)
  would silently leave the vulnerability exactly as it is today — this spec
  is only effective once actually enabled end-to-end, so verification (Test
  plan) must confirm the hook is actually firing, not just that the
  migration applied cleanly.

## Test plan

- Unit test: `custom_access_token_hook` grant/lookup SQL logic isn't
  practically unit-testable via `vitest` — verify via a live script against
  the linked **dev** project (new script or an extension of
  `scripts/verify-rls.ts`, per the existing live-verification precedent in
  this repo): sign in as two independent Auth sessions for the same family
  (simulating two devices), PIN-switch each to a *different* profile,
  confirm each session's `refreshSession()` yields claims scoped to its own
  profile and unaffected by the other session's switch.
- Integration test (mocked Supabase client): `pin-verify` route test
  confirming it upserts `auth_session_profiles` instead of calling
  `admin.updateUserById`; `update-avatar` route test confirming it resolves
  `user_id` from the decoded token instead of `getUser().app_metadata`.
- Manual verification on dev: reproduce the original bug scenario (two
  browser sessions, switch profile on one, force a token refresh on the
  other, e.g. via a short `jwt_expiry` in dev config) and confirm the second
  session's claims are unaffected.
- Regression: full existing test suite (`npm test`) and `npm run
  check:encoding` must still pass.

## Acceptance criteria

- A profile switch (PIN entry) on one Auth session never changes the
  `app_metadata` claims another concurrently active Auth session receives on
  its next token refresh, verified live against dev.
- All four RLS helper functions (`current_family_id`, `current_user_id`,
  `current_jwt_role`, `is_platform_admin`) are unchanged and all existing
  RLS-dependent tests/behavior continue to pass unmodified.
- `pin-verify` and `update-avatar` routes pass their updated tests.
- Full `npm test` suite green; `npm run check:encoding` green.
- Migration applied to dev and verified per Test plan before any prod
  deployment (per `0_BUILD_CONVENTIONS.md §9` — dry-run/review before
  `db:push:prod`).

## Open questions

- Should `auth.users.app_metadata` be explicitly cleared as part of this
  migration (cosmetic cleanup) or left inert? Leaning toward leaving it
  alone — clearing it is a service-role admin operation with no functional
  benefit and a small chance of surprising anything unaccounted for that
  might still read it directly (audit turned up none in `src/`, but this
  isn't a hard guarantee for hooks/config we don't control).
- Whether the hosted Supabase project (dev and prod) needs a Dashboard-side
  toggle in addition to `config.toml` — needs confirmation during
  deployment; flagged in Edge cases above.
