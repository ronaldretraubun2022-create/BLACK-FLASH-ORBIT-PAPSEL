const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");

function loadWorkflowEngineWithFakes({ aiResult, repository }) {
  const enginePath = path.join(rootDir, "server/services/workflows/workflowEngine.js");
  const repoPath = path.join(rootDir, "server/services/workflows/workflowRepository.js");
  const aiRouterPath = path.join(rootDir, "server/services/ai/aiRouter.js");
  const originalEngine = require.cache[require.resolve(enginePath)];
  const originalRepository = require.cache[require.resolve(repoPath)];
  const originalAiRouter = require.cache[require.resolve(aiRouterPath)];

  delete require.cache[require.resolve(enginePath)];
  require.cache[require.resolve(repoPath)] = {
    exports: repository,
    id: repoPath,
    loaded: true,
    filename: repoPath,
  };
  require.cache[require.resolve(aiRouterPath)] = {
    exports: {
      AI_USE_CASES: { GENERAL_CHAT: "GENERAL_CHAT" },
      generateCompletion: aiResult,
    },
    id: aiRouterPath,
    loaded: true,
    filename: aiRouterPath,
  };

  return {
    cleanup() {
      delete require.cache[require.resolve(enginePath)];
      delete require.cache[require.resolve(repoPath)];
      delete require.cache[require.resolve(aiRouterPath)];

      if (originalEngine) require.cache[require.resolve(enginePath)] = originalEngine;
      if (originalRepository) {
        require.cache[require.resolve(repoPath)] = originalRepository;
      }
      if (originalAiRouter) require.cache[require.resolve(aiRouterPath)] = originalAiRouter;
    },
    engine: require(enginePath),
  };
}

function loadHealthServiceWithFakes({
  embeddingStatus = { configured: true, provider: "openai" },
  knowledgeChatStatus = { configured: true, provider: "openrouter" },
  serviceConfigured = true,
  workflowConfiguredStatus = { configured: true, status: "configured" },
  workflowReadinessStatus = { configured: true, status: "ready" },
}) {
  const healthPath = path.join(rootDir, "server/services/observability/healthService.js");
  const embeddingPath = path.join(rootDir, "server/services/knowledge/embeddingService.js");
  const supabasePath = path.join(rootDir, "server/services/supabaseAdmin.js");
  const workflowPath = path.join(rootDir, "server/services/workflows/workflowRepository.js");
  const originalHealth = require.cache[require.resolve(healthPath)];
  const originalEmbedding = require.cache[require.resolve(embeddingPath)];
  const originalSupabase = require.cache[require.resolve(supabasePath)];
  const originalWorkflow = require.cache[require.resolve(workflowPath)];

  delete require.cache[require.resolve(healthPath)];
  require.cache[require.resolve(embeddingPath)] = {
    exports: {
      getEmbeddingProviderStatus: () => embeddingStatus,
      getKnowledgeChatProviderStatus: () => knowledgeChatStatus,
    },
    id: embeddingPath,
    loaded: true,
    filename: embeddingPath,
  };
  require.cache[require.resolve(supabasePath)] = {
    exports: {
      isSupabaseServiceConfigured: () => serviceConfigured,
    },
    id: supabasePath,
    loaded: true,
    filename: supabasePath,
  };
  require.cache[require.resolve(workflowPath)] = {
    exports: {
      checkWorkflowPersistence: async () => workflowReadinessStatus,
      getWorkflowPersistenceStatus: () => workflowConfiguredStatus,
    },
    id: workflowPath,
    loaded: true,
    filename: workflowPath,
  };

  return {
    cleanup() {
      delete require.cache[require.resolve(healthPath)];
      delete require.cache[require.resolve(embeddingPath)];
      delete require.cache[require.resolve(supabasePath)];
      delete require.cache[require.resolve(workflowPath)];

      if (originalHealth) require.cache[require.resolve(healthPath)] = originalHealth;
      if (originalEmbedding) {
        require.cache[require.resolve(embeddingPath)] = originalEmbedding;
      }
      if (originalSupabase) require.cache[require.resolve(supabasePath)] = originalSupabase;
      if (originalWorkflow) require.cache[require.resolve(workflowPath)] = originalWorkflow;
    },
    healthService: require(healthPath),
  };
}

