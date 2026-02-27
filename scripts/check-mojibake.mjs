#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".css",
  ".txt",
]);

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "archive",
  "docs/archive",
]);

const CJK_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
const LATIN1_SIGNAL = /[\u00C0-\u00FF]/u;

function shouldIgnoreDir(relativePath) {
  if (!relativePath) return false;
  const normalized = relativePath.replaceAll("\\", "/");
  return [...IGNORED_DIRS].some((ignored) =>
    normalized === ignored || normalized.startsWith(`${ignored}/`)
  );
}

function listFiles(dir, relative = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relPath = relative ? path.posix.join(relative, entry.name) : entry.name;
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(relPath)) {
        continue;
      }

      files.push(...listFiles(absPath, relPath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) {
      files.push({ absPath, relPath });
    }
  }

  return files;
}

function isLikelyMojibake(line) {
  if (!LATIN1_SIGNAL.test(line)) {
    return false;
  }

  if (CJK_PATTERN.test(line)) {
    return false;
  }

  const repaired = Buffer.from(line, "latin1").toString("utf8");
  if (repaired.includes("\uFFFD")) {
    return false;
  }

  return CJK_PATTERN.test(repaired);
}

const offenders = [];
for (const { absPath, relPath } of listFiles(REPO_ROOT)) {
  const raw = fs.readFileSync(absPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    if (isLikelyMojibake(lines[i])) {
      offenders.push({ file: relPath, line: i + 1, value: lines[i].trim() });
    }
  }
}

if (offenders.length > 0) {
  console.error("Found likely mojibake (encoding corruption):");
  for (const offender of offenders) {
    console.error(`- ${offender.file}:${offender.line} -> ${offender.value}`);
  }
  process.exit(1);
}

console.log("Encoding check passed: no likely mojibake found in authoritative files.");
