/**
 * Decodes (without re-verifying) the payload segment of a JWT already
 * verified moments earlier via `supabase.auth.getUser(token)` in the same
 * request handler -- these helpers only ever run after that check, so
 * decoding without a second signature verification is safe. Used to read
 * per-session claims (session_id, app_metadata) directly off the caller's
 * own token instead of doing a live auth.users lookup, which is what
 * session-scoped profile claims replaces -- see
 * docs/feature-specs/2026-08-08-session-scoped-profile-claims.md.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("decodeJwtPayload: malformed token");
  }

  const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  let json: string;
  try {
    json = Buffer.from(padded, "base64").toString("utf8");
  } catch {
    throw new Error("decodeJwtPayload: payload is not valid base64");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("decodeJwtPayload: payload is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("decodeJwtPayload: payload is not an object");
  }

  return parsed as Record<string, unknown>;
}

export function getJwtSessionId(token: string): string | undefined {
  const sessionId = decodeJwtPayload(token).session_id;
  return typeof sessionId === "string" && sessionId ? sessionId : undefined;
}

export function getJwtAppMetadataUserId(token: string): string | undefined {
  const appMetadata = decodeJwtPayload(token).app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") {
    return undefined;
  }
  const userId = (appMetadata as Record<string, unknown>).user_id;
  return typeof userId === "string" && userId ? userId : undefined;
}
