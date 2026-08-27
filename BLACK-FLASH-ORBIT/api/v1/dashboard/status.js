const {
  createDashboardResponse,
  sendJson,
  withTelemetryAuth,
} = require("../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res, user) {
  if (req.method && req.method !== "GET") {
    return sendJson(
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  return sendJson(res, createDashboardResponse({ user }));
});
