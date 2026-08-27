const assert = require("node:assert");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const errorHandler = require("../../server/middleware/errorHandler");
const {
  getConfigInventory,
  validateProductionEnvironment,
} = require("../../server/config/environment");
const {
  createRouteRateLimiters,
} = require("../../server/middleware/routeRateLimits");
const {
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");
const serverPath = path.join(rootDir, "server/index.js");

const PRODUCTION_ENV = {
  CORS_ALLOWED_ORIGINS: "https://app.example.test",
  NODE_ENV: "production",
  OPENAI_API_KEY: "test-openai-key",
  OPENROUTER_API_KEY: "test-openrouter-key",
  ORBIT_ENABLE_HSTS: "true",
  PORT: "0",
  SUPABASE_ANON_KEY: "test-supabase-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-supabase-service-role-key",
  SUPABASE_URL: "https://project.supabase.co",
  VITE_API_BASE_URL: "/api",
  VITE_SUPABASE_ANON_KEY: "test-supabase-anon-key",
  VITE_SUPABASE_URL: "https://project.supabase.co",
};

function withEnv(overrides, callback) {
  const previous = {};
  const keys = new Set([...Object.keys(PRODUCTION_ENV), ...Object.keys(overrides)]);

  keys.forEach((key) => {
    previous[key] = process.env[key];
  });

  Object.entries({ ...PRODUCTION_ENV, ...overrides }).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  function restore() {
    keys.forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  }

  try {
    const result = callback();

    if (result && typeof result.then === "function") {
      return result.finally(restore);
    }

    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function loadProductionApp() {
  delete require.cache[require.resolve(serverPath)];
  return require(serverPath);
}

test("production environment validation requires mandatory config without exposing values", () => {
  const result = validateProductionEnvironment({
    CORS_ALLOWED_ORIGINS: "*",
    NODE_ENV: "production",
  });
  const inventory = getConfigInventory(PRODUCTION_ENV);
  const serialized = JSON.stringify({ inventory, result });

  assert.strictEqual(result.ok, false);
  assert(result.missing.includes("OPENROUTER_API_KEY"));
  assert(result.missing.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(result.missing.includes("CORS_ALLOWED_ORIGINS_NO_WILDCARD"));
  assert(!serialized.includes(PRODUCTION_ENV.OPENROUTER_API_KEY));
  assert(!serialized.includes(PRODUCTION_ENV.SUPABASE_SERVICE_ROLE_KEY));
});

test("production CORS allows configured origin, rejects unknown origin, and sends security headers", async () => {
  await withEnv({}, async () => {
    const app = loadProductionApp();
    const server = await startServer(app);

    try {
      const allowed = await requestJson(server.baseUrl, "/health", {
        headers: {
          origin: "https://app.example.test",
        },
      });
      const rejected = await requestJson(server.baseUrl, "/health", {
        headers: {
          origin: "https://evil.example.test",
        },
      });

      assert.strictEqual(allowed.status, 200);
      assert.strictEqual(
        allowed.response.headers.get("access-control-allow-origin"),
        "https://app.example.test",
      );
      assert.strictEqual(allowed.response.headers.get("x-frame-options"), "DENY");
      assert.strictEqual(
        allowed.response.headers.get("x-content-type-options"),
        "nosniff",
      );
      assert.match(
        allowed.response.headers.get("permissions-policy") || "",
        /camera=\(\)/,
      );
      assert.match(
        allowed.response.headers.get("strict-transport-security") || "",
        /max-age=/,
      );
      assert.strictEqual(allowed.body.status, "alive");
      assert.strictEqual(allowed.body.dependencies, undefined);

      assert.strictEqual(rejected.status, 403);
      assert.strictEqual(rejected.body.code, "CORS_ORIGIN_DENIED");
      assert.strictEqual(rejected.body.message, "Akses ditolak.");
    } finally {
      await server.close();
    }
  });
});

test("readiness remains separate from fast health and does not expose secrets", async () => {
  await withEnv({}, async () => {
    const app = loadProductionApp();
    const health = app.healthPayload();
    const readiness = await app.readinessPayload();
    const serialized = JSON.stringify({ health, readiness });

    assert.strictEqual(health.status, "alive");
    assert.strictEqual(health.dependencies, undefined);
    assert(["ready", "degraded"].includes(readiness.status));
    assert(readiness.dependencies);
    assert(!serialized.includes(PRODUCTION_ENV.OPENROUTER_API_KEY));
    assert(!serialized.includes(PRODUCTION_ENV.SUPABASE_SERVICE_ROLE_KEY));
  });
});

test("route-aware production limiter returns clean HTTP 429 for expensive operations", async () => {
  const app = express();
  const { newsroom } = createRouteRateLimiters({ isProduction: true });

  app.set("trust proxy", 1);
  app.use(newsroom);
  app.get("/expensive", (_req, res) => {
    res.status(200).json({ success: true });
  });

  const server = await startServer(app);

  try {
    let lastResult = null;

    for (let index = 0; index < 21; index += 1) {
      lastResult = await requestJson(server.baseUrl, "/expensive");
    }

    assert.strictEqual(lastResult.status, 429);
    assert.strictEqual(lastResult.body.success, false);
    assert.strictEqual(lastResult.body.code, "NEWSROOM_RATE_LIMITED");
  } finally {
    await server.close();
  }
});

test("production error handler returns sanitized response with request id", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const secret = "OPENROUTER_API_KEY=secret-value at D:\\secret\\file.sql";
    const error = new Error(secret);
    error.code = "DATABASE_INTERNAL_FAILURE";
    const res = createResponse();

    errorHandler(
      error,
      {
        headers: {
          "x-request-id": "request-safe-1",
        },
        method: "GET",
        originalUrl: "/api/v1/private",
      },
      res,
      () => {},
    );

    const serialized = JSON.stringify(res.body);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.message, "Terjadi kesalahan server.");
    assert.strictEqual(res.body.requestId, "request-safe-1");
    assert(!serialized.includes("secret-value"));
    assert(!serialized.includes("file.sql"));
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
});

test("frontend source and env example keep server secrets out of browser boundary", () => {
  const browserSource = fs
    .readdirSync(path.join(rootDir, "apps/web/src"), { recursive: true })
    .filter((file) => /\.(js|jsx|mjs|cjs)$/.test(String(file)))
    .map((file) =>
      fs.readFileSync(path.join(rootDir, "apps/web/src", file), "utf8"),
    )
    .join("\n");
  const envExample = fs.readFileSync(path.join(rootDir, ".env.example"), "utf8");

  assert(!browserSource.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!browserSource.includes("OPENROUTER_API_KEY"));
  assert(!browserSource.includes("OPENAI_API_KEY"));
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key/);
  assert.match(envExample, /ORBIT_ENABLE_HSTS=false/);
  assert(!envExample.includes("sk-"));
});
