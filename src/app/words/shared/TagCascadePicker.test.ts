/**
 * TagCascadePicker — focused logic test for the extracted appendSelectedOption
 * helper (@testing-library/react is not available in this project — see
 * src/app/words/results/SessionHistoryTable.test.ts).
 *
 * Regression coverage for a bug found live-testing /words/add-paragraph:
 * typing a brand-new grade/unit/lesson value via "+ Enter custom value"
 * set the underlying React state correctly, but the <select> had no
 * matching <option> for a not-yet-persisted value, so it rendered blank —
 * indistinguishable from the value never having been captured.
 */
import { describe, expect, it, vi } from "vitest";

// TagCascadePicker.tsx transitively imports supabase-service.ts -> supabaseClient.ts,
// which throws at module-eval time if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't set
// in the test process. Mock it out, matching AdminSection.test.ts's pattern, since
// this test only exercises the extracted pure helper below.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { appendSelectedOption } from "./TagCascadePicker";

describe("appendSelectedOption", () => {
  it("returns the original options unchanged when selectedValue is null", () => {
    expect(appendSelectedOption(["G1", "G2"], null)).toEqual(["G1", "G2"]);
  });

  it("returns the original options unchanged when selectedValue is empty/whitespace", () => {
    expect(appendSelectedOption(["G1", "G2"], "")).toEqual(["G1", "G2"]);
    expect(appendSelectedOption(["G1", "G2"], "   ")).toEqual(["G1", "G2"]);
  });

  it("returns the original options unchanged when selectedValue is already present", () => {
    expect(appendSelectedOption(["G1", "G2"], "G1")).toEqual(["G1", "G2"]);
  });

  it("appends and re-sorts when selectedValue is a brand-new, not-yet-persisted value", () => {
    expect(appendSelectedOption(["G1", "G3"], "G2")).toEqual(["G1", "G2", "G3"]);
  });

  it("appends a new value to an empty options list", () => {
    expect(appendSelectedOption([], "G3-Repro")).toEqual(["G3-Repro"]);
  });

  it("trims the selected value before comparing/appending", () => {
    expect(appendSelectedOption(["G1"], "  G1  ")).toEqual(["G1"]);
    expect(appendSelectedOption(["G1"], "  G2  ")).toEqual(["G1", "G2"]);
  });
});
