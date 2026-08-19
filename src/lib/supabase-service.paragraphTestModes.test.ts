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

import {
  createParagraphTestMode,
  deleteParagraphTestMode,
  listAllParagraphTestModes,
  listParagraphTestModes,
  PARAGRAPH_TEST_MODE_NAME_TAKEN,
  updateParagraphTestMode,
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

const SAMPLE_ROW = {
  id: "mode-1",
  paragraph_id: "paragraph-1",
  family_id: "family-1",
  name: "Quiz 1",
  span_ids: ["s0-0-1", "s0-3-6"],
  created_by_user_id: "user-1",
  created_at: "2026-08-18T00:00:00.000Z",
  updated_at: "2026-08-18T00:00:00.000Z",
};

describe("supabase-service paragraph test modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("listParagraphTestModes scopes to family_id and paragraph_id, oldest first", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [SAMPLE_ROW], error: null });
    fromMock.mockReturnValue(builder);

    const result = await listParagraphTestModes("paragraph-1");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "paragraph_id", "paragraph-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "mode-1",
      paragraphId: "paragraph-1",
      name: "Quiz 1",
      spanIds: ["s0-0-1", "s0-3-6"],
      createdByUserId: "user-1",
      createdAt: new Date("2026-08-18T00:00:00.000Z").getTime(),
      updatedAt: new Date("2026-08-18T00:00:00.000Z").getTime(),
    });
  });

  it("listAllParagraphTestModes scopes the select to family_id only, no paragraph_id filter", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockResolvedValue({ data: [SAMPLE_ROW], error: null });
    fromMock.mockReturnValue(builder);

    const result = await listAllParagraphTestModes();
    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(result).toHaveLength(1);
  });

  it("createParagraphTestMode rejects an empty name without querying", async () => {
    await expect(createParagraphTestMode("paragraph-1", "  ", ["s0-0-1"])).rejects.toThrow(
      "Test mode name is required."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("createParagraphTestMode rejects zero spans without querying", async () => {
    await expect(createParagraphTestMode("paragraph-1", "Quiz 1", [])).rejects.toThrow(
      "Select at least one span for the test mode."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("createParagraphTestMode inserts with resolved family/user ids and trimmed name", async () => {
    const builder = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    const result = await createParagraphTestMode("paragraph-1", "  Quiz 1  ", ["s0-0-1", "s0-3-6"]);
    expect(builder.insert).toHaveBeenCalledWith({
      paragraph_id: "paragraph-1",
      family_id: "family-1",
      name: "Quiz 1",
      span_ids: ["s0-0-1", "s0-3-6"],
      created_by_user_id: "user-1",
    });
    expect(result.id).toBe("mode-1");
  });

  it("createParagraphTestMode translates a unique-constraint violation to the distinguishable error", async () => {
    const builder = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value" } });
    fromMock.mockReturnValue(builder);

    await expect(createParagraphTestMode("paragraph-1", "Quiz 1", ["s0-0-1"])).rejects.toThrow(
      PARAGRAPH_TEST_MODE_NAME_TAKEN
    );
  });

  it("createParagraphTestMode surfaces a non-collision DB error as a generic message", async () => {
    const builder = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    fromMock.mockReturnValue(builder);

    await expect(createParagraphTestMode("paragraph-1", "Quiz 1", ["s0-0-1"])).rejects.toThrow(
      "createParagraphTestMode: permission denied"
    );
  });

  it("updateParagraphTestMode writes only the provided fields plus a fresh updated_at", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    await updateParagraphTestMode("mode-1", { name: "Renamed" });
    const writtenRow = builder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(writtenRow.name).toBe("Renamed");
    expect(writtenRow.span_ids).toBeUndefined();
    expect(typeof writtenRow.updated_at).toBe("string");
  });

  it("updateParagraphTestMode rejects renaming to an empty name without querying", async () => {
    await expect(updateParagraphTestMode("mode-1", { name: "   " })).rejects.toThrow(
      "Test mode name is required."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updateParagraphTestMode rejects clearing spanIds to empty without querying", async () => {
    await expect(updateParagraphTestMode("mode-1", { spanIds: [] })).rejects.toThrow(
      "Select at least one span for the test mode."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updateParagraphTestMode translates a rename collision to the distinguishable error", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value" } });
    fromMock.mockReturnValue(builder);

    await expect(updateParagraphTestMode("mode-1", { name: "Quiz 1" })).rejects.toThrow(
      PARAGRAPH_TEST_MODE_NAME_TAKEN
    );
  });

  it("updateParagraphTestMode scopes the update to id and family_id", async () => {
    const builder = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: SAMPLE_ROW, error: null });
    fromMock.mockReturnValue(builder);

    await updateParagraphTestMode("mode-1", { spanIds: ["s0-0-1"] });
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", "mode-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "family_id", "family-1");
  });

  it("deleteParagraphTestMode scopes the delete to id and family_id", async () => {
    const builder = { delete: vi.fn(), eq: vi.fn() };
    builder.delete.mockReturnValue(builder);
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    builder.eq.mockReturnValue({ eq: secondEq });
    fromMock.mockReturnValue(builder);

    await deleteParagraphTestMode("mode-1");
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", "mode-1");
    expect(secondEq).toHaveBeenCalledWith("family_id", "family-1");
  });

  it("normalizes malformed span_ids jsonb by dropping non-string entries", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [{ ...SAMPLE_ROW, span_ids: ["s0-0-1", 42, null, "s0-3-6"] }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listParagraphTestModes("paragraph-1");
    expect(result[0]?.spanIds).toEqual(["s0-0-1", "s0-3-6"]);
  });

  it("normalizes non-array span_ids jsonb to an empty array", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [{ ...SAMPLE_ROW, span_ids: null }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listParagraphTestModes("paragraph-1");
    expect(result[0]?.spanIds).toEqual([]);
  });
});
