/**
 * Pure rules for packaging review test sessions from Due Review (roadmap item P; spec
 * docs/feature-specs/2026-10-24-child-packaged-sessions-and-reward-picks.md).
 * A child may package sessions like a parent, but only ever extends or deletes
 * sessions THEY created -- the database enforces the same rules (Section 12 of verify-rls).
 */

/** Quick Add sizes: one per reward tier (10 = 1 pick, 20 = 2 picks, 30 = 3 picks). */
export const QUICK_ADD_SIZES = [10, 20, 30] as const;
export type QuickAddSize = (typeof QUICK_ADD_SIZES)[number];

export type SessionNameTarget =
  | { kind: "create" }
  | { kind: "append"; sessionId: string }
  | { kind: "name_taken" };

type SessionLike = { id: string; name: string; createdByUserId: string };

/**
 * What typing `name` does. A name matching an active session appends to it when the
 * viewer may extend it; a child typing a name that belongs to someone else's session is
 * told the name is taken (active session names are unique per family), never appended.
 */
export function resolveSessionNameTarget(params: {
  name: string;
  sessions: ReadonlyArray<SessionLike>;
  viewerUserId: string | null;
  viewerIsChild: boolean;
}): SessionNameTarget {
  const trimmed = params.name.trim();
  const existing = params.sessions.find((session) => session.name === trimmed);
  if (!existing) {
    return { kind: "create" };
  }
  if (params.viewerIsChild && existing.createdByUserId !== params.viewerUserId) {
    return { kind: "name_taken" };
  }
  return { kind: "append", sessionId: existing.id };
}

/**
 * Whether the viewer sees a Delete button for a session: a parent may delete any session
 * (as before, including a child's); a child only the ones they created. Platform admin
 * keeps its existing behavior (no delete control on this page).
 */
export function canDeleteReviewTestSession(params: {
  viewerRole: string | null | undefined;
  viewerIsPlatformAdmin: boolean;
  viewerUserId: string | null | undefined;
  createdByUserId: string;
}): boolean {
  if (params.viewerIsPlatformAdmin) {
    return false;
  }
  if (params.viewerRole === "parent") {
    return true;
  }
  if (params.viewerRole === "child") {
    return Boolean(params.viewerUserId) && params.createdByUserId === params.viewerUserId;
  }
  return false;
}

/** A fresh, readable, effectively-unique default name for a child's session ("My practice 10-24 18:05"). */
export function buildDefaultChildSessionName(template: string, now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return template.replace("{time}", stamp);
}

/** A Quick Add of `size` characters is only offered when that many are due. */
export function isQuickAddAvailable(size: number, dueCount: number): boolean {
  return dueCount >= size;
}
