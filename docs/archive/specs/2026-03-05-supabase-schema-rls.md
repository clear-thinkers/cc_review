# Feature Spec — 2026-03-05 — Supabase Schema & RLS Policies

_Status: Draft — Awaiting human review before implementation_

---

## Problem

The app currently stores all data in IndexedDB (client-side, device-local). This blocks:
- Multi-user access (parent + child share Nora's data)
- Multi-family pilot (3 families onboarding)
- Public launch (multi-tenant SaaS)
- Data durability (cache clear wipes all learning history)

All data must move to a server-hosted Postgres database (Supabase). IndexedDB is retired entirely.

---

## Scope

- Define the full Supabase Postgres schema (tables, fields, types, constraints)
- Define Row Level Security (RLS) policies for all tables
- Define the platform admin bypass pattern
- Establish foreign key relationships and indexing strategy
- Cover all tables currently in IndexedDB: `words`, `flashcardContents`, `quizSessions`, `wallets`
- Add new tables required by multi-tenant auth: `families`, `users`

---

## Out of Scope

- Auth flow implementation (covered in `2026-03-05-auth-and-user-model.md`)
- Role-based routing (covered in `2026-03-05-role-based-routing.md`)
- Data migration from existing IndexedDB (not needed — pilot families start fresh)
- Content packs / curated word bank tables (deferred post-pilot)
- Any application-layer code changes (this spec covers DB only)

---

## Proposed Schema

### Table: `families`

One row per tenant (one family = one tenant).

```sql
create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
```

---

### Table: `users`

All human users — both parents (Supabase Auth) and children (PIN-only).

```sql
create table users (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id) on delete cascade,
  auth_user_id        uuid references auth.users(id) on delete set null,
    -- ^ non-null for parent accounts (linked to Supabase Auth)
    -- ^ null for child accounts (PIN-only, no Supabase Auth account)
  name                text not null,
  role                text not null check (role in ('parent', 'child')),
  pin_hash            text,
    -- ^ null for parent (uses Supabase Auth password instead)
    -- ^ required for child accounts
  is_platform_admin     boolean not null default false,
    -- ^ true only for Chengyuan's account; bypasses all RLS
  failed_pin_attempts   integer not null default 0,
    -- ^ incremented server-side on each wrong PIN entry
    -- ^ reset to 0 on successful PIN entry
    -- ^ application layer locks PIN entry UI at 5; parent must re-auth to reset
  avatar_id             text,
    -- ^ filename stem of chosen avatar e.g. 'bubble_tea_excited_1'
    -- ^ resolves to /public/avatar/{avatar_id}.png in the UI
    -- ^ set during registration (parent) or child profile creation
  created_at            timestamptz not null default now()
);
```

**Constraints:**
- `auth_user_id` must be non-null when `role = 'parent'` — enforced at application layer on registration
- `pin_hash` must be non-null when `role = 'child'` — enforced at application layer on child profile creation
- `avatar_id` must be one of the 8 valid filename stems — enforced at application layer; valid set: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1`

**Index:**
```sql
create index users_family_id_idx on users(family_id);
create unique index users_auth_user_id_idx on users(auth_user_id) where auth_user_id is not null;
```

---

### Table: `words`

One row per Hanzi character, scoped to a family. Direct migration of IndexedDB `words` table.

```sql
create table words (
  id              text primary key,
    -- ^ preserves existing makeId() pattern
  family_id       uuid not null references families(id) on delete cascade,
  hanzi           text not null,
  pinyin          text,
  meaning         text,
  created_at      timestamptz not null default now(),
  repetitions     integer not null default 0,
  interval_days   numeric not null default 0,
  ease            numeric not null default 21,
  next_review_at  bigint not null default 0,
    -- ^ Unix timestamp in milliseconds; 0 = immediately due (preserves scheduler contract)
  review_count    integer not null default 0,
  test_count      integer not null default 0,
  fill_test       jsonb
    -- ^ nullable; populated only after Content Admin curation
    -- ^ stores FillTest object as-is from current schema
);
```

**Index:**
```sql
create index words_family_id_idx on words(family_id);
create unique index words_family_hanzi_idx on words(family_id, hanzi);
  -- ^ enforces no duplicate hanzi per family (replaces app-layer check-then-add)
```

**Note on field naming:** Current IndexedDB uses camelCase (`intervalDays`, `nextReviewAt`). Postgres columns use snake_case per convention. The application service layer translates between the two. See Layer Impact.

---

### Table: `flashcard_contents`

Curated content per character+pronunciation pair, scoped to a family.

```sql
create table flashcard_contents (
  id          text not null,
    -- ^ composite key: "{character}|{pronunciation}"
  family_id   uuid not null references families(id) on delete cascade,
  meanings    jsonb not null default '[]',
    -- ^ string[]
  phrases     jsonb not null default '[]',
    -- ^ Phrase[]: { zh, pinyin, en, include_in_fill_test }
  examples    jsonb not null default '[]',
    -- ^ Example[]: { zh, pinyin, en, include_in_fill_test }
  updated_at  timestamptz not null default now(),
  primary key (id, family_id)
);
```

**Index:**
```sql
create index flashcard_contents_family_id_idx on flashcard_contents(family_id);
```

---

### Table: `quiz_sessions`

Completed fill-test session records, scoped to a user.

```sql
create table quiz_sessions (
  id                       text primary key,
  user_id                  uuid not null references users(id) on delete cascade,
  family_id                uuid not null references families(id) on delete cascade,
    -- ^ denormalized for RLS policy efficiency
  created_at               timestamptz not null default now(),
  session_type             text not null default 'fill-test',
  grade_data               jsonb not null default '[]',
    -- ^ SessionGradeData[]: { wordId, hanzi, grade, timestamp }
  fully_correct_count      integer not null default 0,
  failed_count             integer not null default 0,
  partially_correct_count  integer not null default 0,
  total_grades             integer not null default 0,
  duration_seconds         integer not null default 0,
  coins_earned             integer not null default 0
);
```

**Index:**
```sql
create index quiz_sessions_user_id_idx on quiz_sessions(user_id);
create index quiz_sessions_family_id_idx on quiz_sessions(family_id);
```

---

### Table: `wallets`

Cumulative coin balance, one row per user (singleton per user, not per family).

```sql
create table wallets (
  user_id         uuid primary key references users(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
    -- ^ denormalized for RLS policy efficiency
  total_coins     integer not null default 0,
  last_updated_at timestamptz not null default now(),
  version         integer not null default 1
);
```

**Note:** Current IndexedDB wallet uses a singleton with fixed `id = "wallet"`. In Postgres the natural key is `user_id`. Application layer adapts accordingly.

---

## Row Level Security Policies

### Design Principles

1. RLS is enabled on every table — no table is left unprotected.
2. All policies resolve `family_id` from the session JWT claim `app.family_id` (set at login via Supabase custom claims or a session context function).
3. Platform admin (`is_platform_admin = true`) bypasses RLS on all tables via a superuser role or a permissive bypass policy.
4. Child users have a Supabase session created by the parent on their behalf (see auth spec). Their JWT carries `family_id` and `user_id`.
5. Policies are `PERMISSIVE` by default; all tables start with deny-all, then add explicit allow policies.

---

### Helper Function

```sql
-- Returns the family_id claim from the current session JWT
create or replace function current_family_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'family_id',
    ''
  )::uuid
$$;

-- Returns the user_id claim from the current session JWT
create or replace function current_user_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'user_id',
    ''
  )::uuid
