import { describe, expect, it } from "vitest";
import { normalizeFlashcardLlmResponse, type FlashcardLlmRequest } from "./flashcardLlm";

describe("normalizeFlashcardLlmResponse fill-test flag", () => {
  const request: FlashcardLlmRequest = {
    character: "\u4f60",
    pronunciation: "ni3",
  };

  it("defaults include_in_fill_test to true", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "\u79f0\u8bf4\u8bdd\u7684\u5bf9\u65b9",
            phrases: [
              {
                phrase: "\u4f60\u597d",
                pinyin: "ni3 hao3",
                example: "\u4f60\u597d\u5417\uff1f",
              },
              {
                phrase: "\u4f60\u4eec",
                pinyin: "ni3 men",
                example: "\u4f60\u4eec\u5f88\u68d2\u3002",
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.meanings).toHaveLength(1);
    expect(response.meanings[0].phrases).toHaveLength(2);
    expect(response.meanings[0].phrases[0].include_in_fill_test).toBe(true);
    expect(response.meanings[0].phrases[1].include_in_fill_test).toBe(true);
  });

  it("preserves an explicit include_in_fill_test false value", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "\u79f0\u8bf4\u8bdd\u7684\u5bf9\u65b9",
            phrases: [
              {
                phrase: "\u4f60\u597d",
                pinyin: "ni3 hao3",
                example: "\u4f60\u597d\u554a\u3002",
                include_in_fill_test: false,
              },
              {
                phrase: "\u4f60\u4eec",
                pinyin: "ni3 men",
                example: "\u4f60\u4eec\u4eca\u5929\u8ba4\u771f\u542c\u8bfe\u3002",
                includeInFillTest: true,
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.meanings[0].phrases[0].include_in_fill_test).toBe(false);
    expect(response.meanings[0].phrases[1].include_in_fill_test).toBe(true);
  });
});

