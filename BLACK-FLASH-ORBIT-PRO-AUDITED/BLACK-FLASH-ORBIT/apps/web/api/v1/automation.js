const {
  getOrbitAutomation,
  sendJson,
  withTelemetryAuth,
} = require("../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res) {
  const engines = getOrbitAutomation();

  sendJson(res, {
    success: true,
    status: "ready",
    module: "automation",
    data: engines,
    metrics: {
      totalEngines: Object.keys(engines).length,
    },
    message: "Module automation ready for staging.",
    timestamp: new Date().toISOString(),
  });
});
