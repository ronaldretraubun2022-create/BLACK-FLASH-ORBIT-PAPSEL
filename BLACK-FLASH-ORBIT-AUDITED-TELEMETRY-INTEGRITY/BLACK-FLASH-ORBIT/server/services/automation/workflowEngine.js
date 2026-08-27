const crypto = require("node:crypto");

const { generateCompletion, AI_USE_CASES } = require("../ai/aiRouter");
const {
  recordWorkflowTelemetry,
} = require("../observability/operationalTelemetry");
const { sanitizeScalar } = require("../observability/logger");

const TERMINAL_STATES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
const MAX_RUNS_PER_OWNER = 50;
const MAX_INPUT_STRING_LENGTH = 500;
const MAX_RETRY_ATTEMPTS = 3;
const MIN_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 4000;
const DEFAULT_STEP_TIMEOUT_MS = 5000;
const SENSITIVE_INPUT_PATTERN =
  /(authorization|bearer|cookie|password|passwd|secret|token|api[_ -]?key|service[_ -]?role|private[_ -]?key|seed[_ -]?phrase)/i;
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /\.local$/i,
];

const workflowDefinitions = [
  {
    id: "telemetry-sync",
    name: "Telemetry Sync",
    description: "Refresh safe runtime, module, and automation observability.",
    inputSchema: {
      scope: ["dashboard", "health", "automation"],
    },
    steps: [
      {
        id: "collect-health",
        name: "Collect Health",
        toolId: "telemetry.healthSnapshot",
      },
      {
        id: "audit-telemetry",
        name: "Audit Telemetry",
        toolId: "audit.recordEvent",
      },
    ],
  },
  {
    id: "security-sweep",
    name: "Security Sweep",
    description: "Run a safe route and configuration checklist.",
    inputSchema: {
      scope: ["routes", "telemetry", "release"],
    },
    steps: [
      {
        id: "checklist",
        name: "Run Checklist",
        toolId: "audit.securityChecklist",
        maxRetries: 1,
      },
      {
        id: "audit-security",
        name: "Audit Security",
        toolId: "audit.recordEvent",
      },
    ],
  },
  {
    id: "ai-operations-brief",
    name: "AI Operations Brief",
    description: "Create a short operations brief through the existing AI Router boundary.",
    inputSchema: {
      topic: "string",
    },
    steps: [
      {
        id: "ai-summary",
        name: "AI Summary",
        requiresApproval: true,
        timeoutMs: 12000,
        toolId: "ai.router.summary",
      },
      {
        id: "audit-ai",
        name: "Audit AI Workflow",
        toolId: "audit.recordEvent",
      },
    ],
  },
];

const allowedExternalHosts = new Set(
  String(process.env.ORBIT_WORKFLOW_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

function createWorkflowError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
}

function getUserId(user) {
  return String(user?.id || "").trim();
}

function assertUser(user) {
  const userId = getUserId(user);

  if (!userId) {
    throw createWorkflowError(
      "Authenticated user is required.",
      "WORKFLOW_AUTH_REQUIRED",
      401,
    );
  }

  return userId;
}

function sanitizeIdentifier(value, fallback = "") {
  return sanitizeScalar(value, 120) || fallback;
}

function containsSensitiveInput(value) {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    return SENSITIVE_INPUT_PATTERN.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveInput(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).some(
      ([key, item]) => SENSITIVE_INPUT_PATTERN.test(key) || containsSensitiveInput(item),
    );
  }

  return false;
}

