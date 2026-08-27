const { createDashboardData } = require("./orbitDashboardTelemetry");

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function getDashboardData() {
  try {
    return createDashboardData();
  } catch (error) {
    console.warn("[ORBIT Commands] gagal membaca dashboard data", {
      message: error.message || null,
    });

    return {
      activity: [],
      automation: {},
      health: {},
      metrics: {},
      projects: [],
      security: {},
      system: {},
    };
  }
}

function formatStatus() {
  const data = getDashboardData();
  const memory = data.metrics?.memory || {};

  return [
    "## BLACK FLASH ORBIT Status",
    "",
    `- API: ${data.health?.status || "unknown"}`,
    `- Service: ${data.health?.service || "BLACK FLASH ORBIT API"}`,
    `- Environment: ${data.system?.environment || "unknown"}`,
    `- Runtime: ${data.system?.runtime || "node"}`,
    `- Uptime: ${Math.round(data.metrics?.uptime || data.health?.uptime || 0)} detik`,
    `- Memory RSS: ${formatBytes(memory.rss)}`,
    `- Heap Used: ${formatBytes(memory.heapUsed)}`,
    `- Security Score: ${data.security?.securityScore || 0}%`,
    `- Open Issues: ${(data.security?.issues || []).length}`,
    `- Projects: ${Array.isArray(data.projects) ? data.projects.length : 0}`,
    `- Dashboard Telemetry: active`,
    `- Automation Engine: ready`,
  ].join("\n");
}

function formatSecurity() {
  const security = getDashboardData().security || {};

  return [
    "## Security Center",
    "",
    `- Posture: ${security.helmet || "unknown"}`,
    `- Score: ${security.securityScore || 0}%`,
    `- CORS: ${security.cors || "unknown"}`,
    `- Rate Limit: ${security.rateLimit || "unknown"}`,
    `- Last Audit: ${security.lastAudit || "unknown"}`,
    `- Open Issues: ${(security.issues || []).length}`,
    "",
    ...(security.issues || []).map(
      (issue) =>
        `- ${issue.id || "ISSUE"} [${issue.severity || "info"}]: ${issue.message || "No message"}`,
    ),
  ].join("\n");
}

function formatProjects() {
  const projects = getDashboardData().projects || [];

  return [
    "## Active Projects",
    "",
    ...(projects.length
      ? projects.map(
          (project, index) =>
            `${index + 1}. ${project.name} — ${project.status} (${project.type}) | score ${project.score ?? "-"} | last scan ${project.lastScan || "-"}`,
        )
      : ["Tidak ada project aktif."]),
  ].join("\n");
}

function formatMetrics() {
  const metrics = getDashboardData().metrics || {};
  const memory = metrics.memory || {};

  return [
    "## Runtime Metrics",
    "",
    `- Uptime: ${Math.round(metrics.uptime || 0)} detik`,
    `- Reports: ${metrics.reports || 0}`,
    `- Projects: ${metrics.projects || 0}`,
    `- RSS: ${formatBytes(memory.rss)}`,
    `- Heap Used: ${formatBytes(memory.heapUsed)}`,
    `- Heap Total: ${formatBytes(memory.heapTotal)}`,
    `- External: ${formatBytes(memory.external)}`,
  ].join("\n");
}

function formatActivity() {
  const activity = getDashboardData().activity || [];

  return [
    "## Recent Activity",
    "",
    ...(activity.length
      ? activity
          .slice(0, 8)
          .map(
            (item) =>
              `- ${item.type || "system"}: ${item.message || "Activity"} (${item.time || "live"})`,
          )
      : ["Belum ada aktivitas terbaru."]),
  ].join("\n");
}

function formatRuntime() {
  const data = getDashboardData();
  const memory = data.metrics?.memory || {};

  return [
    "## ORBIT Runtime",
    "",
    `- Node Env: ${process.env.NODE_ENV || "development"}`,
    `- Vercel: ${process.env.VERCEL ? "yes" : "no"}`,
    `- Runtime: ${data.system?.runtime || "node"}`,
    `- API Version: ${data.system?.apiVersion || "v1"}`,
    `- Timestamp: ${data.system?.timestamp || new Date().toISOString()}`,
    `- Process Uptime: ${Math.round(process.uptime())} detik`,
    `- RSS: ${formatBytes(memory.rss)}`,
    `- Heap Used: ${formatBytes(memory.heapUsed)}`,
  ].join("\n");
}

function formatHelp() {
  return [
    "## ORBIT Operator Commands",
    "",
    "- /status — cek status sistem",
    "- /security — cek keamanan",
    "- /projects — daftar project aktif",
    "- /metrics — runtime metrics",
    "- /activity — aktivitas terbaru",
    "- /runtime — detail runtime backend",
    "- /help — daftar command",
  ].join("\n");
}

function handleOrbitCommand(message) {
  const command = String(message || "")
    .trim()
    .toLowerCase();

  if (!command.startsWith("/")) {
    return null;
  }

  if (command === "/status") return formatStatus();
  if (command === "/security") return formatSecurity();
  if (command === "/projects") return formatProjects();
  if (command === "/metrics") return formatMetrics();
  if (command === "/activity") return formatActivity();
  if (command === "/runtime") return formatRuntime();
  if (command === "/help") return formatHelp();

  return [
    "Command ORBIT tidak dikenal.",
    "",
    "Ketik /help untuk melihat daftar command.",
  ].join("\n");
}

module.exports = {
  handleOrbitCommand,
};
