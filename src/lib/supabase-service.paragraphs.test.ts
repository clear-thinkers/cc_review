import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAccessToken } from "./testHelpers/fakeJwt";

const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

import { createParagraph, deleteParagraph, getParagraph, listParagraphs, updateParagraph } from "./supabase-service";
import type { ParagraphSentence } from "./paragraph.types";

function mockSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: makeFakeAccessToken({ app_metadata: { family_id: "family-1", user_id: "user-1" } }),
        user: {
          id: "auth-user-1",
          app_metadata: {
            family_id: "family-1",
            user_id: "user-1",
          },
        },
      },
    },
  });
}

const SAMPLE_SENTENCES: ParagraphSentence[] = [
  {
    index: 0,
    text: "我喜欢图书馆。",
    paragraphBreakBefore: false,
    spans: [
      {
        id: "span-1",
        text: "图书馆",
        startOffset: 2,
        endOffset: 5,
        kind: "phrase",
        resolvedVocabPhraseId: "vp-1",
        fillTestEligible: true,
      },
    ],
  },
];

const SAMPLE_ROW = {
  id: "paragraph-1",
  family_id: "family-1",
  title: null,
  raw_text: "我喜欢图书馆。",
  sentences: [
    {
      index: 0,
      text: "我喜欢图书馆。",
      paragraphBreakBefore: false,
      spans: [
        {
          id: "span-1",
          text: "图书馆",
          startOffset: 2,
          endOffset: 5,
          kind: "phrase",
          resolvedVocabPhraseId: "vp-1",
          fillTestEligible: true,
        },
      ],
    },
  ],
  created_by_user_id: "user-1",
  created_at: "2026-08-17T00:00:00.000Z",
  updated_at: "2026-08-17T00:00:00.000Z",
};

describe("supabase-service paragraphs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("createParagraph inserts with resolved family/user ids and normalized sentences", async () => {
    const builder = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    const result = await createParagraph("我喜欢图书馆。", null, SAMPLE_SENTENCES);

    expect(builder.insert).toHaveBeenCalledWith({
      family_id: "family-1",
      title: null,
      raw_text: "我喜欢图书馆。",
      sentences: SAMPLE_ROW.sentences,
      created_by_user_id: "user-1",
    });
    expect(result.id).toBe("paragraph-1");
    expect(result.sentences).toEqual(SAMPLE_SENTENCES);
    expect(result.createdByUserId).toBe("user-1");
  });

  it("listParagraphs scopes the select to the current family, newest first", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [SAMPLE_ROW], error: null });
    fromMock.mockReturnValue(builder);

    const result = await listParagraphs();
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("paragraph-1");
  });

  it("getParagraph returns null when no row matches", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await expect(getParagraph("missing")).resolves.toBeNull();
  });

  it("getParagraph scopes to id and family_id and maps the row", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    const result = await getParagraph("paragraph-1");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", "paragraph-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "family_id", "family-1");
    expect(result?.rawText).toBe("我喜欢图书馆。");
  });

  it("deleteParagraph scopes the delete to id and family_id", async () => {
    const builder = { delete: vi.fn(), eq: vi.fn() };
    builder.delete.mockReturnValue(builder);
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    builder.eq.mockReturnValue({ eq: secondEq });
    fromMock.mockReturnValue(builder);

    await deleteParagraph("paragraph-1");
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", "paragraph-1");
    expect(secondEq).toHaveBeenCalledWith("family_id", "family-1");
  });

  it("normalizes malformed sentences jsonb by dropping invalid entries", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: {
        ...SAMPLE_ROW,
        sentences: [
          { index: 0, text: "valid", paragraphBreakBefore: false, spans: [] },
          { index: 1, text: "", paragraphBreakBefore: false, spans: [] }, // dropped: empty text
          { text: "missing index", paragraphBreakBefore: false, spans: [] }, // dropped: no index
          "not an object", // dropped
          null, // dropped
        ],
      },
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await getParagraph("paragraph-1");
    expect(result?.sentences).toEqual([{ index: 0, text: "valid", paragraphBreakBefore: false, spans: [] }]);
  });

  it("normalizes malformed span entries within a sentence, dropping invalid ones", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: {
        ...SAMPLE_ROW,
        sentences: [
          {
            index: 0,
            text: "你好",
            paragraphBreakBefore: false,
            spans: [
              { id: "s1", text: "你", startOffset: 0, endOffset: 1, kind: "character", fillTestEligible: true },
              { id: "s2", text: "好", startOffset: 1, kind: "character", fillTestEligible: true }, // dropped: missing endOffset
              { id: "s3", text: "好", startOffset: 1, endOffset: 2, kind: "word", fillTestEligible: true }, // dropped: invalid kind
            ],
          },
        ],
      },
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await getParagraph("paragraph-1");
    expect(result?.sentences[0]?.spans).toEqual([
      { id: "s1", text: "你", startOffset: 0, endOffset: 1, kind: "character", fillTestEligible: true },
    ]);
  });

  it("updateParagraph writes title, sentences, and a fresh updated_at", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    await updateParagraph("paragraph-1", { title: "New Title", sentences: SAMPLE_SENTENCES });

    const writtenRow = builder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(writtenRow.title).toBe("New Title");
    expect(writtenRow.sentences).toEqual(SAMPLE_ROW.sentences);
    expect(typeof writtenRow.updated_at).toBe("string");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", "paragraph-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "family_id", "family-1");
  });

  it("updateParagraph writes only the provided fields, still bumping updated_at", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    await updateParagraph("paragraph-1", { title: "Only Title" });

    const writtenRow = builder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(writtenRow).toEqual({ title: "Only Title", updated_at: writtenRow.updated_at });
    expect(writtenRow.sentences).toBeUndefined();
  });

  it("updateParagraph allows explicitly clearing the title to null", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    await updateParagraph("paragraph-1", { title: null });

    const writtenRow = builder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(writtenRow.title).toBeNull();
  });

  it("normalizeParagraphSentences via getParagraph returns [] for non-array sentences", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, sentences: null },
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await getParagraph("paragraph-1");
    expect(result?.sentences).toEqual([]);
  });
});
