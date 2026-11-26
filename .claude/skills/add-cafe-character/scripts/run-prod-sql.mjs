#!/usr/bin/env node
/**
 * Runs a SQL file against PROD in one psql session. Use ONLY when the owner has asked for
 * this specific file to go to prod.
 *
 *   node run-prod-sql.mjs <file.sql>
 *
 * Why psql: `supabase db query --db-url` sends a prepared statement and rejects a file with
 * more than one statement ("cannot insert multiple commands into a prepared statement"),
 * which every seed file has. psql runs the whole file, with ON_ERROR_STOP so the first error
 * aborts (the seed files wrap everything in begin/commit, so nothing is half-applied).
 *
 * Reads SUPABASE_PROD_DB_URL from .env.production.local and percent-encodes the password
 * exactly like scripts/db-push-prod.mjs. The URL is never printed. psql comes from
 * PSQL_PATH, else "C:/Program Files/PostgreSQL/17/bin/psql.exe" (see 0_BUILD_CONVENTIONS.md,
 * db-sync-dev-from-prod), else psql on PATH. Run from the repo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("Usage: run-prod-sql.mjs <file.sql>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.production.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);
const rawUrl = env.SUPABASE_PROD_DB_URL;
if (!rawUrl) throw new Error("SUPABASE_PROD_DB_URL not found in .env.production.local");
const match = rawUrl.match(/^([^:]+:\/\/[^:]+):(.+?)@(.+)$/);
if (!match) throw new Error("Could not parse SUPABASE_PROD_DB_URL");
const [, userPart, rawPassword, hostPart] = match;
const url = `${userPart}:${encodeURIComponent(rawPassword)}@${hostPart}`;

const windowsPsql = "C:/Program Files/PostgreSQL/17/bin/psql.exe";
const psql = process.env.PSQL_PATH ?? (existsSync(windowsPsql) ? windowsPsql : "psql");

try {
  const out = execFileSync(psql, ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-d", url, "-f", file], {
    encoding: "utf8",
    env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  });
  process.stdout.write(out.split(url).join("<prod-url>"));
  console.log(`✓ Ran ${file} on prod.`);
} catch (error) {
  const text = String(error.stdout ?? "") + String(error.stderr ?? "") + String(error.message ?? "");
  process.stderr.write(text.split(url).join("<prod-url>"));
  console.error(`✗ ${file} failed on prod. With ON_ERROR_STOP and begin/commit, nothing was applied.`);
  process.exit(1);
}
