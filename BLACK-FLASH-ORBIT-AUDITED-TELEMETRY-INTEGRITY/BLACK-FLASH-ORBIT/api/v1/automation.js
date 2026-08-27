const {
  getOrbitAutomation,
  sendJson,
  withTelemetryAuth,
} = require("../../server/lib/orbitDashboardTelemetry");
const {
  defaultWorkflowEngine,
} = require("../../server/services/automation/workflowEngine");

module.exports = withTelemetryAuth(function handler(req, res) {
  const engines = getOrbitAutomation();

  sendJson(res, {
    success: true,
    status: "ready",
    module: "automation",
    data: engines,
    engines,
    metrics: {
      totalEngines: Object.keys(engines).length,
    },
    message: "Automation telemetry ready.",
    timestamp: new Date().toISOString(),
    workflow: defaultWorkflowEngine.getSnapshot(),
    workflowDefinitions: defaultWorkflowEngine.listDefinitions(),
  });
});
