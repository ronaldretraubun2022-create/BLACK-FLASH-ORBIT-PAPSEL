import { getAuthenticatedHeaders, resolveApiUrl } from "./api";
import { SharedRequestCache } from "./sharedRequestCache.mjs";

const NEWSROOM_HISTORY_CACHE_TTL_MS = 3_000;
const sharedNewsroomHistory = new SharedRequestCache({
  maxEntries: 100,
  ttlMs: NEWSROOM_HISTORY_CACHE_TTL_MS,
});

export function isNewsroomLocalFallbackEnabled() {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK === "true"
  );
}

export async function generateIntelligenceDraft(payload) {
  try {
    const response = await fetch(resolveApiUrl("/api/ai/newsroom"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthenticatedHeaders()),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const message =
        json?.message ||
        `AI Newsroom request failed with status ${response.status}`;
      throw new Error(message);
    }

    if (!json) {
      throw new Error("Respons AI Newsroom tidak valid.");
    }

    return json;
  } catch (error) {
    throw new Error(
      error?.message ||
        "Gagal menghubungi AI Newsroom. Silakan coba lagi nanti.",
    );
  }
}

function getAuthorizationCacheKey(authorization = "") {
  let hash = 2166136261;

  for (let index = 0; index < authorization.length; index += 1) {
    hash ^= authorization.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `session-${(hash >>> 0).toString(16)}`;
}

export function clearNewsroomHistoryCache() {
  sharedNewsroomHistory.clearAll();
}

async function requestNewsroomJson(path, options = {}) {
  const { authHeaders, ...fetchOptions } = options;
  const headers = authHeaders || (await getAuthenticatedHeaders());
  const response = await fetch(resolveApiUrl(path), {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(fetchOptions.headers || {}),
    },
    credentials: "include",
  });

  if (response.status === 304) {
    return {
      notModified: true,
      success: true,
    };
  }

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(
      json?.message || `Newsroom request failed with status ${response.status}`,
    );
  }

  return json;
}

function createQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const cleanValue = String(value || "").trim();

    if (cleanValue) searchParams.set(key, cleanValue);
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function listNewsroomHistory(filters = {}) {
  const authHeaders = await getAuthenticatedHeaders();
  const path = `/api/ai/newsroom/history${createQueryString(filters)}`;
  const cacheKey = [
    "newsroom-history",
    getAuthorizationCacheKey(authHeaders.Authorization || ""),
    path,
  ].join(":");

  return sharedNewsroomHistory.resolve(
    cacheKey,
    () => requestNewsroomJson(path, { authHeaders }),
  );
}

export async function getNewsroomGeneration(id) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
  );
}

export async function saveNewsroomGeneration(payload, idempotencyKey) {
  const response = await requestNewsroomJson("/api/ai/newsroom/history", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(payload),
  });

  clearNewsroomHistoryCache();
  return response;
}

export async function updateNewsroomGeneration(id, payload) {
  const response = await requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  clearNewsroomHistoryCache();
  return response;
}

export async function submitNewsroomDecision(id, payload) {
  const response = await requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  clearNewsroomHistoryCache();
  return response;
}

export async function deleteNewsroomGeneration(id) {
  const response = await requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );

  clearNewsroomHistoryCache();
  return response;
}

export async function exportNewsroomGeneration(id, { format, type }) {
  const response = await fetch(
    resolveApiUrl(
      `/api/ai/newsroom/history/${encodeURIComponent(id)}/export${createQueryString(
        {
          format,
          type,
        },
      )}`,
    ),
    {
      headers: {
        ...(await getAuthenticatedHeaders()),
      },
      credentials: "include",
    },
  );

  if (!response.ok) {
    let message = `Export gagal dengan status ${response.status}`;

    try {
      const error = await response.json();
      message = error?.message || message;
    } catch {
      message = `Export gagal dengan status ${response.status}`;
    }

    throw new Error(message);
  }

  return {
    blob: await response.blob(),
    filename:
      getFilenameFromDisposition(response.headers.get("content-disposition")) ||
      `black-flash-orbit-${type || "review"}.${format || "pdf"}`,
  };
}

function getFilenameFromDisposition(disposition) {
  const match = String(disposition || "").match(/filename="([^"]+)"/i);

  return match?.[1] || "";
}
