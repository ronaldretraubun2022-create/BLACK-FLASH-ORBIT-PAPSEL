function isAgentBridgeEnabled() {
  return String(process.env.ORBIT_AGENT_BRIDGE_ENABLED || "").trim().toLowerCase() === "true";
}

function getAgentBridgeState() {
  const enabled = isAgentBridgeEnabled();

  return {
    enabled,
    mode: "local-only",
    reason: enabled
      ? "Local Agent Bridge is enabled on this server."
      : "Local Agent Bridge is disabled. Set ORBIT_AGENT_BRIDGE_ENABLED=true on the local server to run repository jobs.",
  };
}

function createAgentDisabledError() {
  const error = new Error("Agent Bridge lokal dinonaktifkan pada server ini.");
  error.statusCode = 403;
  error.code = "AGENT_BRIDGE_DISABLED";
  return error;
}

function assertAgentBridgeEnabled() {
  if (!isAgentBridgeEnabled()) {
    throw createAgentDisabledError();
  }
}

module.exports = {
  assertAgentBridgeEnabled,
  createAgentDisabledError,
  getAgentBridgeState,
  isAgentBridgeEnabled,
};
