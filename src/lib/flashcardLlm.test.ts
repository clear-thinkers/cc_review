import { describe, expect, it } from "vitest";
import {
  buildFlashcardLlmRequestKey,
  normalizeFlashcardLlmRequest,
  normalizeFlashcardLlmResponse,
  parseAndNormalizeFlashcardLlmResponse,
  type FlashcardLlmRequest,
} from "./flashcardLlm";

describe("normalizeFlashcardLlmRequest", () => {
  it("returns null for invalid request", () => {
    expect(normalizeFlashcardLlmRequest(null)).toBeNull();
    expect(normalizeFlashcardLlmRequest({})).toBeNull();
  });

  it("normalizes character and pronunciation", () => {
    const request = normalizeFlashcardLlmRequest({
      character: "你们",
      pronunciation: " nǐ ",
    });

    expect(request).toEqual({
      character: "你",
      pronunciation: "nǐ",
    });
  });
});

describe("buildFlashcardLlmRequestKey", () => {
  it("builds stable request key", () => {
    expect(buildFlashcardLlmRequestKey({ character: "你", pronunciation: "nǐ" })).toBe("你|nǐ");
  });
});

describe("normalizeFlashcardLlmResponse", () => {
  const request: FlashcardLlmRequest = {
    character: "你",
    pronunciation: "nǐ",
  };

  it("keeps only valid meanings and two valid phrases", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "称说话的对方",
            definition_en: "you",
            phrases: [
              {
                phrase: "你好",
                pinyin: "nǐ hǎo",
                example: "你好吗？",
                example_pinyin: "nǐ hǎo ma",
                example_meaning: "How are you?",
              },
              {
                phrase: "你们",
                pinyin: "nǐ men",
                example: "你们真棒。",
                example_pinyin: "nǐ men zhēn bàng",
                example_meaning: "You all are great.",
              },
              {
                phrase: "你好",
                pinyin: "nǐ hǎo",
                example: "你好呀。",
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.character).toBe("你");
    expect(response.pronunciation).toBe("nǐ");
    expect(response.meanings).toHaveLength(1);
    expect(response.meanings[0].phrases).toHaveLength(2);
    expect(response.meanings[0].phrases[0].phrase).toBe("你好");
    expect(response.meanings[0].phrases[1].phrase).toBe("你们");
    expect(response.meanings[0].phrases[0].example_pinyin).toBe("nǐ hǎo ma");
    expect(response.meanings[0].phrases[0]).not.toHaveProperty("example_meaning");
    expect(response.meanings[0].phrases[1].example_pinyin).toBe("nǐ men zhēn bàng");
    expect(response.meanings[0].phrases[1]).not.toHaveProperty("example_meaning");
  });

  it("drops meanings that do not have two valid phrases", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "称说话的对方",
            phrases: [
              {
                phrase: "你好",
                pinyin: "nǐ hǎo",
                example: "你好",
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.meanings).toEqual([]);
  });

  it("filters unsafe and invalid phrase content", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "称说话的对方",
            phrases: [
              {
                phrase: "打架",
                pinyin: "dǎ jià",
                example: "我们不打架。",
              },
              {
                phrase: "你好",
                pinyin: "nǐ hǎo",
                example: "你好呀。",
              },
              {
                phrase: "你们",
                pinyin: "nǐ men",
                example: "你们今天认真听课。",
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.meanings).toHaveLength(1);
    expect(response.meanings[0].phrases).toHaveLength(2);
    expect(response.meanings[0].phrases.some((item) => item.phrase === "打架")).toBe(false);
  });

  it("rejects unsafe phrase 打架 as a regression guard", () => {
    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "称说话的对方",
            phrases: [
              {
                phrase: "打架",
                pinyin: "dǎ jià",
                example: "他们在打架。",
              },
              {
                phrase: "你们",
                pinyin: "nǐ men",
                example: "你们今天认真听课。",
              },
            ],
          },
        ],
      },
      request
    );

    expect(response.meanings).toEqual([]);
  });

  it("accepts examples longer than 15 chars when within 30-char limit", () => {
    const longExampleRequest: FlashcardLlmRequest = {
      character: "假",
      pronunciation: "jiǎ",
    };

    const response = normalizeFlashcardLlmResponse(
      {
        meanings: [
          {
            definition: "借势逞强",
            phrases: [
              {
                phrase: "狐假虎威",
                pinyin: "hú jiǎ hǔ wēi",
                example: "他总是狐假虎威在同学面前逞强。",
              },
              {
                phrase: "假惺惺",
                pinyin: "jiǎ xīng xīng",
                example: "他假惺惺地说关心其实一点也不真诚。",
              },
            ],
          },
        ],
      },
      longExampleRequest
    );

    expect(response.meanings).toHaveLength(1);
    expect(response.meanings[0].phrases).toHaveLength(2);
  });
});

describe("parseAndNormalizeFlashcardLlmResponse", () => {
  it("parses fenced json response", () => {
    const request: FlashcardLlmRequest = { character: "学", pronunciation: "xué" };
    const raw = [
      "```json",
      JSON.stringify({
        character: "学",
        pronunciation: "xué",
        meanings: [
          {
            definition: "学习知识",
            phrases: [
              {
                phrase: "学问",
                pinyin: "xué wèn",
                example: "学问要慢慢积累。",
                example_pinyin: "xue wen yao man man ji lei",
                example_meaning: "Knowledge grows over time.",
              },
              {
                phrase: "学习",
                pinyin: "xué xí",
                example: "我们爱学习。",
                example_pinyin: "wo men ai xue xi",
                example_meaning: "We love learning.",
              },
            ],
          },
        ],
      }),
      "```",
    ].join("\n");

    const response = parseAndNormalizeFlashcardLlmResponse(raw, request);
    expect(response.meanings).toHaveLength(1);
    expect(response.meanings[0].phrases).toHaveLength(2);
    expect(response.meanings[0].phrases[0].example_pinyin).toBe("xue wen yao man man ji lei");
    expect(response.meanings[0].phrases[0]).not.toHaveProperty("example_meaning");
  });
});
