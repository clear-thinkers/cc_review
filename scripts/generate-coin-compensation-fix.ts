#!/usr/bin/env tsx

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildMissingChildTargetMessage,
  buildCoinCompensationSql,
  normalizeCoinCompensationRequest,
} from "../src/lib/coinCompensationFix";

interface ScriptArgs {
  childUserId: string;
  coins: number;
  reason: string;
  createdAtIso: string;
  sessionId?: string;
  outputPath?: string;
  isProd: boolean;
}

interface UserLookupRow {
  id: string;
  family_id: string;
  name: string;
  role: string;
  auth_user_id?: string | null;
}

interface WalletLookupRow {
  total_coins: number;
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

function getRequiredArg(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required argument: ${flag}`);
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

function parseArgs(): ScriptArgs {
  const rawPositionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const leadingEnvToken = rawPositionalArgs[0]?.toLowerCase();
  const hasLeadingEnvToken =
    leadingEnvToken === "prod" ||
    leadingEnvToken === "production" ||
    leadingEnvToken === "dev" ||
    leadingEnvToken === "development";
  const positionalArgs = hasLeadingEnvToken ? rawPositionalArgs.slice(1) : rawPositionalArgs;
  const childUserId =
    getOptionalArg("--child-user-id") ??
    getOptionalArg("--user-id") ??
    positionalArgs[0] ??
    "";
  if (!childUserId) {
    throw new Error("Missing required argument: --child-user-id");
  }

  const coinsRaw = getOptionalArg("--coins") ?? positionalArgs[1] ?? "";
  if (!coinsRaw) {
    throw new Error("Missing required argument: --coins");
  }
  const coins = Number.parseInt(coinsRaw, 10);
  const reason = getOptionalArg("--reason") ?? positionalArgs[2] ?? "";
  if (!reason) {
    throw new Error("Missing required argument: --reason");
  }
  const createdAtIso = getOptionalArg("--created-at") ?? new Date().toISOString();
  const outputPath = getOptionalArg("--output") ?? positionalArgs[3];

  return {
    childUserId,
    coins,
    reason,
    createdAtIso,
    sessionId: getOptionalArg("--session-id"),
    outputPath,
    isProd: shouldUseProdEnv(),
  };
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

  const npmProduction = process.env["npm_config_production"];
  if (typeof npmProduction === "string") {
    const normalized = npmProduction.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "") {
      return true;
    }
  }

  return false;
}

function printUsage(): void {
  console.log(`Usage:
  npm run generate:coin-compensation-sql -- --child-user-id <uuid> --coins <int> --reason "<text>"
  npm run generate:coin-compensation-sql -- <uuid> <coins> "<reason>" [output]

Optional flags:
  --created-at <iso8601>   Use a specific session timestamp instead of now
  --session-id <text>      Override the deterministic session id
  --output <path>          Write SQL to a file instead of stdout
  --prod                   Load .env.production.local instead of .env.local
  --env prod               Alternate production selector that npm will not swallow

Example:
  npm run generate:coin-compensation-sql -- --env prod --child-user-id 11111111-2222-3333-4444-555555555555 --coins 13 --reason "Missed coins after RPC bug" --output supabase/manual/coin-fix.sql`);
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchChildTarget(
  supabase: SupabaseClient,
  childUserId: string
): Promise<UserLookupRow> {
  const { data, error } = await supabase
    .from("users")
    .select("id, family_id, name, role")
    .eq("id", childUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up child user: ${error.message}`);
  }

  if (!data) {
    const { data: authMatchedRow, error: authMatchError } = await supabase
      .from("users")
      .select("id, family_id, name, role, auth_user_id")
      .eq("auth_user_id", childUserId)
      .maybeSingle();

    if (authMatchError) {
      throw new Error(`Failed to look up auth-linked profile id: ${authMatchError.message}`);
    }

    const matchedAuthUser = authMatchedRow as UserLookupRow | null;
    if (!matchedAuthUser) {
      throw new Error(
        buildMissingChildTargetMessage({
          requestedId: childUserId,
        })
      );
    }

    const { data: familyChildren, error: familyChildrenError } = await supabase
      .from("users")
      .select("id, name")
      .eq("family_id", matchedAuthUser.family_id)
      .eq("role", "child")
      .order("created_at", { ascending: true });

    if (familyChildrenError) {
      throw new Error(`Failed to look up family child profiles: ${familyChildrenError.message}`);
    }

    throw new Error(
      buildMissingChildTargetMessage({
        requestedId: childUserId,
        matchedAuthUser: {
          id: matchedAuthUser.id,
          name: matchedAuthUser.name,
          role: matchedAuthUser.role,
          familyId: matchedAuthUser.family_id,
        },
        familyChildCandidates: ((familyChildren as Array<{ id: string; name: string }> | null) ?? []).map(
          (row) => ({
            id: row.id,
            name: row.name,
          })
        ),
      })
    );
  }

  const row = data as UserLookupRow;
  if (row.role !== "child") {
    throw new Error(`User ${childUserId} is role="${row.role}", not a child profile.`);
  }

  return row;
}

async function fetchWalletCoins(
  supabase: SupabaseClient,
  childUserId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("wallets")
    .select("total_coins")
    .eq("user_id", childUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up wallet: ${error.message}`);
  }

  const wallet = data as WalletLookupRow | null;
  return wallet?.total_coins ?? null;
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
  const child = await fetchChildTarget(supabase, args.childUserId);
  const existingWalletCoins = await fetchWalletCoins(supabase, args.childUserId);

  const request = normalizeCoinCompensationRequest({
    childUserId: child.id,
    childUserName: child.name,
    familyId: child.family_id,
    coins: args.coins,
    reason: args.reason,
    createdAtIso: args.createdAtIso,
    sessionId: args.sessionId,
    existingWalletCoins,
  });

  const sql = buildCoinCompensationSql(request);
  if (!args.outputPath) {
    process.stdout.write(sql);
    return;
  }

  const absoluteOutputPath = path.resolve(args.outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, sql, "utf8");

  console.log(`Wrote coin compensation SQL to ${absoluteOutputPath}`);
  console.log(`Child: ${request.childUserName} (${request.childUserId})`);
  console.log(`Coins: ${request.coins}`);
  console.log(`Session ID: ${request.sessionId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
