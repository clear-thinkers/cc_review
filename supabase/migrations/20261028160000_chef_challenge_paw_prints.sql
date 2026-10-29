-- Chef challenge + paw-print collectibles (roadmap item T, 2026-10-28).
-- Spec: docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md
--
-- While prepping a recipe in an interactive kitchen scene, the child can take Chef
-- Shrewy's challenge: one curated, Chinese-only question about that recipe. A correct
-- answer earns a paw print. Paw prints are spent on the Rewards page (launch reward:
-- "Shrewy washes his hands", 10 paw prints).
--
-- Security posture (same as the Shop Kitchen tables and reward offers): every table has
-- RLS and NO client insert/update/delete policy. The security-definer RPCs below are the
-- only writers, each checking the caller itself. Children cannot read the question bank
-- at all, so a correct answer never reaches their browser before they answer.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Shared question bank, curated by the platform admin in Shop Admin (via a
-- service-role API route). Every question belongs to one recipe.
create table chef_challenge_questions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references shop_recipes(id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 200),
  correct_answer text not null check (char_length(btrim(correct_answer)) between 1 and 60),
  -- 2-3 wrong options (strings); distinctness is validated by the API route.
  wrong_answers jsonb not null check (
    jsonb_typeof(wrong_answers) = 'array'
    and jsonb_array_length(wrong_answers) between 2 and 3
  ),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chef_challenge_questions_recipe_idx
  on chef_challenge_questions (recipe_id, display_order);

alter table chef_challenge_questions enable row level security;

-- Platform admin only. No policy for children or parents: they can't select it at all.
create policy "chef_challenge_questions: platform admin all"
on chef_challenge_questions for all
using (is_platform_admin())
with check (is_platform_admin());

-- One row per challenge handed to a child. `round` drives the per-child, per-recipe
-- rotation: no question repeats within a round.
create table chef_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  recipe_id uuid references shop_recipes(id) on delete set null,
  question_id uuid references chef_challenge_questions(id) on delete set null,
  round integer not null check (round >= 1),
  issued_at timestamptz not null default now(),
  answered_at timestamptz,
  chosen_answer text,
  is_correct boolean,
  check ((answered_at is null) = (is_correct is null))
);

-- At most one open (unanswered) challenge per child per recipe.
create unique index chef_challenge_attempts_one_open_idx
  on chef_challenge_attempts (user_id, recipe_id) where answered_at is null;

create index chef_challenge_attempts_rotation_idx
  on chef_challenge_attempts (user_id, recipe_id, round);

alter table chef_challenge_attempts enable row level security;

create policy "chef_challenge_attempts: family scoped read"
on chef_challenge_attempts for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- The reward catalog. Server-side so a client can never set a price. Seeded below;
-- there is no admin UI for it yet.
create table paw_print_rewards (
  reward_key text primary key,
  giver text not null check (giver in ('shrewy')),
  cost integer not null check (cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table paw_print_rewards enable row level security;

create policy "paw_print_rewards: authenticated read"
on paw_print_rewards for select
to authenticated
using (true);

insert into paw_print_rewards (reward_key, giver, cost) values ('shrewy-hand-wash', 'shrewy', 10);

-- Append-only ledger of earned paw prints. `giver` leaves room for other characters'
-- tokens later (each with its own balance).
create table paw_print_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  giver text not null check (giver in ('shrewy')),
  recipe_id uuid references shop_recipes(id) on delete set null,
  attempt_id uuid unique references chef_challenge_attempts(id) on delete set null,
  earned_at timestamptz not null default now()
);

create index paw_print_awards_user_idx on paw_print_awards (user_id, giver, earned_at);

alter table paw_print_awards enable row level security;

create policy "paw_print_awards: family scoped read"
on paw_print_awards for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- What a child has redeemed. Permanent: a reward is unlocked once, for good.
create table paw_print_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  reward_key text not null references paw_print_rewards(reward_key),
  giver text not null,
  cost integer not null check (cost > 0),
  redeemed_at timestamptz not null default now(),
  unique (user_id, reward_key)
);

alter table paw_print_redemptions enable row level security;

