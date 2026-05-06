import { describe, expect, it } from "vitest";
import { buildXinhuaFlashcardInfo, type XinhuaDataset } from "./xinhua";

const sampleDataset: XinhuaDataset = {
  detail: [
    {
      char: "你",
      pronunciations: [
        {
          pinyin: "nǐ",
          explanations: [{ content: "称说话的对方。" }],
        },
      ],
    },
    {
      char: "好",
      word: [
        { pinyin: "hǎo", explanations: [{ content: "优点多。" }] },
        { pinyin: "hào", explanations: [{ content: "喜爱。" }] },
      ],
    },
    {
      char: "学",
      pronunciations: [{ pinyin: "xué" }, { pinyin: "xué" }],
    },
  ],
};

describe("buildXinhuaFlashcardInfo", () => {
  it("reads character and pinyin from detail.pronunciations only", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "你");

    expect(result).not.toBeNull();
    expect(result?.word).toBe("你");
    expect(result?.pinyin).toEqual(["nǐ"]);
    expect(result?.pronunciations).toEqual([{ pinyin: "nǐ", explanations: [] }]);
  });

  it("supports detail.word as pronunciation source", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "好");

    expect(result).not.toBeNull();
    expect(result?.pinyin).toEqual(["hǎo", "hào"]);
    expect(result?.pronunciations).toEqual([
      { pinyin: "hǎo", explanations: [] },
      { pinyin: "hào", explanations: [] },
    ]);
  });

  it("dedupes duplicated pinyin entries", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "学");

    expect(result).not.toBeNull();
    expect(result?.pinyin).toEqual(["xué"]);
    expect(result?.pronunciations).toEqual([{ pinyin: "xué", explanations: [] }]);
  });

  it("merges missing base pronunciations into trimmed detail entries", () => {
    const result = buildXinhuaFlashcardInfo(
      {
        detail: [{ char: "\u6084", pinyin: ["qi\u01ceo"] }],
        base: [{ char: "\u6084", pinyin: ["qi\u01ceo", "qi\u0101o"] }],
      },
      "\u6084"
    );

    expect(result).not.toBeNull();
    expect(result?.pinyin).toEqual(["qi\u01ceo", "qi\u0101o"]);
    expect(result?.pronunciations).toEqual([
      { pinyin: "qi\u01ceo", explanations: [] },
      { pinyin: "qi\u0101o", explanations: [] },
    ]);
  });

  it("dedupes pinyin when base data uses phonetic letter g", () => {
    const result = buildXinhuaFlashcardInfo(
      {
        detail: [{ char: "\u4e1c", pinyin: ["d\u014dng"] }],
        base: [{ char: "\u4e1c", pinyin: ["d\u014dn\u0261"] }],
      },
      "\u4e1c"
    );

    expect(result).not.toBeNull();
    expect(result?.pinyin).toEqual(["d\u014dng"]);
    expect(result?.pronunciations).toEqual([{ pinyin: "d\u014dng", explanations: [] }]);
  });

  it("returns null for unknown character", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "未");
    expect(result).toBeNull();
  });
});
