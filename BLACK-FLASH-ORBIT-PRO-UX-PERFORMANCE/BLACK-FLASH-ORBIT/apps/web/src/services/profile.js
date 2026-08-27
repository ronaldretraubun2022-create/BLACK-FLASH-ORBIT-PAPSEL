import { api } from "./api";

const PROFILE_CACHE_TTL_MS = 15_000;
const profileCache = new Map();
const profileRequests = new Map();

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

function getCachedProfile(cacheKey) {
  const cached = profileCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.cachedAt >= PROFILE_CACHE_TTL_MS) {
    profileCache.delete(cacheKey);
    return null;
  }

  return cached.profile;
}

export function clearProfileCache(user) {
  const cacheKey = getProfileCacheKey(user);
  if (!cacheKey) return;

  profileCache.delete(cacheKey);
  profileRequests.delete(cacheKey);
}

export async function ensureUserProfile(
  user,
  { signal, force = false } = {},
) {
  if (!user) return null;

  const cacheKey = getProfileCacheKey(user);
  const canShareRequest = Boolean(cacheKey) && !signal;

  if (!force && cacheKey) {
    const cachedProfile = getCachedProfile(cacheKey);
    if (cachedProfile) return cachedProfile;

    if (canShareRequest && profileRequests.has(cacheKey)) {
      return profileRequests.get(cacheKey);
    }
  }

  const request = api
    .getProfile({ signal })
    .then((profile) => {
      const normalized = normalizeProfile(profile, user);

      if (cacheKey) {
        profileCache.set(cacheKey, {
          cachedAt: Date.now(),
          profile: normalized,
        });
      }

      return normalized;
    });

  if (!canShareRequest) return request;

  profileRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (profileRequests.get(cacheKey) === request) {
      profileRequests.delete(cacheKey);
    }
  }
}

export async function insertRegisteredUserProfile(user) {
  return createProfilePayload(user);
}