create policy "paw_print_redemptions: family scoped read"
on paw_print_redemptions for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- ---------------------------------------------------------------------------
-- 2. Helpers (internal; not callable by clients)
-- ---------------------------------------------------------------------------

-- Collected and available paw prints for one user and giver.
create or replace function paw_print_balance(p_user_id uuid, p_giver text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'collected', (select count(*) from paw_print_awards where user_id = p_user_id and giver = p_giver),
    'available',
      (select count(*) from paw_print_awards where user_id = p_user_id and giver = p_giver)
      - (select coalesce(sum(cost), 0) from paw_print_redemptions where user_id = p_user_id and giver = p_giver)
  );
$$;

revoke execute on function paw_print_balance(uuid, text) from public, anon, authenticated;

-- A question as the child sees it: the prompt and every option, shuffled, with no
-- marker of which one is right.
create or replace function chef_challenge_payload(p_attempt_id uuid, p_question_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'success', true,
    'attemptId', p_attempt_id,
    'prompt', q.prompt,
    'options', (
      select jsonb_agg(o.option order by random())
      from (
        select q.correct_answer as option
        union all
        select w from jsonb_array_elements_text(q.wrong_answers) as w
      ) o
    )
  )
  from chef_challenge_questions q
  where q.id = p_question_id;
$$;

