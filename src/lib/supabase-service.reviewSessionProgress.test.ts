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
  deleteReviewSessionProgress,
  listReviewSessionProgress,
  loadReviewSessionProgress,
  saveReviewSessionProgress,
} from "./supabase-service";

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

describe("supabase-service review session progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("resolves user_id/family_id from the access token's own claims, not the stale session.user.app_metadata (regression: packaged-session-limbo autosave RLS failure)", async () => {
    // session.user.app_metadata reflects the auth.users DB row, which
    // session-scoped profile claims (2026-08-08) stopped keeping in sync
    // with the active Layer 2 profile -- it can be frozen showing a
    // DIFFERENT profile (e.g. the parent) than the one actually active (a
    // child), which is exactly what caused a live RLS rejection on this
    // exact insert. The access token's own app_metadata claim (what Postgres
    // RLS reads server-side) must be the source of truth instead.
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: makeFakeAccessToken({
            app_metadata: { family_id: "family-1", user_id: "child-1" },
          }),
          user: {
            id: "auth-user-1",
            // Stale: frozen at the parent's identity from before the
            // session-scoped-claims migration, even though a child is the
            // one actually playing per the access token above.
            app_metadata: { family_id: "family-1", user_id: "parent-1" },
          },
        },
      },
    });

    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return { upsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await saveReviewSessionProgress({
      clientSessionKey: "session-key-1",
      sourceType: "packaged",
      packagedSessionId: "review-test-session-1",
      progressData: {},
    });

    const [row] = upsert.mock.calls[0];
    expect(row.user_id).toBe("child-1");
    expect(row.family_id).toBe("family-1");
  });

  it("upserts progress on save with the (user_id, client_session_key) conflict target", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return { upsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      saveReviewSessionProgress({
        clientSessionKey: "session-key-1",
        sourceType: "due_review",
        packagedSessionId: null,
        progressData: { quizIndex: 2 },
      })
    ).resolves.toBeUndefined();

    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, options] = upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "user_id,client_session_key" });
    expect(row).toMatchObject({
      user_id: "user-1",
      family_id: "family-1",
      client_session_key: "session-key-1",
      source_type: "due_review",
      packaged_session_id: null,
      progress_data: { quizIndex: 2 },
    });
    expect(typeof row.last_saved_at).toBe("string");
  });

  it("includes started_at on save when provided", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return { upsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const startedAt = new Date("2026-07-24T00:00:00.000Z").getTime();
    await saveReviewSessionProgress({
      clientSessionKey: "session-key-2",
      sourceType: "packaged",
      packagedSessionId: "review-test-session-1",
      progressData: {},
      startedAt,
    });

    const [row] = upsert.mock.calls[0];
    expect(row.started_at).toBe(new Date(startedAt).toISOString());
    expect(row.packaged_session_id).toBe("review-test-session-1");
  });

  it("throws a wrapped error when save fails", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return { upsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      saveReviewSessionProgress({
        clientSessionKey: "session-key-1",
        sourceType: "due_review",
        packagedSessionId: null,
        progressData: {},
      })
    ).rejects.toThrow("saveReviewSessionProgress: boom");
  });

  it("returns null from load when no row matches", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(loadReviewSessionProgress("missing-key")).resolves.toBeNull();
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.eq).toHaveBeenCalledWith("client_session_key", "missing-key");
  });

  it("returns a mapped object from load when a row exists", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: {
        id: "progress-1",
        user_id: "user-1",
        client_session_key: "session-key-1",
        source_type: "due_review",
        packaged_session_id: null,
        progress_data: { quizIndex: 3 },
        started_at: "2026-07-24T00:00:00.000Z",
        last_saved_at: "2026-07-24T00:05:00.000Z",
      },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(loadReviewSessionProgress("session-key-1")).resolves.toEqual({
      id: "progress-1",
      userId: "user-1",
      clientSessionKey: "session-key-1",
      sourceType: "due_review",
      packagedSessionId: null,
      progressData: { quizIndex: 3 },
      startedAt: new Date("2026-07-24T00:00:00.000Z").getTime(),
      lastSavedAt: new Date("2026-07-24T00:05:00.000Z").getTime(),
    });
  });

  it("lists progress scoped to family_id (not just the caller's own user_id)", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: "progress-1",
          user_id: "child-1",
          client_session_key: "session-key-1",
          source_type: "due_review",
          packaged_session_id: null,
          progress_data: {},
          started_at: "2026-07-24T00:00:00.000Z",
          last_saved_at: "2026-07-24T00:05:00.000Z",
        },
      ],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await listReviewSessionProgress();
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("child-1");
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(builder.eq).not.toHaveBeenCalledWith("user_id", expect.anything());
  });

  it("applies the optional source_type filter when listing", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [], error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await listReviewSessionProgress("packaged");
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(builder.eq).toHaveBeenCalledWith("source_type", "packaged");
  });

  it("scopes delete to the current user via user_id and client_session_key", async () => {
    const builder = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deleteReviewSessionProgress("session-key-1")).resolves.toBeUndefined();
    expect(builder.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "client_session_key", "session-key-1");
  });

  it("throws a wrapped error when delete fails", async () => {
    const builder = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ error: { message: "nope" } });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_session_progress") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deleteReviewSessionProgress("session-key-1")).rejects.toThrow(
      "deleteReviewSessionProgress: nope"
    );
  });
});
