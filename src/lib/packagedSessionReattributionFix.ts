export interface PackagedSessionReattributionRequest {
  familyId: string;
  packagedSessionId: string;
  quizSessionId: string;
  fromUserId: string;
  toUserId: string;
  coins: number;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function normalizePackagedSessionReattributionRequest(
  input: PackagedSessionReattributionRequest
): PackagedSessionReattributionRequest {
  const familyId = requireNonEmpty(input.familyId, "familyId");
  const packagedSessionId = requireNonEmpty(input.packagedSessionId, "packagedSessionId");
  const quizSessionId = requireNonEmpty(input.quizSessionId, "quizSessionId");
  const fromUserId = requireNonEmpty(input.fromUserId, "fromUserId");
  const toUserId = requireNonEmpty(input.toUserId, "toUserId");

  if (fromUserId === toUserId) {
    throw new Error("fromUserId and toUserId must be different users.");
  }

  if (!Number.isInteger(input.coins) || input.coins < 0) {
    throw new Error(`coins must be a non-negative integer. Received: ${input.coins}`);
  }

  return { familyId, packagedSessionId, quizSessionId, fromUserId, toUserId, coins: input.coins };
}

/**
 * Builds idempotent SQL that repairs a packaged review test session left in
 * limbo because the completing user's JWT claims resolved to the wrong
 * family member (e.g. a parent's stale/concurrent session claims instead of
 * the child's) -- see build-fix-log-2026-07-30-packaged-session-limbo.md.
 *
 * `complete_review_test_session` requires the caller to be a child (or
 * platform admin), so when it runs under the wrong identity it raises
 * before stamping `completed_at` or cleaning up the paused progress row --
 * even though `record_quiz_session` (no role gate) already succeeded and
 * wrote the completed quiz under the wrong user_id. This script:
 *   1. Moves the quiz_sessions row to the correct user (only if it's still
 *      owned by `fromUserId` -- safe to rerun).
 *   2. Rebalances both wallets by the session's coin award.
 *   3. Stamps review_test_sessions.completed_at (only if still null).
 *   4. Deletes the now-stale review_session_progress row for that session.
 */
export function buildPackagedSessionReattributionSql(
  input: PackagedSessionReattributionRequest
): string {
  const familyIdSql = escapeSqlLiteral(input.familyId);
  const packagedSessionIdSql = escapeSqlLiteral(input.packagedSessionId);
  const quizSessionIdSql = escapeSqlLiteral(input.quizSessionId);
  const fromUserIdSql = escapeSqlLiteral(input.fromUserId);
  const toUserIdSql = escapeSqlLiteral(input.toUserId);

  return [
    `-- Packaged review test session reattribution generated at ${new Date().toISOString()}`,
    `-- Family ID: ${input.familyId}`,
    `-- Packaged session: ${input.packagedSessionId}`,
    `-- Quiz session: ${input.quizSessionId}`,
    `-- Reattributing from ${input.fromUserId} to ${input.toUserId}, moving ${input.coins} coins`,
    "-- Safe to rerun: each step is guarded by the current row state.",
    "",
    "begin;",
    "",
    "do $$",
    "declare",
    `  v_from_user_id uuid := ${fromUserIdSql};`,
    `  v_to_user_id uuid := ${toUserIdSql};`,
    `  v_family_id uuid := ${familyIdSql};`,
    `  v_quiz_session_id text := ${quizSessionIdSql};`,
    `  v_packaged_session_id text := ${packagedSessionIdSql};`,
    `  v_coins integer := ${input.coins};`,
    "  v_current_owner uuid;",
    "begin",
    "  if not exists (select 1 from users where id = v_from_user_id and family_id = v_family_id) then",
    "    raise exception 'Reattribution source user % not found in family %', v_from_user_id, v_family_id;",
    "  end if;",
    "",
    "  if not exists (",
    "    select 1 from users where id = v_to_user_id and family_id = v_family_id and role = 'child'",
    "  ) then",
    "    raise exception 'Reattribution target user % not found as a child profile in family %', v_to_user_id, v_family_id;",
    "  end if;",
    "",
    "  select user_id into v_current_owner",
    "  from quiz_sessions",
    "  where id = v_quiz_session_id and family_id = v_family_id;",
    "",
    "  if v_current_owner is null then",
    "    raise exception 'quiz_sessions row % not found in family %', v_quiz_session_id, v_family_id;",
    "  end if;",
    "",
    "  if v_current_owner = v_from_user_id then",
    "    update quiz_sessions",
    "    set user_id = v_to_user_id",
    "    where id = v_quiz_session_id;",
    "",
    "    update wallets",
    "    set total_coins = total_coins - v_coins,",
    "        last_updated_at = now(),",
    "        version = coalesce(version, 1) + 1",
    "    where user_id = v_from_user_id;",
    "",
    "    insert into wallets (user_id, family_id, total_coins, last_updated_at, version)",
    "    values (v_to_user_id, v_family_id, 0, now(), 1)",
    "    on conflict on constraint wallets_pkey do nothing;",
    "",
    "    update wallets",
    "    set total_coins = total_coins + v_coins,",
    "        last_updated_at = now(),",
    "        version = coalesce(version, 1) + 1",
    "    where user_id = v_to_user_id;",
    "  elsif v_current_owner <> v_to_user_id then",
    "    raise exception",
    "      'quiz_sessions row % is owned by % (expected % or %) -- refusing to guess, investigate manually',",
    "      v_quiz_session_id, v_current_owner, v_from_user_id, v_to_user_id;",
    "  end if;",
    "",
    "  update review_test_sessions",
    "  set completed_at = now(),",
    "      completed_by_user_id = v_to_user_id",
    "  where id = v_packaged_session_id",
    "    and family_id = v_family_id",
    "    and completed_at is null;",
    "",
    "  delete from review_session_progress",
    "  where packaged_session_id = v_packaged_session_id;",
    "end",
    "$$;",
    "",
    "commit;",
    "",
  ].join("\n");
}
