import { supabase } from "../lib/supabase";
import {
  clearAuthSessionAndRedirect,
  createSessionExpiredError,
  recoverStaleRefreshToken,
} from "../lib/authRecovery";
import { normalizePromptCategory } from "../data/promptCategories";
import {
  getApiPathSuffix,
  joinApiUrl,
  normalizeApiBaseUrl,
  normalizeApiPath,
} from "./apiUrlUtils.mjs";

const DEFAULT_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_WINDOW_MS = 60000;
const LOCAL_DEV_API_PORT = "5000";
// Use IPv4 loopback in dev so Windows does not resolve localhost to ::1
// when the Node server is listening on 127.0.0.1/IPv4 only.
const LOCAL_DEV_API_BASE_URL = "http://127.0.0.1:5000/api";
const API_BASE_URL = normalizeApiBaseUrl(getConfiguredApiBaseUrl());
const AUTH_PROVIDER_UNAVAILABLE_CODE = "AUTH_PROVIDER_UNAVAILABLE";

const AUTH_FAILURE_CODES = new Set([
  "missing_authorization",
  "invalid_bearer_format",
  "invalid_supabase_token",
  "invalid_supabase_user",
]);
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/v1/health"]);
const KNOWLEDGE_API_PREFIX = "/api/v1/knowledge";

function createQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const cleanValue = String(value || "").trim();

    if (cleanValue) {
      searchParams.set(key, cleanValue);
    }
  });

  const queryString = searchParams.toString();

  return queryString ? `?${queryString}` : "";
}

function requireAccessToken(accessToken) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return accessToken.trim();
}

async function getSupabaseAccessToken() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  try {
    let session = await getSessionFromSupabaseAuth();

    if (shouldRefreshSession(session)) {
      await refreshSupabaseSession();
      session = await getSessionFromSupabaseAuth();
    }

    logFrontendAuthDebug(session);

    return requireAccessToken(session?.access_token);
  } catch (error) {
    await throwRecoveredAuthError(error);
  }
}

export async function getAuthenticatedHeaders() {
  const accessToken = await getSupabaseAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function isKnowledgeApiRequestUrl(requestUrl) {
  return getRequestPathname(requestUrl).startsWith(KNOWLEDGE_API_PREFIX);
}

async function getSessionFromSupabaseAuth() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  if (!data.session?.user?.id || !data.session?.access_token) {
    logFrontendAuthDebug(data.session);
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return data.session;
}

function shouldRefreshSession(session) {
  const expiresAtMs = Number(session?.expires_at || 0) * 1000;

  if (!expiresAtMs) return true;

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_WINDOW_MS;
}

async function refreshSupabaseSession() {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    await throwRecoveredAuthError(error);
  }

  return data.session ?? null;
}

async function throwRecoveredAuthError(error) {
  if (await recoverStaleRefreshToken(error)) {
    throw createSessionExpiredError();
  }

  throw error;
}

function logFrontendAuthDebug(session) {
  if (import.meta.env.VITE_ENABLE_AUTH_DEBUG !== "true") return;

  const accessToken = session?.access_token || "";

  console.info("[AI Auth Frontend]", {
    hasSession: Boolean(session),
    hasAccessToken: Boolean(accessToken),
    userId: session?.user?.id || null,
    tokenLength: accessToken.length,
  });
}

function getApiErrorMessage(errorBody, status) {
  const candidates = [errorBody?.message, errorBody?.error]
    .filter(Boolean)
    .map((value) => formatErrorValue(value))
    .filter(Boolean);

  const uniqueMessages = [...new Set(candidates)];

  return uniqueMessages[0] || `API request failed with status ${status}.`;
}

function formatErrorValue(value) {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message || value.name;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Terjadi error pada API.";
    }
  }

  return String(value || "").trim();
}

function isAuthFailureResponse(errorBody, status) {
  const code = getApiErrorCode(errorBody).toLowerCase();
  const message = getApiErrorMessage(errorBody, status).toLowerCase();

  return (
    status === 401 &&
    (AUTH_FAILURE_CODES.has(code) ||
      message.includes("missing bearer token") ||
      message.includes("invalid or expired token"))
  );
}

