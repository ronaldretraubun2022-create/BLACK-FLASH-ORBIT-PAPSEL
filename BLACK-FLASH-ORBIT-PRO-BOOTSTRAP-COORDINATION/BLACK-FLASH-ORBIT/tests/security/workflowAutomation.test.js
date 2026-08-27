const assert = require("node:assert");
const express = require("express");
const path = require("node:path");
const test = require("node:test");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");
const routesIndexPath = path.join(rootDir, "server/routes/index.js");
const enginePath = path.join(
  rootDir,
  "server/services/automation/workflowEngine.js",
);
const telemetryPath = path.join(
  rootDir,
  "server/services/observability/operationalTelemetry.js",
);
const dashboardTelemetryPath = path.join(
  rootDir,
  "server/lib/orbitDashboardTelemetry.js",
);
const serverlessDefinitionsPath = path.join(
  rootDir,
  "api/v1/automation/definitions.js",
);
const serverlessRunsPath = path.join(rootDir, "api/v1/automation/runs.js");

function createMockAuthMiddleware() {
  return function requireMockAuth(req, res, next) {
    const authorization = String(req.headers.authorization || "");

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    const token = authorization.slice("Bearer ".length).trim();
    req.user = {
      email: `${token}@example.test`,
      id: token || "user-1",
    };
    req.userId = req.user.id;
    req.userEmail = req.user.email;

    return next();
  };
}

function createAutomationApp() {
  delete require.cache[require.resolve(enginePath)];
  delete require.cache[require.resolve(routesIndexPath)];

  const route = loadModuleWithMocks(routesIndexPath, {
    "../lib/supabase": null,
    "../middleware/requireAdmin": {
      requireAdmin: createMockAuthMiddleware(),
    },
    "../middleware/requireAuth": {
      requireAuth: createMockAuthMiddleware(),
    },
  });
  const app = express();
  app.use(express.json());
  app.use("/api/v1", route);

  return app;
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

function createServerlessAuthMock() {
  return {
    createClient() {
      return {
        auth: {
          async getUser() {
            return {
              data: {
                user: {
                  email: "operator@example.test",
                  id: "user-1",
                },
              },
              error: null,
            };
          },
        },
      };
    },
  };
}

test("workflow engine runs a deterministic lifecycle", async () => {
  const {
    createAutomationWorkflowEngine,
  } = require("../../server/services/automation/workflowEngine");
  const events = [];
  const engine = createAutomationWorkflowEngine({
    telemetryRecorder: (event) => events.push(event),
  });

  const run = await engine.startRun({
    input: { scope: "dashboard" },
    user: { id: "user-1" },
    workflowId: "telemetry-sync",
  });

  assert.strictEqual(run.state, "succeeded");
  assert.strictEqual(run.completedSteps, run.totalSteps);
  assert.deepStrictEqual(
    run.steps.map((step) => step.status),
    ["succeeded", "succeeded"],
  );
  assert(events.some((event) => event.event === "workflow_succeeded"));
});

test("workflow engine rejects invalid state transitions", () => {
  const {
    createAutomationWorkflowEngine,
  } = require("../../server/services/automation/workflowEngine");
  const engine = createAutomationWorkflowEngine({
    telemetryRecorder: () => {},
  });
  const run = {
    events: [],
    state: "queued",
    updatedAt: new Date().toISOString(),
  };

  assert.throws(() => engine.transitionRunState(run, "succeeded"), {
    code: "WORKFLOW_INVALID_TRANSITION",
  });
});

test("workflow routes enforce auth and ownership isolation", async () => {
  const app = createAutomationApp();
  const server = await startServer(app);

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/api/v1/automation/runs", {
      body: JSON.stringify({ workflowId: "telemetry-sync" }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(unauthenticated.status, 401);

    const created = await requestJson(server.baseUrl, "/api/v1/automation/runs", {
      body: JSON.stringify({ workflowId: "telemetry-sync" }),
      headers: {
        ...createAuthHeader("Bearer user-1"),
        "content-type": "application/json",
      },
      method: "POST",
    });
    const hiddenFromOtherUser = await requestJson(
      server.baseUrl,
      `/api/v1/automation/runs/${created.body.data.id}`,
      {
        headers: createAuthHeader("Bearer user-2"),
      },
    );

    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.data.state, "succeeded");
    assert.strictEqual(hiddenFromOtherUser.status, 404);
  } finally {
    await server.close();
  }
});

