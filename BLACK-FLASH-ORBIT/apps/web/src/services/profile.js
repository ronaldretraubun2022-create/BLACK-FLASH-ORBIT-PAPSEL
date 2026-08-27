import { api } from "./api";
import { SharedRequestCache } from "./sharedRequestCache.mjs";

const PROFILE_CACHE_TTL_MS = 15_000;
const sharedProfiles = new SharedRequestCache({ ttlMs: PROFILE_CACHE_TTL_MS });

export function createProfilePayload(user) {
  return {
    id: user?.id,
    email: user?.email,
    role: "user",
  };
}

function getProfileCacheKey(user) {
  return user?.id || user?.email || "";
}

function normalizeProfile(profile, user) {
  return {
    id: profile?.id || user.id,
    email: profile?.email || user.email,
    fullName: profile?.fullName || "Authenticated User",
    role: profile?.role || "user",
    avatarInitials: profile?.avatarInitials || "RO",
    workspace: profile?.workspace || "BLACK FLASH ORBIT",
    createdAt: profile?.createdAt,
    updatedAt: profile?.updatedAt,
  };
}

export function clearProfileCache(user) {
  sharedProfiles.clear(getProfileCacheKey(user));
}

export async function ensureUserProfile(
  user,
  { signal, force = false } = {},
) {
  if (!user) return null;

  const cacheKey = getProfileCacheKey(user);
  const loadProfile = () =>
    api.getProfile({ signal }).then((profile) => normalizeProfile(profile, user));

  // Abortable requests stay isolated so one consumer cannot cancel another.
  if (signal || !cacheKey) return loadProfile();

  return sharedProfiles.resolve(cacheKey, loadProfile, { force });
}

export async function insertRegisteredUserProfile(user) {
  return createProfilePayload(user);
}
