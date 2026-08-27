const assert = require("node:assert");
const test = require("node:test");

const {
  getApiPathSuffix,
  joinApiUrl,
  normalizeApiBaseUrl,
} = require("../../apps/web/src/services/apiUrlUtils.cjs");

function resolveWithBase(baseUrl, path) {
  const cleanPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${path || ""}`;

  return joinApiUrl(normalizeApiBaseUrl(baseUrl), getApiPathSuffix(cleanPath));
}

test("API URL resolver keeps normal /api path stable", () => {
  assert.strictEqual(resolveWithBase("/api", "/v1/health"), "/api/v1/health");
});

test("API URL resolver handles already-prefixed /api path", () => {
  assert.strictEqual(
    resolveWithBase("/api", "/api/v1/health"),
    "/api/v1/health",
  );
});

test("API URL resolver handles absolute base URLs ending with /api", () => {
  assert.strictEqual(
    resolveWithBase("https://orbit.example.com/api", "/api/ai/newsroom"),
    "https://orbit.example.com/api/ai/newsroom",
  );
});

test("API URL resolver never emits /api/api", () => {
  const candidates = [
    resolveWithBase("/api", "/api/ai/newsroom"),
    resolveWithBase("/api/", "/api/v1/knowledge/ask"),
    resolveWithBase("https://orbit.example.com/api", "/api/v1/health"),
    resolveWithBase("https://orbit.example.com/api/api", "/api/v1/health"),
  ];

  candidates.forEach((url) => {
    assert(!/\/api\/api(?:\/|$)/i.test(url), url);
  });
});
