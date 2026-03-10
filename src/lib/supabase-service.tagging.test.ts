import { describe, expect, it, vi } from "vitest";

// Prevent supabaseClient from throwing due to missing env vars
vi.mock("./supabaseClient", () => ({ supabase: {} }));

import { normalizeLessonTagField } from "./supabase-service";

describe("normalizeLessonTagField", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeLessonTagField("  Unit 8  ")).toBe("Unit 8");
  });

  it("collapses multiple interior spaces into one", () => {
    expect(normalizeLessonTagField("Unit  3")).toBe("Unit 3");
    expect(normalizeLessonTagField("Grade   2")).toBe("Grade 2");
  });

  it("trims and collapses in combination", () => {
    expect(normalizeLessonTagField("  Lesson  4  ")).toBe("Lesson 4");
  });

  it("preserves CJK characters without modification", () => {
    expect(normalizeLessonTagField("第八单元")).toBe("第八单元");
  });

  it("preserves CJK with surrounding whitespace trimmed", () => {
    expect(normalizeLessonTagField("  第八单元  ")).toBe("第八单元");
  });

  it("does not modify an already clean value", () => {
    expect(normalizeLessonTagField("G2")).toBe("G2");
    expect(normalizeLessonTagField("Lesson 4")).toBe("Lesson 4");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeLessonTagField("   ")).toBe("");
  });
});
