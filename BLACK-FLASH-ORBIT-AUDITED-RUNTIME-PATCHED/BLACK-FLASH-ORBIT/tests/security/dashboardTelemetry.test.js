const assert = require("node:assert");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");
const apiServicePath = path.join(rootDir, "apps/web/src/services/api.js");
const dashboardStatePath = path.join(
  rootDir,
  "apps/web/src/services/dashboardTelemetryState.cjs",
);
const dashboardStatusPath = path.join(
  rootDir,
  "api/v1/dashboard/status.js",
);
const telemetryLibPath = path.join(
  rootDir,
  "server/lib/orbitDashboardTelemetry.js",
);
const routesIndexPath = path.join(rootDir, "server/routes/index.js");

function createFrontendApiHarness({
  fetchImpl,
  session,
  env = {},
} = {}) {
  let source = fs.readFileSync(apiServicePath, "utf8");

  source = source
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace(/import\.meta\.env/g, "importMetaEnv")
    .replace(/export\s+async\s+function\s+/g, "async function ")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+api\s+=/g, "const api =");

  const script = `
    const {
      getApiPathSuffix,
      joinApiUrl,
      normalizeApiBaseUrl,
      normalizeApiPath,
    } = require("${path
      .join(rootDir, "apps/web/src/services/apiUrlUtils.cjs")
      .replace(/\\/g, "\\\\")}");
    const supabase = mockedSupabase;
    const clearAuthSessionAndRedirect = async () => {};
    const createSessionExpiredError = () => new Error("Session expired.");
    const recoverStaleRefreshToken = async () => false;
    const normalizePromptCategory = (value) => value;
    ${source}
    module.exports = {
      api,
      getAuthenticatedHeaders,
      resolveApiUrl,
    };
  `;
  const context = {
    AbortController,
    Error,
    FormData,
    Headers,
    URL,
    URLSearchParams,
    clearTimeout,
    console,
    fetch: fetchImpl,
    importMetaEnv: {
      DEV: false,
      VITE_API_BASE_URL: "/api",
      VITE_ENABLE_API_DEBUG: "false",
      VITE_ENABLE_AUTH_DEBUG: "false",
      ...env,
    },
    module: { exports: {} },
    mockedSupabase: {
      auth: {
        getSession: async () => ({
          data: {
            session: session ?? {
              access_token: "mock-access-token",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: {
                id: "user-1",
              },
            },
          },
          error: null,
        }),
        refreshSession: async () => ({
          data: {
            session: session ?? {
              access_token: "mock-access-token",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: {
                id: "user-1",
              },
            },
          },
          error: null,
        }),
      },
    },
    require,
    setTimeout,
  };

  vm.createContext(context);
  vm.runInContext(script, context, {
    filename: apiServicePath,
  });

  return context.module.exports;
}

function createResponseRecorder() {
  return {
    body: "",
    headers: {},
    statusCode: 0,
    end(value) {
      this.body = value;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
  };
}

function createDashboardAuthMiddleware(user = {}) {
  return function requireDashboardAuth(req, _res, next) {
    req.user = {
      email: "operator@example.test",
      id: "user-1",
      ...user,
    };
    next();
  };
}

test("getDashboardStatus builds /api/v1/dashboard/status and attaches Authorization Bearer", async () => {
  let requestedUrl = "";
  let authorization = "";

  const { api } = createFrontendApiHarness({
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      authorization = options.headers.get("Authorization");

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            activity: [],
            automation: {},
            health: {},
            metrics: {},
            projects: [],
            security: {},
            system: {},
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    },
  });

  await api.getDashboardStatus();

  assert.strictEqual(requestedUrl, "/api/v1/dashboard/status");
  assert.strictEqual(authorization, "Bearer mock-access-token");
});

