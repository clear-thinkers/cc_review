import { describe, it, expect } from "vitest";
import type {
  NavPage,
  WordsSectionPage,
  NavItem,
} from "./shell.types";

describe("Shell & Navigation Types", () => {
  it("should allow creating NavPage values", () => {
    const pages: NavPage[] = [
      "add",
      "all",
      "review",
      "shop",
      "shopAdmin",
      "admin",
      "results",
      "prompts",
    ];
    expect(pages).toHaveLength(8);
  });

  it("should allow creating WordsSectionPage values", () => {
    const pages: WordsSectionPage[] = [
      "add",
      "all",
      "review",
      "shop",
      "shopAdmin",
      "admin",
      "results",
      "prompts",
      "flashcard",
      "fillTest",
    ];
    expect(pages).toHaveLength(10);
  });

  it("should allow creating NavItem objects", () => {
    const item: NavItem = {
      href: "/words/add",
      label: "Add Characters",
      page: "add",
    };
    expect(item.page).toBe("add");
  });
});