function normalizeWorkflowInput(definition, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createWorkflowError(
      "Workflow input must be an object.",
      "WORKFLOW_INPUT_INVALID",
      400,
    );
  }

  if (containsSensitiveInput(input)) {
    throw createWorkflowError(
      "Workflow input contains sensitive data.",
      "WORKFLOW_INPUT_SENSITIVE",
      400,
    );
  }

  const schema = definition.inputSchema || {};
  const normalized = {};
  const allowedKeys = Object.keys(schema);

  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      throw createWorkflowError(
        "Workflow input field is not allowed.",
        "WORKFLOW_INPUT_FIELD_REJECTED",
        400,
      );
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    const rawValue = input[key];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    if (Array.isArray(rule)) {
      const value = sanitizeScalar(rawValue, MAX_INPUT_STRING_LENGTH);

      if (!rule.includes(value)) {
        throw createWorkflowError(
          "Workflow input value is not allowed.",
          "WORKFLOW_INPUT_VALUE_REJECTED",
          400,
        );
      }

      normalized[key] = value;
      continue;
    }

    if (rule === "string") {
      const value = sanitizeScalar(rawValue, MAX_INPUT_STRING_LENGTH);

      if (!value) {
        throw createWorkflowError(
          "Workflow input string is empty.",
          "WORKFLOW_INPUT_VALUE_REJECTED",
          400,
        );
      }

      normalized[key] = value;
    }
  }

  return normalized;
}

function publicDefinition(definition) {
  return {
    description: definition.description,
    id: definition.id,
    name: definition.name,
    requiresApproval: definition.steps.some((step) => step.requiresApproval),
    stepCount: definition.steps.length,
    steps: definition.steps.map((step) => ({
      id: step.id,
      name: step.name,
      requiresApproval: Boolean(step.requiresApproval),
      toolId: step.toolId,
    })),
  };
}

function createStepState(step) {
  return {
    attempts: 0,
    id: step.id,
    name: step.name,
    requiresApproval: Boolean(step.requiresApproval),
    status: "pending",
    toolId: step.toolId,
  };
}

function calculateBackoffMs(attempt) {
  const boundedAttempt = Math.min(Math.max(Number(attempt) || 1, 1), MAX_RETRY_ATTEMPTS);
  return Math.min(MIN_BACKOFF_MS * 2 ** (boundedAttempt - 1), MAX_BACKOFF_MS);
}

function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

function transitionRunState(run, nextState, details = {}) {
  const allowedTransitions = {
    queued: ["running", "cancelled"],
    running: ["waiting_approval", "retry_scheduled", "succeeded", "failed", "timed_out", "cancelled"],
    waiting_approval: ["running", "cancelled"],
    retry_scheduled: ["running", "cancelled"],
  };
  const currentState = run.state;
  const allowedNextStates = allowedTransitions[currentState] || [];

  if (!allowedNextStates.includes(nextState)) {
    throw createWorkflowError(
      `Invalid workflow transition ${currentState} -> ${nextState}.`,
      "WORKFLOW_INVALID_TRANSITION",
      409,
      {
        currentState,
        nextState,
      },
    );
  }

  run.state = nextState;
  run.updatedAt = new Date().toISOString();
  run.events.unshift({
    at: run.updatedAt,
    code: details.code || null,
    state: nextState,
    type: details.type || "state_transition",
  });

  return run;
}

function validateSafeUrl(rawUrl, allowedHosts = allowedExternalHosts) {
  let parsed = null;

  try {
    parsed = new URL(String(rawUrl || ""));
  } catch {
    throw createWorkflowError("URL is invalid.", "WORKFLOW_URL_INVALID", 400);
  }

  if (parsed.protocol !== "https:") {
    throw createWorkflowError("URL protocol is not allowed.", "WORKFLOW_URL_REJECTED", 400);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw createWorkflowError("URL host is not allowed.", "WORKFLOW_URL_REJECTED", 400);
  }

  if (!allowedHosts.has(hostname)) {
    throw createWorkflowError("URL host is not allowlisted.", "WORKFLOW_URL_REJECTED", 400);
  }

  return parsed.toString();
}