$$;

-- Returns true if current user is platform admin
create or replace function is_platform_admin()
returns boolean
language sql stable
as $$
  select exists (
    select 1 from users
    where id = current_user_id()
    and is_platform_admin = true
  )
$$;
```

---

### RLS: `families`

```sql
alter table families enable row level security;

-- Members of a family can read their own family row
create policy "families: family members can read own family"
on families for select
using (
  is_platform_admin()
  or id = current_family_id()
);

-- Only platform admin can insert/update/delete families
create policy "families: platform admin full access"
on families for all
using (is_platform_admin());
```

---

### RLS: `users`

```sql
alter table users enable row level security;

-- Family members can read users in their own family
create policy "users: family members can read own family users"
on users for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- Parent can insert child users within their family
-- (application layer enforces role=parent check before calling insert)
create policy "users: parent can insert child users"
on users for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

-- Users can update their own record; parent can update child records in family
create policy "users: update own family users"
on users for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- Only platform admin can delete users
create policy "users: platform admin can delete"
on users for delete
using (is_platform_admin());
```

---

### RLS: `words`

```sql
alter table words enable row level security;

create policy "words: family scoped read"
on words for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "words: family scoped write"
on words for insert
with check (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "words: family scoped update"
on words for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "words: family scoped delete"
on words for delete
using (
  is_platform_admin()
  or family_id = current_family_id()
);
```

---

### RLS: `flashcard_contents`

```sql
alter table flashcard_contents enable row level security;

-- Same family-scoped pattern as words
create policy "flashcard_contents: family scoped read"
on flashcard_contents for select
using (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped write"
on flashcard_contents for insert
with check (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped update"
on flashcard_contents for update
using (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped delete"
on flashcard_contents for delete
using (is_platform_admin() or family_id = current_family_id());
```

---

### RLS: `quiz_sessions`

```sql
alter table quiz_sessions enable row level security;

-- Any family member can read all sessions within the family
-- (parent monitors child's results; child sees own results)
create policy "quiz_sessions: family scoped read"
on quiz_sessions for select
using (is_platform_admin() or family_id = current_family_id());

-- Only the user themselves can insert their own session
create policy "quiz_sessions: user can insert own session"
on quiz_sessions for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

-- No updates or deletes on quiz sessions (immutable audit record)
-- Platform admin can delete for data management purposes only
create policy "quiz_sessions: platform admin delete"
on quiz_sessions for delete
using (is_platform_admin());
```

---

### RLS: `wallets`

```sql
alter table wallets enable row level security;

-- Any family member can read all wallets in the family
create policy "wallets: family scoped read"
on wallets for select
using (is_platform_admin() or family_id = current_family_id());

-- User can insert/update their own wallet
create policy "wallets: user can write own wallet"
on wallets for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

create policy "wallets: user can update own wallet"
on wallets for update
using (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);
```

---

## Layer Impact

### Service Layer (`src/lib/db.ts` → `src/lib/supabase.ts`)

- `src/lib/db.ts` (IndexedDB/Dexie) is retired and replaced by `src/lib/supabase.ts`
- All existing service function signatures are preserved — only the internal implementation changes
- The new service layer translates between camelCase (TypeScript) and snake_case (Postgres) on read/write
- `src/lib/supabaseClient.ts` — singleton Supabase client initialization

### Domain Layer (`src/lib/scheduler.ts`)

- No changes. Scheduler remains a pure function. The service layer feeds it the same data shape.

### UI Layer

- No changes in this spec. UI continues calling the same service functions.
- Session/auth context (family_id, user_id, role) is injected via a React context provider (auth spec).

### API Routes (`src/app/api/...`)

- API routes replace any direct Dexie calls with Supabase client calls
- Must pass the user's JWT to Supabase so RLS policies evaluate correctly
- Server-side Supabase calls use the `supabaseServiceRole` client only for platform admin operations

---

## Edge Cases

1. **Duplicate hanzi insert:** The unique index `words_family_hanzi_idx` rejects duplicates at DB level. Application layer must handle the Postgres unique violation error gracefully (same bilingual status message behavior as today).
2. **Child wallet creation:** Wallet row is created on first quiz session completion, not at child profile creation. Application layer checks for existence before insert.
3. **Platform admin JWT:** `is_platform_admin()` queries the `users` table on every RLS evaluation. If performance is a concern, add a JWT claim `is_platform_admin: true` and read from JWT instead. Defer optimization until needed.
4. **Session JWT claims:** Supabase does not automatically add `family_id` and `user_id` to JWT. A Postgres function or Edge Function hook must inject these claims after login. This is the auth spec's responsibility — this spec only defines the helpers that consume them.
5. **`fill_test` JSONB field:** Stored as raw JSON. Application layer validates shape on read before passing to scheduler. Malformed rows are treated as `fill_test: undefined` (same behavior as today).

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| RLS misconfiguration allows cross-family data read | High | Integration test: log in as Family A, assert Family B words return empty |
| JWT claim injection not implemented before schema ships | High | Auth spec must be implemented before any data layer code runs |
| `is_platform_admin()` function querying users table adds latency | Low | Defer optimization; monitor after pilot launch |
| JSONB shape drift on `fill_test`, `grade_data` | Medium | Add Zod validation in service layer on read |

---

## Test Plan

1. **RLS isolation test:** Create two families. Insert words for Family A. Log in as Family B user. Assert `select * from words` returns zero rows.
2. **Platform admin bypass test:** Log in as platform admin. Assert all family rows visible.
3. **Child cannot write words:** Log in as child user. Assert insert to `words` with correct `family_id` succeeds. Assert insert with wrong `family_id` is rejected.
4. **Quiz session immutability:** Insert a quiz session. Assert update is rejected by RLS. Assert delete is rejected by RLS.
5. **Duplicate hanzi constraint:** Insert same hanzi twice for same family. Assert second insert fails with unique constraint violation.
6. **Wallet upsert:** Child completes first quiz. Assert wallet row created. Child completes second quiz. Assert `total_coins` increments correctly.

---

## Acceptance Criteria

- [ ] All 6 tables created in Supabase with correct fields, types, and constraints
- [ ] RLS enabled on all 6 tables
- [ ] All RLS policies deployed and named per convention above
- [ ] Helper functions `current_family_id()`, `current_user_id()`, `is_platform_admin()` deployed
- [ ] Unique index on `words(family_id, hanzi)` enforces no duplicate characters per family
- [ ] Platform admin account (`is_platform_admin = true`) can read all families' data
- [ ] Family A user cannot read Family B's words, sessions, or wallet (RLS isolation test passing)
- [ ] Quiz sessions are insert-only (no update/delete for non-admin)
- [ ] All JSONB fields (`fill_test`, `meanings`, `phrases`, `examples`, `grade_data`) accept correct shape without error
- [ ] Schema SQL is committed to `/supabase/migrations/` as a versioned migration file

---

## Decisions Closed

1. **JWT claim injection method:** ✅ Option B — Next.js API route `/api/auth/pin-verify` handles server-side PIN verification and returns enriched session to client. No Supabase Auth Hook required.
2. **One email per family:** ✅ Confirmed. One Supabase Auth account per family. Multi-parent deferred.
3. **Child PIN security:** ✅ Two-layer model. Layer 1 is email + password (Supabase Auth). PIN is profile switcher only, verified server-side.
4. **Avatar assets:** ✅ 8 PNG files. `avatar_id` stored as filename stem in `users.avatar_id`. Valid values documented in Constraints above.
5. **PIN lockout:** ✅ Server-side. `failed_pin_attempts` column on `users` table. Locks at 5, reset on success.

## Open Questions

1. **Supabase project environment:** One project for dev + prod, or separate projects? Recommend separate (dev/prod) before public launch.
2. **`next_review_at` type:** Currently stored as Unix milliseconds (bigint). Confirm scheduler contract does not need to change when reading from Postgres vs. IndexedDB.
