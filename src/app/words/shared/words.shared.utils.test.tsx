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

function getRootClassName(node: ReactNode): string {
  if (!isValidElement(node)) {
    return "";
  }

  const className = (node.props as { className?: string }).className;
  return typeof className === "string" ? className : "";
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

  it("allows wrapped sentence layout when requested", () => {
    const className = getRootClassName(
      renderSentenceWithPinyin(
        "\u8fd9\u573a\u767e\u7c73\u8d5b\u8dd1\u4e2d\uff0c\u4e24\u4f4d\u9009\u624b\u5e76\u9a7e\u9f50\u9a71\u3002",
        "zh\u00e8 ch\u01ceng b\u01cei m\u01d0 s\u00e0i p\u01ceo zh\u014dng li\u01ceng w\u00e8i xu\u01cen sh\u01d2u b\u00ecng ji\u00e0 q\u00ed q\u016b",
        { allowWrap: true }
      )
    );

    expect(className).toContain("flex-wrap");
    expect(className).toContain("max-w-full");
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
