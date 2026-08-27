const assert = require("node:assert");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");

function createWorkflowApp({ overrides = {} } = {}) {
  let createRunCalls = 0;
  const updateTemplateCalls = [];
  const repository = {
    async createTemplate({ input, ownerId }) {
      return {
        action: input.action || "",
        definitionId: input.definitionId,
        description: input.description || "",
        id: "template-1",
        name: input.name,
        ownerId,
        schedule: input.schedule || "Manual",
        trigger: input.trigger || "",
      };
    },
    async deleteTemplate() {
      return true;
    },
    async getRun() {
      return null;
    },
    async getTemplate({ ownerId, templateId }) {
      return {
        action: "Refresh data",
        definitionId: "telemetry_sync",
        description: "Safe reusable template.",
        id: templateId,
        name: "Telemetry Sync",
        ownerId,
        schedule: "Manual",
        trigger: "Manual",
      };
    },
    async listRuns() {
      return [];
    },
    async listTemplates({ ownerId }) {
      return [
        {
          definitionId: "telemetry_sync",
          id: "template-1",
          name: "Telemetry Sync",
          ownerId,
        },
      ];
    },
    async updateTemplate({ input, ownerId, templateId }) {
      updateTemplateCalls.push({ ownerId, templateId });
      return {
        definitionId: input.definitionId,
        id: templateId,
        name: input.name,
        ownerId,
      };
    },
    ...overrides.repository,
  };
  const route = loadModuleWithMocks("../../server/routes/workflows", {
    "../middleware/requireAuth": {
      requireAuth(req, res, next) {
        if (!req.headers.authorization) {
          return res.status(401).json({ success: false });
        }

        req.user = { id: "user-1" };
        req.userId = "user-1";
        return next();
      },
    },
    "../services/workflows/workflowDefinitions": {
      assertAllowedWorkflowDefinition(definition) {
        if (!definition) {
          const error = new Error("Workflow definition tidak ditemukan.");
          error.code = "WORKFLOW_DEFINITION_NOT_FOUND";
          error.statusCode = 404;
          throw error;
        }
      },
      getWorkflowDefinition(definitionId) {
        if (definitionId !== "telemetry_sync") return null;

        return {
          id: "telemetry_sync",
          steps: [],
        };
      },
      getWorkflowDefinitions() {
        return [{ id: "telemetry_sync" }];
      },
    },
    "../services/workflows/workflowEngine": {
      async approveWorkflowRun() {
        throw new Error("not used");
      },
      async cancelWorkflowRun() {
        throw new Error("not used");
      },
      async createWorkflowRun() {
        createRunCalls += 1;
        return {
          id: "run-1",
          status: "succeeded",
        };
      },
    },
    "../services/workflows/workflowRepository": repository,
  });
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use("/api/v1/workflows", route);

  return {
    app,
    getCreateRunCalls: () => createRunCalls,
    getUpdateTemplateCalls: () => updateTemplateCalls,
  };
}

test("workflow template migration is owner scoped and RLS protected", () => {
  const sql = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20260824020000_orbit_workflow_templates.sql"),
    "utf8",
  );
  const workflowHistorySql = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20260824010000_orbit_workflow_history.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.orbit_workflow_templates/);
  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /alter table public\.orbit_workflow_templates enable row level security/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /unique index if not exists orbit_workflow_templates_owner_name_idx/);
  assert.match(sql, /alter table public\.orbit_workflow_runs\s+add column if not exists template_id/);
  assert.doesNotMatch(sql, /create table if not exists public\.orbit_workflow_runs/);
  assert.doesNotMatch(sql, /create table if not exists public\.orbit_workflow_run_steps/);
  assert.doesNotMatch(sql, /create table if not exists public\.orbit_workflow_approvals/);
  assert.doesNotMatch(sql, /create table if not exists public\.orbit_workflow_audit_events/);
  assert.doesNotMatch(sql, /Workflow run owners can/);
  assert.doesNotMatch(sql, /Workflow step owners can/);
  assert.doesNotMatch(sql, /Workflow approval owners can/);
  assert.doesNotMatch(sql, /Workflow audit owners can/);
  assert.match(workflowHistorySql, /create table if not exists public\.orbit_workflow_runs/);
  assert.match(workflowHistorySql, /create table if not exists public\.orbit_workflow_run_steps/);
  assert.match(workflowHistorySql, /create table if not exists public\.orbit_workflow_approvals/);
  assert.match(workflowHistorySql, /create table if not exists public\.orbit_workflow_audit_events/);
  assert.match(sql, /metadata::text !~\* '\(authorization\|cookie\|password/);
  assert.doesNotMatch(sql, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(sql, /OPENROUTER_API_KEY/);
});

