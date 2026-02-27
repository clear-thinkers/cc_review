import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATASET_FILES = {
  full: [
    { sourcePath: "character/char_base.json", outputName: "char_base.json" },
    { sourcePath: "character/char_detail.json", outputName: "char_detail.json" },
  ],
  common: [
    { sourcePath: "character/common/char_common_base.json", outputName: "char_base.json" },
    { sourcePath: "character/common/char_common_detail.json", outputName: "char_detail.json" },
  ],
};

const DEFAULT_REPO_OWNER = "mapull";
const DEFAULT_REPO_NAME = "chinese-dictionary";
const DEFAULT_BRANCHES = ["main", "master"];

function readBranchesFromEnv() {
  const value = process.env.CHINESE_DICTIONARY_REPO_BRANCHES || process.env.XINHUA_REPO_BRANCHES;
  if (!value) {
    return DEFAULT_BRANCHES;
  }

  const branches = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return branches.length > 0 ? branches : DEFAULT_BRANCHES;
}

function readDatasetVariantFromEnv() {
  const variant = (process.env.CHINESE_DICTIONARY_VARIANT || "full").trim().toLowerCase();
  if (variant === "common") {
    return "common";
  }

  return "full";
}

function buildRawUrl(owner, repo, branch, sourcePath) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sourcePath}`;
}

async function fetchDataFile({ owner, repo, branches, sourcePath }) {
  const errors = [];

  for (const branch of branches) {
    const url = buildRawUrl(owner, repo, branch, sourcePath);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "cc_review/download-dictionary-data",
        },
      });

      if (!response.ok) {
        errors.push(`${branch}: HTTP ${response.status}`);
        continue;
      }

      return {
        branch,
        body: await response.text(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${branch}: ${message}`);
    }
  }

  throw new Error(`Failed to download ${sourcePath}. Tried branches ${branches.join(", ")}. ${errors.join(" | ")}`);
}

async function main() {
  const owner =
    process.env.CHINESE_DICTIONARY_REPO_OWNER || process.env.XINHUA_REPO_OWNER || DEFAULT_REPO_OWNER;
  const repo = process.env.CHINESE_DICTIONARY_REPO_NAME || process.env.XINHUA_REPO_NAME || DEFAULT_REPO_NAME;
  const branches = readBranchesFromEnv();
  const variant = readDatasetVariantFromEnv();
  const files = DATASET_FILES[variant];

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  const outputDir = path.join(projectRoot, "public", "data");

  await mkdir(outputDir, { recursive: true });
  console.log(`Downloading dictionary dataset (${variant}) from ${owner}/${repo}...`);

  for (const file of files) {
    const { branch, body } = await fetchDataFile({ owner, repo, branches, sourcePath: file.sourcePath });
    const outputPath = path.join(outputDir, file.outputName);
    await writeFile(outputPath, body, "utf8");
    console.log(`Saved ${file.outputName} from ${file.sourcePath} (${branch})`);
  }

  console.log("Dictionary dataset download complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
