const {
  handleRuns,
} = require("../../../server/lib/automationWorkflowHttp");
const {
  sendJson,
  withTelemetryAuth,
} = require("../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res, user) {
  return handleRuns(sendJson, req, res, user);
});
