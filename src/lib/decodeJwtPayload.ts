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
// Uses atob/TextDecoder rather than Node's Buffer -- this runs both
// server-side (pin-verify, update-avatar routes) and client-side
// (supabase-service.ts's getSessionMetadata, in the browser), and atob is
// the one base64 primitive both environments share.
function base64UrlDecodeToString(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("decodeJwtPayload: malformed token");
  }

  let json: string;
  try {
    json = base64UrlDecodeToString(parts[1]);
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

// Returns the token's own app_metadata claim -- the same claim
// current_family_id()/current_user_id() read server-side via
// request.jwt.claims. Deliberately NOT the same thing as the Supabase JS
// client's `session.user.app_metadata`: that field is populated from the
// /token response body's `user` object, i.e. the auth.users DB row, which
// session-scoped profile claims (2026-08-08) stopped keeping in sync with
// the active Layer 2 profile -- it is frozen at whatever it was before that
// migration and must never be used to resolve the CURRENT family_id/user_id.
export function getJwtAppMetadata(token: string): Record<string, unknown> | undefined {
  const appMetadata = decodeJwtPayload(token).app_metadata;
  return appMetadata && typeof appMetadata === "object"
    ? (appMetadata as Record<string, unknown>)
    : undefined;
}
