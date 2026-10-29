-- Chef challenge 小知识 / explanation (roadmap item T follow-up, authorized 2026-10-29).
-- Spec: docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md
--
-- Each question may carry a short, child-facing explanation (Chinese only) that the
-- challenge pop-up shows after the child answers, right or wrong. Like the correct
-- answer, it is revealed only by answer_chef_challenge -- never by get_chef_challenge.

alter table chef_challenge_questions
  add column explanation text
  check (explanation is null or char_length(btrim(explanation)) between 1 and 300);

-- Same function as 20261028160000, plus `explanation` in the result.
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
    'explanation', v_question.explanation,
    'collected', v_balance -> 'collected',
    'available', v_balance -> 'available'
  );
end;
$$;

revoke execute on function answer_chef_challenge(uuid, text) from public, anon;
grant execute on function answer_chef_challenge(uuid, text) to authenticated;
