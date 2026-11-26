#!/usr/bin/env node
/**
 * Preview a Café character's finished art before seeding it.
 *
 *   node preview.mjs <key>
 *
 * Writes to public/characters/<key>/_staging/ (git-ignored):
 *   - preview-cafe.png: the character over public/shop/shop.png at the door, the counter
 *     (waiting pose) and the table (delighted pose), placed exactly as the app does;
 *   - preview-edges.png: both poses on a dark and on a cream background (a leftover rim from
 *     the background shows up on dark), plus the token at full size, spent (grey, faded) and
 *     at 28 px, the size it's shown at in headings.
 *
 * The spots and box size mirror VISITOR_SPOTS / VISITOR_SIZE in
 * src/app/words/shop/cafe/CafeSection.tsx. Update both together.
 * Run from the repo root.
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";

const SPOTS = { door: [68.5, 38], counter: [51.5, 42], table: [27, 45] };
const BOX = { width: 0.24, height: 0.36 };

const key = process.argv[2];
if (!key) {
  console.error("Usage: preview.mjs <key>");
  process.exit(1);
}
const dir = `public/characters/${key}`;
const files = {
  waiting: `${dir}/${key}_waiting.png`,
  delighted: `${dir}/${key}_delighted.png`,
  token: `${dir}/${key}_token.png`,
};
for (const [name, file] of Object.entries(files)) {
  if (!existsSync(file)) {
    console.error(`Missing ${name}: ${file}. Run cutout.mjs first.`);
    process.exit(1);
  }
}
mkdirSync(`${dir}/_staging`, { recursive: true });

// 1. In the café. Composite at full size first, then shrink (sharp resizes before compositing
//    if both are in one pipeline, which would misplace the character).
const scene = await sharp("public/shop/shop.png").metadata();
const boxW = Math.round(BOX.width * scene.width);
const boxH = Math.round(BOX.height * scene.height);
const layers = [];
for (const [spot, [left, top]] of Object.entries(SPOTS)) {
  const pose = spot === "table" ? files.delighted : files.waiting;
  const input = await sharp(pose)
    .resize(boxW, boxH, { fit: "contain", position: "bottom", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  layers.push({ input, left: Math.round((left / 100) * scene.width), top: Math.round((top / 100) * scene.height) });
}
const cafe = await sharp("public/shop/shop.png").composite(layers).png().toBuffer();
await sharp(cafe).resize({ width: 1100 }).toFile(`${dir}/_staging/preview-cafe.png`);

// 2. Edges and the token.
const tile = async (file, background, width, height) =>
  sharp({ create: { width, height, channels: 4, background: { ...background, alpha: 1 } } })
    .composite([{ input: await sharp(file).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer() }])
    .png()
    .toBuffer();
const dark = { r: 40, g: 40, b: 60 };
const cream = { r: 255, g: 250, b: 240 };
const tiles = [
  await tile(files.waiting, dark, 480, 540),
  await tile(files.waiting, cream, 480, 540),
  await tile(files.delighted, dark, 480, 540),
  await tile(files.delighted, cream, 480, 540),
];
// A spent token is shown grey at 35% opacity (RewardsSection: "opacity-35 grayscale").
const { data: tokenPixels } = await sharp(files.token).resize(256, 256).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < tokenPixels.length; i += 4) {
  const grey = Math.round(0.299 * tokenPixels[i] + 0.587 * tokenPixels[i + 1] + 0.114 * tokenPixels[i + 2]);
  tokenPixels[i] = tokenPixels[i + 1] = tokenPixels[i + 2] = grey;
  tokenPixels[i + 3] = Math.round(tokenPixels[i + 3] * 0.35);
}
const spentToken = await sharp(tokenPixels, { raw: { width: 256, height: 256, channels: 4 } }).png().toBuffer();
const tokenTiles = [
  await tile(files.token, cream, 256, 256),
  await sharp({ create: { width: 256, height: 256, channels: 4, background: { ...cream, alpha: 1 } } })
    .composite([{ input: spentToken }])
    .png()
    .toBuffer(),
  await tile(files.token, cream, 28, 28),
];
const sheet = await sharp({ create: { width: 480 * 4 + 30, height: 540 + 266, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } })
  .composite([
    ...tiles.map((input, i) => ({ input, left: i * 490, top: 0 })),
    { input: tokenTiles[0], left: 0, top: 550 },
    { input: tokenTiles[1], left: 266, top: 550 },
    { input: tokenTiles[2], left: 532, top: 550 },
  ])
  .png()
  .toBuffer();
await sharp(sheet).resize({ width: 1400 }).toFile(`${dir}/_staging/preview-edges.png`);

console.log(`Wrote ${dir}/_staging/preview-cafe.png and ${dir}/_staging/preview-edges.png`);
