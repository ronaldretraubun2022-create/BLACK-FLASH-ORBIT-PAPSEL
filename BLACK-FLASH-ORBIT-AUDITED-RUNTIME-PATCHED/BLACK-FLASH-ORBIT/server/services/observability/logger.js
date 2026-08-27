const crypto = require("node:crypto");

const REDACTED = "[REDACTED]";
const RECENT_RUNTIME_ERROR_LIMIT = 25;
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token)/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b([A-Za-z0-9_.-]*(?:api[_-]?key|service[_-]?role[_-]?key|access[_-]?key|refresh[_-]?token|password|passwd|secret|token)[A-Za-z0-9_.-]*)(\s*[:=]\s*)(['"]?)[^\s'",;)}\]]+\3/gi;
const recentRuntimeErrors = [];

function sanitizeScalar(value, maxLength = 2000) {
  if (value === null || value === undefined) return value;

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value)
    .replace(/Authorization\s*[:=]\s*Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, REDACTED)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (_match, key, separator) => `${key}${separator}${REDACTED}`,
    )
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function redactValue(value, depth = 0, seen = new WeakSet()) {
  if (depth > 6) return "[MAX_DEPTH]";

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return sanitizeScalar(value);
  }

  if (value instanceof Error) {
    return {
      name: sanitizeScalar(value.name, 120),
      message: sanitizeScalar(value.message, 500),
      code: sanitizeScalar(value.code, 120),
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : sanitizeScalar(value.stack, 4000),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);

    const output = {};

    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : redactValue(item, depth + 1, seen);
    }

    return output;
  }

  return sanitizeScalar(value);
}

function createRequestId(req) {
  const incoming =
    req?.headers?.["x-request-id"] ||
    req?.headers?.["x-vercel-id"] ||
    req?.headers?.["x-correlation-id"];

  return sanitizeScalar(incoming, 160) || crypto.randomUUID();
}

function getRequestContext(req) {
  if (!req) return {};

  return {
    requestId: req.requestId || createRequestId(req),
    method: sanitizeScalar(req.method, 16),
    path: sanitizeScalar(
      String(req.originalUrl || req.url || "").split(/[?#]/, 1)[0],
      500,
    ),
    userId: sanitizeScalar(req.user?.id, 160),
  };
}

function write(level, event, metadata = {}) {
  const payload = redactValue({
    level,
    event,
    service: "BLACK FLASH ORBIT API",
    timestamp: new Date().toISOString(),
    ...metadata,
  });

  if (level === "error") {
    recordRuntimeError(payload);
  }

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function recordRuntimeError(payload) {
  recentRuntimeErrors.unshift({
    code: sanitizeScalar(payload.code || payload.error?.code || null, 120),
    event: sanitizeScalar(payload.event, 160),
    message: sanitizeScalar(payload.error?.message || payload.message || null, 240),
    method: sanitizeScalar(payload.method || null, 16),
    path: sanitizeScalar(payload.path || null, 240),
    requestId: sanitizeScalar(payload.requestId || null, 160),
    statusCode: Number(payload.statusCode || payload.status || 0) || null,
    timestamp: sanitizeScalar(payload.timestamp, 64),
  });

  recentRuntimeErrors.splice(RECENT_RUNTIME_ERROR_LIMIT);
}

function getRecentRuntimeErrors(limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 0), 25);

  return recentRuntimeErrors.slice(0, safeLimit).map((item) => ({ ...item }));
}

function info(event, metadata) {
  write("info", event, metadata);
}

function warn(event, metadata) {
  write("warn", event, metadata);
}

function error(event, metadata) {
  write("error", event, metadata);
}

module.exports = {
  REDACTED,
  createRequestId,
  error,
  getRequestContext,
  getRecentRuntimeErrors,
  info,
  redactValue,
  sanitizeScalar,
  warn,
};
