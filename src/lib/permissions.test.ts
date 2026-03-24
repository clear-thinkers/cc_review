import { describe, expect, it } from "vitest";
import { canAccessRoute } from "./permissions";

describe("canAccessRoute", () => {
  it("allows child access to the shop route", () => {
    expect(canAccessRoute("/words/shop", "child", false)).toBe(true);
  });

  it("blocks parent access to the shop route", () => {
    expect(canAccessRoute("/words/shop", "parent", false)).toBe(false);
  });
});
