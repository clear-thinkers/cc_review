export interface CoinCompensationBuildInput {
  childUserId: string;
  childUserName: string;
  familyId: string;
  coins: number;
  reason: string;
  createdAtIso: string;
  sessionId?: string;
  existingWalletCoins: number | null;
}

export interface CoinCompensationFamilyChildCandidate {
  id: string;
  name: string;
}

export interface CoinCompensationMissingTargetContext {
  requestedId: string;
  matchedAuthUser?:
    | {
        id: string;
        name: string;
        role: string;
        familyId: string;
      }
    | undefined;
  familyChildCandidates?: CoinCompensationFamilyChildCandidate[];
}

export interface CoinCompensationRequest {
  childUserId: string;
  childUserName: string;
  familyId: string;
  coins: number;
  reason: string;
  createdAtIso: string;
  sessionId: string;
  existingWalletCoins: number | null;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function toCanonicalIsoString(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`createdAt must be a valid date/time. Received: ${value}`);
  }
  return date.toISOString();
}

function toReasonSlug(reason: string): string {
  const slug = reason
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || "manual-adjustment";
}

function toTimestampToken(createdAtIso: string): string {
  return createdAtIso
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z")
    .toLowerCase();
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function formatCommentLine(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/--/g, "- -").trim();
}

export function buildCoinCompensationSessionId(args: {
  childUserId: string;
  createdAtIso: string;
  reason: string;
}): string {
  const childToken = args.childUserId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "child";
  const timestampToken = toTimestampToken(args.createdAtIso);
  const reasonToken = toReasonSlug(args.reason);
  return `manual-coin-fix-${timestampToken}-${childToken}-${reasonToken}`;
}

export function normalizeCoinCompensationRequest(
  input: CoinCompensationBuildInput
): CoinCompensationRequest {
  const childUserId = requireNonEmpty(input.childUserId, "childUserId");
  const childUserName = requireNonEmpty(input.childUserName, "childUserName");
  const familyId = requireNonEmpty(input.familyId, "familyId");
  const reason = requireNonEmpty(input.reason, "reason");

  if (!Number.isInteger(input.coins) || input.coins <= 0) {
    throw new Error(`coins must be a positive integer. Received: ${input.coins}`);
  }

  const createdAtIso = toCanonicalIsoString(input.createdAtIso);
  const sessionId =
    input.sessionId?.trim() ||
    buildCoinCompensationSessionId({
      childUserId,
      createdAtIso,
      reason,
    });

  return {
    childUserId,
    childUserName,
    familyId,
    coins: input.coins,
    reason,
    createdAtIso,
    sessionId,
    existingWalletCoins: input.existingWalletCoins,
  };
}

export function buildCoinCompensationSql(input: CoinCompensationRequest): string {
  const childUserIdSql = escapeSqlLiteral(input.childUserId);
  const familyIdSql = escapeSqlLiteral(input.familyId);
  const createdAtSql = `${escapeSqlLiteral(input.createdAtIso)}::timestamptz`;
  const sessionIdSql = escapeSqlLiteral(input.sessionId);
  const walletComment =
    input.existingWalletCoins === null
      ? "none yet (wallet row will be created if needed)"
      : `${input.existingWalletCoins}`;

  return [
    `-- One-time child coin compensation generated at ${new Date().toISOString()}`,
    `-- Child user: ${formatCommentLine(input.childUserName)} (${input.childUserId})`,
    `-- Family ID: ${input.familyId}`,
    `-- Reason: ${formatCommentLine(input.reason)}`,
    `-- Coins to add: ${input.coins}`,
    `-- Existing wallet total before patch: ${walletComment}`,
    `-- Session ID: ${input.sessionId}`,
    `-- Safe to rerun: the wallet update only happens if this exact session row is inserted.`,
    "",
    "begin;",
    "",
    "do $$",
    "begin",
    "  if not exists (",
    "    select 1",
    "    from users",
    `    where id = ${childUserIdSql}`,
    `      and family_id = ${familyIdSql}`,
    "      and role = 'child'",
    "  ) then",
    "    raise exception",
    `      'Coin compensation target % was not found in family % as a child profile.', ${childUserIdSql}, ${familyIdSql};`,
    "  end if;",
    "end",
    "$$;",
    "",
    "with inserted_session as (",
    "  insert into quiz_sessions (",
    "    id,",
    "    user_id,",
    "    family_id,",
    "    created_at,",
    "    session_type,",
    "    grade_data,",
    "    fully_correct_count,",
    "    failed_count,",
    "    partially_correct_count,",
    "    total_grades,",
    "    duration_seconds,",
    "    coins_earned",
    "  )",
    "  select",
    `    ${sessionIdSql},`,
    "    u.id,",
    "    u.family_id,",
    `    ${createdAtSql},`,
    "    'fill-test',",
    "    '[]'::jsonb,",
    "    0,",
    "    0,",
    "    0,",
    "    0,",
    "    0,",
    `    ${input.coins}`,
    "  from users u",
    `  where u.id = ${childUserIdSql}`,
    `    and u.family_id = ${familyIdSql}`,
    "    and u.role = 'child'",
    "  on conflict (id) do nothing",
    "  returning user_id, family_id, coins_earned",
    "), ensured_wallet as (",
    "  insert into wallets (",
    "    user_id,",
    "    family_id,",
    "    total_coins,",
    "    last_updated_at,",
    "    version",
    "  )",
    "  select",
    "    inserted_session.user_id,",
    "    inserted_session.family_id,",
    "    0,",
    `    ${createdAtSql},`,
    "    1",
    "  from inserted_session",
    "  on conflict on constraint wallets_pkey do nothing",
    ")",
    "update wallets",
    "set",
    "  total_coins = wallets.total_coins + inserted_session.coins_earned,",
    `  last_updated_at = ${createdAtSql},`,
    "  version = coalesce(wallets.version, 1) + 1",
    "from inserted_session",
    "where wallets.user_id = inserted_session.user_id;",
    "",
    "commit;",
    "",
  ].join("\n");
}

export function buildMissingChildTargetMessage(
  context: CoinCompensationMissingTargetContext
): string {
  const lines = [
    `No public.users.id row was found for: ${context.requestedId}`,
    "This script expects the app-level child profile id from public.users.id, not a Supabase auth.users.id.",
  ];

  if (!context.matchedAuthUser) {
    lines.push(
      "If you copied the id from Supabase Auth, profile session data, or another auth-facing screen, fetch the child profile id from the app's users table instead."
    );
    return lines.join("\n");
  }

  lines.push(
    `A users row was found with auth_user_id = ${context.requestedId}: ${context.matchedAuthUser.name} (${context.matchedAuthUser.role}).`
  );

  const childCandidates = context.familyChildCandidates ?? [];
  if (childCandidates.length === 0) {
    lines.push(
      `That family (${context.matchedAuthUser.familyId}) currently has no child profiles in public.users.`
    );
    return lines.join("\n");
  }

  lines.push("Valid child profile ids for that family:");
  for (const candidate of childCandidates) {
    lines.push(`- ${candidate.name}: ${candidate.id}`);
  }

  return lines.join("\n");
}
