const {
  getOrbitSecurity,
  sendJson,
  withTelemetryAuth,
} = require("../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res) {
  sendJson(res, {
    success: true,
    status: "ready",
    module: "security",
    data: getOrbitSecurity(),
    metrics: {},
    message: "Module security ready for staging.",
    timestamp: new Date().toISOString(),
  });
});
