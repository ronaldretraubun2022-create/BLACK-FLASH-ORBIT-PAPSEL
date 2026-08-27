const { getSupabaseAdmin, isSupabaseServiceConfigured } = require("../supabaseAdmin");
const { redactValue, sanitizeScalar } = require("../observability/logger");

const RUN_COLUMNS =
  "id, owner_id, definition_id, template_id, status, metadata, error_code, error_message, created_at, updated_at, started_at, completed_at";
const STEP_COLUMNS =
  "id, run_id, owner_id, step_id, status, tool, attempts, metadata, error_code, error_message, started_at, completed_at, created_at, updated_at";
const APPROVAL_COLUMNS =
  "id, run_id, owner_id, step_id, status, approved_by, approved_at, created_at";
const TEMPLATE_COLUMNS =
  "id, owner_id, name, description, definition_id, trigger_label, action_label, schedule, metadata, created_at, updated_at";

const SENSITIVE_TEMPLATE_KEY_PATTERN =
  /(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|prompt|payload|credential)/i;

function getWorkflowPersistenceStatus() {
  return {
    configured: isSupabaseServiceConfigured(),
    status: isSupabaseServiceConfigured() ? "configured" : "not_configured",
  };
}

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    const error = new Error("Workflow persistence belum dikonfigurasi.");
    error.code = "WORKFLOW_PERSISTENCE_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  return client;
}

function normalizeLimit(value, fallback = 25) {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) return fallback;

  return Math.min(limit, 100);
}

function safeMetadata(metadata = {}) {
  return JSON.parse(JSON.stringify(redactValue(metadata || {}) || {}));
}

function assertNoSensitiveTemplateFields(value, path = []) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSensitiveTemplateFields(item, [...path, String(index)]),
    );
    return;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_TEMPLATE_KEY_PATTERN.test(key)) {
        const error = new Error("Template workflow memuat field sensitif.");
        error.code = "WORKFLOW_TEMPLATE_SENSITIVE_FIELD";
        error.field = [...path, key].join(".");
        error.statusCode = 400;
        throw error;
      }

      assertNoSensitiveTemplateFields(item, [...path, key]);
    }
  }
}

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeTemplateInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Template workflow tidak valid.");
    error.code = "WORKFLOW_TEMPLATE_INVALID";
    error.statusCode = 400;
    throw error;
  }

  assertNoSensitiveTemplateFields(input);

  const name = normalizeText(input.name, 120);
  const definitionId = normalizeText(input.definitionId || input.definition_id, 80);

  if (!name || !definitionId) {
    const error = new Error("Template workflow membutuhkan name dan definitionId.");
    error.code = "WORKFLOW_TEMPLATE_INVALID";
    error.statusCode = 400;
    throw error;
  }

  return {
    action_label: normalizeText(input.action || input.actionLabel || input.action_label, 160),
    definition_id: definitionId,
    description: normalizeText(input.description, 500),
    metadata: safeMetadata({
      ui: {
        source: "workflow_automation",
      },
      ...(input.metadata && typeof input.metadata === "object"
        ? input.metadata
        : {}),
    }),
    name,
    schedule: normalizeText(input.schedule, 80) || "Manual",
    trigger_label: normalizeText(input.trigger || input.triggerLabel || input.trigger_label, 160),
  };
}

function mapRun(row, steps = [], approvals = []) {
  if (!row) return null;

  return {
    approvals: approvals.map(mapApproval),
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    definitionId: row.definition_id,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    id: row.id,
    metadata: row.metadata || {},
    ownerId: row.owner_id,
    startedAt: row.started_at || null,
    status: row.status,
    steps: steps.map(mapStep),
    templateId: row.template_id || null,
    updatedAt: row.updated_at || null,
  };
}

function mapStep(row) {
  return {
    attempts: Number(row.attempts || 0),
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    id: row.id,
    metadata: row.metadata || {},
    ownerId: row.owner_id,
    runId: row.run_id,
    startedAt: row.started_at || null,
    status: row.status,
    stepId: row.step_id,
    tool: row.tool,
    updatedAt: row.updated_at || null,
  };
}

