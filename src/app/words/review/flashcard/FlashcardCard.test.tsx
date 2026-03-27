import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FlashcardLlmResponse } from "@/lib/flashcardLlm";
import type { Word } from "@/lib/types";
import { wordsStrings } from "../../words.strings";
import FlashcardCard from "./FlashcardCard";

const baseWord: Word = {
  id: "word-1",
  hanzi: "你",
  createdAt: 0,
  repetitions: 0,
  intervalDays: 0,
  ease: 21,
  nextReviewAt: 0,
};

function renderCard(
  flashcardContent: FlashcardLlmResponse | undefined,
  options?: {
    pronunciationLabel?: string;
    showPinyin?: boolean;
    word?: Word;
  }
): string {
  return renderToStaticMarkup(
    <FlashcardCard
      word={options?.word ?? baseWord}
      flashcardContent={flashcardContent}
      str={wordsStrings.en}
      pronunciationLabel={options?.pronunciationLabel ?? "ni3"}
      showPinyin={options?.showPinyin ?? false}
    />
  );
}

function stripTags(markup: string): string {
  return markup.replace(/<[^>]+>/g, "");
}

describe("FlashcardCard", () => {
  it("renders the loading state when content is missing", () => {
    const markup = renderCard(undefined);

    expect(markup).toContain(wordsStrings.en.flashcard.loadingContent);
    expect(markup).toContain("flashcard-loading");
  });

  it("renders only phrases marked for fill-test", () => {
    const markup = renderCard({
      character: "你",
      pronunciation: "ni3",
      meanings: [
        {
          definition: "you",
          definition_en: "you",
          phrases: [
            {
              phrase: "你好",
              pinyin: "ni3 hao3",
              example: "你好啊",
              example_pinyin: "ni3 hao3 a",
              include_in_fill_test: true,
            },
            {
              phrase: "你们",
              pinyin: "ni3 men",
              example: "你们好",
              example_pinyin: "ni3 men hao3",
              include_in_fill_test: false,
            },
          ],
        },
      ],
    });

    const textContent = stripTags(markup);

    expect(textContent).toContain("你好");
    expect(textContent).toContain("你好啊");
    expect(markup).toContain("you / you");
    expect(textContent).not.toContain("你们");
    expect(textContent).not.toContain("你们好");
  });

  it("omits ruby pinyin markup when showPinyin is false", () => {
    const markup = renderCard(
      {
        character: "你",
        pronunciation: "ni3",
        meanings: [
          {
            definition: "you",
            phrases: [
              {
                phrase: "你好",
                pinyin: "ni3 hao3",
                example: "你好啊",
                example_pinyin: "ni3 hao3 a",
                include_in_fill_test: true,
              },
            ],
          },
        ],
      },
      { showPinyin: false }
    );

    expect(markup).toContain("hide-pinyin");
    expect(markup).not.toContain("flashcard-ruby-pinyin");
    expect(markup).not.toContain("ni3");
  });

  it("renders lowercase ruby pinyin when showPinyin is true", () => {
    const markup = renderCard(
      {
        character: "你",
        pronunciation: "NI3",
        meanings: [
          {
            definition: "you",
            phrases: [
              {
                phrase: "你好",
                pinyin: "NI3 HAO3",
                example: "你好啊",
                example_pinyin: "NI3 HAO3 A",
                include_in_fill_test: true,
              },
            ],
          },
        ],
      },
      { pronunciationLabel: "NI3", showPinyin: true }
    );

    expect(markup).not.toContain("hide-pinyin");
    expect(markup).toContain("flashcard-ruby-pinyin");
    expect(markup).toContain("ni3");
    expect(markup).toContain("hao3");
  });

  it("returns no markup when no phrase is eligible for fill-test", () => {
    const markup = renderCard({
      character: "你",
      pronunciation: "ni3",
      meanings: [
        {
          definition: "you",
          phrases: [
            {
              phrase: "你们",
              pinyin: "ni3 men",
              example: "你们好",
              example_pinyin: "ni3 men hao3",
              include_in_fill_test: false,
            },
          ],
        },
      ],
    });

    expect(markup).toBe("");
  });
});
