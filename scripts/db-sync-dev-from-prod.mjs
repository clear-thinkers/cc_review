import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createInterface } from "readline/promises";

// Data schemas to replace in dev. `storage` is intentionally excluded — copying
// storage.objects metadata without the underlying files would just leave broken
// references, so file/bucket sync (if ever needed) is a separate concern.
const SCHEMAS = ["public", "auth"];

// Supabase-managed infra rows — never overwrite these even on a full data replace.
// auth.instances/schema_migrations are per-project identity, not "prod data";
// auth.audit_log_entries is an append-only log, not meaningful to mirror.
const EXCLUDE = ["auth.instances", "auth.schema_migrations", "auth.audit_log_entries"];

// Fallback for machines where the installer didn't add PostgreSQL to PATH.
const WIN_DEFAULT_BIN = "C:\\Program Files\\PostgreSQL\\17\\bin";

function resolveTool(name) {
  try {
    execSync(`${name} --version`, { stdio: "ignore" });
    return name;
  } catch {
    const winPath = join(WIN_DEFAULT_BIN, `${name}.exe`);
    if (existsSync(winPath)) return `"${winPath}"`;
    throw new Error(`${name} not found on PATH or at ${winPath}. Install PostgreSQL 17 client tools.`);
  }
}

function readEnvVar(file, key) {
  const content = readFileSync(file, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${file}`);
  return line.slice(key.length + 1).trim();
}

// Avoid new URL() — it partially encodes special chars ([], !) in passwords inconsistently.
// Instead, extract the raw password with regex and encode it directly.
function encodeDbUrl(rawUrl, sourceLabel) {
  const match = rawUrl.match(/^([^:]+:\/\/[^:]+):(.+?)@(.+)$/);
  if (!match) throw new Error(`Could not parse ${sourceLabel} — expected: postgresql://user:password@host/db`);
  const [, userPart, rawPassword, hostPart] = match;
  return `${userPart}:${encodeURIComponent(rawPassword)}@${hostPart}`;
}

const pgDump = resolveTool("pg_dump");
const psql = resolveTool("psql");

const prodUrl = encodeDbUrl(readEnvVar(".env.production.local", "SUPABASE_PROD_DB_URL"), "SUPABASE_PROD_DB_URL");
const devUrl = encodeDbUrl(readEnvVar(".env.local", "SUPABASE_DEV_DB_URL"), "SUPABASE_DEV_DB_URL");

const dryRun = process.argv.includes("--dry-run");
const workDir = mkdtempSync(join(tmpdir(), "db-sync-dev-from-prod-"));
const dumpFile = join(workDir, "prod-data.sql");
const truncateFile = join(workDir, "dev-truncate.sql");

console.log(`Dumping data-only (${SCHEMAS.join(", ")}) from PROD...`);
const schemaArgs = SCHEMAS.map((s) => `--schema=${s}`).join(" ");
const excludeArgs = EXCLUDE.map((t) => `--exclude-table=${t}`).join(" ");
execSync(
  `${pgDump} --data-only --no-owner --no-privileges ${schemaArgs} ${excludeArgs} -f "${dumpFile}" "${prodUrl}"`,
  { stdio: "inherit" }
);

if (dryRun) {
  console.log(`Dry run — dump written to ${dumpFile}. Dev was not touched. Inspect it, then re-run without --dry-run.`);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  `\nThis will PERMANENTLY WIPE existing data in DEV's ${SCHEMAS.join(
    ", "
  )} schemas (except ${EXCLUDE.join(", ")}) and replace it with a copy of PROD.\nType "REPLACE DEV" to continue: `
);
rl.close();
if (answer.trim() !== "REPLACE DEV") {
  console.log("Aborted. Nothing was changed.");
  process.exit(1);
}

const excludeList = EXCLUDE.map((t) => `'${t}'`).join(", ");
const schemaList = SCHEMAS.map((s) => `'${s}'`).join(", ");
writeFileSync(
  truncateFile,
  `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname = ANY(ARRAY[${schemaList}])
      AND schemaname || '.' || tablename NOT IN (${excludeList})
  LOOP
    -- Not RESTART IDENTITY: that requires owning the table's sequences, and
    -- auth.* sequences are owned by supabase_auth_admin, not postgres. The
    -- restored dump's own setval() calls fix up sequence positions instead.
    EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', r.schemaname, r.tablename);
  END LOOP;
END $$;
`
);

console.log("Truncating DEV tables...");
execSync(`${psql} "${devUrl}" -v ON_ERROR_STOP=1 -f "${truncateFile}"`, { stdio: "inherit" });

console.log("Restoring PROD data into DEV...");
execSync(`${psql} "${devUrl}" -v ON_ERROR_STOP=1 -f "${dumpFile}"`, { stdio: "inherit" });

for (const f of [dumpFile, truncateFile]) {
  if (existsSync(f)) unlinkSync(f);
}

console.log(`Done. Dev now mirrors prod for: ${SCHEMAS.join(", ")} (excluding ${EXCLUDE.join(", ")}).`);
