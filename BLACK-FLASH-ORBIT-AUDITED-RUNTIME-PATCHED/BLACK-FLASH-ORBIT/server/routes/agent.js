const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/requireAuth");
const {
  approveAgentJob,
  createAgentJob,
  getAgentJob,
  getAgentJobDiff,
  getAgentStatus,
  listAgentJobs,
  rejectAgentJob,
  runAgentDiagnostics,
  runAgentRepair,
  validateAgentJob,
} = require("../services/agent/agentJobService");
const { assertAgentBridgeEnabled } = require("../services/agent/agentConfig");

const router = express.Router();

const agentLimiter = rateLimit({
  legacyHeaders: false,
  max: process.env.NODE_ENV === "production" ? 30 : 300,
  message: {
    success: false,
    code: "AGENT_RATE_LIMITED",
    message: "Terlalu banyak request Agent Bridge. Coba lagi nanti.",
  },
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
});

function getOwnerId(req) {
  return req.userId || req.user?.id || null;
}

function sendAgentError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const code = error?.code || "AGENT_REQUEST_FAILED";
  const isKnownAgentError = /^AGENT_[A-Z0-9_]+$/.test(code);
  const safeMessage =
    isKnownAgentError || safeStatus < 500
      ? error?.message || "Agent Bridge request gagal."
      : "Agent Bridge request gagal.";
  const safeMetadata = error?.safeMetadata?.active === true && error?.safeMetadata?.stage === "codex_repair"
    ? { active: true, stage: "codex_repair" }
    : undefined;

  return res.status(safeStatus).json({
    success: false,
    code,
    message: safeMessage,
    status: safeStatus,
    ...(safeMetadata ? { metadata: safeMetadata } : {}),
  });
}

function wrapAsync(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      return sendAgentError(res, error);
    }
  };
}

function requireAgentBridgeEnabled(_req, res, next) {
  try {
    assertAgentBridgeEnabled();
    next();
  } catch (error) {
    sendAgentError(res, error);
  }
}

router.use(requireAuth);
router.use(agentLimiter);

router.get(
  "/status",
  wrapAsync(async (req, res) => {
    const data = await getAgentStatus({ ownerId: getOwnerId(req) });

    res.json({ success: true, data });
  }),
);

router.use(requireAgentBridgeEnabled);

router.post(
  "/jobs",
  wrapAsync(async (req, res) => {
    const data = await createAgentJob({
      input: req.body,
      ownerId: getOwnerId(req),
    });

    res.status(201).json({
      success: true,
      data,
      message: "Agent job created.",
    });
  }),
);

router.get(
  "/jobs",
  wrapAsync(async (req, res) => {
    const data = await listAgentJobs({ ownerId: getOwnerId(req) });

    res.json({ success: true, data });
  }),
);

router.get(
  "/jobs/:id",
  wrapAsync(async (req, res) => {
    const data = await getAgentJob({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data });
  }),
);

router.post(
  "/jobs/:id/diagnose",
  wrapAsync(async (req, res) => {
    const data = await runAgentDiagnostics({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data, message: "Agent diagnostics completed." });
  }),
);

router.post(
  "/jobs/:id/run",
  wrapAsync(async (req, res) => {
    const data = await runAgentRepair({
      input: req.body,
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.status(202).json({ success: true, data, message: "Agent repair queued." });
  }),
);

router.post(
  "/jobs/:id/validate",
  wrapAsync(async (req, res) => {
    const data = await validateAgentJob({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data, message: "Agent validation completed." });
  }),
);

router.post(
  "/jobs/:id/approve",
  wrapAsync(async (req, res) => {
    const data = await approveAgentJob({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data, message: "Agent job approved." });
  }),
);

router.post(
  "/jobs/:id/reject",
  wrapAsync(async (req, res) => {
    const data = await rejectAgentJob({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data, message: "Agent job rejected." });
  }),
);

router.get(
  "/jobs/:id/diff",
  wrapAsync(async (req, res) => {
    const data = await getAgentJobDiff({
      jobId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({ success: true, data });
  }),
);

module.exports = router;
