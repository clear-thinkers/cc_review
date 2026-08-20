import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAccessToken } from "./testHelpers/fakeJwt";

const { getSessionMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
    rpc: rpcMock,
  },
}));

import {
  getActiveSessionTargetKeys,
  hasActiveParagraphQuizSession,
  hasActiveTestModeQuizSession,
} from "./supabase-service";

function mockSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: makeFakeAccessToken({ app_metadata: { family_id: "family-1", user_id: "user-1" } }),
        user: {
          id: "auth-user-1",
          app_metadata: { family_id: "family-1", user_id: "user-1" },
        },
      },
    },
  });
}

function makeCountBuilder(result: { count: number | null; error: unknown }) {
  const builder = { select: vi.fn(), eq: vi.fn(), is: vi.fn() };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockResolvedValue(result);
  return builder;
}

describe("supabase-service paragraph-quiz active-session guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("hasActiveParagraphQuizSession returns true when any of the paragraph's test modes has an active session", async () => {
    const builder = makeCountBuilder({ count: 1, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_sessions") return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(hasActiveParagraphQuizSession("paragraph-1")).resolves.toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("paragraph_test_modes.paragraph_id", "paragraph-1");
  });

  it("hasActiveParagraphQuizSession returns false when none of the paragraph's sessions are active", async () => {
    const builder = makeCountBuilder({ count: 0, error: null });
    fromMock.mockImplementation(() => builder);

    await expect(hasActiveParagraphQuizSession("paragraph-1")).resolves.toBe(false);
  });

  it("hasActiveTestModeQuizSession returns true only for THAT specific test mode, not a sibling", async () => {
    const activeBuilder = makeCountBuilder({ count: 1, error: null });
    fromMock.mockImplementation(() => activeBuilder);

    await expect(hasActiveTestModeQuizSession("test-mode-1")).resolves.toBe(true);
    expect(activeBuilder.eq).toHaveBeenCalledWith("paragraph_test_mode_id", "test-mode-1");
  });

  it("hasActiveTestModeQuizSession returns false for a sibling test mode on the same paragraph with no active session of its own", async () => {
    const inactiveBuilder = makeCountBuilder({ count: 0, error: null });
    fromMock.mockImplementation(() => inactiveBuilder);

    await expect(hasActiveTestModeQuizSession("test-mode-2")).resolves.toBe(false);
  });

  it("hasActiveParagraphQuizSession propagates a query error", async () => {
    const builder = makeCountBuilder({ count: null, error: { message: "boom" } });
    fromMock.mockImplementation(() => builder);

    await expect(hasActiveParagraphQuizSession("paragraph-1")).rejects.toThrow(
      "hasActiveParagraphQuizSession: boom"
    );
  });

  it("getActiveSessionTargetKeys resolves hanzi from character targets and ids from vocab-phrase targets, across character/phrase/mixed/paragraph-quiz sessions alike", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), is: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.is.mockResolvedValue({
      data: [
        // Ordinary character-session target.
        { character: "你", vocab_phrase_id: null },
        // Ordinary phrase-session target.
        { character: "谢谢", vocab_phrase_id: "vp-1" },
        // Mixed-session character target.
        { character: "好", vocab_phrase_id: null },
        // Paragraph-quiz blank resolving to a character.
        { character: "图", vocab_phrase_id: null },
        // Paragraph-quiz blank resolving to a phrase.
        { character: "图书馆", vocab_phrase_id: "vp-2" },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_session_targets") return builder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getActiveSessionTargetKeys();
    expect(result.hanziSet).toEqual(new Set(["你", "好", "图"]));
    expect(result.vocabPhraseIdSet).toEqual(new Set(["vp-1", "vp-2"]));
  });

  it("getActiveSessionTargetKeys returns empty sets when no session is active", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), is: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.is.mockResolvedValue({ data: [], error: null });
    fromMock.mockImplementation(() => builder);

    const result = await getActiveSessionTargetKeys();
    expect(result.hanziSet.size).toBe(0);
    expect(result.vocabPhraseIdSet.size).toBe(0);
  });
});
