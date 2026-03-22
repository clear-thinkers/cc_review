import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  applyAdminMeaningEdit,
  renderPhraseWithPinyin,
  renderSentenceWithPinyin,
  tokenizePinyinSyllables,
} from "./words.shared.utils";

type NodeWithChildren = {
  children?: ReactNode;
};

function collectRtTexts(node: ReactNode): string[] {
  const texts: string[] = [];

  const walk = (current: ReactNode): void => {
    if (current == null || typeof current === "boolean") {
      return;
    }

    if (typeof current === "string" || typeof current === "number") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (!isValidElement(current)) {
      return;
    }

    const children = (current.props as NodeWithChildren).children;

    if (typeof current.type === "string" && current.type === "rt") {
      const text = Children.toArray(children)
        .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
        .join("");
      texts.push(text);
    }

    Children.forEach(children, walk);
  };

  walk(node);
  return texts;
}

describe("tokenizePinyinSyllables", () => {
  it("keeps full syllables when pinyin contains tone-mark vowels", () => {
    expect(tokenizePinyinSyllables("l\u0101 ch\u0113")).toEqual(["l\u0101", "ch\u0113"]);
    expect(tokenizePinyinSyllables("xu\u00e9 x\u00ed")).toEqual(["xu\u00e9", "x\u00ed"]);
  });
});

describe("pinyin rendering regression guard", () => {
  it("renders full tone-marked syllables for phrase ruby text", () => {
    const rtTexts = collectRtTexts(renderPhraseWithPinyin("\u62c9\u8f66", "l\u0101 ch\u0113"));
    expect(rtTexts).toEqual(["l\u0101", "ch\u0113"]);
  });

  it("renders full tone-marked syllables for sentence ruby text", () => {
    const rtTexts = collectRtTexts(
      renderSentenceWithPinyin("\u6211\u62c9\u8f66\u3002", "w\u01d2 l\u0101 ch\u0113")
    );
    expect(rtTexts).toEqual(["w\u01d2", "l\u0101", "ch\u0113"]);
  });
});

describe("applyAdminMeaningEdit", () => {
  it("updates a meaning label and replaces its English translation", () => {
    const updated = applyAdminMeaningEdit({
      content: {
        character: "兵",
        pronunciation: "bing",
        meanings: [
          {
            definition: "士兵",
            definition_en: "soldier",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
            ],
          },
        ],
      },
      currentMeaningZh: "士兵",
      currentMeaningEn: "soldier",
      nextMeaningZh: "军人",
      nextMeaningEn: "service member",
    });

    expect(updated.meanings).toHaveLength(1);
    expect(updated.meanings[0].definition).toBe("军人");
    expect(updated.meanings[0].definition_en).toBe("service member");
  });

  it("merges phrases/examples when the edited meaning matches another saved meaning", () => {
    const updated = applyAdminMeaningEdit({
      content: {
        character: "兵",
        pronunciation: "bing",
        meanings: [
          {
            definition: "士兵",
            definition_en: "soldier",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
              {
                phrase: "兵营",
                pinyin: "bing ying",
                example: "兵营很整齐。",
                example_pinyin: "bing ying hen zheng qi。",
              },
            ],
          },
          {
            definition: "军人",
            definition_en: "military person",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
              {
                phrase: "兵种",
                pinyin: "bing zhong",
                example: "这个兵种很重要。",
                example_pinyin: "zhe ge bing zhong hen zhong yao。",
              },
            ],
          },
        ],
      },
      currentMeaningZh: "士兵",
      currentMeaningEn: "soldier",
      nextMeaningZh: "军人",
      nextMeaningEn: "service member",
    });

    expect(updated.meanings).toHaveLength(1);
    expect(updated.meanings[0].definition).toBe("军人");
    expect(updated.meanings[0].definition_en).toBe("service member");
    expect(updated.meanings[0].phrases.map((phrase) => phrase.phrase)).toEqual(["士兵", "兵种", "兵营"]);
  });
});
