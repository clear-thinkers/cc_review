import { describe, expect, it } from "vitest";
import { buildXinhuaFlashcardInfo, type XinhuaDataset } from "./xinhua";

const sampleDataset: XinhuaDataset = {
  word: [
    {
      word: "学",
      pinyin: "xue2",
      explanation: "学习；研究",
      radicals: "子",
      strokes: "8",
    },
  ],
  ci: [
    { ci: "学习", explanation: "从阅读、听讲中获得知识" },
    { ci: "同学", explanation: "在同一学校学习的人" },
    { ci: "学生", explanation: "在学校学习的人" },
    { ci: "学问", explanation: "系统知识" },
    { ci: "学院", explanation: "高等院校内部机构" },
    { ci: "化学", explanation: "研究物质组成和变化的科学" },
    { ci: "学习", explanation: "重复词条，用于去重测试" },
  ],
  idiom: [
    {
      word: "学而不厌",
      pinyin: "xue2 er2 bu4 yan4",
      explanation: "学习总不感到满足",
      example: "他平时学而不厌，成绩稳定。",
    },
    {
      word: "勤学苦练",
      pinyin: "qin2 xue2 ku3 lian4",
      explanation: "勤奋学习，刻苦训练",
    },
  ],
  xiehouyu: [
    {
      riddle: "孔夫子搬家",
      answer: "尽是书（输）",
    },
    {
      riddle: "师傅领进门",
      answer: "修行在个人",
    },
  ],
};

describe("buildXinhuaFlashcardInfo", () => {
  it("builds flashcard info with defaults for ci and idiom limits", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "学");

    expect(result).not.toBeNull();
    expect(result?.word).toBe("学");
    expect(result?.pinyin).toEqual(["xue2"]);
    expect(result?.explanation).toBe("学习；研究");
    expect(result?.ci).toHaveLength(5);
    expect(result?.idiom).toHaveLength(2);
    expect(result?.example.source).toBe("xinhua_idiom");
    expect(result?.example.reference).toBe("学而不厌");
    expect(result?.example.sentence).toBe("他平时学而不厌，成绩稳定。");
  });

  it("applies limits and falls back to llm_pending example when idiom has no example", () => {
    const noIdiomExampleDataset: XinhuaDataset = {
      ...sampleDataset,
      idiom: [
        {
          word: "勤学苦练",
          explanation: "勤奋学习，刻苦训练",
        },
      ],
    };

    const result = buildXinhuaFlashcardInfo(noIdiomExampleDataset, "学", {
      ciLimit: 3,
      idiomLimit: 1,
      xiehouyuLimit: 0,
    });

    expect(result).not.toBeNull();
    expect(result?.ci).toHaveLength(3);
    expect(result?.idiom).toHaveLength(1);
    expect(result?.xiehouyu).toHaveLength(0);
    expect(result?.example.source).toBe("llm_pending");
    expect(result?.example.reference).toBe(result?.ci[0]?.text ?? null);
  });

  it("returns null for missing characters", () => {
    const result = buildXinhuaFlashcardInfo(sampleDataset, "未");
    expect(result).toBeNull();
  });
});