function mapApproval(row) {
  return {
    approvedAt: row.approved_at || null,
    approvedBy: row.approved_by || null,
    createdAt: row.created_at || null,
    id: row.id,
    ownerId: row.owner_id,
    runId: row.run_id,
    status: row.status,
    stepId: row.step_id,
  };
}

function mapTemplate(row) {
  if (!row) return null;

  return {
    action: row.action_label || "",
    createdAt: row.created_at || null,
    definitionId: row.definition_id,
    description: row.description || "",
    id: row.id,
    metadata: row.metadata || {},
    name: row.name,
    ownerId: row.owner_id,
    schedule: row.schedule || "Manual",
    trigger: row.trigger_label || "",
    updatedAt: row.updated_at || null,
  };
}

async function assertNoError(result, code = "WORKFLOW_PERSISTENCE_ERROR") {
  if (!result?.error) return result;

  const error = new Error("Workflow persistence gagal.");
  error.code = code;
  error.safeDetails = {
    dbCode: sanitizeScalar(result.error.code, 80),
  };
  error.statusCode = 503;

  if (result.error.code === "23505") {
    error.code = "WORKFLOW_TEMPLATE_DUPLICATE_NAME";
    error.message = "Nama template workflow sudah digunakan.";
    error.statusCode = 409;
  }

  throw error;
}

async function createRunWithSteps({ definition, metadata = {}, ownerId, templateId = null }) {
  const client = getClient();
  const startedAt = new Date().toISOString();
  const runResult = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .insert({
        definition_id: definition.id,
        metadata: safeMetadata(metadata),
        owner_id: ownerId,
        started_at: startedAt,
        status: "queued",
        template_id: templateId,
      })
      .select(RUN_COLUMNS)
      .single(),
  );
  const run = runResult.data;
  const stepRows = definition.steps.map((step, index) => ({
    attempts: 0,
    metadata: safeMetadata({
      name: step.name,
      order: index + 1,
      requiresApproval: step.requiresApproval,
      timeoutMs: step.timeoutMs,
    }),
    owner_id: ownerId,
    run_id: run.id,
    status: "queued",
    step_id: step.id,
    tool: step.tool,
  }));

  let stepsResult = null;

  try {
    stepsResult = await assertNoError(
      await client
        .from("orbit_workflow_run_steps")
        .insert(stepRows)
        .select(STEP_COLUMNS),
    );
  } catch (error) {
    await client
      .from("orbit_workflow_runs")
      .update({
        completed_at: new Date().toISOString(),
        error_code: sanitizeScalar(error.code, 120),
        error_message: "Workflow persistence gagal.",
        status: "failed",
      })
      .eq("owner_id", ownerId)
      .eq("id", run.id);
    throw error;
  }

  await recordAuditEvent({
    eventType: "run_created",
    metadata: { definitionId: definition.id, templateId },
    ownerId,
    runId: run.id,
  });

  return mapRun(run, stepsResult.data || [], []);
}

async function getRun({ ownerId, runId }) {
  const client = getClient();
  const runResult = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .select(RUN_COLUMNS)
      .eq("owner_id", ownerId)
      .eq("id", runId)
      .maybeSingle(),
  );

  if (!runResult.data) return null;

  const [stepsResult, approvalsResult] = await Promise.all([
    assertNoError(
      await client
        .from("orbit_workflow_run_steps")
        .select(STEP_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("run_id", runId)
        .order("created_at", { ascending: true }),
    ),
    assertNoError(
      await client
        .from("orbit_workflow_approvals")
        .select(APPROVAL_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("run_id", runId)
        .order("created_at", { ascending: true }),
    ),
  ]);

  return mapRun(runResult.data, stepsResult.data || [], approvalsResult.data || []);
}

async function listRuns({ limit, ownerId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .select(RUN_COLUMNS)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(normalizeLimit(limit)),
  );

  return (result.data || []).map((row) => mapRun(row));
}

async function updateRun({ completed = false, error, metadata, ownerId, runId, status }) {
  const client = getClient();
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (completed) patch.completed_at = patch.updated_at;
  if (metadata) patch.metadata = safeMetadata(metadata);
  if (error) {
    patch.error_code = sanitizeScalar(error.code, 120);
    patch.error_message = sanitizeScalar(error.message, 500);
  }

  const result = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", runId)
      .select(RUN_COLUMNS)
      .single(),
  );

  return mapRun(result.data);
}

