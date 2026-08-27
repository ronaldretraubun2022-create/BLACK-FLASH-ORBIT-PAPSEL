const { generateCompletion, AI_USE_CASES } = require("../ai/aiRouter");
const {
  assertAllowedWorkflowDefinition,
  getWorkflowDefinition,
} = require("./workflowDefinitions");
const repository = require("./workflowRepository");

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
const APPROVAL_STEP_ID = "human_approval";
const AI_STEP_ID = "ai_router_check";

function createHttpError(message, statusCode = 500, code = "WORKFLOW_ERROR") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function sanitizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const label =
    typeof input.label === "string"
      ? input.label.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 120)
      : "";

  return label ? { label } : {};
}

function assertOwner(ownerId) {
  if (!ownerId) {
    throw createHttpError("Workflow membutuhkan user terautentikasi.", 401, "WORKFLOW_AUTH_REQUIRED");
  }
}

function assertTransition(run, expectedStatus, action) {
  if (!run) {
    throw createHttpError("Workflow run tidak ditemukan.", 404, "WORKFLOW_RUN_NOT_FOUND");
  }

  if (run.status !== expectedStatus) {
    throw createHttpError(
      `Workflow tidak bisa ${action} dari status ${run.status}.`,
      409,
      "WORKFLOW_INVALID_TRANSITION",
    );
  }
}

async function resolveRunDefinition({ definitionId, ownerId, templateId }) {
  if (!templateId) {
    return {
      definition: getWorkflowDefinition(definitionId),
      template: null,
    };
  }

  const template = await repository.getTemplate({ ownerId, templateId });

  if (!template) {
    throw createHttpError("Workflow template tidak ditemukan.", 404, "WORKFLOW_TEMPLATE_NOT_FOUND");
  }

  return {
    definition: getWorkflowDefinition(template.definitionId),
    template,
  };
}

async function createWorkflowRun({ definitionId, input, ownerId, requestId, templateId }) {
  assertOwner(ownerId);

  const { definition, template } = await resolveRunDefinition({
    definitionId,
    ownerId,
    templateId,
  });
  assertAllowedWorkflowDefinition(definition);

  const safeInput = sanitizeInput(input);
  const run = await repository.createRunWithSteps({
    definition,
    metadata: {
      input: safeInput,
      requestId,
      templateId: template?.id || null,
      templateName: template?.name || null,
    },
    ownerId,
    templateId: template?.id || null,
  });

  if (definition.sensitive) {
    await repository.updateStep({
      completed: true,
      metadata: { validated: true },
      ownerId,
      runId: run.id,
      status: "succeeded",
      stepId: "validate_request",
    });
    await repository.updateStep({
      metadata: { reason: "human_approval_required" },
      ownerId,
      runId: run.id,
      status: "waiting_approval",
      stepId: APPROVAL_STEP_ID,
    });
    await repository.updateRun({
      metadata: {
        ...run.metadata,
        approvalRequired: true,
      },
      ownerId,
      runId: run.id,
      status: "waiting_approval",
    });
    await repository.recordAuditEvent({
      eventType: "run_waiting_approval",
      metadata: { stepId: APPROVAL_STEP_ID },
      ownerId,
      runId: run.id,
    });

    return repository.getRun({ ownerId, runId: run.id });
  }

  await repository.updateStep({
    completed: true,
    metadata: { validated: true },
    ownerId,
    runId: run.id,
    status: "succeeded",
    stepId: "validate_request",
  });
  await repository.updateStep({
    completed: true,
    metadata: { persisted: true },
    ownerId,
    runId: run.id,
    status: "succeeded",
    stepId: "persist_result",
  });
  await repository.updateRun({
    completed: true,
    metadata: { ...run.metadata, providerReached: false },
    ownerId,
    runId: run.id,
    status: "succeeded",
  });
  await repository.recordAuditEvent({
    eventType: "run_succeeded",
    metadata: { providerReached: false },
    ownerId,
    runId: run.id,
  });

  return repository.getRun({ ownerId, runId: run.id });
}

