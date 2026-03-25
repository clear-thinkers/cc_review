import type { AppSession, UserProfile } from "./auth.types";

export type ChildProfileTarget = {
  userId: string;
  userName: string;
  isCurrentSessionTarget: boolean;
};

export function resolveChildProfileTarget(
  session: AppSession | null,
  familyProfiles: UserProfile[]
): ChildProfileTarget | null {
  if (!session) {
    return null;
  }

  if (session.role === "child") {
    return {
      userId: session.userId,
      userName: session.userName,
      isCurrentSessionTarget: true,
    };
  }

  const firstChildProfile = familyProfiles.find((profile) => profile.role === "child");
  if (firstChildProfile) {
    return {
      userId: firstChildProfile.id,
      userName: firstChildProfile.name,
      isCurrentSessionTarget: firstChildProfile.id === session.userId,
    };
  }

  return {
    userId: session.userId,
    userName: session.userName,
    isCurrentSessionTarget: true,
  };
}