test("serverless workflow handlers expose definitions and runs with auth", async () => {
  delete require.cache[require.resolve(enginePath)];
  delete require.cache[require.resolve(serverlessDefinitionsPath)];
  delete require.cache[require.resolve(serverlessRunsPath)];

  const definitionsHandler = loadModuleWithMocks(serverlessDefinitionsPath, {
    "@supabase/supabase-js": createServerlessAuthMock(),
  });
  const runsHandler = loadModuleWithMocks(serverlessRunsPath, {
    "@supabase/supabase-js": createServerlessAuthMock(),
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
    const definitionsRes = createResponseRecorder();
    await definitionsHandler(
      {
        headers: { authorization: "Bearer valid-token" },
        method: "GET",
        url: "/api/v1/automation/definitions",
      },
      definitionsRes,
    );
    const createRes = createResponseRecorder();
    await runsHandler(
      {
        body: { workflowId: "telemetry-sync" },
        headers: { authorization: "Bearer valid-token" },
        method: "POST",
        url: "/api/v1/automation/runs",
      },
      createRes,
    );

    assert.strictEqual(definitionsRes.statusCode, 200);
    assert(JSON.parse(definitionsRes.body).data.length > 0);
    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(JSON.parse(createRes.body).data.state, "succeeded");
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

test("workflow approval gate blocks sensitive AI step until approved", async () => {
  const {
    createAutomationWorkflowEngine,
    createSafeToolRegistry,
  } = require("../../server/services/automation/workflowEngine");
  let aiCalls = 0;
  const engine = createAutomationWorkflowEngine({
    telemetryRecorder: () => {},
    toolRegistry: createSafeToolRegistry({
      "ai.router.summary": {
        execute: async () => {
          aiCalls += 1;
          return { provider: "mock", status: "completed" };
        },
      },
    }),
  });

  const waiting = await engine.startRun({
    input: { topic: "Release health" },
    user: { id: "user-1" },
    workflowId: "ai-operations-brief",
  });

  assert.strictEqual(waiting.state, "waiting_approval");
  assert.strictEqual(aiCalls, 0);

  const approved = await engine.approveRun({
    runId: waiting.id,
    user: { id: "user-1" },
  });

  assert.strictEqual(approved.state, "succeeded");
  assert.strictEqual(aiCalls, 1);
});

test("workflow retry uses bounded exponential backoff", async () => {
  const {
    createAutomationWorkflowEngine,
    createSafeToolRegistry,
  } = require("../../server/services/automation/workflowEngine");
  let attempts = 0;
  const engine = createAutomationWorkflowEngine({
    definitions: [
      {
        id: "retry-test",
        inputSchema: {},
        name: "Retry Test",
        steps: [
          {
            id: "flaky",
            maxRetries: 2,
            name: "Flaky",
            toolId: "test.flaky",
          },
        ],
      },
    ],
    telemetryRecorder: () => {},
    toolRegistry: createSafeToolRegistry({
      "test.flaky": {
        execute: async () => {
          attempts += 1;

          if (attempts < 3) {
            const error = new Error("temporary failure");
            error.code = "TEMPORARY_FAILURE";
            throw error;
          }

          return { status: "ok" };
        },
      },
    }),
  });

  const run = await engine.startRun({
    user: { id: "user-1" },
    workflowId: "retry-test",
  });

  assert.strictEqual(run.state, "succeeded");
  assert.strictEqual(attempts, 3);
  assert.deepStrictEqual(run.retryDelaysMs, [250, 500]);
  assert.strictEqual(run.steps[0].status, "succeeded");
  assert.strictEqual(run.steps[0].code, null);
});

test("workflow timeout and cancellation are terminal and safe", async () => {
  const {
    createAutomationWorkflowEngine,
    createSafeToolRegistry,
  } = require("../../server/services/automation/workflowEngine");
  const engine = createAutomationWorkflowEngine({
    definitions: [
      {
        id: "timeout-test",
        inputSchema: {},
        name: "Timeout Test",
        steps: [
          {
            id: "slow",
            name: "Slow",
            timeoutMs: 5,
            toolId: "test.slow",
          },
        ],
      },
      {
        id: "approval-test",
        inputSchema: {},
        name: "Approval Test",
        steps: [
          {
            id: "approval",
            name: "Approval",
            requiresApproval: true,
            toolId: "approval.wait",
          },
        ],
      },
    ],
    telemetryRecorder: () => {},
    toolRegistry: createSafeToolRegistry({
      "test.slow": {
        execute: async () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ status: "late" }), 25);
          }),
      },
    }),
  });

  const timedOut = await engine.startRun({
    user: { id: "user-1" },
    workflowId: "timeout-test",
  });
  const waiting = await engine.startRun({
    user: { id: "user-1" },
    workflowId: "approval-test",
  });
  const cancelled = engine.cancelRun({
    runId: waiting.id,
    user: { id: "user-1" },
  });

  assert.strictEqual(timedOut.state, "timed_out");
  assert.strictEqual(cancelled.state, "cancelled");
});

