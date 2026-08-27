const express = require("express");
const { createRequestId } = require("../services/observability/logger");
const { requireAuth } = require("../middleware/requireAuth");
const {
  approveWorkflowRun,
  cancelWorkflowRun,
  createWorkflowRun,
} = require("../services/workflows/workflowEngine");
const {
  assertAllowedWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowDefinitions,
} = require("../services/workflows/workflowDefinitions");
const {
  createTemplate,
  deleteTemplate,
  getRun,
  getTemplate,
  listRuns,
  listTemplates,
  updateTemplate,
} = require("../services/workflows/workflowRepository");

const router = express.Router();

function getOwnerId(req) {
  return req.userId || req.user?.id || null;
}

const SAFE_WORKFLOW_ERROR_MESSAGES = {
  WORKFLOW_PERSISTENCE_ERROR: "Workflow persistence gagal.",
  WORKFLOW_PERSISTENCE_NOT_CONFIGURED: "Workflow persistence belum dikonfigurasi.",
  WORKFLOW_TEMPLATE_DUPLICATE_NAME: "Nama template workflow sudah digunakan.",
};

function sendWorkflowError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const safeMessage =
    SAFE_WORKFLOW_ERROR_MESSAGES[error?.code] ||
    (safeStatus < 500 ? error?.message : null) ||
    "Workflow request gagal.";

  return res.status(safeStatus).json({
    success: false,
    code: error?.code || "WORKFLOW_ERROR",
    message: safeMessage,
  });
}

function assertTemplateDefinition(input) {
  const definition = getWorkflowDefinition(input?.definitionId || input?.definition_id);

  assertAllowedWorkflowDefinition(definition);
}

router.use(requireAuth);

router.get("/definitions", (req, res) => {
  res.json({
    success: true,
    data: getWorkflowDefinitions(),
  });
});

router.get("/templates", async (req, res) => {
  try {
    const templates = await listTemplates({ ownerId: getOwnerId(req) });

    return res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/templates", async (req, res) => {
  try {
    assertTemplateDefinition(req.body);
    const template = await createTemplate({
      input: req.body,
      ownerId: getOwnerId(req),
    });

    return res.status(201).json({
      success: true,
      data: template,
      message: "Workflow template saved.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const template = await getTemplate({
      ownerId: getOwnerId(req),
      templateId: req.params.id,
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        code: "WORKFLOW_TEMPLATE_NOT_FOUND",
        message: "Workflow template tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.put("/templates/:id", async (req, res) => {
  try {
    assertTemplateDefinition(req.body);
    const template = await updateTemplate({
      input: req.body,
      ownerId: getOwnerId(req),
      templateId: req.params.id,
    });

    return res.json({
      success: true,
      data: template,
      message: "Workflow template updated.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const deleted = await deleteTemplate({
      ownerId: getOwnerId(req),
      templateId: req.params.id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        code: "WORKFLOW_TEMPLATE_NOT_FOUND",
        message: "Workflow template tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: { id: req.params.id },
      message: "Workflow template deleted.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.get("/runs", async (req, res) => {
  try {
    const runs = await listRuns({
      limit: req.query?.limit,
      ownerId: getOwnerId(req),
    });

    return res.json({
      success: true,
      data: runs,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs", async (req, res) => {
  try {
    const run = await createWorkflowRun({
      definitionId: req.body?.definitionId,
      input: req.body?.input,
      ownerId: getOwnerId(req),
      requestId: createRequestId(req),
      templateId: req.body?.templateId,
    });

    return res.status(201).json({
      success: true,
      data: run,
      message: "Workflow run created.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.get("/runs/:id", async (req, res) => {
  try {
    const run = await getRun({
      ownerId: getOwnerId(req),
      runId: req.params.id,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "WORKFLOW_RUN_NOT_FOUND",
        message: "Workflow run tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs/:id/approve", async (req, res) => {
  try {
    const run = await approveWorkflowRun({
      approvedBy: getOwnerId(req),
      ownerId: getOwnerId(req),
      requestId: createRequestId(req),
      runId: req.params.id,
    });

    return res.json({
      success: true,
      data: run,
      message: "Workflow approved and executed.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs/:id/cancel", async (req, res) => {
  try {
    const run = await cancelWorkflowRun({
      ownerId: getOwnerId(req),
      runId: req.params.id,
    });

    return res.json({
      success: true,
      data: run,
      message: "Workflow cancelled.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

module.exports = router;
