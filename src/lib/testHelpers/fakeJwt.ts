// Test-only helper for building a syntactically valid (unsigned) JWT string
// so mocked `supabase.auth.getSession()` responses can exercise
// getSessionMetadata()'s real decode path (decodeJwtPayload reads
// session.access_token, not session.user.app_metadata -- see
// docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md).
function base64url(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeFakeAccessToken(claims: Record<string, unknown>): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(claims);
  return `${header}.${body}.fakesignature`;
}