function getApiErrorCode(errorBody) {
  return String(errorBody?.code || "").trim();
}

export function isAuthProviderUnavailableResponse(errorBody, status) {
  return (
    status === 503 &&
    getApiErrorCode(errorBody).toUpperCase() === AUTH_PROVIDER_UNAVAILABLE_CODE
  );
}

export function isAuthProviderUnavailableError(error) {
  return (
    error?.code === AUTH_PROVIDER_UNAVAILABLE_CODE ||
    isAuthProviderUnavailableResponse(error?.body, error?.status)
  );
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();
  const requestUrl = resolveApiUrl(path);
  const hasFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const {
    auth,
    headers: optionHeaders,
    redirectOnAuthFailure = true,
    retryOnAuthFailure = true,
    signal: externalSignal,
    ...fetchOptions
  } = options;
  // Forward route/component aborts into the same controller so unmounts and
  // manual cancels stop the fetch without losing the built-in timeout guard.
  const handleExternalAbort = () => controller.abort();
  let hasRetriedAuth = false;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", handleExternalAbort, {
        once: true,
      });
    }
  }

  logApiRequestStart({ path, requestUrl });

  try {
    if (isKnowledgeApiRequestUrl(requestUrl)) {
      fetchOptions.cache = "no-store";
    } else if (
      fetchOptions.cache === undefined &&
      shouldForceNoStore(requestUrl)
    ) {
      fetchOptions.cache = "no-store";
    }

    const shouldHandleAuthFailure = shouldHandleAuthenticationFailure({
      auth,
      optionHeaders,
      requestUrl,
    });
    let headers = await createRequestHeaders({
      auth,
      hasFormDataBody,
      optionHeaders,
      options,
      requestUrl,
    });

    while (true) {
      const response = await fetch(requestUrl, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      const data = await parseJsonResponse(response);
      logApiRequestResult({
        durationMs: Date.now() - startedAt,
        headers,
        path,
        requestUrl,
        status: response.status,
      });

      if (isKnowledgeApiRequestUrl(requestUrl) && import.meta.env.DEV) {
        console.info("[Knowledge API]", {
          method: String(fetchOptions.method || "GET").toUpperCase(),
          hasBearerToken: headers.has("Authorization"),
          status: response.status,
          url: getPrintableRequestUrl(requestUrl),
        });
      }

      if (response.ok || response.status === 304) {
        return data;
      }

      if (
        shouldHandleAuthFailure &&
        retryOnAuthFailure &&
        !hasRetriedAuth &&
        isAuthFailureResponse(data, response.status)
      ) {
        hasRetriedAuth = true;
        headers = await createRetriedAuthHeaders(headers);
        continue;
      }

      if (
        shouldHandleAuthFailure &&
        redirectOnAuthFailure &&
        isAuthFailureResponse(data, response.status)
      ) {
        await clearAuthSessionAndRedirect();
      }

      const message = getApiErrorMessage(data, response.status);

      throw new ApiRequestError(message, {
        body: data,
        status: response.status,
      });
    }
  } catch (error) {
    if (error.name === "AbortError") {
      if (externalSignal?.aborted) {
        // Preserve the real abort reason for callers that intentionally
        // canceled the request; only non-abort failures are converted below.
        throw error;
      }

      throw new Error("API request timed out.");
    }

    logApiRequestFailure({
      durationMs: Date.now() - startedAt,
      error,
      path,
      requestUrl,
    });

    if (isFetchNetworkError(error)) {
      const message = "API network request failed.";

      throw new ApiRequestError(message, {
        body: {
          success: false,
          code: "API_NETWORK_ERROR",
          message,
        },
        status: 0,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", handleExternalAbort);
    }
  }
}

async function createRequestHeaders({
  auth,
  hasFormDataBody,
  optionHeaders,
  options,
  requestUrl,
}) {
  const headers = new Headers(optionHeaders || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !hasFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (shouldAttachAuthorizationHeader({ auth, headers, requestUrl })) {
    const authHeaders = await getAuthenticatedHeaders();

    Object.entries(authHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function shouldAttachAuthorizationHeader({ auth, headers, requestUrl }) {
  if (auth === false || headers.has("Authorization")) return false;
  if (auth === true) return true;

  return isProtectedApiRequestUrl(requestUrl);
}

function shouldHandleAuthenticationFailure({
  auth,
  optionHeaders,
  requestUrl,
}) {
  if (auth === false) return false;
  if (auth === true || isProtectedApiRequestUrl(requestUrl)) return true;

  return new Headers(optionHeaders || {}).has("Authorization");
}

function isProtectedApiRequestUrl(requestUrl) {
  const pathname = getRequestPathname(requestUrl);

  if (!pathname.startsWith("/api/")) return false;

  return !PUBLIC_API_PATHS.has(pathname);
}

function shouldForceNoStore(requestUrl) {
  return isProtectedApiRequestUrl(requestUrl);
}

function getRequestPathname(requestUrl) {
  try {
    const url = /^https?:\/\//i.test(requestUrl)
      ? new URL(requestUrl)
      : new URL(requestUrl, "http://orbit.local");

    return normalizeApiPath(url.pathname);
  } catch {
    const cleanPath = String(requestUrl || "").startsWith("/")
      ? String(requestUrl || "")
      : `/${requestUrl || ""}`;

    return normalizeApiPath(cleanPath);
  }
}

async function createRetriedAuthHeaders(previousHeaders) {
  const refreshedSession = await refreshSupabaseSession();
  const session = refreshedSession || (await getSessionFromSupabaseAuth());
  const accessToken = requireAccessToken(session?.access_token);
  const headers = new Headers(previousHeaders || {});

  logFrontendAuthDebug(session);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return headers;
}

async function parseJsonResponse(response) {
  if (response.status === 204 || response.status === 304) {
    return {
      data: [],
      success: true,
    };
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (response.ok) {
      return {
        data: [],
        success: true,
      };
    }

    const preview = text.replace(/\s+/g, " ").trim().slice(0, 120);
    const message = preview
      ? `Endpoint API mengembalikan non-JSON (${response.status}): ${preview}`
      : `Endpoint API mengembalikan non-JSON (${response.status}).`;

    throw new ApiRequestError(message, {
      body: { message },
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch {
    if (response.ok) {
      return {
        data: [],
        success: true,
      };
    }

    const message = `Endpoint API mengembalikan JSON tidak valid (${response.status}).`;

    throw new ApiRequestError(message, {
      body: { message },
      status: response.status,
    });
  }
}

export function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;

  const cleanPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${path || ""}`;

  return joinApiUrl(getRuntimeApiBaseUrl(), getApiPathSuffix(cleanPath));
}

function getConfiguredApiBaseUrl() {
  const configuredBaseUrl = String(
    import.meta.env.VITE_API_BASE_URL || "",
  ).trim();

  return configuredBaseUrl || "/api";
}

function getRuntimeApiBaseUrl() {
  if (API_BASE_URL === "/api" && isDevelopmentFrontendOrigin()) {
    return getDevelopmentApiBaseUrl();
  }

  return API_BASE_URL;
}

function getDevelopmentApiBaseUrl() {
  if (typeof window === "undefined") return LOCAL_DEV_API_BASE_URL;

  const hostname = window.location.hostname;

  if (!isDevelopmentHostname(hostname)) {
    return LOCAL_DEV_API_BASE_URL;
  }

  return `http://127.0.0.1:${LOCAL_DEV_API_PORT}/api`;
}

function isDevelopmentFrontendOrigin() {
  if (typeof window === "undefined") return false;

  return isDevelopmentHostname(window.location.hostname);
}

function isDevelopmentHostname(hostname) {
  if (isLocalhostHostname(hostname)) return true;

  const cleanHostname = String(hostname || "").toLowerCase();
  const parts = cleanHostname.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isLocalhostHostname(hostname) {
  const cleanHostname = String(hostname || "").toLowerCase();

  return cleanHostname === "localhost" || cleanHostname === "127.0.0.1";
}

function getPrintableRequestUrl(requestUrl) {
  if (/^https?:\/\//i.test(requestUrl)) return requestUrl;

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(requestUrl, window.location.origin).href;
  }

  return requestUrl;
}

function isFetchNetworkError(error) {
  if (!error || error.name === "AbortError") return false;

  const values = [
    error.code,
    error.name,
    error.message,
    error.cause?.code,
    error.cause?.name,
    error.cause?.message,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return values.some((value) =>
    [
      "failed to fetch",
      "fetch failed",
      "networkerror",
      "network error",
      "load failed",
    ].some((pattern) => value.includes(pattern)),
  );
}

function logApiRequestStart({ path, requestUrl }) {
  if (import.meta.env.VITE_ENABLE_API_DEBUG !== "true") return;

  console.info("[ORBIT API Request]", {
    path,
    url: getPrintableRequestUrl(requestUrl),
  });
}

function logApiRequestResult({
  durationMs,
  headers,
  path,
  requestUrl,
  status,
}) {
  if (import.meta.env.VITE_ENABLE_API_DEBUG !== "true") return;

  console.info("[ORBIT API Response]", {
    durationMs,
    hasAuthorization: headers?.has?.("Authorization") || false,
    path,
    status,
    url: getPrintableRequestUrl(requestUrl),
  });
}

function logApiRequestFailure({ durationMs, error, path, requestUrl }) {
  if (import.meta.env.VITE_ENABLE_API_DEBUG !== "true") return;

  console.warn("[ORBIT API Failure]", {
    durationMs,
    errorName: error?.name || "Error",
    message: error?.message || "Request failed",
    path,
    url: getPrintableRequestUrl(requestUrl),
  });
}

class ApiRequestError extends Error {
  constructor(message, { body, status }) {
    super(message);
    this.name = "ApiRequestError";
    this.body = body;
    this.code = getApiErrorCode(body);
    this.status = status;
  }
}

function normalizeModuleData(response, fallback) {
  if (!response) return fallback;
  if (Array.isArray(response)) return response;
  if (response.data !== undefined) return response.data;
  return response;
}

function normalizeReports(response) {
  const data = normalizeModuleData(response, []);
  return Array.isArray(data) ? data : [];
}

function normalizeAutomation(response) {
  if (!response) return {};
  if (response.engines && typeof response.engines === "object") {
    return response.engines;
  }

  const data = normalizeModuleData(response, {});
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function normalizeSecurity(response) {
  if (!response || Array.isArray(response)) return {};
  return response;
}

export const api = {
  getHealth() {
    return request("/api/health");
  },

  async getV1Health() {
    try {
      return await request("/api/v1/health");
    } catch {
      return request("/api/health");
    }
  },

  async getProfile({ signal } = {}) {
    return request("/api/v1/profile", {
      auth: true,
      signal,
    });
  },

  async getSystem() {
    return request("/api/v1/system", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getMetrics() {
    return request("/api/v1/metrics", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getActivity() {
    return request("/api/v1/activity", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getProjects() {
    return request("/api/v1/projects", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getWebBuilderProjects() {
    const response = await request("/api/v1/web-builder/projects", {
      headers: await getAuthenticatedHeaders(),
    });

    return Array.isArray(response?.data) ? response.data : [];
  },

  async createWebBuilderProject(payload) {
    return request("/api/v1/web-builder/projects", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async getWebBuilderProject(projectId) {
    return request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}`,
      {
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async updateWebBuilderProject(projectId, payload) {
    return request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        headers: await getAuthenticatedHeaders(),
        body: JSON.stringify(payload),
      },
    );
  },

  async deleteWebBuilderProject(projectId) {
    return request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}`,
      {
        method: "DELETE",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async getWebBuilderPages(projectId) {
    const response = await request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}/pages`,
      {
        headers: await getAuthenticatedHeaders(),
      },
    );

    return Array.isArray(response?.data) ? response.data : [];
  },

  async createWebBuilderPage(projectId, payload) {
    return request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}/pages`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
        body: JSON.stringify(payload),
      },
    );
  },

  async exportWebBuilderProject(projectId) {
    return request(
      `/api/v1/web-builder/projects/${encodeURIComponent(projectId)}/export`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async getWebBuilderPage(pageId) {
    return request(`/api/v1/web-builder/pages/${encodeURIComponent(pageId)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async updateWebBuilderPage(pageId, payload) {
    return request(`/api/v1/web-builder/pages/${encodeURIComponent(pageId)}`, {
      method: "PATCH",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async deleteWebBuilderPage(pageId) {
    return request(`/api/v1/web-builder/pages/${encodeURIComponent(pageId)}`, {
      method: "DELETE",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getSecurity() {
    return normalizeSecurity(
      await request("/api/v1/security", {
        headers: await getAuthenticatedHeaders(),
      }),
    );
  },

  async getDashboardStatus({ signal } = {}) {
    return request("/api/v1/dashboard/status", {
      headers: await getAuthenticatedHeaders(),
      signal,
    });
  },

  async getReports() {
    return normalizeReports(
      await request("/api/v1/reports", {
        headers: await getAuthenticatedHeaders(),
      }),
    );
  },

  async getPromptCategories() {
    return request("/api/v1/prompts/categories", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getPrompts({ category, search } = {}) {
    return request(
      `/api/v1/prompts${createQueryString({ category, search })}`,
      {
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async createPrompt({
    category,
    content,
    isFavorite = false,
    isPinned = false,
    title,
  }) {
    return request("/api/v1/prompts", {
      headers: await getAuthenticatedHeaders(),
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        category: normalizePromptCategory(category),
        isFavorite,
        isPinned,
      }),
    });
  },

  async updatePrompt({
    category,
    content,
    id,
    isFavorite = false,
    isPinned = false,
    title,
  }) {
    return request(`/api/v1/prompts/${id}`, {
      method: "PUT",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify({
        title,
        content,
        category: normalizePromptCategory(category),
        isFavorite,
        isPinned,
      }),
    });
  },

  async togglePromptFavorite({ id, isFavorite }) {
    return request(`/api/v1/prompts/${id}/favorite`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify({
        isFavorite,
      }),
    });
  },

  async togglePromptPin({ id, isPinned }) {
    return request(`/api/v1/prompts/${id}/pin`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify({
        isPinned,
      }),
    });
  },

  async duplicatePrompt(id) {
    return request(`/api/v1/prompts/${id}/duplicate`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async markPromptUsed(id) {
    return request(`/api/v1/prompts/${id}/use`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async exportPrompts() {
    return request("/api/v1/prompts/export", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async importPrompts(payload) {
    return request("/api/v1/prompts/import", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async deletePrompt(id) {
    return request(`/api/v1/prompts/${id}`, {
      method: "DELETE",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomation() {
    return normalizeAutomation(
      await request("/api/v1/automation", {
        headers: await getAuthenticatedHeaders(),
      }),
    );
  },

  async getAutomationStatus() {
    return request("/api/v1/automation/status", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationJobs() {
    return request("/api/v1/automation/jobs", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationHistory() {
    return request("/api/v1/automation/history", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationDefinitions() {
    return request("/api/v1/automation/definitions", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getWorkflowDefinitions() {
    return request("/api/v1/workflows/definitions", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationRuns() {
    return request("/api/v1/automation/runs", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getWorkflowTemplates() {
    return request("/api/v1/workflows/templates", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async createWorkflowTemplate(payload) {
    return request("/api/v1/workflows/templates", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateWorkflowTemplate(id, payload) {
    return request(`/api/v1/workflows/templates/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async deleteWorkflowTemplate(id) {
    return request(`/api/v1/workflows/templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getWorkflowRuns() {
    return request("/api/v1/workflows/runs", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getIntelligenceOverview({ signal } = {}) {
    return request("/api/v1/intelligence/overview", {
      headers: await getAuthenticatedHeaders(),
      signal,
    });
  },

  async getIntelligenceEntities(params = {}) {
    return request(`/api/v1/intelligence/entities${createQueryString(params)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getIntelligenceClaims(params = {}) {
    return request(`/api/v1/intelligence/claims${createQueryString(params)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getIntelligenceTimeline(params = {}) {
    return request(`/api/v1/intelligence/timeline${createQueryString(params)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async searchIntelligence(params = {}) {
    return request(`/api/v1/intelligence/search${createQueryString(params)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getIntelligenceSourceLinks(params = {}) {
    return request(`/api/v1/intelligence/source-links${createQueryString(params)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async processIntelligenceSource(payload) {
    return request("/api/v1/intelligence/process", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async reprocessIntelligenceSource(sourceId) {
    return request(
      `/api/v1/intelligence/sources/${encodeURIComponent(sourceId)}/reprocess`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async getAgentStatus() {
    return request("/api/v1/agent/status", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async createAgentJob(payload) {
    return request("/api/v1/agent/jobs", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async getAgentJobs() {
    return request("/api/v1/agent/jobs", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAgentJob(jobId) {
    return request(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async diagnoseAgentJob(jobId) {
    return request(
      `/api/v1/agent/jobs/${encodeURIComponent(jobId)}/diagnose`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async runAgentJob(jobId, payload) {
    return request(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}/run`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async validateAgentJob(jobId) {
    return request(
      `/api/v1/agent/jobs/${encodeURIComponent(jobId)}/validate`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async approveAgentJob(jobId) {
    return request(
      `/api/v1/agent/jobs/${encodeURIComponent(jobId)}/approve`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async rejectAgentJob(jobId) {
    return request(
      `/api/v1/agent/jobs/${encodeURIComponent(jobId)}/reject`,
      {
        method: "POST",
        headers: await getAuthenticatedHeaders(),
      },
    );
  },

  async getAgentJobDiff(jobId) {
    return request(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}/diff`, {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async createAutomationRun(payload) {
    return request("/api/v1/automation/runs", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async createWorkflowRun(payload) {
    return request("/api/v1/workflows/runs", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async approveAutomationRun(id) {
    return request(`/api/v1/automation/runs/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async approveWorkflowRun(id) {
    return request(`/api/v1/workflows/runs/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async cancelAutomationRun(id) {
    return request(`/api/v1/automation/runs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async cancelWorkflowRun(id) {
    return request(`/api/v1/workflows/runs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getReadiness() {
    return request("/api/v1/readiness");
  },

  async getCommandCenter() {
    const [health, metrics, projects, security, automation, activity, system] =
      await Promise.all([
        this.getV1Health(),
        this.getMetrics(),
        this.getProjects(),
        this.getSecurity(),
        this.getAutomation(),
        this.getActivity(),
        this.getSystem(),
      ]);

    return {
      activity,
      automation,
      health,
      metrics,
      projects,
      security,
      system,
    };
  },

  async getKnowledgeDocuments() {
    const response = await request("/api/v1/knowledge/documents", {
      headers: await getAuthenticatedHeaders(),
    });

    return Array.isArray(response?.data) ? response.data : [];
  },

  async createKnowledgeDocument(payload) {
    return request("/api/v1/knowledge/documents", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateKnowledgeDocument(documentId, payload) {
    return request(`/api/v1/knowledge/documents/${documentId}`, {
      method: "PUT",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async patchKnowledgeDocument(documentId, payload) {
    return request(`/api/v1/knowledge/documents/${documentId}`, {
      method: "PATCH",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async deleteKnowledgeDocument(documentId) {
    return request(`/api/v1/knowledge/documents/${documentId}`, {
      method: "DELETE",
      headers: await getAuthenticatedHeaders(),
    });
  },

  async uploadKnowledgeDocument(formData) {
    return request("/api/v1/knowledge/upload", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: formData,
    });
  },

  async askKnowledge(payload, { signal } = {}) {
    return request("/api/v1/knowledge/ask", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
  },

  async sendAiChat({ history, message, model, sessionId, systemPrompt }) {
    let accessToken = await getSupabaseAccessToken();
    const body = JSON.stringify({
      history: Array.isArray(history) ? history : [],
      message,
      model,
      sessionId,
      systemPrompt,
    });

    try {
      return await request("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
    } catch (error) {
      if (!isAuthFailureResponse(error.body, error.status)) {
        throw error;
      }

      const refreshedSession = await refreshSupabaseSession();
      const session = refreshedSession || (await getSessionFromSupabaseAuth());

      logFrontendAuthDebug(session);
      accessToken = requireAccessToken(session?.access_token);

      return request("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
    }
  },

  renameChatSession({ accessToken, sessionId, title }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
  },

  deleteChatSession({ accessToken, sessionId }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  togglePinChatSession({ accessToken, pinned, sessionId }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}/pin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pinned }),
    });
  },
};