test("workflow tool allowlist and URL SSRF guard reject unsafe execution", async () => {
  const {
    createAutomationWorkflowEngine,
    validateSafeUrl,
  } = require("../../server/services/automation/workflowEngine");
  const engine = createAutomationWorkflowEngine({
    definitions: [
      {
        id: "unknown-tool",
        inputSchema: {},
        name: "Unknown Tool",
        steps: [
          {
            id: "unknown",
            name: "Unknown",
            toolId: "shell.exec",
          },
        ],
      },
    ],
    telemetryRecorder: () => {},
  });

  const run = await engine.startRun({
    user: { id: "user-1" },
    workflowId: "unknown-tool",
  });

  assert.strictEqual(run.state, "failed");
  assert.strictEqual(run.steps[0].code, "WORKFLOW_TOOL_NOT_ALLOWED");
  assert.throws(() => validateSafeUrl("http://127.0.0.1:3000/internal"), {
    code: "WORKFLOW_URL_REJECTED",
  });
});

test("workflow telemetry redacts sensitive input and Command Center reports health", async () => {
  delete require.cache[require.resolve(telemetryPath)];
  delete require.cache[require.resolve(enginePath)];
  delete require.cache[require.resolve(dashboardTelemetryPath)];

  const {
    defaultWorkflowEngine,
  } = require("../../server/services/automation/workflowEngine");
  const {
    createDashboardResponse,
  } = require("../../server/lib/orbitDashboardTelemetry");

  await assert.rejects(
    () =>
      defaultWorkflowEngine.startRun({
        input: {
          scope: "dashboard",
          token: "secret-token-value",
        },
        user: {
          email: "operator@example.test",
          id: "user-1",
        },
        workflowId: "telemetry-sync",
      }),
    {
      code: "WORKFLOW_INPUT_SENSITIVE",
    },
  );

  await defaultWorkflowEngine.startRun({
    input: { scope: "dashboard" },
    user: {
      email: "operator@example.test",
      id: "user-1",
    },
    workflowId: "telemetry-sync",
  });

  const response = createDashboardResponse({
    user: {
      email: "operator@example.test",
      id: "user-1",
    },
  });
  const workflow = response.data.operationalIntelligence.workflow;
  const serialized = JSON.stringify(response.data.operationalIntelligence);

  assert.strictEqual(workflow.status, "ready");
  assert(workflow.total > 0);
  assert(!serialized.includes("operator@example.test"));
  assert(!serialized.includes("secret-token-value"));
  assert(!serialized.includes("Authorization"));
  assert(!serialized.includes("Bearer"));
});

test("workflow telemetry active count follows latest run state, not event history", async () => {
  delete require.cache[require.resolve(telemetryPath)];
  delete require.cache[require.resolve(enginePath)];

  const telemetry = require("../../server/services/observability/operationalTelemetry");
  const {
    defaultWorkflowEngine,
  } = require("../../server/services/automation/workflowEngine");

  telemetry.resetOperationalTelemetryForTests();
  defaultWorkflowEngine.reset();

  const run = await defaultWorkflowEngine.startRun({
    input: { scope: "dashboard" },
    user: { id: "user-1" },
    workflowId: "telemetry-sync",
  });
  const observed = telemetry.getOperationalIntelligence({
    user: { id: "user-1" },
  }).workflow;

  assert.strictEqual(run.state, "succeeded");
  assert.strictEqual(defaultWorkflowEngine.getSnapshot().active, 0);
  assert.strictEqual(observed.active, 0);
  assert.strictEqual(observed.succeeded, 1);
  assert(observed.total > observed.succeeded);
});
