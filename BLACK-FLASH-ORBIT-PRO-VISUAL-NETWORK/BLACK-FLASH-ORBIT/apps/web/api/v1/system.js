const {
  getOrbitSystem,
  sendJson,
  withTelemetryAuth,
} = require("../../../../server/lib/orbitDashboardTelemetry");

module.exports = withTelemetryAuth(function handler(req, res) {
  sendJson(res, getOrbitSystem());
});
