#!/usr/bin/env node
/**
 * Normalize ONE placed reward icon into this game's real convention: a
 * genuine PNG, RGBA, fully transparent (alpha=0) at the canvas edges/
 * corners, with a hard cutout into an opaque vignette-glow blob behind the
 * subject. See ../add-food-variation/references/reward-art-style.md for the
 * full description -- that doc was WRONG about this exact point for a long
 * time (it claimed reward icons are opaque, not transparent) and caused a
 * real defect once already. This script trusts pixel/alpha data, not any
 * doc's claim, and re-derives it fresh every time.
 *
 * Every icon a user places for this skill is assumed to need this pass --
 * common failure modes seen in practice: a JPEG saved with a .png
 * extension (no alpha at all, format lie), a baked-in checkerboard
 * "transparency" texture flattened into real opaque pixels, and a real but
 * WRONG alpha channel (fully or partially opaque where it should be
 * transparent). This script is idempotent: an icon that's already correct
 * passes through unchanged (no-op), so it's safe to always run.
 *
 * This performs automated QC on its own output before calling anything
 * fixed -- background fraction sanity bounds, and a check that the image
 * center (where "centered single subject filling the frame" style
 * guidance puts the subject) never ends up masked as background. If QC
 * fails, this exits non-zero with a clear reason instead of silently
 * writing a bad asset -- that's a stop-and-ask-the-user case, not
 * something to guess past.
 *
 * Usage:
 *   node normalize-reward-icon.mjs public/rewards/pancake_plain.png
 *   # Overwrites the file in place ONLY if a fix was actually needed.
 *   # Already-correct files are left byte-for-byte untouched.
 *
 *   node normalize-reward-icon.mjs public/rewards/pancake_plain.png --check-only
 *   # Reports pass/fail and would-be background fraction; never writes.
 */

import sharp from "sharp";

const TRANSPARENT_ALPHA_TOLERANCE = 5;
const ACHROMATIC_SPREAD_TOLERANCE = 14; // max(r,g,b) - min(r,g,b)
const MIN_BACKGROUND_FRACTION = 0.03;
const MAX_BACKGROUND_FRACTION = 0.9;

function isAchromatic(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread <= ACHROMATIC_SPREAD_TOLERANCE;
}

async function loadRawRGBA(filePath) {
  const img = sharp(filePath);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, meta };
}

function sampleCornerAlphas(data, w, h) {
  const pts = [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ];
  return pts.map(([x, y]) => data[(y * w + x) * 4 + 3]);
}

function isAlreadyGood(meta, cornerAlphas) {
  return meta.format === "png" && meta.hasAlpha && cornerAlphas.every((a) => a <= TRANSPARENT_ALPHA_TOLERANCE);
}

/**
 * Flood fill from every border pixel into 4-connected neighbors that are
 * ACHROMATIC (R≈G≈B -- a flat gray/white/black checker cell, or the flat
 * black some tools emit for "fully transparent," including their
 * antialiased blends, which stay achromatic too). This is deliberately
 * NOT a local/neighbor-relative color-distance flood fill: an earlier
 * version of this script used that approach and it cascaded straight
 * through the subject, because a painted illustration's shading is smooth
 * enough that a chain of small per-step deltas can walk arbitrarily far
 * once it bridges onto the subject anywhere (e.g. a plate's near-white
 * highlight sitting close enough to a white checker cell to look like a
 * valid first step). Achromatic-ness is a much more stable signal for
 * THIS art style specifically: every real reward icon's subject is
 * consistently warm-toned (never truly neutral gray) even at its lightest
 * highlights, per direct pixel inspection -- see reward-art-style.md.
 */
function floodFillBackgroundMask(data, w, h) {
  const mask = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;

  function idx(x, y) {
    return y * w + x;
  }
  function tryAdd(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = idx(x, y);
    if (visited[i]) return;
    const p = i * 4;
    if (!isAchromatic(data[p], data[p + 1], data[p + 2])) return;
    visited[i] = 1;
    mask[i] = 1;
    queue[qTail++] = i;
  }

  for (let x = 0; x < w; x++) {
    tryAdd(x, 0);
    tryAdd(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryAdd(0, y);
    tryAdd(w - 1, y);
  }

  while (qHead < qTail) {
    const i = queue[qHead++];
    const x = i % w;
    const y = (i / w) | 0;
    tryAdd(x + 1, y);
    tryAdd(x - 1, y);
    tryAdd(x, y + 1);
    tryAdd(x, y - 1);
  }

  return mask;
}

async function main() {
  const filePath = process.argv[2];
  const checkOnly = process.argv.includes("--check-only");
  if (!filePath) throw new Error("Usage: normalize-reward-icon.mjs <path-to-png> [--check-only]");

  const { data, width, height, meta } = await loadRawRGBA(filePath);
  const cornerAlphas = sampleCornerAlphas(data, width, height);

  if (isAlreadyGood(meta, cornerAlphas)) {
    console.log(`OK (already correct): ${filePath} -- real PNG, transparent corners (alpha ${cornerAlphas.join(",")}). No change needed.`);
    return;
  }

  console.log(
    `Needs normalization: ${filePath} -- format=${meta.format}, hasAlpha=${meta.hasAlpha}, corner alphas=${cornerAlphas.join(",")}.`
  );

  const mask = floodFillBackgroundMask(data, width, height);
  const maskedCount = mask.reduce((a, b) => a + b, 0);
  const fraction = maskedCount / (width * height);
  console.log(`Flood-fill masked ${maskedCount} / ${width * height} pixels (${(fraction * 100).toFixed(1)}%) as background.`);

  if (fraction < MIN_BACKGROUND_FRACTION || fraction > MAX_BACKGROUND_FRACTION) {
    throw new Error(
      `QC FAILED: masked background fraction ${(fraction * 100).toFixed(1)}% is outside the sane range ` +
        `[${MIN_BACKGROUND_FRACTION * 100}%, ${MAX_BACKGROUND_FRACTION * 100}%] -- likely failed to detect the ` +
        `real background (too low) or ate into the subject (too high). Not writing anything -- this needs a human look, ` +
        `not a guess.`
    );
  }

  const centerIdx = Math.floor(height / 2) * width + Math.floor(width / 2);
  if (mask[centerIdx]) {
    throw new Error(
      `QC FAILED: the image center was masked as background, but every existing reward icon has a centered subject ` +
        `filling most of the frame -- this strongly suggests the flood fill leaked into (or past) the subject. ` +
        `Not writing anything.`
    );
  }

  if (checkOnly) {
    console.log("(--check-only: not writing anything)");
    return;
  }

  const out = Buffer.from(data);
  for (let i = 0; i < width * height; i++) {
    if (mask[i]) out[i * 4 + 3] = 0;
    else out[i * 4 + 3] = 255;
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(filePath);

  const verify = await loadRawRGBA(filePath);
  const verifyCorners = sampleCornerAlphas(verify.data, verify.width, verify.height);
  if (!isAlreadyGood(verify.meta, verifyCorners)) {
    throw new Error(
      `QC FAILED after writing: re-read of ${filePath} does not pass the transparency check ` +
        `(hasAlpha=${verify.meta.hasAlpha}, corner alphas=${verifyCorners.join(",")}). This should not happen -- investigate before trusting this file.`
    );
  }

  console.log(`Fixed and verified: ${filePath} now has real transparent corners (alpha ${verifyCorners.join(",")}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
