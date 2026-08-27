const {
  handleDefinitions,
} = require("../../../server/lib/automationWorkflowHttp");
const {
  sendJson,
  withTelemetryAuth,
} = require("../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res) {
  return handleDefinitions(sendJson, req, res);
});
