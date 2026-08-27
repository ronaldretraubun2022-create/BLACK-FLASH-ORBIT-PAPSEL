const {
  defaultWorkflowEngine,
} = require("../services/automation/workflowEngine");

function parseWorkflowBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function getRunId(req) {
  const segments = String(req.url || "")
    .split("/")
    .filter(Boolean);
  const lastSegment = segments.at(-1);

  return (
    req.query?.id ||
    (["approve", "cancel"].includes(lastSegment)
      ? segments.at(-2)
      : lastSegment)
  );
}

function sendWorkflowJson(sendJson, res, body, statusCode = 200) {
  return sendJson(res, body, statusCode);
}

function sendWorkflowError(sendJson, res, error) {
  const statusCode = error.statusCode || error.status || 500;
  const safeStatusCode =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  return sendWorkflowJson(
    sendJson,
    res,
    {
      success: false,
      code: error.code || "WORKFLOW_REQUEST_FAILED",
      message:
        safeStatusCode >= 500
          ? "Workflow request failed."
          : error.message || "Workflow request failed.",
    },
    safeStatusCode,
  );
}

function handleDefinitions(sendJson, req, res) {
  if (req.method && req.method !== "GET") {
    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  return sendWorkflowJson(sendJson, res, {
    success: true,
    data: defaultWorkflowEngine.listDefinitions(),
  });
}

async function handleRuns(sendJson, req, res, user) {
  if (!req.method || req.method === "GET") {
    return sendWorkflowJson(sendJson, res, {
      success: true,
      data: defaultWorkflowEngine.listRuns(user),
    });
  }

  if (req.method !== "POST") {
    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const body = parseWorkflowBody(req);
    const run = await defaultWorkflowEngine.startRun({
      input: body.input || {},
      user,
      workflowId: body.workflowId || body.workflow_id,
    });

    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: true,
        data: run,
      },
      201,
    );
  } catch (error) {
    return sendWorkflowError(sendJson, res, error);
  }
}

function handleRun(sendJson, req, res, user) {
  if (req.method && req.method !== "GET") {
    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    return sendWorkflowJson(sendJson, res, {
      success: true,
      data: defaultWorkflowEngine.getOwnedRun(getRunId(req), user),
    });
  } catch (error) {
    return sendWorkflowError(sendJson, res, error);
  }
}

async function handleApprove(sendJson, req, res, user) {
  if (req.method && req.method !== "POST") {
    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const run = await defaultWorkflowEngine.approveRun({
      runId: getRunId(req),
      user,
    });

    return sendWorkflowJson(sendJson, res, {
      success: true,
      data: run,
    });
  } catch (error) {
    return sendWorkflowError(sendJson, res, error);
  }
}

function handleCancel(sendJson, req, res, user) {
  if (req.method && req.method !== "POST") {
    return sendWorkflowJson(
      sendJson,
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    return sendWorkflowJson(sendJson, res, {
      success: true,
      data: defaultWorkflowEngine.cancelRun({
        runId: getRunId(req),
        user,
      }),
    });
  } catch (error) {
    return sendWorkflowError(sendJson, res, error);
  }
}

module.exports = {
  handleApprove,
  handleCancel,
  handleDefinitions,
  handleRun,
  handleRuns,
  parseWorkflowBody,
  sendWorkflowError,
};
