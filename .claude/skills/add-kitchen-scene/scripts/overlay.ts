/**
 * Render a recipe's RECIPE_KITCHEN_SCENES entry on top of its artwork, so the
 * layout can be checked against the picture (add-kitchen-scene skill, Phase 5).
 *
 *   red boxes     hotspots (fridge, book, stovetop, oven, shelf)
 *   blue box      effects.pot (the drop target)
 *   purple box    effects.chef (the painted chef's tap box)
 *   green circles ingredient tokens at their real rendered size (8% of the
 *                 scene's width, centred on each origin), numbered in recipe order
 *   orange dots   sparkles
 *
 * Imports the real kitchen.types.ts, so what you see is what the app uses.
 *
 * Usage: npx tsx .claude/skills/add-kitchen-scene/scripts/overlay.ts <slug> <out.png>
 */
import path from "node:path";
import sharp from "sharp";
import { RECIPE_KITCHEN_SCENES } from "../../../../src/app/words/shop/kitchen/kitchen.types";

/** Mirrors `.token { width: 8% }` in kitchenScene.animation.module.css. */
const TOKEN_WIDTH_PERCENT = 8;

type Box = { left: string; top: string; width: string; height: string };

async function main(): Promise<void> {
  const [slug, out] = process.argv.slice(2);
  if (!slug || !out) throw new Error("Usage: overlay.ts <slug> <out.png>");
  const scene = RECIPE_KITCHEN_SCENES[slug];
  if (!scene) throw new Error(`No RECIPE_KITCHEN_SCENES entry for "${slug}".`);

  const file = path.join(process.cwd(), "public", scene.imagePath);
  const { width: W = 0, height: H = 0 } = await sharp(file).metadata();
  const px = (value: string, total: number) => (parseFloat(value) / 100) * total;
  const rect = (box: Box, color: string, label: string) =>
    `<rect x="${px(box.left, W)}" y="${px(box.top, H)}" width="${px(box.width, W)}" height="${px(box.height, H)}" fill="none" stroke="${color}" stroke-width="3"/>` +
    `<text x="${px(box.left, W) + 3}" y="${px(box.top, H) + 16}" font-size="15" font-family="sans-serif" font-weight="bold" fill="${color}">${label}</text>`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (const [name, box] of Object.entries(scene.hotspots)) svg += rect(box, "red", name);
  if (scene.effects) {
    svg += rect(scene.effects.pot, "blue", `pot (${scene.effects.vessel})`);
    svg += rect(scene.effects.chef, "purple", `chef (bubble ${scene.effects.chef.bubbleAlign})`);
    const radius = ((TOKEN_WIDTH_PERCENT / 100) * W) / 2;
    scene.effects.ingredientOrigins.forEach((origin, index) => {
      const x = px(origin.left, W);
      const y = px(origin.top, H);
      svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="rgba(0,200,0,0.25)" stroke="green" stroke-width="3"/>`;
      svg += `<text x="${x - 6}" y="${y + 7}" font-size="20" font-family="sans-serif" font-weight="bold" fill="darkgreen">${index + 1}</text>`;
    });
    for (const sparkle of scene.effects.sparkles) {
      svg += `<circle cx="${px(sparkle.left, W)}" cy="${px(sparkle.top, H)}" r="6" fill="orange"/>`;
    }
  }
  svg += "</svg>";

  await sharp(file).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
  console.log(`${out} (${W}x${H}, ${scene.effects ? "interactive" : "plain"} scene)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
