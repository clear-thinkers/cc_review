import { beforeEach, describe, expect, it, vi } from "vitest";

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
  appendTargetsToReviewTestSession,
  completeReviewTestSession,
  createReviewTestSession,
  deleteReviewTestSession,
  listReviewTestSessions,
} from "./supabase-service";

function mockSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
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

describe("supabase-service review test sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("lists active review test sessions with ordered targets", async () => {
    const sessionBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
    };
    sessionBuilder.select.mockReturnValue(sessionBuilder);
    sessionBuilder.eq.mockReturnValue(sessionBuilder);
    sessionBuilder.is.mockReturnValue(sessionBuilder);
    sessionBuilder.order.mockResolvedValue({
      data: [
        {
          id: "session-1",
          name: "Weekend",
          created_at: "2026-03-21T00:00:00.000Z",
          created_by_user_id: "user-1",
          completed_at: null,
          completed_by_user_id: null,
        },
      ],
      error: null,
    });

    const targetBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
    };
    targetBuilder.select.mockReturnValue(targetBuilder);
    targetBuilder.eq.mockReturnValue(targetBuilder);
    targetBuilder.in.mockReturnValue(targetBuilder);
    targetBuilder.order.mockResolvedValue({
      data: [
        {
          session_id: "session-1",
          character: " alpha ",
          pronunciation: " hao3 ",
          display_order: 0,
        },
      ],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_sessions") {
        return sessionBuilder;
      }
      if (table === "review_test_session_targets") {
        return targetBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(listReviewTestSessions()).resolves.toEqual([
      {
        id: "session-1",
        name: "Weekend",
        createdAt: new Date("2026-03-21T00:00:00.000Z").getTime(),
        createdByUserId: "user-1",
        completedAt: null,
        completedByUserId: null,
        targets: [
          {
            sessionId: "session-1",
            character: "alpha",
            pronunciation: "hao3",
            key: "alpha|hao3",
            displayOrder: 0,
          },
        ],
      },
    ]);
  });

  it("creates a review test session and numbered targets", async () => {
    const sessionInsert = vi.fn().mockResolvedValue({ error: null });
    const targetInsert = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_sessions") {
        return {
          insert: sessionInsert,
        };
      }
      if (table === "review_test_session_targets") {
        return {
          insert: targetInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const session = await createReviewTestSession("  Weekend  ", [
      { character: "alpha", pronunciation: "hao3", key: "alpha|hao3" },
      { character: "beta", pronunciation: "xue2", key: "beta|xue2" },
    ]);

    expect(session.name).toBe("Weekend");
    expect(session.targets.map((target) => target.displayOrder)).toEqual([0, 1]);
    expect(sessionInsert).toHaveBeenCalledTimes(1);
    expect(targetInsert).toHaveBeenCalledTimes(1);
  });

  it("appends only new targets to an existing review test session", async () => {
    const selectBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    selectBuilder.select.mockReturnValue(selectBuilder);
    selectBuilder.eq.mockReturnValue(selectBuilder);
    selectBuilder.order.mockResolvedValue({
      data: [
        {
          session_id: "session-1",
          character: "alpha",
          pronunciation: "hao3",
          display_order: 0,
        },
      ],
      error: null,
    });

    const targetInsert = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_session_targets") {
        return {
          ...selectBuilder,
          insert: targetInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      appendTargetsToReviewTestSession("session-1", [
        { character: "alpha", pronunciation: "hao3", key: "alpha|hao3" },
        { character: "beta", pronunciation: "xue2", key: "beta|xue2" },
      ])
    ).resolves.toBe(1);

    expect(targetInsert).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        family_id: "family-1",
        character: "beta",
        pronunciation: "xue2",
        display_order: 1,
      },
    ]);
  });

  it("deletes an active review test session", async () => {
    const deleteBuilder = {
      delete: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      select: vi.fn(),
    };
    deleteBuilder.delete.mockReturnValue(deleteBuilder);
    deleteBuilder.eq.mockReturnValue(deleteBuilder);
    deleteBuilder.is.mockReturnValue(deleteBuilder);
    deleteBuilder.select.mockResolvedValue({
      data: [{ id: "session-1" }],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "review_test_sessions") {
        return deleteBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deleteReviewTestSession("session-1")).resolves.toBeUndefined();
  });

  it("completes a review test session through the RPC helper", async () => {
    rpcMock.mockResolvedValue({ error: null });

    await expect(completeReviewTestSession("session-1")).resolves.toBeUndefined();

    expect(rpcMock).toHaveBeenCalledWith("complete_review_test_session", {
      p_session_id: "session-1",
    });
  });
});
