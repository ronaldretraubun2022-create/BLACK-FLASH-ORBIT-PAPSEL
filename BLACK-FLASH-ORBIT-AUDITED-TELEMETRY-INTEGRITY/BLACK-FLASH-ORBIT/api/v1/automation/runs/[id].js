const {
  handleRun,
} = require("../../../../server/lib/automationWorkflowHttp");
const {
  sendJson,
  withTelemetryAuth,
} = require("../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res, user) {
  return handleRun(sendJson, req, res, user);
});
