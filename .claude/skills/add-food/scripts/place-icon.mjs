#!/usr/bin/env node
/**
 * Convert and move ONE user-placed source image (any filename, any common
 * raster format -- JPEG, PNG mislabeled as something else, etc., typically
 * found under public/rewards/_staging/ or public/ingredients/_staging/)
 * into this game's required final path as a real PNG.
 *
 * This only handles FORMAT and PLACEMENT. It does not touch transparency --
 * always run normalize-reward-icon.mjs on the destination afterward. A
 * source with no alpha channel at all (e.g. a JPEG) comes out fully opaque,
 * which is exactly what normalize-reward-icon.mjs expects to fix next.
 *
 * Usage:
 *   node place-icon.mjs <source-path> <dest-path>
 *   node place-icon.mjs <source-path> <dest-path> --overwrite
 */

import { existsSync } from "node:fs";
import sharp from "sharp";

async function main() {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const overwrite = process.argv.includes("--overwrite");
  const [source, dest] = positional;

  if (!source || !dest) {
    throw new Error("Usage: place-icon.mjs <source-path> <dest-path> [--overwrite]");
  }
  if (!existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }
  if (existsSync(dest) && !overwrite) {
    throw new Error(
      `Destination already exists: ${dest} (pass --overwrite to replace it intentionally -- this script won't silently clobber an existing asset)`
    );
  }

  const info = await sharp(source).png().toFile(dest);
  console.log(
    `Placed: ${source} -> ${dest} (${info.width}x${info.height}, format=png). ` +
      `Run normalize-reward-icon.mjs on ${dest} next -- this step only fixed format/location, not transparency.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