revoke execute on function chef_challenge_payload(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_chef_challenge: the open challenge for this recipe, or a new one.
-- ---------------------------------------------------------------------------
create or replace function get_chef_challenge(p_recipe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_open chef_challenge_attempts%rowtype;
  v_last_answered timestamptz;
  v_last_cooked timestamptz;
  v_last_question uuid;
  v_round integer;
  v_question_id uuid;
  v_attempt_id uuid;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if not exists (
    select 1 from shop_recipe_unlocks where user_id = v_user_id and recipe_id = p_recipe_id
  ) then
    return jsonb_build_object('success', false, 'code', 'not_unlocked');
  end if;

  if not exists (
    select 1 from chef_challenge_questions where recipe_id = p_recipe_id and is_active
  ) then
    return jsonb_build_object('success', false, 'code', 'no_questions');
  end if;

  -- Serialize per child + recipe so two devices can't both issue a challenge.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':chef-challenge:' || p_recipe_id::text, 0));

  -- An open challenge comes back unchanged, so closing the pop-up never re-rolls it.
  select * into v_open
  from chef_challenge_attempts
  where user_id = v_user_id and recipe_id = p_recipe_id and answered_at is null;

  if found then
    if exists (
      select 1 from chef_challenge_questions where id = v_open.question_id and is_active
    ) then
      return chef_challenge_payload(v_open.id, v_open.question_id);
    end if;
    -- Its question was deleted or deactivated: drop it (never answered, never awarded).
    delete from chef_challenge_attempts where id = v_open.id;
  end if;

  -- One challenge per cook: after answering, the child must cook this recipe before the
  -- next challenge. (Cancel + re-pick would otherwise hand out unlimited challenges.)
  select max(answered_at) into v_last_answered
  from chef_challenge_attempts
  where user_id = v_user_id and recipe_id = p_recipe_id and answered_at is not null;

  if v_last_answered is not null then
    select max(cooked_at) into v_last_cooked
    from shop_cooked_dishes
    where user_id = v_user_id and recipe_id = p_recipe_id;

    if v_last_cooked is null or v_last_cooked < v_last_answered then
      return jsonb_build_object('success', false, 'code', 'cook_required');
    end if;
  end if;

  -- Rotation: a random active question not yet asked in the current round.
  select coalesce(max(round), 1) into v_round
  from chef_challenge_attempts
  where user_id = v_user_id and recipe_id = p_recipe_id;

  select q.id into v_question_id
  from chef_challenge_questions q
  where q.recipe_id = p_recipe_id
    and q.is_active
    and not exists (
      select 1 from chef_challenge_attempts a
      where a.user_id = v_user_id
        and a.recipe_id = p_recipe_id
        and a.round = v_round
        and a.question_id = q.id
    )
  order by random()
  limit 1;

  if v_question_id is null then
    -- Round complete: start the next one. Avoid opening it with the question just asked,
    -- when there's another to choose.
    v_round := v_round + 1;

    select question_id into v_last_question
    from chef_challenge_attempts
    where user_id = v_user_id and recipe_id = p_recipe_id
    order by issued_at desc
    limit 1;

    select q.id into v_question_id
    from chef_challenge_questions q
    where q.recipe_id = p_recipe_id and q.is_active
    order by (q.id is not distinct from v_last_question), random()
    limit 1;
  end if;

  insert into chef_challenge_attempts (user_id, family_id, recipe_id, question_id, round)
  values (v_user_id, v_family_id, p_recipe_id, v_question_id, v_round)
  returning id into v_attempt_id;

  return chef_challenge_payload(v_attempt_id, v_question_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. answer_chef_challenge: check the answer once; a correct one earns a paw print.
-- ---------------------------------------------------------------------------
create or replace function answer_chef_challenge(p_attempt_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_attempt chef_challenge_attempts%rowtype;
  v_question chef_challenge_questions%rowtype;
  v_is_correct boolean;
  v_balance jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  -- Lock the caller's own attempt so two simultaneous answers can't both count.
  select * into v_attempt
  from chef_challenge_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'no_attempt');
  end if;
  if v_attempt.answered_at is not null then
    return jsonb_build_object('success', false, 'code', 'already_answered');
  end if;

  select * into v_question from chef_challenge_questions where id = v_attempt.question_id;
  if not found then
    return jsonb_build_object('success', false, 'code', 'question_unavailable');
  end if;

  v_is_correct := btrim(coalesce(p_answer, '')) = btrim(v_question.correct_answer);

  update chef_challenge_attempts
  set answered_at = now(), chosen_answer = p_answer, is_correct = v_is_correct
  where id = v_attempt.id;

  if v_is_correct then
    insert into paw_print_awards (user_id, family_id, giver, recipe_id, attempt_id)
    values (v_user_id, v_family_id, 'shrewy', v_attempt.recipe_id, v_attempt.id);
  end if;

  v_balance := paw_print_balance(v_user_id, 'shrewy');

  return jsonb_build_object(
    'success', true,
    'isCorrect', v_is_correct,
    'correctAnswer', v_question.correct_answer,
    'collected', v_balance -> 'collected',
    'available', v_balance -> 'available'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. redeem_paw_print_reward: spend paw prints on a catalog reward, once, for good.
-- ---------------------------------------------------------------------------
create or replace function redeem_paw_print_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_reward paw_print_rewards%rowtype;
  v_available integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select * into v_reward from paw_print_rewards where reward_key = p_reward_key and is_active;
  if not found then
    return jsonb_build_object('success', false, 'code', 'unknown_reward');
  end if;

  -- Serialize spending per child + giver so two redemptions can't overspend.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':paw-prints:' || v_reward.giver, 0));

  if exists (
    select 1 from paw_print_redemptions where user_id = v_user_id and reward_key = p_reward_key
  ) then
    return jsonb_build_object('success', false, 'code', 'already_redeemed');
  end if;

  v_available := (paw_print_balance(v_user_id, v_reward.giver) ->> 'available')::integer;
  if v_available < v_reward.cost then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_paw_prints',
      'available', v_available,
      'cost', v_reward.cost
    );
  end if;

  insert into paw_print_redemptions (user_id, family_id, reward_key, giver, cost)
  values (v_user_id, v_family_id, v_reward.reward_key, v_reward.giver, v_reward.cost);

  return jsonb_build_object('success', true, 'available', v_available - v_reward.cost);
end;
$$;

revoke execute on function get_chef_challenge(uuid) from public, anon;
revoke execute on function answer_chef_challenge(uuid, text) from public, anon;
revoke execute on function redeem_paw_print_reward(text) from public, anon;
grant execute on function get_chef_challenge(uuid) to authenticated;
grant execute on function answer_chef_challenge(uuid, text) to authenticated;
grant execute on function redeem_paw_print_reward(text) to authenticated;