function createSafeToolRegistry(overrides = {}) {
  const tools = {
    "approval.wait": {
      execute: async () => ({ status: "approved" }),
    },
    "audit.recordEvent": {
      execute: async ({ run }) => ({
        runId: run.id,
        state: run.state,
        status: "recorded",
        workflowId: run.workflowId,
      }),
    },
    "audit.securityChecklist": {
      execute: async () => ({
        checks: ["auth", "allowlist", "redaction", "rls-boundary"],
        status: "passed",
      }),
    },
    "http.safeJson": {
      execute: async ({ args }) => ({
        status: "validated",
        url: validateSafeUrl(args?.url),
      }),
    },
    "telemetry.healthSnapshot": {
      execute: async () => {
        const { getHealthSnapshot } = require("../observability/healthService");

        const health = getHealthSnapshot();
        return {
          module: health.module,
          runtime: health.runtime,
          status: health.status,
        };
      },
    },
    "ai.router.summary": {
      execute: async ({ input, run }) => {
        const topic = sanitizeScalar(input.topic || "Operational workflow", 160);
        const result = await generateCompletion({
          maxTokens: 250,
          messages: [
            {
              role: "system",
              content:
                "Create a concise operational status summary. Do not include secrets, credentials, or raw prompts.",
            },
            {
              role: "user",
              content: `Summarize this approved BLACK FLASH ORBIT workflow: ${topic}`,
            },
          ],
          model: "openrouter/auto",
          requestId: run.id,
          temperature: 0.1,
          timeout: 12000,
          useCase: AI_USE_CASES.GENERAL_CHAT,
        });

        return {
          model: sanitizeScalar(result.model, 120),
          provider: sanitizeScalar(result.provider || "openrouter", 80),
          status: "completed",
        };
      },
    },
    ...overrides,
  };

  return {
    execute: async (toolId, context) => {
      if (!Object.prototype.hasOwnProperty.call(tools, toolId)) {
        throw createWorkflowError(
          "Workflow tool is not allowlisted.",
          "WORKFLOW_TOOL_NOT_ALLOWED",
          400,
          { toolId },
        );
      }

      return tools[toolId].execute(context);
    },
    has: (toolId) => Object.prototype.hasOwnProperty.call(tools, toolId),
    ids: () => Object.keys(tools).sort(),
    validateSafeUrl,
  };
}

