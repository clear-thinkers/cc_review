-- Supabase RLS Policies and Helper Functions
-- 2026-03-05 RLS Setup
-- Defines Row Level Security policies for all tables + helper functions

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

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
  select coalesce(
    (select is_platform_admin from users where id = current_user_id()),
    false
  )
$$;


-- ============================================================================
-- RLS POLICY: families
-- ============================================================================

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


-- ============================================================================
-- RLS POLICY: users
-- ============================================================================

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


-- ============================================================================
-- RLS POLICY: words
-- ============================================================================

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


-- ============================================================================
-- RLS POLICY: flashcard_contents
-- ============================================================================

-- Same family-scoped pattern as words
create policy "flashcard_contents: family scoped read"
on flashcard_contents for select
using (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped insert"
on flashcard_contents for insert
with check (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped update"
on flashcard_contents for update
using (is_platform_admin() or family_id = current_family_id());

create policy "flashcard_contents: family scoped delete"
on flashcard_contents for delete
using (is_platform_admin() or family_id = current_family_id());


-- ============================================================================
-- RLS POLICY: quiz_sessions
-- ============================================================================

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

-- No updates on quiz sessions (immutable audit record)
-- Platform admin can delete for data management purposes only
create policy "quiz_sessions: platform admin delete"
on quiz_sessions for delete
using (is_platform_admin());


-- ============================================================================
-- RLS POLICY: wallets
-- ============================================================================

-- Any family member can read all wallets in the family
create policy "wallets: family scoped read"
on wallets for select
using (is_platform_admin() or family_id = current_family_id());

-- User can insert/update their own wallet
create policy "wallets: user can insert own wallet"
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