function createFakeRepository() {
  const state = {
    approvals: [],
    auditEvents: [],
    runs: new Map(),
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    state,
    async createRunWithSteps({ definition, metadata, ownerId }) {
      const run = {
        approvals: [],
        createdAt: "2026-08-24T00:00:00.000Z",
        definitionId: definition.id,
        id: "run-1",
        metadata,
        ownerId,
        status: "queued",
        steps: definition.steps.map((step) => ({
          attempts: 0,
          metadata: {},
          ownerId,
          runId: "run-1",
          status: "queued",
          stepId: step.id,
          tool: step.tool,
        })),
      };

      state.runs.set(run.id, run);
      return clone(run);
    },
    async getRun({ ownerId, runId }) {
      const run = state.runs.get(runId);

      if (!run || run.ownerId !== ownerId) return null;

      return clone(run);
    },
    async recordApproval({ approvedBy, ownerId, runId, stepId }) {
      const run = state.runs.get(runId);
      const approval = {
        approvedBy,
        ownerId,
        runId,
        status: "approved",
        stepId,
      };

      run.approvals.push(approval);
      state.approvals.push(approval);
      return clone(approval);
    },
    async recordAuditEvent(event) {
      state.auditEvents.push(clone(event));
    },
    async updateRun({ completed, error, metadata, ownerId, runId, status }) {
      const run = state.runs.get(runId);

      assert(run);
      assert.strictEqual(run.ownerId, ownerId);

      run.status = status;
      if (completed) run.completedAt = "2026-08-24T00:00:01.000Z";
      if (metadata) run.metadata = metadata;
      if (error) {
        run.errorCode = error.code || null;
        run.errorMessage = error.message || null;
      }

      return clone(run);
    },
    async updateStep({ attempts, completed, error, metadata, ownerId, runId, status, stepId }) {
      const run = state.runs.get(runId);
      const step = run.steps.find((item) => item.stepId === stepId);

      assert(step);
      assert.strictEqual(step.ownerId, ownerId);

      step.status = status;
      if (Number.isInteger(attempts)) step.attempts = attempts;
      if (completed) step.completedAt = "2026-08-24T00:00:01.000Z";
      if (metadata) step.metadata = metadata;
      if (error) {
        step.errorCode = error.code || null;
        step.errorMessage = error.message || null;
      }

      return clone(step);
    },
  };
}

test("workflow history migration is owner scoped and RLS protected", () => {
  const sql = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20260824010000_orbit_workflow_history.sql"),
    "utf8",
  );

  for (const table of [
    "orbit_workflow_runs",
    "orbit_workflow_run_steps",
    "orbit_workflow_approvals",
    "orbit_workflow_audit_events",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /authorization/i);
  assert.doesNotMatch(sql, /api[_-]?key/i);
});

test("workflow approval gate blocks AI Router until human approval", async () => {
  const repository = createFakeRepository();
  let aiCalls = 0;
  const { cleanup, engine } = loadWorkflowEngineWithFakes({
    repository,
    aiResult: async () => {
      aiCalls += 1;
      return {
        metadata: { durationMs: 42 },
        model: "safe/model",
        provider: "openrouter",
      };
    },
  });

  try {
    const created = await engine.createWorkflowRun({
      definitionId: "ai_operational_check",
      input: { label: "Daily personal check" },
      ownerId: "user-1",
      requestId: "req-1",
    });

    assert.strictEqual(created.status, "waiting_approval");
    assert.strictEqual(aiCalls, 0);

    const approved = await engine.approveWorkflowRun({
      approvedBy: "user-1",
      ownerId: "user-1",
      requestId: "req-2",
      runId: created.id,
    });

    assert.strictEqual(approved.status, "succeeded");
    assert.strictEqual(approved.metadata.providerReached, true);
    assert.strictEqual(aiCalls, 1);

    await assert.rejects(
      () =>
        engine.approveWorkflowRun({
          approvedBy: "user-1",
          ownerId: "user-1",
          requestId: "req-3",
          runId: created.id,
        }),
      /tidak bisa di-approve/,
    );
  } finally {
    cleanup();
  }
});

test("workflow persistence failure fails safely before run success", async () => {
  const { cleanup, engine } = loadWorkflowEngineWithFakes({
    repository: {
      async createRunWithSteps() {
        const error = new Error("Workflow persistence gagal.");
        error.code = "WORKFLOW_PERSISTENCE_ERROR";
        error.statusCode = 503;
        throw error;
      },
    },
    aiResult: async () => {
      throw new Error("AI must not run when persistence fails.");
    },
  });

  try {
    await assert.rejects(
      () =>
        engine.createWorkflowRun({
          definitionId: "ai_operational_check",
          ownerId: "user-1",
          requestId: "req-1",
        }),
      /Workflow persistence gagal/,
    );
  } finally {
    cleanup();
  }
});

test("readiness endpoint and Vercel ignore protect deployment boundaries", () => {
  const readinessSource = fs.readFileSync(
    path.join(rootDir, "api/v1/readiness.js"),
    "utf8",
  );
  const ignore = fs.readFileSync(path.join(rootDir, ".vercelignore"), "utf8");

  assert.match(readinessSource, /getReadinessSnapshot/);
  assert.match(readinessSource, /status === "ready" \? 200 : 503/);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^\.vercel$/m);
});

test("health stays compatible while readiness reports durable persistence", async () => {
  const { cleanup, healthService } = loadHealthServiceWithFakes({});
  const previousOpenRouterKey = process.env.OPENROUTER_API_KEY;

  try {
    process.env.OPENROUTER_API_KEY = "test-openrouter-configured";
    const health = healthService.getHealthSnapshot();
    const readiness = await healthService.getReadinessSnapshot();

    assert.strictEqual(health.status, "healthy");
    assert.deepStrictEqual(health.dependencies.workflowPersistence, {
      configured: true,
      status: "configured",
    });
    assert.strictEqual(readiness.status, "ready");
    assert.deepStrictEqual(readiness.dependencies.workflowPersistence, {
      configured: true,
      status: "ready",
    });
  } finally {
    if (previousOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previousOpenRouterKey;
    }
    cleanup();
  }
});
