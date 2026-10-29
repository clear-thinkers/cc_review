import { describe, expect, it } from "vitest";
import { SHREWY_HAND_WASH_REWARD_KEY, PAW_PRINT_GIVERS } from "@/lib/pawPrints";
import { rewardsStrings } from "./rewards.strings";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("rewards.strings", () => {
  it("EN and ZH have identical nested keys", () => {
    expect(collectKeyPaths(rewardsStrings.zh).sort()).toEqual(collectKeyPaths(rewardsStrings.en).sort());
  });

  it("has no empty strings", () => {
    for (const locale of ["en", "zh"] as const) {
      const values = collectKeyPaths(rewardsStrings[locale]).map((path) =>
        path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], rewardsStrings[locale])
      );
      expect(values.every((value) => typeof value === "string" && value.trim() !== "")).toBe(true);
    }
  });

  it("names every giver and the launch reward in both locales", () => {
    for (const locale of ["en", "zh"] as const) {
      for (const giver of PAW_PRINT_GIVERS) expect(rewardsStrings[locale].giverNames[giver]).toBeTruthy();
      expect(rewardsStrings[locale].catalog[SHREWY_HAND_WASH_REWARD_KEY].title).toBeTruthy();
    }
  });
});
