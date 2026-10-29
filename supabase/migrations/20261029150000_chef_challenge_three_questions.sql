-- Chef challenge: three questions per challenge (roadmap item T follow-up, authorized 2026-10-29).
-- Spec: docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md
--
-- Owner decisions (2026-10-29):
--   * One challenge per cook (unchanged). A challenge asks up to 3 questions, drawn at
--     random from ALL of the recipe's active questions (no per-round rotation any more),
--     never the same question twice in one challenge. A recipe with fewer than 3 asks
--     them all.
--   * Questions come one at a time. A wrong answer shows that question's answer and
--     ENDS the challenge (no paw print). Closing mid-way costs nothing: the next call
--     resumes with the next question of the same challenge.
--   * Only a fully correct challenge earns 1 paw print.
--   * "Shrewy washes his hands" now costs 2 paw prints (was 10).
--
-- No new tables or columns: chef_challenge_attempts.round now numbers a child's
-- challenges for a recipe -- every attempt of one challenge shares its round.
-- A challenge's size is min(3, questions answered correctly so far + active questions not
-- yet asked in it), so deactivating a question mid-challenge can never strand it.

update paw_print_rewards set cost = 2 where reward_key = 'shrewy-hand-wash';

-- The child-facing payload now carries progress ("question 2 of 3").
drop function if exists chef_challenge_payload(uuid, uuid);

create or replace function chef_challenge_payload(
  p_attempt_id uuid,
  p_question_id uuid,
  p_question_number integer,
  p_question_count integer
)
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
    ),
    'questionNumber', p_question_number,
    'questionCount', p_question_count
  )
  from chef_challenge_questions q
  where q.id = p_question_id;
$$;

revoke execute on function chef_challenge_payload(uuid, uuid, integer, integer) from public, anon, authenticated;

-- Progress of one challenge: answers so far and the active questions it hasn't asked.
create or replace function chef_challenge_progress(p_user_id uuid, p_recipe_id uuid, p_round integer)
returns table (answered integer, correct integer, wrong integer, unasked integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from chef_challenge_attempts a
      where a.user_id = p_user_id and a.recipe_id = p_recipe_id and a.round = p_round and a.answered_at is not null),
    (select count(*)::integer from chef_challenge_attempts a
      where a.user_id = p_user_id and a.recipe_id = p_recipe_id and a.round = p_round and a.is_correct),
    (select count(*)::integer from chef_challenge_attempts a
      where a.user_id = p_user_id and a.recipe_id = p_recipe_id and a.round = p_round and a.is_correct = false),
    (select count(*)::integer from chef_challenge_questions q
      where q.recipe_id = p_recipe_id and q.is_active
        and not exists (
          select 1 from chef_challenge_attempts a
          where a.user_id = p_user_id and a.recipe_id = p_recipe_id and a.round = p_round and a.question_id = q.id
        ));
$$;

