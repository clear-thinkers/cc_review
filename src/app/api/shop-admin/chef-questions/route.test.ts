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

const { GET, POST, PATCH, DELETE } = await import("./route");

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeToken(userId: string | null): string {
  const claims = userId ? { app_metadata: { user_id: userId } } : { app_metadata: {} };
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(claims)}.sig`;
}

function request(method: string, url: string, token: string | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A chainable, awaitable stand-in for a Supabase query builder. */
function query(result: { data?: unknown; error?: unknown }, calls: string[] = []) {
  const settled = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof settled) => unknown) => Promise.resolve(settled).then(resolve),
    maybeSingle: vi.fn(async () => settled),
  };
  for (const name of ["select", "eq", "order", "limit", "insert", "update", "delete"]) {
    builder[name] = vi.fn((...args: unknown[]) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return builder;
    });
  }
  return builder;
}

const QUESTION_ROW = {
  id: "q1",
  recipe_id: "recipe-1",
  prompt: "中秋节吃什么？",
  correct_answer: "月饼",
  wrong_answers: ["粽子", "汤圆"],
  is_active: true,
  display_order: 0,
};

const VALID_DRAFT = {
  recipeId: "recipe-1",
  prompt: "中秋节吃什么？",
  correctAnswer: "月饼",
  wrongAnswers: ["粽子", "汤圆", ""],
  isActive: true,
};

function mockTables(params: { isAdmin: boolean; calls?: string[] }) {
  fromMock.mockImplementation((table: string) => {
    if (table === "users") {
      return query({ data: { id: "admin-1", is_platform_admin: params.isAdmin } });
    }
    return query({ data: [QUESTION_ROW] }, params.calls);
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
});

describe("/api/shop-admin/chef-questions", () => {
  it("rejects a request with no token", async () => {
    const response = await GET(request("GET", "/api/shop-admin/chef-questions?recipeId=recipe-1", null));
    expect(response.status).toBe(401);
  });

  it("rejects a token with no active profile", async () => {
    mockTables({ isAdmin: true });
    const response = await GET(request("GET", "/api/shop-admin/chef-questions?recipeId=recipe-1", makeToken(null)));
    expect(response.status).toBe(403);
  });

  it("rejects anyone who isn't a platform admin", async () => {
    mockTables({ isAdmin: false });
    const response = await GET(request("GET", "/api/shop-admin/chef-questions?recipeId=recipe-1", makeToken("child-1")));
    expect(response.status).toBe(403);
  });

  it("lists a recipe's questions for the platform admin", async () => {
    mockTables({ isAdmin: true });
    const response = await GET(request("GET", "/api/shop-admin/chef-questions?recipeId=recipe-1", makeToken("admin-1")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      questions: [
        {
          id: "q1",
          recipeId: "recipe-1",
          prompt: "中秋节吃什么？",
          correctAnswer: "月饼",
          wrongAnswers: ["粽子", "汤圆"],
          isActive: true,
          displayOrder: 0,
        },
      ],
    });
  });

  it("requires a recipeId to list", async () => {
    mockTables({ isAdmin: true });
    const response = await GET(request("GET", "/api/shop-admin/chef-questions", makeToken("admin-1")));
    expect(response.status).toBe(400);
  });

  it("creates a valid question, dropping empty wrong-answer slots", async () => {
    const calls: string[] = [];
    mockTables({ isAdmin: true, calls });
    const response = await POST(request("POST", "/api/shop-admin/chef-questions", makeToken("admin-1"), { draft: VALID_DRAFT }));
    expect(response.status).toBe(200);
    const insert = calls.find((call) => call.startsWith("insert:"));
    expect(insert).toContain('"wrong_answers":["粽子","汤圆"]');
  });

  it("rejects an invalid draft with its validation code", async () => {
    mockTables({ isAdmin: true });
    const response = await POST(
      request("POST", "/api/shop-admin/chef-questions", makeToken("admin-1"), {
        draft: { ...VALID_DRAFT, wrongAnswers: ["月饼", "汤圆"] },
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "duplicate_answer" });
  });

  it("requires an id to edit", async () => {
    mockTables({ isAdmin: true });
    const response = await PATCH(request("PATCH", "/api/shop-admin/chef-questions", makeToken("admin-1"), { draft: VALID_DRAFT }));
    expect(response.status).toBe(400);
  });

  it("deletes a question and returns the remaining list", async () => {
    const calls: string[] = [];
    mockTables({ isAdmin: true, calls });
    const response = await DELETE(
      request("DELETE", "/api/shop-admin/chef-questions?id=q1&recipeId=recipe-1", makeToken("admin-1"))
    );
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.startsWith("delete:"))).toBe(true);
  });
});
