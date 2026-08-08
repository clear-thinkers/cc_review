import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getUser: getUserMock } },
  getServerSupabaseClient: vi.fn(() => ({ from: fromMock })),
}));

const { PATCH } = await import("./route");

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(payload: object): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  return `${header}.${body}.fakesignature`;
}

function buildRequest(token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/auth/update-avatar", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/auth/update-avatar", () => {
  const updateEq = vi.fn(async () => ({ data: null, error: null }));
  const updateMock = vi.fn(() => ({ eq: updateEq }));

  beforeEach(() => {
    vi.clearAllMocks();
    // getUser() is a LIVE auth.users read -- its own app_metadata must
    // never be trusted for the active profile (it's not written by
    // pin-verify anymore); only used here to confirm the token is valid.
    getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-1", app_metadata: { stale: "should never be read" } } },
      error: null,
    });
    updateEq.mockClear();
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return { update: updateMock };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("resolves the active profile's user_id from the token's own app_metadata claim, not from a live auth.users lookup", async () => {
    const token = makeToken({ app_metadata: { user_id: "child-1", family_id: "family-1" } });

    const response = await PATCH(buildRequest(token, { avatarId: "cake_sleep_1" }));

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ avatar_id: "cake_sleep_1" });
    expect(updateEq).toHaveBeenCalledWith("id", "child-1");
  });

  it("returns 403 when the token has no app_metadata.user_id claim (Layer 2 not completed)", async () => {
    const token = makeToken({ sub: "auth-user-1" });

    const response = await PATCH(buildRequest(token, { avatarId: "cake_sleep_1" }));

    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await PATCH(buildRequest(null, { avatarId: "cake_sleep_1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid avatarId", async () => {
    const token = makeToken({ app_metadata: { user_id: "child-1" } });

    const response = await PATCH(buildRequest(token, { avatarId: "not-a-real-avatar" }));

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
