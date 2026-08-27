const {
  sendJson,
  withTelemetryAuth,
} = require("../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res) {
  sendJson(res, {
    success: true,
    status: "ready",
    module: "reports",
    data: [],
    metrics: {},
    message: "Module reports ready for staging.",
    timestamp: new Date().toISOString(),
  });
});
