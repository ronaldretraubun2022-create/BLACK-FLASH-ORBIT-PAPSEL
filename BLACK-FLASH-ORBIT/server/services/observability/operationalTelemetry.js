const crypto = require("node:crypto");

const { getHealthSnapshot } = require("./healthService");
const { getRecentRuntimeErrors, sanitizeScalar } = require("./logger");

const AI_CHAT_EVENT_LIMIT = 30;
const WORKFLOW_EVENT_LIMIT = 50;
const aiChatEvents = [];
const workflowEvents = [];
const workflowRunStates = new Map();

function hashValue(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return null;

  return crypto.createHash("sha256").update(cleanValue).digest("hex").slice(0, 12);
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function recordAiChatTelemetry(event = {}) {
  const userId = event.user?.id || event.userId || null;
  const providerLatencyMs = toNumber(event.providerLatencyMs);
  const durationMs = toNumber(event.durationMs);

  aiChatEvents.unshift({
    authenticated: Boolean(userId),
    code: sanitizeScalar(event.code || null, 120),
    durationMs,
    model: sanitizeScalar(event.model || null, 160),
    provider: sanitizeScalar(event.provider || "openrouter", 80),
    providerLatencyMs,
    providerReached: Boolean(event.providerReached),
    stage: sanitizeScalar(event.stage || "unknown", 80),
    status: sanitizeScalar(event.status || "unknown", 40),
    timestamp: new Date().toISOString(),
    userHash: hashValue(userId),
  });

  aiChatEvents.splice(AI_CHAT_EVENT_LIMIT);
}

function recordWorkflowTelemetry(event = {}) {
  const userId = event.user?.id || event.userId || null;
  const runId = sanitizeScalar(event.runId || null, 120);
  const item = {
    code: sanitizeScalar(event.code || null, 120),
    event: sanitizeScalar(event.event || "workflow_event", 120),
    runId,
    state: sanitizeScalar(event.state || "unknown", 80),
    timestamp: new Date().toISOString(),
    toolId: sanitizeScalar(event.toolId || null, 120),
    userHash: hashValue(userId),
    workflowId: sanitizeScalar(event.workflowId || null, 120),
  };

  workflowEvents.unshift(item);

  if (runId) {
    workflowRunStates.set(runId, item);
  }

  workflowEvents.splice(WORKFLOW_EVENT_LIMIT);
  const retainedRunIds = new Set(
    workflowEvents.map((event) => event.runId).filter(Boolean),
  );

  for (const key of workflowRunStates.keys()) {
    if (!retainedRunIds.has(key)) {
      workflowRunStates.delete(key);
    }
  }
}

function getAiChatEventsForUser(user) {
  const userHash = hashValue(user?.id || user?.userId);

  if (!userHash) return aiChatEvents;

  return aiChatEvents.filter((event) => event.userHash === userHash);
}

function getAiChatObservability({ user } = {}) {
  const scopedEvents = getAiChatEventsForUser(user);
  const total = scopedEvents.length;
  const successes = scopedEvents.filter((event) => event.status === "success").length;
  const failures = scopedEvents.filter((event) => event.status === "failed").length;
  const providerReached = scopedEvents.filter((event) => event.providerReached).length;
  const providerLatencies = scopedEvents
    .map((event) => event.providerLatencyMs)
    .filter((value) => Number.isFinite(value));
  const averageProviderLatencyMs = providerLatencies.length
    ? Math.round(
        providerLatencies.reduce((totalMs, value) => totalMs + value, 0) /
          providerLatencies.length,
      )
    : null;

  return {
    averageProviderLatencyMs,
    failures,
    latest: scopedEvents[0] || null,
    providerReached,
    recent: scopedEvents.slice(0, 5).map((event) => ({ ...event })),
    successes,
    total,
  };
}

function getWorkflowObservability() {
  const total = workflowEvents.length;
  const runStates = Array.from(workflowRunStates.values());
  const active = runStates.filter((event) =>
    ["queued", "running", "retry_scheduled"].includes(event.state),
  ).length;
  const waitingApproval = runStates.filter(
    (event) => event.state === "waiting_approval",
  ).length;
  const failed = runStates.filter((event) =>
    ["failed", "timed_out"].includes(event.state),
  ).length;
  const succeeded = runStates.filter(
    (event) => event.state === "succeeded",
  ).length;

  return {
    active,
    failed,
    latest: workflowEvents[0] || null,
    recent: workflowEvents.slice(0, 5).map((event) => ({ ...event })),
    status: failed > 0 ? "degraded" : "ready",
    succeeded,
    total,
    waitingApproval,
  };
}

function getModuleHealth(health = getHealthSnapshot()) {
  const dependencies = health.dependencies || {};

  return [
    {
      module: "runtime",
      status: health.status || "unknown",
    },
    {
      module: "supabase",
      status: dependencies.supabase?.status || "unknown",
    },
    {
      module: "ai",
      provider: dependencies.ai?.provider || "openrouter",
      status: dependencies.ai?.status || "unknown",
    },
    {
      module: "knowledge",
      status: dependencies.knowledge?.status || "unknown",
    },
    {
      module: "workflow",
      status: getWorkflowObservability().status,
    },
    {
      module: "logger",
      status: "ready",
    },
  ];
}

function getDeploymentMetadata(health = getHealthSnapshot()) {
  return {
    branch:
      sanitizeScalar(
        process.env.VERCEL_GIT_COMMIT_REF ||
          process.env.GIT_BRANCH ||
          process.env.BRANCH ||
          "local",
        120,
      ) || "local",
    commit:
      sanitizeScalar(
        process.env.VERCEL_GIT_COMMIT_SHA
          ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
          : "",
        24,
      ) || null,
    environment: health.environment || "development",
    region: sanitizeScalar(process.env.VERCEL_REGION || "local", 80) || "local",
    runtime: health.runtime || "node",
  };
}

function getAuthSessionVisibility(user) {
  return {
    authenticated: Boolean(user?.id),
    provider: "supabase",
    session: user?.id ? "validated" : "not_present",
    userHash: hashValue(user?.id),
  };
}

function getOperationalIntelligence({ user } = {}) {
  const health = getHealthSnapshot();

  return {
    aiChat: getAiChatObservability({ user }),
    authSession: getAuthSessionVisibility(user),
    deployment: getDeploymentMetadata(health),
    moduleHealth: getModuleHealth(health),
    recentRuntimeErrors: getRecentRuntimeErrors(5),
    timestamp: new Date().toISOString(),
    workflow: getWorkflowObservability(),
  };
}

function resetOperationalTelemetryForTests() {
  aiChatEvents.splice(0, aiChatEvents.length);
  workflowEvents.splice(0, workflowEvents.length);
  workflowRunStates.clear();
}

module.exports = {
  getAiChatObservability,
  getOperationalIntelligence,
  recordAiChatTelemetry,
  recordWorkflowTelemetry,
  resetOperationalTelemetryForTests,
};