revoke execute on function chef_challenge_progress(uuid, uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_chef_challenge: the current question of the child's challenge for this recipe --
-- resuming one in progress, or starting a new one when the last is over and cooked.
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
  v_round integer;
  v_open chef_challenge_attempts%rowtype;
  v_answered integer;
  v_correct integer;
  v_wrong integer;
  v_unasked integer;
  v_finished boolean;
  v_last_answered timestamptz;
  v_last_cooked timestamptz;
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

  -- Serialize per child + recipe so two devices can't both issue a question.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':chef-challenge:' || p_recipe_id::text, 0));

  select max(round) into v_round
  from chef_challenge_attempts
  where user_id = v_user_id and recipe_id = p_recipe_id;

  if v_round is not null then
    -- An open question comes back unchanged, so closing the pop-up never re-rolls it.
    select * into v_open
    from chef_challenge_attempts
    where user_id = v_user_id and recipe_id = p_recipe_id and answered_at is null;

    if found then
      if exists (
        select 1 from chef_challenge_questions where id = v_open.question_id and is_active
      ) then
        select answered, unasked into v_answered, v_unasked
        from chef_challenge_progress(v_user_id, p_recipe_id, v_round);
        -- The open question isn't "unasked", so count it back in for the total.
        return chef_challenge_payload(v_open.id, v_open.question_id, v_answered + 1, least(3, v_answered + v_unasked + 1));
      end if;
      -- Its question was deleted or deactivated: drop it (never answered, never awarded).
      delete from chef_challenge_attempts where id = v_open.id;
    end if;

    select answered, correct, wrong, unasked into v_answered, v_correct, v_wrong, v_unasked
    from chef_challenge_progress(v_user_id, p_recipe_id, v_round);
    v_finished := v_wrong > 0 or v_correct >= least(3, v_correct + v_unasked);

    if not v_finished then
      -- Resume the challenge in progress with its next question.
      select q.id into v_question_id
      from chef_challenge_questions q
      where q.recipe_id = p_recipe_id and q.is_active
        and not exists (
          select 1 from chef_challenge_attempts a
          where a.user_id = v_user_id and a.recipe_id = p_recipe_id and a.round = v_round and a.question_id = q.id
        )
      order by random()
      limit 1;

      insert into chef_challenge_attempts (user_id, family_id, recipe_id, question_id, round)
      values (v_user_id, v_family_id, p_recipe_id, v_question_id, v_round)
      returning id into v_attempt_id;

      return chef_challenge_payload(v_attempt_id, v_question_id, v_answered + 1, least(3, v_answered + v_unasked));
    end if;

    -- The last challenge is over: the next one needs a cook of this recipe after it.
    select max(answered_at) into v_last_answered
    from chef_challenge_attempts
    where user_id = v_user_id and recipe_id = p_recipe_id and round = v_round;

    select max(cooked_at) into v_last_cooked
    from shop_cooked_dishes
    where user_id = v_user_id and recipe_id = p_recipe_id;

    if v_last_cooked is null or v_last_cooked < v_last_answered then
      return jsonb_build_object('success', false, 'code', 'cook_required');
    end if;
  end if;

  -- Start a new challenge.
  v_round := coalesce(v_round, 0) + 1;

  select q.id into v_question_id
  from chef_challenge_questions q
  where q.recipe_id = p_recipe_id and q.is_active
  order by random()
  limit 1;

  select count(*)::integer into v_unasked
  from chef_challenge_questions
  where recipe_id = p_recipe_id and is_active;

  insert into chef_challenge_attempts (user_id, family_id, recipe_id, question_id, round)
  values (v_user_id, v_family_id, p_recipe_id, v_question_id, v_round)
  returning id into v_attempt_id;

  return chef_challenge_payload(v_attempt_id, v_question_id, 1, least(3, v_unasked));
end;
$$;

-- ---------------------------------------------------------------------------
-- answer_chef_challenge: check one answer. A wrong answer ends the challenge; the paw
-- print comes only with the last correct answer of a fully correct challenge.
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
  v_answered integer;
  v_correct integer;
  v_wrong integer;
  v_unasked integer;
  v_total integer;
  v_finished boolean;
  v_earned boolean := false;
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

  select answered, correct, wrong, unasked into v_answered, v_correct, v_wrong, v_unasked
  from chef_challenge_progress(v_user_id, v_attempt.recipe_id, v_attempt.round);
  v_total := least(3, v_answered + v_unasked);
  v_finished := v_wrong > 0 or v_correct >= least(3, v_correct + v_unasked);

  if v_finished and v_wrong = 0 then
    insert into paw_print_awards (user_id, family_id, giver, recipe_id, attempt_id)
    values (v_user_id, v_family_id, 'shrewy', v_attempt.recipe_id, v_attempt.id);
    v_earned := true;
  end if;

  v_balance := paw_print_balance(v_user_id, 'shrewy');

  return jsonb_build_object(
    'success', true,
    'isCorrect', v_is_correct,
    'correctAnswer', v_question.correct_answer,
    'explanation', v_question.explanation,
    'questionNumber', v_answered,
    'questionCount', greatest(v_total, v_answered),
    'challengeFinished', v_finished,
    'pawPrintEarned', v_earned,
    'collected', v_balance -> 'collected',
    'available', v_balance -> 'available'
  );
end;
$$;

revoke execute on function get_chef_challenge(uuid) from public, anon;
revoke execute on function answer_chef_challenge(uuid, text) from public, anon;
grant execute on function get_chef_challenge(uuid) to authenticated;
grant execute on function answer_chef_challenge(uuid, text) to authenticated;
