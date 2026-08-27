const {
  handleCancel,
} = require("../../../../../server/lib/automationWorkflowHttp");
const {
  sendJson,
  withTelemetryAuth,
} = require("../../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res, user) {
  return handleCancel(sendJson, req, res, user);
});
