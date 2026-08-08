import { describe, expect, it } from "vitest";
import { decodeJwtPayload, getJwtAppMetadataUserId, getJwtSessionId } from "./decodeJwtPayload";

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

describe("decodeJwtPayload", () => {
  it("decodes the payload segment of a well-formed token", () => {
    const token = makeToken({ session_id: "session-1", foo: "bar" });
    expect(decodeJwtPayload(token)).toEqual({ session_id: "session-1", foo: "bar" });
  });

  it("throws on a token without exactly three segments", () => {
    expect(() => decodeJwtPayload("only.two")).toThrow("malformed token");
    expect(() => decodeJwtPayload("a.b.c.d")).toThrow("malformed token");
  });

  it("throws when the payload segment is not valid JSON", () => {
    const notJson = Buffer.from("not-json").toString("base64").replace(/=+$/, "");
    expect(() => decodeJwtPayload(`header.${notJson}.sig`)).toThrow("not valid JSON");
  });
});

describe("getJwtSessionId", () => {
  it("returns the session_id claim when present", () => {
    const token = makeToken({ session_id: "session-abc" });
    expect(getJwtSessionId(token)).toBe("session-abc");
  });

  it("returns undefined when session_id is missing", () => {
    const token = makeToken({ other: "field" });
    expect(getJwtSessionId(token)).toBeUndefined();
  });

  it("returns undefined when session_id is not a string", () => {
    const token = makeToken({ session_id: 12345 });
    expect(getJwtSessionId(token)).toBeUndefined();
  });
});

describe("getJwtAppMetadataUserId", () => {
  it("returns app_metadata.user_id when present", () => {
    const token = makeToken({ app_metadata: { user_id: "user-xyz", family_id: "family-1" } });
    expect(getJwtAppMetadataUserId(token)).toBe("user-xyz");
  });

  it("returns undefined when app_metadata is missing", () => {
    const token = makeToken({ session_id: "session-1" });
    expect(getJwtAppMetadataUserId(token)).toBeUndefined();
  });

  it("returns undefined when app_metadata.user_id is missing", () => {
    const token = makeToken({ app_metadata: { family_id: "family-1" } });
    expect(getJwtAppMetadataUserId(token)).toBeUndefined();
  });
});