test("workflow template input rejects malformed and sensitive fields", () => {
  const { normalizeTemplateInput } = require("../../server/services/workflows/workflowRepository");

  assert.throws(
    () => normalizeTemplateInput(null),
    /Template workflow tidak valid/,
  );
  assert.throws(
    () => normalizeTemplateInput({ definitionId: "telemetry_sync" }),
    /membutuhkan name dan definitionId/,
  );
  assert.throws(
    () => normalizeTemplateInput({ definitionId: "telemetry_sync", name: "   " }),
    /membutuhkan name dan definitionId/,
  );
  assert.strictEqual(
    normalizeTemplateInput({ definitionId: "telemetry_sync", name: "  ORBIT Personal Test 001  " })
      .name,
    "ORBIT Personal Test 001",
  );
  assert.throws(
    () =>
      normalizeTemplateInput({
        definitionId: "telemetry_sync",
        metadata: { authorization: "Bearer unsafe" },
        name: "Unsafe",
      }),
    /field sensitif/,
  );
});

test("custom template name is submitted through the authenticated create endpoint", async () => {
  const { app } = createWorkflowApp();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/workflows/templates", {
      body: JSON.stringify({
        definitionId: "telemetry_sync",
        name: "ORBIT Personal Test 001",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.body.data.name, "ORBIT Personal Test 001");
  } finally {
    await server.close();
  }
});

test("loading a workflow template does not execute a workflow run", async () => {
  const { app, getCreateRunCalls } = createWorkflowApp();
  const server = await startServer(app);

  try {
    const result = await requestJson(
      server.baseUrl,
      "/api/v1/workflows/templates/template-1",
      {
        headers: createAuthHeader(),
      },
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.data.id, "template-1");
    assert.strictEqual(getCreateRunCalls(), 0);
  } finally {
    await server.close();
  }
});

test("workflow template CRUD handles duplicate names safely", async () => {
  const { app } = createWorkflowApp({
    overrides: {
      repository: {
        async createTemplate() {
          const error = new Error("Nama template workflow sudah digunakan.");
          error.code = "WORKFLOW_TEMPLATE_DUPLICATE_NAME";
          error.statusCode = 409;
          throw error;
        },
      },
    },
  });
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/workflows/templates", {
      body: JSON.stringify({
        definitionId: "telemetry_sync",
        name: "Telemetry Sync",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 409);
    assert.strictEqual(result.body.code, "WORKFLOW_TEMPLATE_DUPLICATE_NAME");
  } finally {
    await server.close();
  }
});

test("workflow template update preserves authenticated owner scope", async () => {
  const { app, getUpdateTemplateCalls } = createWorkflowApp();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/workflows/templates/template-1", {
      body: JSON.stringify({
        definitionId: "telemetry_sync",
        name: "Updated Telemetry Sync",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "PUT",
    });

    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(getUpdateTemplateCalls(), [
      { ownerId: "user-1", templateId: "template-1" },
    ]);
  } finally {
    await server.close();
  }
});

test("workflow persistence failures preserve a safe machine-readable error", async () => {
  const { app } = createWorkflowApp({
    overrides: {
      repository: {
        async createTemplate() {
          const error = new Error("Workflow persistence gagal.");
          error.code = "WORKFLOW_PERSISTENCE_ERROR";
          error.statusCode = 503;
          throw error;
        },
      },
    },
  });
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/workflows/templates", {
      body: JSON.stringify({
        definitionId: "telemetry_sync",
        name: "Telemetry Sync",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 503);
    assert.strictEqual(result.body.code, "WORKFLOW_PERSISTENCE_ERROR");
    assert.strictEqual(result.body.message, "Workflow persistence gagal.");
    assert.notStrictEqual(result.body.message, "Workflow request gagal.");
  } finally {
    await server.close();
  }
});

test("creating a run from a template uses the workflow engine boundary", async () => {
  const { app, getCreateRunCalls } = createWorkflowApp();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/workflows/runs", {
      body: JSON.stringify({
        templateId: "template-1",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.body.data.status, "succeeded");
    assert.strictEqual(getCreateRunCalls(), 1);
  } finally {
    await server.close();
  }
});

test("workflow repository scopes template queries to owner", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "server/services/workflows/workflowRepository.js"),
    "utf8",
  );

  for (const fnName of [
    "listTemplates",
    "getTemplate",
    "updateTemplate",
    "deleteTemplate",
  ]) {
    const start = source.indexOf(`async function ${fnName}`);
    const end = source.indexOf("\nasync function", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);

    assert.match(body, /\.eq\("owner_id", ownerId\)/);
  }
});
