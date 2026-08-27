const DEFAULT_AI_TIMEOUT_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 1;
const MAX_SAFE_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 500, 502, 503, 504]);

function getConfiguredMaxAttempts(value = process.env.AI_ROUTER_MAX_ATTEMPTS) {
  const attempts = Number.parseInt(value, 10);

  if (!Number.isFinite(attempts) || attempts < 1) return DEFAULT_MAX_ATTEMPTS;

  return Math.min(MAX_SAFE_ATTEMPTS, attempts);
}

function normalizeTimeoutMs(value, fallback = DEFAULT_AI_TIMEOUT_MS) {
  const timeoutMs = Number.parseInt(value, 10);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) return fallback;

  return Math.min(timeoutMs, 120000);
}

function isRetryableAiError(error, { allowRateLimitRetry = false } = {}) {
  if (!error?.retryable) return false;
  if (error.code === "AI_RATE_LIMITED") return Boolean(allowRateLimitRetry);

  return RETRYABLE_STATUSES.has(Number(error.status || error.statusCode));
}

function shouldFallbackAfterError(error) {
  if (!error) return false;
  if (
    ["AI_AUTH_ERROR", "AI_CONFIGURATION_ERROR", "AI_RATE_LIMITED"].includes(
      error.code,
    )
  ) {
    return false;
  }

  return (
    error.code === "AI_MODEL_UNAVAILABLE" ||
    error.code === "AI_TIMEOUT" ||
    (error.code === "AI_PROVIDER_ERROR" && Boolean(error.retryable))
  );
}

function createAbortController({ externalSignal, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  function handleExternalAbort() {
    controller.abort();
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", handleExternalAbort, {
        once: true,
      });
    }
  }

  return {
    controller,
    dispose() {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", handleExternalAbort);
      }
    },
  };
}

module.exports = {
  DEFAULT_AI_TIMEOUT_MS,
  createAbortController,
  getConfiguredMaxAttempts,
  isRetryableAiError,
  normalizeTimeoutMs,
  shouldFallbackAfterError,
};
