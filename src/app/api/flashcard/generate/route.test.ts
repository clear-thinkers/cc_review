import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getUser: vi.fn() } },
  getServerSupabaseClient: vi.fn(),
}));

const { POST } = await import("./route");

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/flashcard/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/flashcard/generate", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
    delete process.env.DEEPSEEK_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("falls back to a currently-supported DeepSeek model when DEEPSEEK_MODEL is unset", async () => {
    let requestedModel: unknown;
    global.fetch = vi.fn(async (_url, init) => {
      requestedModel = JSON.parse((init as RequestInit).body as string).model;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"example_pinyin":"gāng qín"}' } }] }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const response = await POST(
      buildRequest({
        mode: "example_pinyin",
        character: "钢",
        pronunciation: "gang1",
        example: "很久没弹钢琴，我的手法有些生疏了。",
      })
    );

    expect(response.status).toBe(200);
    // Regression guard: DeepSeek retired the "deepseek-chat" alias — every
    // generation call fails with a 400 from the provider if this regresses.
    expect(requestedModel).not.toBe("deepseek-chat");
    expect(requestedModel).toBe("deepseek-v4-flash");
  });

  it("uses DEEPSEEK_MODEL from the environment when set", async () => {
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    let requestedModel: unknown;
    global.fetch = vi.fn(async (_url, init) => {
      requestedModel = JSON.parse((init as RequestInit).body as string).model;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"example_pinyin":"gāng qín"}' } }] }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const response = await POST(
      buildRequest({
        mode: "example_pinyin",
        character: "钢",
        pronunciation: "gang1",
        example: "很久没弹钢琴，我的手法有些生疏了。",
      })
    );

    expect(response.status).toBe(200);
    expect(requestedModel).toBe("deepseek-v4-pro");
  });

  it("surfaces a generic error when the provider rejects the request (e.g. an unsupported model)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message:
              "The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-chat.",
            type: "invalid_request_error",
          },
        }),
        { status: 400 }
      );
    }) as unknown as typeof fetch;

    const response = await POST(
      buildRequest({
        mode: "example_pinyin",
        character: "钢",
        pronunciation: "gang1",
        example: "很久没弹钢琴，我的手法有些生疏了。",
      })
    );

    expect(response.status).toBe(502);
    const payload = (await response.json()) as { error: string; detail: string };
    expect(payload.error).toBe("Failed to generate flashcard content.");
    expect(payload.detail).toContain("DeepSeek API request failed");
  });

  it("retries phrase_details generation when the example omits the exact phrase", async () => {
    let callCount = 0;
    global.fetch = vi.fn(async () => {
      callCount += 1;
      const content =
        callCount === 1
          ? JSON.stringify({
              pinyin: "cāng lǎo",
              example: "爷爷虽然头发苍白，但精神很好。",
              example_pinyin: "yé ye suī rán tóu fa cāng bái",
            })
          : JSON.stringify({
              pinyin: "cāng lǎo",
              example: "爷爷虽然苍老，但精神很好。",
              example_pinyin: "yé ye suī rán cāng lǎo",
            });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const response = await POST(
      buildRequest({
        mode: "phrase_details",
        character: "苍",
        pronunciation: "cāng",
        meaning: "灰白色",
        phrase: "苍老",
      })
    );

    expect(callCount).toBe(2);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { example: string };
    expect(payload.example).toContain("苍老");
  });

  it("fails phrase_details generation after retries if the example never contains the exact phrase", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pinyin: "cāng lǎo",
                  example: "爷爷虽然头发苍白，但精神很好。",
                  example_pinyin: "yé ye suī rán tóu fa cāng bái",
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const response = await POST(
      buildRequest({
        mode: "phrase_details",
        character: "苍",
        pronunciation: "cāng",
        meaning: "灰白色",
        phrase: "苍老",
      })
    );

    expect(response.status).toBe(502);
  });

  it("returns 503 when DEEPSEEK_API_KEY is missing", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const response = await POST(
      buildRequest({ mode: "example_pinyin", character: "钢", pronunciation: "gang1", example: "test" })
    );

    expect(response.status).toBe(503);
  });
});
