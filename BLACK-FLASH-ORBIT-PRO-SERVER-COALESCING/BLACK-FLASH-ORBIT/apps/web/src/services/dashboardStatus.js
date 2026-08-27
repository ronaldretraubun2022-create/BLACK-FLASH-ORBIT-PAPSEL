import { api } from "./api";
import { SharedRequestCache } from "./sharedRequestCache.mjs";

const DASHBOARD_STATUS_TTL_MS = 5_000;
const sharedDashboardStatus = new SharedRequestCache({
  ttlMs: DASHBOARD_STATUS_TTL_MS,
});

function getDashboardStatusCacheKey(userId) {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId ? `dashboard-status:${normalizedUserId}` : "";
}

export function clearDashboardStatusCache(userId) {
  const cacheKey = getDashboardStatusCacheKey(userId);

  if (cacheKey) {
    sharedDashboardStatus.clear(cacheKey);
    return;
  }

  sharedDashboardStatus.clearAll();
}

export function getSharedDashboardStatus(userId, { force = false } = {}) {
  const cacheKey = getDashboardStatusCacheKey(userId);

  if (!cacheKey) {
    return api.getDashboardStatus();
  }

  return sharedDashboardStatus.resolve(
    cacheKey,
    () => api.getDashboardStatus(),
    { force },
  );
}
