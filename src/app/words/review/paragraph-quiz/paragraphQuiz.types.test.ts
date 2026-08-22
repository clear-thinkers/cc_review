import { describe, expect, it } from "vitest";
import type {
  ParagraphQuizCharacterRevealContent,
  ParagraphQuizPhraseRevealContent,
  ParagraphQuizRevealContent,
} from "./paragraphQuiz.types";

describe("ParagraphQuizRevealContent", () => {
  it("constructs a character-kind entry with stacked pronunciation entries", () => {
    const content: ParagraphQuizCharacterRevealContent = {
      kind: "character",
      hanzi: "你",
      entries: [
        { pronunciation: "nǐ", meanings: [{ definition: "你", definition_en: "you", phrases: [] }] },
        { pronunciation: "ní", meanings: [] },
      ],
    };
    expect(content.entries).toHaveLength(2);
  });

  it("constructs a phrase-kind entry with an optional example", () => {
    const content: ParagraphQuizPhraseRevealContent = {
      kind: "phrase",
      phrase: "图书馆",
      pinyin: "tú shū guǎn",
      meaningZh: "藏书的地方",
      meaningEn: "library",
      example: { zh: "我去图书馆。", pinyin: "wǒ qù tú shū guǎn.", includeInFillTest: true },
    };
    expect(content.example?.zh).toBe("我去图书馆。");
  });

  it("narrows the union by kind", () => {
    const values: ParagraphQuizRevealContent[] = [
      { kind: "character", hanzi: "你", entries: [] },
      { kind: "phrase", phrase: "图书馆", pinyin: "" },
    ];
    for (const value of values) {
      if (value.kind === "character") {
        expect(Array.isArray(value.entries)).toBe(true);
      } else {
        expect(typeof value.phrase).toBe("string");
      }
    }
  });
});
