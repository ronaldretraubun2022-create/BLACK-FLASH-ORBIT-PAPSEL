const {
  getHealthSnapshot,
} = require("../../server/services/observability/healthService");
const {
  sendJson,
} = require("../../server/lib/orbitDashboardTelemetry");

module.exports = function handler(req, res) {
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

  const health = getHealthSnapshot();

  return sendJson(res, health, 200);
};