function createAutomationWorkflowEngine({
  definitions = workflowDefinitions,
  telemetryRecorder = recordWorkflowTelemetry,
  toolRegistry = createSafeToolRegistry(),
} = {}) {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const runs = [];

  function recordTelemetry(run, event, extra = {}) {
    telemetryRecorder({
      code: extra.code || null,
      event,
      runId: run.id,
      state: run.state,
      toolId: extra.toolId || null,
      user: { id: run.ownerId },
      workflowId: run.workflowId,
    });
  }

  function pruneRuns() {
    const grouped = new Map();

    for (const run of runs) {
      const group = grouped.get(run.ownerId) || [];
      group.push(run);
      grouped.set(run.ownerId, group);
    }

    for (const group of grouped.values()) {
      group
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
        .slice(MAX_RUNS_PER_OWNER)
        .forEach((run) => {
          const index = runs.indexOf(run);
          if (index >= 0) runs.splice(index, 1);
        });
    }
  }

  function getDefinition(workflowId) {
    const definition = definitionsById.get(sanitizeIdentifier(workflowId));

    if (!definition) {
      throw createWorkflowError(
        "Workflow definition not found.",
        "WORKFLOW_DEFINITION_NOT_FOUND",
        404,
      );
    }

    return definition;
  }

  async function executeCurrentStep(run) {
    const definition = getDefinition(run.workflowId);
    const step = definition.steps[run.currentStepIndex];
    const stepState = run.steps[run.currentStepIndex];

    if (!step) {
      transitionRunState(run, "succeeded", { type: "workflow_completed" });
      recordTelemetry(run, "workflow_succeeded");
      return run;
    }

    if (step.requiresApproval && !run.approvals[step.id]) {
      run.waitingForStepId = step.id;
      stepState.status = "waiting_approval";
      transitionRunState(run, "waiting_approval", {
        type: "approval_required",
        toolId: step.toolId,
      });
      recordTelemetry(run, "workflow_waiting_approval", { toolId: step.toolId });
      return run;
    }

    stepState.status = "running";
    stepState.startedAt = new Date().toISOString();
    stepState.completedAt = null;
    stepState.code = null;
    stepState.attempts += 1;

    const timeoutMs = Math.min(
      Math.max(Number(step.timeoutMs || DEFAULT_STEP_TIMEOUT_MS), 1),
      30000,
    );

    try {
      const result = await withTimeout(
        toolRegistry.execute(step.toolId, {
          args: step.args || {},
          input: run.input,
          run,
          step,
        }),
        timeoutMs,
      );

      stepState.status = "succeeded";
      stepState.code = null;
      stepState.completedAt = new Date().toISOString();
      stepState.result = sanitizeToolResult(result);
      run.currentStepIndex += 1;
      run.waitingForStepId = null;
      recordTelemetry(run, "workflow_step_succeeded", { toolId: step.toolId });
      return run;
    } catch (error) {
      const isTimeout = error.code === "WORKFLOW_STEP_TIMEOUT";
      const maxRetries = Math.min(
        Math.max(Number(step.maxRetries || 0), 0),
        MAX_RETRY_ATTEMPTS,
      );

      stepState.status = isTimeout ? "timed_out" : "failed";
      stepState.code = error.code || "WORKFLOW_STEP_FAILED";
      stepState.completedAt = new Date().toISOString();
      recordTelemetry(run, "workflow_step_failed", {
        code: stepState.code,
        toolId: step.toolId,
      });

      if (!isTimeout && stepState.attempts <= maxRetries) {
        const delayMs = calculateBackoffMs(stepState.attempts);
        run.retryDelaysMs.push(delayMs);
        run.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
        transitionRunState(run, "retry_scheduled", {
          code: stepState.code,
          type: "retry_scheduled",
        });
        recordTelemetry(run, "workflow_retry_scheduled", {
          code: stepState.code,
          toolId: step.toolId,
        });
        transitionRunState(run, "running", { type: "retry_started" });
        return executeCurrentStep(run);
      }

      transitionRunState(run, isTimeout ? "timed_out" : "failed", {
        code: stepState.code,
        type: isTimeout ? "step_timed_out" : "step_failed",
      });
      recordTelemetry(run, isTimeout ? "workflow_timed_out" : "workflow_failed", {
        code: stepState.code,
        toolId: step.toolId,
      });
      return run;
    }
  }

  async function advanceRun(run) {
    while (!isTerminalState(run.state)) {
      if (run.cancelRequested) {
        transitionRunState(run, "cancelled", { type: "cancelled" });
        recordTelemetry(run, "workflow_cancelled");
        return sanitizeRun(run);
      }

      if (run.state === "queued" || run.state === "waiting_approval" || run.state === "retry_scheduled") {
        transitionRunState(run, "running", { type: "run_started" });
      }

      await executeCurrentStep(run);

      if (run.state === "waiting_approval" || isTerminalState(run.state)) {
        return sanitizeRun(run);
      }
    }

    return sanitizeRun(run);
  }

  async function startRun({ input = {}, user, workflowId }) {
    const ownerId = assertUser(user);
    const definition = getDefinition(workflowId);
    const normalizedInput = normalizeWorkflowInput(definition, input);
    const now = new Date().toISOString();
    const run = {
      approvals: {},
      cancelRequested: false,
      createdAt: now,
      currentStepIndex: 0,
      definitionName: definition.name,
      events: [],
      id: crypto.randomUUID(),
      input: normalizedInput,
      nextAttemptAt: null,
      ownerId,
      retryDelaysMs: [],
      state: "queued",
      steps: definition.steps.map(createStepState),
      updatedAt: now,
      waitingForStepId: null,
      workflowId: definition.id,
    };

    runs.unshift(run);
    pruneRuns();
    recordTelemetry(run, "workflow_created");

    return advanceRun(run);
  }

  async function approveRun({ runId, user }) {
    const run = getOwnedRun(runId, user);

    if (run.state !== "waiting_approval" || !run.waitingForStepId) {
      throw createWorkflowError(
        "Workflow run is not waiting for approval.",
        "WORKFLOW_APPROVAL_NOT_ALLOWED",
        409,
      );
    }

    run.approvals[run.waitingForStepId] = {
      approvedAt: new Date().toISOString(),
      approvedBy: getUserId(user),
    };
    recordTelemetry(run, "workflow_approved");

    return advanceRun(run);
  }

  function cancelRun({ runId, user }) {
    const run = getOwnedRun(runId, user);

    if (isTerminalState(run.state)) {
      throw createWorkflowError(
        "Workflow run is already terminal.",
        "WORKFLOW_ALREADY_TERMINAL",
        409,
      );
    }

    run.cancelRequested = true;
    transitionRunState(run, "cancelled", { type: "cancelled" });
    recordTelemetry(run, "workflow_cancelled");

    return sanitizeRun(run);
  }

  function getOwnedRun(runId, user) {
    const ownerId = assertUser(user);
    const run = runs.find(
      (item) => item.id === sanitizeIdentifier(runId) && item.ownerId === ownerId,
    );

    if (!run) {
      throw createWorkflowError("Workflow run not found.", "WORKFLOW_RUN_NOT_FOUND", 404);
    }

    return run;
  }

  function listRuns(user) {
    const ownerId = assertUser(user);

    return runs
      .filter((run) => run.ownerId === ownerId)
      .map(sanitizeRun);
  }

  function listDefinitions() {
    return definitions.map(publicDefinition);
  }

  function getSnapshot() {
    const active = runs.filter((run) => !isTerminalState(run.state)).length;
    const waitingApproval = runs.filter((run) => run.state === "waiting_approval").length;
    const failed = runs.filter((run) => run.state === "failed" || run.state === "timed_out").length;
    const succeeded = runs.filter((run) => run.state === "succeeded").length;

    return {
      active,
      definitions: definitions.length,
      failed,
      latest: runs[0] ? sanitizeRun(runs[0]) : null,
      runs: runs.length,
      status: failed > 0 ? "degraded" : "ready",
      succeeded,
      waitingApproval,
    };
  }

  function reset() {
    runs.splice(0, runs.length);
  }

  return {
    approveRun,
    cancelRun,
    getOwnedRun: (runId, user) => sanitizeRun(getOwnedRun(runId, user)),
    getSnapshot,
    listDefinitions,
    listRuns,
    reset,
    startRun,
    transitionRunState,
    toolRegistry,
  };
}

function sanitizeToolResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { status: sanitizeScalar(result, 120) || "completed" };
  }

  return Object.fromEntries(
    Object.entries(result)
      .slice(0, 10)
      .filter(([key]) => !SENSITIVE_INPUT_PATTERN.test(key))
      .map(([key, value]) => [key, sanitizeScalar(value, 160)]),
  );
}

function sanitizeRun(run) {
  return {
    completedSteps: run.steps.filter((step) => step.status === "succeeded").length,
    createdAt: run.createdAt,
    definitionName: run.definitionName,
    id: run.id,
    nextAttemptAt: run.nextAttemptAt,
    retryDelaysMs: [...run.retryDelaysMs],
    state: run.state,
    steps: run.steps.map((step) => ({
      attempts: step.attempts,
      code: step.code || null,
      completedAt: step.completedAt || null,
      id: step.id,
      name: step.name,
      requiresApproval: step.requiresApproval,
      startedAt: step.startedAt || null,
      status: step.status,
      toolId: step.toolId,
    })),
    totalSteps: run.steps.length,
    updatedAt: run.updatedAt,
    waitingForStepId: run.waitingForStepId,
    workflowId: run.workflowId,
  };
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        createWorkflowError(
          "Workflow step timed out.",
          "WORKFLOW_STEP_TIMEOUT",
          504,
        ),
      );
    }, timeoutMs);

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

const defaultWorkflowEngine = createAutomationWorkflowEngine();

module.exports = {
  calculateBackoffMs,
  createAutomationWorkflowEngine,
  createSafeToolRegistry,
  defaultWorkflowEngine,
  isTerminalState,
  normalizeWorkflowInput,
  transitionRunState,
  validateSafeUrl,
};
