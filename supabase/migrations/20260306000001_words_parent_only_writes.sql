-- Migration: Restrict words table writes to parent role only
-- 2026-03-06
--
-- Reason: Defense-in-depth for the product rule "Child: no add/edit/admin."
-- RouteGuard blocks the /words/add and /words/admin routes at the UI layer,
-- but without an RLS restriction a child JWT could still INSERT/UPDATE/DELETE
-- words via direct Supabase client calls. This migration closes that gap.
--
-- The current_jwt_role() helper reads the role from app_metadata, which is
-- populated after Layer 2 PIN verification via the JWT enrichment patch
-- (2026-03-05-auth-jwt-enrichment-patch.md).
--
-- Read access for children is intentionally preserved: children need to read
-- words during review sessions.

-- ─── Helper ───────────────────────────────────────────────────────────────

create or replace function current_jwt_role()
returns text
language sql stable
as $$
  select current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
$$;

-- ─── words: restrict writes to parent role ────────────────────────────────

drop policy if exists "words: family scoped write" on words;
create policy "words: family scoped write"
on words for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

drop policy if exists "words: family scoped update" on words;
create policy "words: family scoped update"
on words for update
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

drop policy if exists "words: family scoped delete" on words;
create policy "words: family scoped delete"
on words for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);
