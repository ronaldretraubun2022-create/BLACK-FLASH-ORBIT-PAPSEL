const {
  getReadinessSnapshot,
} = require("../../server/services/observability/healthService");
const {
  sendJson,
} = require("../../server/lib/orbitDashboardTelemetry");

module.exports = async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return sendJson(
      res,
      {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed.",
      },
      405,
    );
  }

  const readiness = await getReadinessSnapshot();
  const statusCode = readiness.status === "ready" ? 200 : 503;

  return sendJson(res, readiness, statusCode);
};
