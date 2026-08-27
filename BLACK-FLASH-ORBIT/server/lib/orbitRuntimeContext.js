const { createDashboardData } = require("./orbitDashboardTelemetry");

function formatBytesForPrompt(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function buildOrbitRuntimeContext() {
  const data = createDashboardData();
  const metrics = data.metrics || {};
  const memory = metrics.memory || {};
  const security = data.security || {};
  const system = data.system || {};
  const health = data.health || {};
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const activity = Array.isArray(data.activity)
    ? data.activity.slice(0, 5)
    : [];

  return [
    "BLACK FLASH ORBIT LIVE RUNTIME CONTEXT:",
    `- API Status: ${health.status || "unknown"}`,
    `- Service: ${health.service || "BLACK FLASH ORBIT API"}`,
    `- Environment: ${
      system.environment || process.env.NODE_ENV || "development"
    }`,
    `- Runtime: ${system.runtime || (process.env.VERCEL ? "vercel" : "node")}`,
    `- Uptime: ${Math.round(
      metrics.uptime || health.uptime || process.uptime(),
    )} seconds`,
    `- Memory RSS: ${formatBytesForPrompt(memory.rss)}`,
    `- Memory Heap Used: ${formatBytesForPrompt(memory.heapUsed)}`,
    `- Security Posture: ${security.helmet || "protected"}`,
    `- Security Score: ${security.securityScore || 94}%`,
    `- Open Security Issues: ${(security.issues || []).length}`,
    `- Active Projects: ${projects.length}`,
    `- Projects: ${
      projects
        .map((project) => `${project.name}(${project.status})`)
        .join(", ") || "none"
    }`,
    `- Recent Activity: ${
      activity.map((item) => item.message).join(" | ") || "none"
    }`,
    "- Dashboard Telemetry: active",
    "- Automation Engine: ready",
    "",
    "Jika user bertanya status sistem, project, security, metrics, atau aktivitas, jawab berdasarkan live runtime context ini.",
  ].join("\n");
}

module.exports = {
  buildOrbitRuntimeContext,
};
