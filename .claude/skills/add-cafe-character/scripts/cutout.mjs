#!/usr/bin/env node
/**
 * Turns a Café character's delivered art into the files the app uses.
 *
 * Poses:  node cutout.mjs poses <key> <waitingSrc> <delightedSrc> [--bg auto|checker|green] [--chroma N[,N]]
 *   -> public/characters/<key>/<key>_waiting.png and <key>_delighted.png, both 960 x 1080,
 *      transparent, with one shared scale and the feet at the same spot (so swapping poses
 *      never makes the character jump).
 * Token:  node cutout.mjs token <key> <tokenSrc> [--bg ...] [--chroma N]
 *   -> public/characters/<key>/<key>_token.png, 512 x 512, transparent, badge filling ~92%.
 *
 * Background removal (--bg, default auto):
 *   - a PNG with real transparency keeps its own alpha;
 *   - checker: the grey/white checkerboard image agents often paint INTO a JPG. Removed by a
 *     flood fill from the image edges through neutral light pixels, stopping at the outline;
 *     enclosed pockets that hold both tile tones are removed too;
 *   - green: a flat green screen.
 *   --chroma is the checker tolerance (max RGB spread counted as "grey"). Start at 10. If the
 *   background leaves a speckled rim, raise it; if it bites into a white robe or paper, lower
 *   it (Li Bai needed 6 for one pose and 10 for the other). Give two values for the two poses.
 * Afterwards only the largest opaque shape is kept, so stray specks and edge strips vanish.
 *
 * Run from the repo root (sharp comes from the repo's node_modules).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const POSE_W = 960; // the Café's visitor box is sized for 960 x 1080 (CafeSection.tsx VISITOR_SIZE)
const POSE_H = 1080;
const CHAR_H = 940; // hat top to feet, before any shrink to fit the width
const FEET_Y = 1050; // feet bottom, 30 px margin
const SIDE_MARGIN = 20;
const TOKEN_SIZE = 512;
const TOKEN_FILL = 0.92;

function parseArgs(argv) {
  const positional = [];
  const flags = { bg: "auto", chroma: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bg") flags.bg = argv[++i];
    else if (argv[i] === "--chroma") flags.chroma = argv[++i].split(",").map(Number);
    else positional.push(argv[i]);
  }
  return { positional, flags };
}

async function cutout(src, bgMode, chroma) {
  const meta = await sharp(src).metadata();
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const rgba = Buffer.from(data);
  const n = w * h;

  let mode = bgMode;
  if (mode === "auto") {
    let transparent = 0;
    if (meta.hasAlpha) for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 16) transparent++;
    mode = transparent > n * 0.05 ? "alpha" : "checker";
  }

  if (mode !== "alpha") {
    const isBg =
      mode === "green"
        ? (r, g, b) => g > 140 && g > r + 40 && g > b + 40
        : (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= chroma && (r + g + b) / 3 >= 160;
    const bgAt = (i) => isBg(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const bg = new Uint8Array(n);

    // 1. Flood fill from the edges.
    const stack = [];
    const push = (i) => {
      if (!bg[i] && bgAt(i)) {
        bg[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    const neighbours = (i) => {
      const x = i % w;
      const y = (i / w) | 0;
      return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    };
    while (stack.length) for (const j of neighbours(stack.pop())) if (j >= 0) push(j);

    // 2. Enclosed checker pockets (between an arm and the body): both tile tones present.
    if (mode === "checker") {
      const seen = new Uint8Array(n);
      for (let s = 0; s < n; s++) {
        if (bg[s] || seen[s] || !bgAt(s)) continue;
        const comp = [];
        const st = [s];
        seen[s] = 1;
        while (st.length) {
          const i = st.pop();
          comp.push(i);
          for (const j of neighbours(i)) if (j >= 0 && !seen[j] && !bg[j] && bgAt(j)) {
            seen[j] = 1;
            st.push(j);
          }
        }
        let light = 0;
        let grey = 0;
        for (const i of comp) {
          const l = rgba[i * 4];
          if (l >= 235) light++;
          else if (l <= 205) grey++;
        }
        if (comp.length >= 150 && light > comp.length * 0.2 && grey > comp.length * 0.2) for (const i of comp) bg[i] = 1;
      }
    }

    // 3. Clear the background, then soften the rim: light near-neutral (or greenish, for a
    //    green screen) pixels touching it are cleared, the next ring is half transparent.
    const fringe = (r, g, b) =>
      mode === "green" ? g > r + 25 && g > b + 25 : Math.max(r, g, b) - Math.min(r, g, b) <= 20 && (r + g + b) / 3 >= 150;
    for (let i = 0; i < n; i++) if (bg[i]) rgba[i * 4 + 3] = 0;
    for (let ring = 0; ring < 2; ring++) {
      const cleared = new Uint8Array(n);
      for (let i = 0; i < n; i++) cleared[i] = rgba[i * 4 + 3] === 0 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        if (cleared[i]) continue;
        if (!neighbours(i).some((j) => j >= 0 && cleared[j])) continue;
        if (fringe(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])) rgba[i * 4 + 3] = ring === 0 ? 0 : 120;
      }
    }
  }

  // 4. Keep only the largest opaque shape.
  const label = new Int32Array(n).fill(-1);
  let best = -1;
  let bestSize = 0;
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (rgba[s * 4 + 3] < 16 || label[s] !== -1) continue;
    let size = 0;
    const st = [s];
    label[s] = id;
    while (st.length) {
      const i = st.pop();
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && label[j] === -1 && rgba[j * 4 + 3] >= 16) {
          label[j] = id;
          st.push(j);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
    id++;
  }
  for (let i = 0; i < n; i++) if (label[i] !== best) rgba[i * 4 + 3] = 0;
  return { rgba, w, h, mode };
}

function measure({ rgba, w, h }) {
  let top = h;
  let bottom = -1;
  let left = w;
  let right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 128) {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  if (bottom < 0) throw new Error("Nothing left after removing the background. Try another --bg or --chroma.");
  // Feet: centre of the opaque span in the lowest 4% of the figure.
  let sum = 0;
  let count = 0;
  for (let y = bottom - Math.round((bottom - top) * 0.04); y <= bottom; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > 128) {
      sum += x;
      count++;
    }
  }
  return { top, bottom, left, right, feetX: sum / count };
}

async function cropScaled(img, m, scale) {
  const cropW = m.right - m.left + 1;
  const cropH = m.bottom - m.top + 1;
  const width = Math.max(1, Math.round(cropW * scale));
  const height = Math.max(1, Math.round(cropH * scale));
  const buffer = await sharp(img.rgba, { raw: { width: img.w, height: img.h, channels: 4 } })
    .extract({ left: m.left, top: m.top, width: cropW, height: cropH })
    .resize(width, height, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  return { buffer, width, height };
}

async function poses(key, waitingSrc, delightedSrc, flags) {
  const out = `public/characters/${key}`;
  mkdirSync(out, { recursive: true });
  const items = [];
  for (const [index, [name, src]] of [["waiting", waitingSrc], ["delighted", delightedSrc]].entries()) {
    const chroma = flags.chroma[index] ?? flags.chroma[0] ?? 10;
    const img = await cutout(src, flags.bg, chroma);
    const m = measure(img);
    items.push({ name, img, m, scale: CHAR_H / (m.bottom - m.top + 1), chroma });
  }
  // Shrink every pose by the same factor if the widest one wouldn't fit beside centred feet.
  const half = POSE_W / 2 - SIDE_MARGIN;
  const fit = Math.min(1, ...items.map(({ m, scale }) => half / (Math.max(m.feetX - m.left, m.right - m.feetX) * scale)));
  for (const item of items) {
    const scale = item.scale * fit;
    const part = await cropScaled(item.img, item.m, scale);
    const left = Math.round(POSE_W / 2 - (item.m.feetX - item.m.left) * scale);
    const file = `${out}/${key}_${item.name}.png`;
    await sharp({ create: { width: POSE_W, height: POSE_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: part.buffer, left, top: FEET_Y - part.height }])
      .png({ compressionLevel: 9 })
      .toFile(file);
    console.log(
      `${file}: background=${item.img.mode} chroma=${item.chroma} source ${item.m.right - item.m.left + 1}x${item.m.bottom - item.m.top + 1}` +
        ` -> character ${part.width}x${part.height} (fit ${fit.toFixed(2)})`
    );
  }
  if (fit < 0.85) console.log("Note: a wide pose made both characters smaller than usual; a narrower pose would fill the box better.");
}

async function token(key, src, flags) {
  const out = `public/characters/${key}`;
  mkdirSync(out, { recursive: true });
  const chroma = flags.chroma[0] ?? 10;
  const img = await cutout(src, flags.bg, chroma);
  const m = measure(img);
  const inner = Math.round(TOKEN_SIZE * TOKEN_FILL);
  const scale = inner / Math.max(m.right - m.left + 1, m.bottom - m.top + 1);
  const part = await cropScaled(img, m, scale);
  const file = `${out}/${key}_token.png`;
  await sharp({ create: { width: TOKEN_SIZE, height: TOKEN_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part.buffer, left: Math.round((TOKEN_SIZE - part.width) / 2), top: Math.round((TOKEN_SIZE - part.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`${file}: background=${img.mode} chroma=${chroma}, badge ${part.width}x${part.height}`);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, key, ...sources] = positional;
if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(key ?? "")) {
  console.error("Usage: cutout.mjs poses <key> <waitingSrc> <delightedSrc> | token <key> <tokenSrc>  [--bg auto|checker|green] [--chroma N[,N]]");
  process.exit(1);
}
if (command === "poses" && sources.length === 2) await poses(key, sources[0], sources[1], flags);
else if (command === "token" && sources.length === 1) await token(key, sources[0], flags);
else {
  console.error("Usage: cutout.mjs poses <key> <waitingSrc> <delightedSrc> | token <key> <tokenSrc>");
  process.exit(1);
}