test("dashboard request external signal does not cancel a normal request", async () => {
  const controller = new AbortController();
  let fetchSignalWasAborted = true;

  const { api } = createFrontendApiHarness({
    fetchImpl: async (_url, options) => {
      fetchSignalWasAborted = options.signal.aborted;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            activity: [],
            automation: {},
            health: {},
            metrics: {},
            projects: [],
            security: {},
            system: {},
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    },
  });

  await api.getDashboardStatus({ signal: controller.signal });

  assert.strictEqual(fetchSignalWasAborted, false);
  assert.strictEqual(controller.signal.aborted, false);
});

test("dashboard fetch network failure becomes ApiRequestError", async () => {
  const { api } = createFrontendApiHarness({
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });

  await assert.rejects(() => api.getDashboardStatus(), {
    code: "API_NETWORK_ERROR",
    name: "ApiRequestError",
    status: 0,
  });
});

test("dashboard API accepts a valid mocked Supabase user token", async () => {
  let observedToken = "";

  delete require.cache[require.resolve(telemetryLibPath)];
  delete require.cache[require.resolve(dashboardStatusPath)];

  const handler = loadModuleWithMocks(dashboardStatusPath, {
    "@supabase/supabase-js": {
      createClient() {
        return {
          auth: {
            async getUser(token) {
              observedToken = token;

              return {
                data: {
                  user: {
                    id: "user-1",
                    email: "operator@example.test",
                  },
                },
                error: null,
              };
            },
          },
        };
      },
    },
  });
  const previousEnv = {
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  };
  process.env.SUPABASE_URL = "https://orbit-auth.example.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = createResponseRecorder();

    await handler(
      {
        headers: {
          authorization: "Bearer valid-mocked-token",
        },
        method: "GET",
        url: "/api/v1/dashboard/status",
      },
      res,
    );

    const body = JSON.parse(res.body);

    assert.strictEqual(observedToken, "valid-mocked-token");
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.module, "dashboard");
  } finally {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
});

