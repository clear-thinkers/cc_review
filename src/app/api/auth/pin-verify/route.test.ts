import { randomBytes, scryptSync } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, fromMock, adminUpdateUserByIdMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  adminUpdateUserByIdMock: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getUser: getUserMock } },
  getServerSupabaseClient: vi.fn(() => ({
    from: fromMock,
    auth: { admin: { updateUserById: adminUpdateUserByIdMock } },
  })),
}));

const { POST } = await import("./route");

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

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `${salt}:${hash}`;
}

function buildRequest(token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/auth/pin-verify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function mockUsersTable(params: {
  targetUserRow: Record<string, unknown> | null;
  callerRow: Record<string, unknown> | null;
  updateEq: ReturnType<typeof vi.fn>;
}) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((field: string) => ({
        single: vi.fn(async () => {
          if (field === "id") {
            return params.targetUserRow
              ? { data: params.targetUserRow, error: null }
              : { data: null, error: new Error("not found") };
          }
          if (field === "auth_user_id") {
            return params.callerRow
              ? { data: params.callerRow, error: null }
              : { data: null, error: new Error("not found") };
          }
          throw new Error(`Unexpected eq field: ${field}`);
        }),
      })),
    })),
    update: vi.fn(() => ({ eq: params.updateEq })),
  };
}

describe("POST /api/auth/pin-verify", () => {
  const sessionToken = makeToken({ session_id: "session-abc-123", sub: "auth-user-1" });
  const pin = "1234";
  const pinHash = hashPin(pin);
  const updateEq = vi.fn(async () => ({ data: null, error: null }));
  const upsertAuthSessionProfiles = vi.fn().mockResolvedValue({ error: null });

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    upsertAuthSessionProfiles.mockClear().mockResolvedValue({ error: null });
    updateEq.mockClear();

    fromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return mockUsersTable({
          targetUserRow: {
            id: "child-1",
            family_id: "family-1",
            name: "瓜瓜",
            role: "child",
            avatar_id: "cake_sleep_1",
            is_platform_admin: false,
            pin_hash: pinHash,
            failed_pin_attempts: 0,
          },
          callerRow: { family_id: "family-1" },
          updateEq,
        });
      }
      if (table === "auth_session_profiles") {
        return { upsert: upsertAuthSessionProfiles };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("upserts auth_session_profiles keyed by this token's own session_id on a correct PIN — not the shared app_metadata", async () => {
    const response = await POST(buildRequest(sessionToken, { userId: "child-1", pin }));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; profile: { id: string } };
    expect(payload.success).toBe(true);
    expect(payload.profile.id).toBe("child-1");

    expect(upsertAuthSessionProfiles).toHaveBeenCalledTimes(1);
    const [row, options] = upsertAuthSessionProfiles.mock.calls[0];
    expect(options).toEqual({ onConflict: "session_id" });
    expect(row).toMatchObject({
      session_id: "session-abc-123",
      auth_user_id: "auth-user-1",
      family_id: "family-1",
      user_id: "child-1",
      role: "child",
      is_platform_admin: false,
    });

    // Regression guard: session-scoped claims must never fall back to the
    // shared auth.users.app_metadata write -- see
    // docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md.
    expect(adminUpdateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns 500 and does not upsert when the caller's token has no session_id claim", async () => {
    const tokenWithoutSessionId = makeToken({ sub: "auth-user-1" });

    const response = await POST(buildRequest(tokenWithoutSessionId, { userId: "child-1", pin }));

    expect(response.status).toBe(500);
    expect(upsertAuthSessionProfiles).not.toHaveBeenCalled();
  });

  it("does not upsert auth_session_profiles when the PIN is wrong", async () => {
    const response = await POST(buildRequest(sessionToken, { userId: "child-1", pin: "0000" }));

    const payload = (await response.json()) as { success: boolean; failedAttempts: number };
    expect(payload.success).toBe(false);
    expect(payload.failedAttempts).toBe(1);
    expect(upsertAuthSessionProfiles).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await POST(buildRequest(null, { userId: "child-1", pin }));
    expect(response.status).toBe(401);
    expect(upsertAuthSessionProfiles).not.toHaveBeenCalled();
  });
});
