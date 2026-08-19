import { describe, expect, it } from "vitest";
import { canAccessRoute } from "./permissions";

describe("canAccessRoute", () => {
  it("allows child access to the shop route", () => {
    expect(canAccessRoute("/words/shop", "child", false)).toBe(true);
  });

  it("blocks parent access to the shop route", () => {
    expect(canAccessRoute("/words/shop", "parent", false)).toBe(false);
  });

  it("allows platform admin access to the shop admin route", () => {
    expect(canAccessRoute("/words/shop-admin", "parent", true)).toBe(true);
  });

  it("blocks non-platform-admin access to the shop admin route", () => {
    expect(canAccessRoute("/words/shop-admin", "parent", false)).toBe(false);
    expect(canAccessRoute("/words/shop-admin", "child", false)).toBe(false);
  });

  it("allows parent access to the add-paragraph route", () => {
    expect(canAccessRoute("/words/add-paragraph", "parent", false)).toBe(true);
  });

  it("blocks child access to the add-paragraph route", () => {
    expect(canAccessRoute("/words/add-paragraph", "child", false)).toBe(false);
  });

  it("allows platform admin access to the add-paragraph route regardless of role", () => {
    expect(canAccessRoute("/words/add-paragraph", "child", true)).toBe(true);
  });
});