test("Express and serverless dashboard status share telemetry envelope shape", async () => {
  delete require.cache[require.resolve(telemetryLibPath)];
  delete require.cache[require.resolve(dashboardStatusPath)];
  delete require.cache[require.resolve(routesIndexPath)];

  const serverlessHandler = loadModuleWithMocks(dashboardStatusPath, {
    "@supabase/supabase-js": {
      createClient() {
        return {
          auth: {
            async getUser() {
              return {
                data: {
                  user: {
                    id: "user-1",
                    email: "operator@example.test",
                  },
                },
                error: null,
              };
            },
          },
        };
      },
    },
  });
  const expressRoute = loadModuleWithMocks(routesIndexPath, {
    "../lib/supabase": null,
    "../middleware/requireAdmin": {
      requireAdmin: createDashboardAuthMiddleware(),
    },
    "../middleware/requireAuth": {
      requireAuth: createDashboardAuthMiddleware(),
    },
  });
  const previousEnv = {
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  };
  process.env.SUPABASE_URL = "https://orbit-auth.example.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;

  const app = express();
  app.use(express.json());
  app.use("/api/v1", expressRoute);
  const server = await startServer(app);

  try {
    const serverlessRes = createResponseRecorder();
    await serverlessHandler(
      {
        headers: {
          authorization: "Bearer valid-mocked-token",
        },
        method: "GET",
        url: "/api/v1/dashboard/status",
      },
      serverlessRes,
    );
    const serverlessBody = JSON.parse(serverlessRes.body);
    const expressResult = await requestJson(
      server.baseUrl,
      "/api/v1/dashboard/status",
      {
        headers: createAuthHeader(),
      },
    );

    assert.strictEqual(serverlessRes.statusCode, 200);
    assert.strictEqual(expressResult.status, 200);
    assert.strictEqual(typeof serverlessBody.timestamp, "string");
    assert.strictEqual(typeof expressResult.body.timestamp, "string");
    assert.deepStrictEqual(
      Object.keys(serverlessBody.data.operationalIntelligence).sort(),
      Object.keys(expressResult.body.data.operationalIntelligence).sort(),
    );
    assert.strictEqual(
      serverlessBody.data.operationalIntelligence.authSession.session,
      "validated",
    );
    assert.strictEqual(
      expressResult.body.data.operationalIntelligence.authSession.session,
      "validated",
    );
  } finally {
    await server.close();

    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
});

test("createDashboardResponse returns Command Center data structure", () => {
  const { createDashboardResponse } = require(telemetryLibPath);
  const response = createDashboardResponse({
    user: {
      email: "operator@example.test",
      id: "user-1",
    },
  });

  assert.strictEqual(response.success, true);
  assert.strictEqual(response.data.health.module, "health");
  assert.ok(response.data.system.runtime);
  assert.strictEqual(
    response.data.operationalIntelligence.authSession.authenticated,
    true,
  );
  assert.strictEqual(
    response.data.operationalIntelligence.authSession.session,
    "validated",
  );
  assert.ok(response.data.operationalIntelligence.authSession.userHash);
  assert.strictEqual(
    response.data.operationalIntelligence.workflow.status,
    "ready",
  );
  assert.deepStrictEqual(Object.keys(response.data).sort(), [
    "activity",
    "automation",
    "health",
    "metrics",
    "operationalIntelligence",
    "projects",
    "security",
    "system",
  ]);
});

test("Command Center operational intelligence omits email, tokens, and secrets", () => {
  const { createDashboardResponse } = require(telemetryLibPath);
  const response = createDashboardResponse({
    user: {
      email: "operator@example.test",
      id: "user-1",
    },
  });
  const serialized = JSON.stringify(response.data.operationalIntelligence);

  assert(!serialized.includes("operator@example.test"));
  assert(!serialized.includes("Authorization"));
  assert(!serialized.includes("Bearer"));
  assert(!serialized.includes("OPENROUTER_API_KEY"));
  assert(!serialized.includes("SUPABASE_SERVICE_ROLE_KEY"));
});

test("recent runtime errors are redacted before dashboard exposure", () => {
  const { error: logError } = require("../../server/services/observability/logger");
  const { createDashboardResponse } = require(telemetryLibPath);

  logError("test_runtime_error", {
    code: "TEST_RUNTIME_ERROR",
    error: {
      message:
        "OPENROUTER_API_KEY=secret-openrouter-value SUPABASE_SERVICE_ROLE_KEY=secret-supabase-value Authorization: Bearer secret-token-value",
    },
    method: "GET",
    path: "/api/v1/test",
    requestId: "request-1",
    statusCode: 500,
  });

  const response = createDashboardResponse();
  const recentErrors =
    response.data.operationalIntelligence.recentRuntimeErrors || [];
  const serialized = JSON.stringify(recentErrors);

  assert(recentErrors.length > 0);
  assert(!serialized.includes("secret-openrouter-value"));
  assert(!serialized.includes("secret-supabase-value"));
  assert(!serialized.includes("secret-token-value"));
  assert(!serialized.includes("Authorization"));
  assert(!serialized.includes("Bearer"));
  assert(serialized.includes("OPENROUTER_API_KEY=[REDACTED]"));
  assert(serialized.includes("SUPABASE_SERVICE_ROLE_KEY=[REDACTED]"));
  assert(serialized.includes("[REDACTED]"));
});

test("Command Center does not classify successful dashboard response as fallback", () => {
  const { createDashboardResponse } = require(telemetryLibPath);
  const { resolveCommandCenterTelemetryState } = require(dashboardStatePath);
  const state = resolveCommandCenterTelemetryState({
    dashboardData: createDashboardResponse().data,
    isTelemetryLoading: false,
    telemetryError: "",
  });

  assert.strictEqual(state.isTelemetryConnected, true);
  assert.strictEqual(state.isUsingFallback, false);
  assert.strictEqual(state.telemetryStatusText, "Backend telemetry live.");
});
