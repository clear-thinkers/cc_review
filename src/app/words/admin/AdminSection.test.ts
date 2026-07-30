import { describe, expect, it, vi } from "vitest";

// AdminSection.tsx now imports VocabPhraseAdminSection.tsx, which pulls in
// the real supabase-service/supabaseClient modules -- those throw at import
// time when Supabase env vars aren't set. This test only exercises a pure
// exported function and never touches Supabase, so a bare mock is enough
// (same pattern as supabase-service.tagging.test.ts).
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { paginateAdminRowsByCharacter } from "./AdminSection";
import type { AdminTableRow } from "./admin.types";

function makeRow(rowKey: string, character: string, pronunciation: string): AdminTableRow {
  return {
    rowKey,
    targetKey: `${character}|${pronunciation}`,
    rowType: "existing",
    pendingId: null,
    character,
    pronunciation,
    meaningZh: "meaning",
    meaningEn: "meaning-en",
    phrase: "phrase",
    phrasePinyin: "phrase-pinyin",
    example: "example",
    examplePinyin: "example-pinyin",
    includeInFillTest: true,
  };
}

describe("paginateAdminRowsByCharacter", () => {
  it("keeps all rows for a character together on the same page", () => {
    const rows = [
      makeRow("r1", "甲", "jia"),
      makeRow("r2", "甲", "jia"),
      makeRow("r3", "乙", "yi"),
      makeRow("r4", "乙", "yi"),
      makeRow("r5", "乙", "yi"),
    ];

    const pages = paginateAdminRowsByCharacter(rows, 3);

    expect(pages).toHaveLength(2);
    expect(pages[0].map((row) => row.character)).toEqual(["甲", "甲"]);
    expect(pages[1].map((row) => row.character)).toEqual(["乙", "乙", "乙"]);
  });

  it("lets the earlier page exceed the nominal row count to avoid splitting a character", () => {
    const rows = [
      makeRow("r1", "甲", "jia"),
      makeRow("r2", "乙", "yi"),
      makeRow("r3", "乙", "yi"),
      makeRow("r4", "乙", "yi"),
      makeRow("r5", "丙", "bing"),
    ];

    const pages = paginateAdminRowsByCharacter(rows, 2);

    expect(pages).toHaveLength(3);
    expect(pages[0].map((row) => row.character)).toEqual(["甲"]);
    expect(pages[1].map((row) => row.character)).toEqual(["乙", "乙", "乙"]);
    expect(pages[2].map((row) => row.character)).toEqual(["丙"]);
  });

  it("returns a single empty page when there are no rows", () => {
    expect(paginateAdminRowsByCharacter([], 15)).toEqual([[]]);
  });
});
