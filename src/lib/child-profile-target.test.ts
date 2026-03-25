import { describe, expect, it } from "vitest";

import { resolveChildProfileTarget } from "./child-profile-target";
import type { AppSession, UserProfile } from "./auth.types";

function makeSession(overrides: Partial<AppSession> = {}): AppSession {
  return {
    supabaseSession: {} as AppSession["supabaseSession"],
    familyId: "family-1",
    userId: "user-1",
    role: "parent",
    userName: "Parent",
    avatarId: null,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "profile-1",
    familyId: "family-1",
    name: "Profile",
    role: "child",
    avatarId: null,
    isPlatformAdmin: false,
    ...overrides,
  };
}

describe("resolveChildProfileTarget", () => {
  it("uses the active child profile when a child is signed in", () => {
    const target = resolveChildProfileTarget(
      makeSession({ userId: "child-1", role: "child", userName: "Kiddo" }),
      [makeProfile({ id: "child-1", name: "Kiddo" })]
    );

    expect(target).toEqual({
      userId: "child-1",
      userName: "Kiddo",
      isCurrentSessionTarget: true,
    });
  });

  it("uses the first child profile when a parent is signed in", () => {
    const target = resolveChildProfileTarget(makeSession(), [
      makeProfile({ id: "parent-1", role: "parent", name: "Parent" }),
      makeProfile({ id: "child-1", name: "Kiddo" }),
      makeProfile({ id: "child-2", name: "Second Kid" }),
    ]);

    expect(target).toEqual({
      userId: "child-1",
      userName: "Kiddo",
      isCurrentSessionTarget: false,
    });
  });

  it("falls back to the active session when no child profile exists", () => {
    const target = resolveChildProfileTarget(makeSession(), [
      makeProfile({ id: "parent-1", role: "parent", name: "Parent" }),
    ]);

    expect(target).toEqual({
      userId: "user-1",
      userName: "Parent",
      isCurrentSessionTarget: true,
    });
  });
});
