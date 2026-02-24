import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_FILES = ["word.json", "ci.json", "idiom.json", "xiehouyu.json", "ci.csv"];
const DEFAULT_REPO_OWNER = "mitchell-dream";
const DEFAULT_REPO_NAME = "chinese-xinhua";
const DEFAULT_BRANCHES = ["master", "main"];

function readBranchesFromEnv() {
  const value = process.env.XINHUA_REPO_BRANCHES;
  if (!value) {
    return DEFAULT_BRANCHES;
  }

  const branches = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return branches.length > 0 ? branches : DEFAULT_BRANCHES;
}

function buildRawUrl(owner, repo, branch, filename) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data/${filename}`;
}

async function fetchDataFile({ owner, repo, branches, filename }) {
  const errors = [];

  for (const branch of branches) {
    const url = buildRawUrl(owner, repo, branch, filename);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "cc_review/download-xinhua-data",
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

  throw new Error(`Failed to download ${filename}. Tried branches ${branches.join(", ")}. ${errors.join(" | ")}`);
}

async function main() {
  const owner = process.env.XINHUA_REPO_OWNER || DEFAULT_REPO_OWNER;
  const repo = process.env.XINHUA_REPO_NAME || DEFAULT_REPO_NAME;
  const branches = readBranchesFromEnv();

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  const outputDir = path.join(projectRoot, "public", "data");

  await mkdir(outputDir, { recursive: true });
  console.log(`Downloading Xinhua dataset from ${owner}/${repo}...`);

  for (const filename of DATA_FILES) {
    const { branch, body } = await fetchDataFile({ owner, repo, branches, filename });
    const outputPath = path.join(outputDir, filename);
    await writeFile(outputPath, body, "utf8");
    console.log(`Saved ${filename} (${branch})`);
  }

  console.log("Xinhua dataset download complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
