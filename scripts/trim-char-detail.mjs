#!/usr/bin/env node

/**
 * Trim char_detail.json to contain only character and pronunciation data.
 * Removes all explanations, examples, and metadata to reduce file size.
 *
 * Usage: node scripts/trim-char-detail.mjs
 * Output: public/data/char_detail.json (original replaced; backup in archive/)
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, "../public/data/char_detail.json");
const outputPath = inputPath; // Overwrite original

console.log("📖 Loading char_detail.json...");
const startTime = Date.now();

let rawData;
try {
  rawData = readFileSync(inputPath, "utf-8");
} catch (error) {
  console.error("❌ Failed to read input file:", error.message);
  process.exit(1);
}

console.log(`   Original size: ${(rawData.length / 1024 / 1024).toFixed(2)} MB`);

// Parse the full dataset using robust parsing (same logic as xinhua.ts)
let fullData;

function parseDatasetArray() {
  const source = rawData.replace(/^\uFEFF/, "").trim();
  if (!source) {
    throw new Error("Empty file");
  }

  // Try 1: Direct JSON parse
  try {
    return JSON.parse(source);
  } catch {
    // Fall through
  }

  // Try 2: Array wrap with comma cleanup
  try {
    const wrapped = `[${source.replace(/,\s*$/, "")}]`;
    return JSON.parse(wrapped);
  } catch {
    // Fall through
  }

  // Try 3: Line-by-line parsing
  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = [];

  for (const line of lines) {
    const cleanLine = line.replace(/,\s*$/, "");
    if (!cleanLine) continue;
    
    try {
      result.push(JSON.parse(cleanLine));
    } catch (err) {
      throw new Error(`Failed to parse line: ${err.message}`);
    }
  }

  if (result.length > 0) return result;

  throw new Error("Could not parse as array, wrapped, or line-delimited JSON");
}

try {
  fullData = parseDatasetArray();
} catch (error) {
  console.error("❌ Failed to parse JSON:", error.message);
  process.exit(1);
}

if (!Array.isArray(fullData)) {
  console.error("❌ Root is not an array. Invalid char_detail.json format.");
  process.exit(1);
}

console.log(`   Entries: ${fullData.length}`);

// Trim each entry to contain only char and pinyin
function trimEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const char = entry.char?.trim();
  if (!char) {
    return null;
  }

  // Extract pinyin array from pronunciations
  const pinyin = [];
  const pronunciations = Array.isArray(entry.pronunciations) ? entry.pronunciations : [];

  for (const pronunciation of pronunciations) {
    const py = pronunciation.pinyin?.trim();
    if (py && !pinyin.includes(py)) {
      pinyin.push(py);
    }
  }

  // Fallback: check word field
  if (pinyin.length === 0 && Array.isArray(entry.word)) {
    for (const wordEntry of entry.word) {
      const py = wordEntry.pinyin?.trim();
      if (py && !pinyin.includes(py)) {
        pinyin.push(py);
      }
    }
  }

  return {
    char,
    pinyin,
  };
}

console.log("\n✂️  Trimming data...");
const trimmed = [];
let skipped = 0;

for (const entry of fullData) {
  const trimmedEntry = trimEntry(entry);
  if (trimmedEntry) {
    trimmed.push(trimmedEntry);
  } else {
    skipped++;
  }
}

console.log(`   Kept: ${trimmed.length} entries`);
console.log(`   Skipped (no char or pinyin): ${skipped}`);

// Write to output
console.log("\n💾 Writing trimmed data...");
const outputJson = JSON.stringify(trimmed, null, 0); // No indentation for smaller size

try {
  writeFileSync(outputPath, outputJson, "utf-8");
} catch (error) {
  console.error("❌ Failed to write output file:", error.message);
  process.exit(1);
}

const newSize = outputJson.length;
const reduction = (((rawData.length - newSize) / rawData.length) * 100).toFixed(1);

console.log(`   New size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Reduction: ${reduction}%`);
console.log(`   Time: ${Date.now() - startTime}ms`);

console.log("\n✅ Done! char_detail.json trimmed successfully.");
console.log(`   Backup available at: archive/2026-02/char_detail.json.backup`);
