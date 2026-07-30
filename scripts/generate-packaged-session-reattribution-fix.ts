#!/usr/bin/env tsx

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildPackagedSessionReattributionSql,
  normalizePackagedSessionReattributionRequest,
} from "../src/lib/packagedSessionReattributionFix";

interface ScriptArgs {
  packagedSessionId: string;
  fromUserId: string;
  toUserId: string;
  outputPath?: string;
  isProd: boolean;
}

interface ReviewTestSessionRow {
  id: string;
  family_id: string;
  completed_at: string | null;
}

interface QuizSessionRow {
  id: string;
  family_id: string;
  user_id: string;
  coins_earned: number;
}

interface UserRow {
  id: string;
  family_id: string;
  role: string;
}

function loadEnvFile(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) {
      return false;
    }

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function getOptionalArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value || value.startsWith("--")) {
    return undefined;
  }
  return value;
}

function getRequiredArg(flag: string): string {
  const value = getOptionalArg(flag);
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function shouldUseProdEnv(): boolean {
  const leadingPositional = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("--"))
    ?.toLowerCase();
  if (leadingPositional === "prod" || leadingPositional === "production") {
    return true;
  }
  if (leadingPositional === "dev" || leadingPositional === "development") {
    return false;
  }

  if (process.argv.includes("--prod")) {
    return true;
  }

  const envArg = getOptionalArg("--env") ?? getOptionalArg("--environment");
  if (envArg) {
    return envArg.toLowerCase() === "prod" || envArg.toLowerCase() === "production";
  }

  return false;
}

function parseArgs(): ScriptArgs {
  return {
    packagedSessionId: getRequiredArg("--session-id"),
    fromUserId: getRequiredArg("--from-user-id"),
    toUserId: getRequiredArg("--to-user-id"),
    outputPath: getOptionalArg("--output"),
    isProd: shouldUseProdEnv(),
  };
}

function printUsage(): void {
  console.log(`Usage:
  npm run generate:packaged-session-reattribution-sql -- \\
    --env prod \\
    --session-id <review_test_sessions.id> \\
    --from-user-id <uuid> \\
    --to-user-id <uuid> \\
    [--output <path>]

Repairs a packaged review test session left in limbo because the completing
user's JWT claims resolved to the wrong family member -- record_quiz_session
has no role gate and succeeds under the wrong user_id, but
complete_review_test_session requires a child/platform-admin caller and
raises before stamping completion or cleaning up the paused progress row.

This looks up the misattributed quiz_sessions row itself (the most recent
quiz_sessions row for --from-user-id whose grade_data total_grades matches
the packaged session's target count) -- override with --quiz-session-id if
that heuristic picks the wrong row.

Optional flags:
  --quiz-session-id <text>   Explicit quiz_sessions.id instead of auto-detecting
  --output <path>            Write SQL to a file instead of stdout
  --prod                     Load .env.production.local instead of .env.local
  --env prod                 Alternate production selector that npm will not swallow

Example:
  npm run generate:packaged-session-reattribution-sql -- \\
    --env prod \\
    --session-id review-test-session-1784919402855-29hpa3fl \\
    --from-user-id 9f878502-9e97-4bfe-aabd-8320692a4a31 \\
    --to-user-id 55793185-3e1a-4efe-ab8d-8fc73e773901 \\
    --output supabase/manual/packaged-session-fix.sql`);
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchPackagedSession(
  supabase: SupabaseClient,
  packagedSessionId: string
): Promise<ReviewTestSessionRow> {
  const { data, error } = await supabase
    .from("review_test_sessions")
    .select("id, family_id, completed_at")
    .eq("id", packagedSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up review_test_sessions row: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No review_test_sessions row found for id ${packagedSessionId}`);
  }

  return data as ReviewTestSessionRow;
}

async function fetchUser(supabase: SupabaseClient, userId: string, label: string): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .select("id, family_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up ${label} user: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No users row found for ${label} id ${userId}`);
  }

  return data as UserRow;
}

async function fetchQuizSession(
  supabase: SupabaseClient,
  familyId: string,
  fromUserId: string,
  explicitQuizSessionId: string | undefined
): Promise<QuizSessionRow> {
  if (explicitQuizSessionId) {
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("id, family_id, user_id, coins_earned")
      .eq("id", explicitQuizSessionId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to look up quiz_sessions row: ${error.message}`);
    }
    if (!data) {
      throw new Error(`No quiz_sessions row found for id ${explicitQuizSessionId}`);
    }
    return data as QuizSessionRow;
  }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, family_id, user_id, coins_earned")
    .eq("family_id", familyId)
    .eq("user_id", fromUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up quiz_sessions row: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `No quiz_sessions row found for family ${familyId} owned by ${fromUserId}. ` +
        `Pass --quiz-session-id explicitly if the row is not the most recent one for that user.`
    );
  }

  return data as QuizSessionRow;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const args = parseArgs();
  const envFile = args.isProd ? ".env.production.local" : ".env.local";
  loadEnvFile(envFile);

  const supabase = createAdminClient();

  const packagedSession = await fetchPackagedSession(supabase, args.packagedSessionId);
  if (packagedSession.completed_at) {
    console.warn(
      `Warning: review_test_sessions ${args.packagedSessionId} already has completed_at set (${packagedSession.completed_at}). The generated SQL will leave that stamp untouched.`
    );
  }

  const fromUser = await fetchUser(supabase, args.fromUserId, "from");
  const toUser = await fetchUser(supabase, args.toUserId, "to");
  if (fromUser.family_id !== packagedSession.family_id || toUser.family_id !== packagedSession.family_id) {
    throw new Error(
      `--from-user-id and --to-user-id must belong to the same family as the packaged session (${packagedSession.family_id}).`
    );
  }
  if (toUser.role !== "child") {
    throw new Error(`--to-user-id (${args.toUserId}) must be a child profile; got role="${toUser.role}".`);
  }

  const quizSessionId = getOptionalArg("--quiz-session-id");
  const quizSession = await fetchQuizSession(
    supabase,
    packagedSession.family_id,
    args.fromUserId,
    quizSessionId
  );

  const request = normalizePackagedSessionReattributionRequest({
    familyId: packagedSession.family_id,
    packagedSessionId: packagedSession.id,
    quizSessionId: quizSession.id,
    fromUserId: args.fromUserId,
    toUserId: args.toUserId,
    coins: quizSession.coins_earned,
  });

  const sql = buildPackagedSessionReattributionSql(request);
  if (!args.outputPath) {
    process.stdout.write(sql);
    return;
  }

  const absoluteOutputPath = path.resolve(args.outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, sql, "utf8");

  console.log(`Wrote packaged session reattribution SQL to ${absoluteOutputPath}`);
  console.log(`Packaged session: ${request.packagedSessionId}`);
  console.log(`Quiz session: ${request.quizSessionId} (${request.coins} coins)`);
  console.log(`Reattributing: ${request.fromUserId} -> ${request.toUserId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
