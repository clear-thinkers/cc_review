import { execSync } from "child_process";
import { readFileSync } from "fs";

const envFile = readFileSync(".env.production.local", "utf8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const rawUrl = env["SUPABASE_PROD_DB_URL"];
if (!rawUrl) throw new Error("SUPABASE_PROD_DB_URL not found in .env.production.local");

// Avoid new URL() — it partially encodes special chars ([], !) in passwords inconsistently.
// Instead, extract the raw password with regex and encode it directly.
const match = rawUrl.match(/^([^:]+:\/\/[^:]+):(.+?)@(.+)$/);
if (!match) throw new Error("Could not parse SUPABASE_PROD_DB_URL — expected: postgresql://user:password@host/db");
const [, userPart, rawPassword, hostPart] = match;
const url = `${userPart}:${encodeURIComponent(rawPassword)}@${hostPart}`;

const dryRun = process.argv.includes("--dry-run");
execSync(`supabase db push --db-url "${url}" --include-all${dryRun ? " --dry-run" : ""}`, {
  stdio: "inherit",
});