async function approveWorkflowRun({ approvedBy, ownerId, requestId, runId }) {
  assertOwner(ownerId);

  const run = await repository.getRun({ ownerId, runId });
  assertTransition(run, "waiting_approval", "di-approve");

  await repository.recordApproval({
    approvedBy,
    ownerId,
    runId,
    stepId: APPROVAL_STEP_ID,
  });
  await repository.updateStep({
    completed: true,
    metadata: { approvedBy },
    ownerId,
    runId,
    status: "succeeded",
    stepId: APPROVAL_STEP_ID,
  });
  await repository.updateRun({
    metadata: {
      ...run.metadata,
      approved: true,
      requestId,
    },
    ownerId,
    runId,
    status: "running",
  });
  await repository.updateStep({
    attempts: 1,
    ownerId,
    runId,
    status: "running",
    stepId: AI_STEP_ID,
  });

  try {
    const aiResult = await generateCompletion({
      maxTokens: 180,
      messages: [
        {
          content:
            "Return a concise BLACK FLASH ORBIT workflow readiness confirmation for a human-approved operational check. Do not include secrets or credentials.",
          role: "user",
        },
      ],
      metadata: {
        mode: "workflow",
        requestId,
      },
      timeoutMs: 30000,
      useCase: AI_USE_CASES.GENERAL_CHAT,
    });
    const providerMetadata = {
      model: aiResult.model || null,
      provider: aiResult.provider || "openrouter",
      providerLatencyMs: aiResult.metadata?.durationMs || null,
      providerReached: true,
    };

    await repository.updateStep({
      attempts: 1,
      completed: true,
      metadata: providerMetadata,
      ownerId,
      runId,
      status: "succeeded",
      stepId: AI_STEP_ID,
    });
    await repository.updateStep({
      completed: true,
      metadata: { persisted: true },
      ownerId,
      runId,
      status: "succeeded",
      stepId: "persist_result",
    });
    await repository.updateRun({
      completed: true,
      metadata: {
        ...run.metadata,
        ...providerMetadata,
        approved: true,
        requestId,
      },
      ownerId,
      runId,
      status: "succeeded",
    });
    await repository.recordAuditEvent({
      eventType: "run_succeeded",
      metadata: providerMetadata,
      ownerId,
      runId,
    });

    return repository.getRun({ ownerId, runId });
  } catch (error) {
    await repository.updateStep({
      attempts: 1,
      completed: true,
      error,
      ownerId,
      runId,
      status: "failed",
      stepId: AI_STEP_ID,
    });
    await repository.updateRun({
      completed: true,
      error,
      metadata: {
        ...run.metadata,
        approved: true,
        providerReached: Boolean(error?.provider),
        requestId,
      },
      ownerId,
      runId,
      status: "failed",
    });
    await repository.recordAuditEvent({
      eventType: "run_failed",
      metadata: {
        code: error?.code || "AI_PROVIDER_ERROR",
        providerReached: Boolean(error?.provider),
      },
      ownerId,
      runId,
    });

    throw error;
  }
}

async function cancelWorkflowRun({ ownerId, runId }) {
  assertOwner(ownerId);

  const run = await repository.getRun({ ownerId, runId });

  if (!run) {
    throw createHttpError("Workflow run tidak ditemukan.", 404, "WORKFLOW_RUN_NOT_FOUND");
  }

  if (TERMINAL_STATUSES.has(run.status)) {
    throw createHttpError(
      `Workflow sudah terminal: ${run.status}.`,
      409,
      "WORKFLOW_INVALID_TRANSITION",
    );
  }

  await repository.updateRun({
    completed: true,
    metadata: {
      ...run.metadata,
      cancelled: true,
    },
    ownerId,
    runId,
    status: "cancelled",
  });
  await repository.recordAuditEvent({
    eventType: "run_cancelled",
    metadata: {},
    ownerId,
    runId,
  });

  return repository.getRun({ ownerId, runId });
}

module.exports = {
  approveWorkflowRun,
  cancelWorkflowRun,
  createWorkflowRun,
  sanitizeInput,
};
