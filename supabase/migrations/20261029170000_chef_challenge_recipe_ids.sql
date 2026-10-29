-- Which recipes have chef-challenge questions (roadmap item T follow-up, authorized 2026-10-29).
-- Spec: docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md
--
-- The kitchen's Recipe Book marks recipes where the child can actually meet Chef
-- Shrewy's challenge: an interactive kitchen scene (decided in app code) AND at least one
-- active question (decided here). Children can't read chef_challenge_questions at all, so
-- this returns ONLY recipe ids -- no prompts, options or answers.

create or replace function chef_challenge_recipe_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when current_user_id() is null then '{}'::uuid[]
    else coalesce(
      (select array_agg(distinct recipe_id) from chef_challenge_questions where is_active),
      '{}'::uuid[]
    )
  end;
$$;

revoke execute on function chef_challenge_recipe_ids() from public, anon;
grant execute on function chef_challenge_recipe_ids() to authenticated;
