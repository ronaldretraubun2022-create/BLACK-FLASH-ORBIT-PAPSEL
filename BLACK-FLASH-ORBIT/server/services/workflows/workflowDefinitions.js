const WORKFLOW_DEFINITIONS = {
  ai_operational_check: {
    description:
      "Validate workflow persistence, require human approval, then call the existing AI Router.",
    id: "ai_operational_check",
    name: "AI Operational Check",
    sensitive: true,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.validate",
      },
      {
        id: "human_approval",
        name: "Human approval",
        requiresApproval: true,
        timeoutMs: 0,
        tool: "approval.human",
      },
      {
        id: "ai_router_check",
        name: "AI Router check",
        requiresApproval: true,
        timeoutMs: 30000,
        tool: "ai.router",
      },
      {
        id: "persist_result",
        name: "Persist result",
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.persist",
      },
    ],
  },
  telemetry_sync: {
    description: "Record a safe workflow telemetry checkpoint.",
    id: "telemetry_sync",
    name: "Telemetry Sync",
    sensitive: false,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.validate",
      },
      {
        id: "persist_result",
        name: "Persist result",
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.persist",
      },
    ],
  },
};

const ALLOWED_WORKFLOW_TOOLS = new Set([
  "ai.router",
  "approval.human",
  "internal.persist",
  "internal.validate",
]);

function cloneDefinition(definition) {
  return {
    description: definition.description,
    id: definition.id,
    name: definition.name,
    sensitive: Boolean(definition.sensitive),
    steps: definition.steps.map((step) => ({ ...step })),
  };
}

function getWorkflowDefinitions() {
  return Object.values(WORKFLOW_DEFINITIONS).map(cloneDefinition);
}

function getWorkflowDefinition(definitionId) {
  const definition = WORKFLOW_DEFINITIONS[String(definitionId || "").trim()];

  return definition ? cloneDefinition(definition) : null;
}

function assertAllowedWorkflowDefinition(definition) {
  if (!definition) {
    const error = new Error("Workflow definition tidak ditemukan.");
    error.code = "WORKFLOW_DEFINITION_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  const disallowedStep = definition.steps.find(
    (step) => !ALLOWED_WORKFLOW_TOOLS.has(step.tool),
  );

  if (disallowedStep) {
    const error = new Error("Workflow definition memakai tool yang tidak diizinkan.");
    error.code = "WORKFLOW_TOOL_NOT_ALLOWED";
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  ALLOWED_WORKFLOW_TOOLS,
  assertAllowedWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowDefinitions,
};
