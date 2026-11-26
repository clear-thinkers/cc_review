#!/usr/bin/env node
/**
 * Draw a percentage grid over a kitchen-scene image, for measuring hotspot
 * boxes and token positions (add-kitchen-scene skill, Phase 4). Every number
 * in a RECIPE_KITCHEN_SCENES entry is a percentage of the image's width (left,
 * width) or height (top, height), which is exactly what these grid lines show.
 *
 * Usage:
 *   node grid.mjs <image> <out.png>
 *       Whole image, a line every 5% (bold + labelled every 10%).
 *   node grid.mjs <image> <out.png> --zoom <left%>,<top%>,<width%>,<height%>
 *       Crop to that region and enlarge 3x, a line every 1% (bold + labelled
 *       every 5%) -- for the tight spots (a chef standing near the stove, two
 *       props close together).
 *
 * Read-only on the source image; writes only <out.png>. No database access.
 */
import sharp from "sharp";

const [source, out, flag, zoomArg] = process.argv.slice(2);
if (!source || !out) {
  console.error("Usage: node grid.mjs <image> <out.png> [--zoom left,top,width,height]");
  process.exit(1);
}

const { width: W, height: H } = await sharp(source).metadata();
const zoom = flag === "--zoom" ? zoomArg.split(",").map(Number) : null;
const region = zoom
  ? {
      left: Math.round((zoom[0] / 100) * W),
      top: Math.round((zoom[1] / 100) * H),
      width: Math.round((zoom[2] / 100) * W),
      height: Math.round((zoom[3] / 100) * H),
    }
  : { left: 0, top: 0, width: W, height: H };
const scale = zoom ? 3 : 1;
const step = zoom ? 1 : 5;
const major = zoom ? 5 : 10;
const font = zoom ? 13 : 16;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${region.width * scale}" height="${region.height * scale}">`;
for (let p = 0; p <= 100; p += step) {
  const strong = p % major === 0;
  const color = strong ? "rgba(255,0,0,0.85)" : "rgba(255,0,0,0.3)";
  const x = ((p / 100) * W - region.left) * scale;
  const y = ((p / 100) * H - region.top) * scale;
  if (x >= 0 && x <= region.width * scale) {
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${region.height * scale}" stroke="${color}" stroke-width="1"/>`;
    if (strong) svg += `<text x="${x + 2}" y="${font}" font-size="${font}" font-family="sans-serif" fill="blue">${p}</text>`;
  }
  if (y >= 0 && y <= region.height * scale) {
    svg += `<line x1="0" y1="${y}" x2="${region.width * scale}" y2="${y}" stroke="${color}" stroke-width="1"/>`;
    if (strong) svg += `<text x="2" y="${y - 2}" font-size="${font}" font-family="sans-serif" fill="blue">${p}</text>`;
  }
}
svg += "</svg>";

await sharp(source)
  .extract(region)
  .resize(region.width * scale, region.height * scale, { kernel: "nearest" })
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(out);
console.log(`${out} (${W}x${H} source${zoom ? `, zoom ${zoomArg}` : ""})`);
