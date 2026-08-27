import { api } from "./api";

export function createProfilePayload(user) {
  return {
    id: user?.id,
    email: user?.email,
    role: "user",
  };
}

export async function ensureUserProfile(user, { signal } = {}) {
  if (!user) return null;

  const profile = await api.getProfile({ signal });

  return {
    id: profile.id || user.id,
    email: profile.email || user.email,
    fullName: profile.fullName || "Authenticated User",
    role: profile.role || "user",
    avatarInitials: profile.avatarInitials || "RO",
    workspace: profile.workspace || "BLACK FLASH ORBIT",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function insertRegisteredUserProfile(user) {
  return createProfilePayload(user);
}
