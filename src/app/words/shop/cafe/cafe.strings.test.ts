import { describe, expect, it } from "vitest";
import { cafeAdminStrings } from "../../shop-admin/cafeAdmin.strings";
import { wishlistStrings } from "../../wishlist/wishlist.strings";
import { cafeStrings } from "./cafe.strings";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? prefix + "." + key : key));
}

function leaves(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [value];
  return Object.values(value).flatMap(leaves);
}

describe.each([
  ["cafe", cafeStrings],
  ["wishlist", wishlistStrings],
  ["cafeAdmin", cafeAdminStrings],
])("%s strings", (_name, strings) => {
  it("EN and ZH have identical nested keys", () => {
    expect(keyPaths(strings.zh).sort()).toEqual(keyPaths(strings.en).sort());
  });

  it("has no empty strings", () => {
    for (const locale of [strings.en, strings.zh]) {
      for (const leaf of leaves(locale)) expect(String(leaf).trim()).not.toBe("");
    }
  });
});