async function updateStep({ attempts, completed = false, error, metadata, ownerId, runId, status, stepId }) {
  const client = getClient();
  const now = new Date().toISOString();
  const patch = {
    status,
    updated_at: now,
  };

  if (Number.isInteger(attempts)) patch.attempts = attempts;
  if (status === "running") patch.started_at = now;
  if (completed) patch.completed_at = now;
  if (metadata) patch.metadata = safeMetadata(metadata);
  if (error) {
    patch.error_code = sanitizeScalar(error.code, 120);
    patch.error_message = sanitizeScalar(error.message, 500);
  }

  const result = await assertNoError(
    await client
      .from("orbit_workflow_run_steps")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("run_id", runId)
      .eq("step_id", stepId)
      .select(STEP_COLUMNS)
      .single(),
  );

  return mapStep(result.data);
}

async function recordApproval({ approvedBy, ownerId, runId, stepId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_approvals")
      .insert({
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        owner_id: ownerId,
        run_id: runId,
        status: "approved",
        step_id: stepId,
      })
      .select(APPROVAL_COLUMNS)
      .single(),
  );

  await recordAuditEvent({
    eventType: "approval_recorded",
    metadata: { stepId },
    ownerId,
    runId,
  });

  return mapApproval(result.data);
}

async function recordAuditEvent({ eventType, metadata = {}, ownerId, runId }) {
  const client = getClient();

  await assertNoError(
    await client.from("orbit_workflow_audit_events").insert({
      event_type: eventType,
      metadata: safeMetadata(metadata),
      owner_id: ownerId,
      run_id: runId,
    }),
  );
}

async function listTemplates({ ownerId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false }),
  );

  return (result.data || []).map(mapTemplate);
}

async function getTemplate({ ownerId, templateId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("owner_id", ownerId)
      .eq("id", templateId)
      .maybeSingle(),
  );

  return mapTemplate(result.data);
}

async function createTemplate({ input, ownerId }) {
  const client = getClient();
  const template = normalizeTemplateInput(input);
  const result = await assertNoError(
    await client
      .from("orbit_workflow_templates")
      .insert({
        ...template,
        owner_id: ownerId,
      })
      .select(TEMPLATE_COLUMNS)
      .single(),
  );

  return mapTemplate(result.data);
}

async function updateTemplate({ input, ownerId, templateId }) {
  const client = getClient();
  const template = normalizeTemplateInput(input);
  const result = await assertNoError(
    await client
      .from("orbit_workflow_templates")
      .update(template)
      .eq("owner_id", ownerId)
      .eq("id", templateId)
      .select(TEMPLATE_COLUMNS)
      .single(),
  );

  return mapTemplate(result.data);
}

async function deleteTemplate({ ownerId, templateId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_templates")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", templateId)
      .select("id")
      .maybeSingle(),
  );

  return Boolean(result.data);
}

async function checkWorkflowPersistence() {
  if (!isSupabaseServiceConfigured()) {
    return {
      configured: false,
      status: "not_configured",
    };
  }

  try {
    const client = getClient();
    const checks = await Promise.all([
      client.from("orbit_workflow_runs").select("id").limit(1),
      client.from("orbit_workflow_templates").select("id").limit(1),
    ]);
    const failed = checks.find((result) => result.error);

    if (failed) {
      return {
        code: sanitizeScalar(failed.error.code, 80),
        configured: true,
        status: "unavailable",
      };
    }

    return {
      configured: true,
      status: "ready",
    };
  } catch (error) {
    return {
      code: sanitizeScalar(error.code || error.name, 80),
      configured: true,
      status: "unavailable",
    };
  }
}

module.exports = {
  checkWorkflowPersistence,
  createRunWithSteps,
  createTemplate,
  deleteTemplate,
  getRun,
  getTemplate,
  getWorkflowPersistenceStatus,
  listRuns,
  listTemplates,
  normalizeTemplateInput,
  recordApproval,
  recordAuditEvent,
  updateRun,
  updateStep,
  updateTemplate,
};
