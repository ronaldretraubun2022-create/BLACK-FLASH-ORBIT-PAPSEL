const { createClient } = require("@supabase/supabase-js");
const {
  getHealthSnapshot,
} = require("../services/observability/healthService");
const {
  getOperationalIntelligence,
} = require("../services/observability/operationalTelemetry");
const {
  getWorkflowPersistenceStatus,
} = require("../services/workflows/workflowRepository");

const SERVICE_NAME = "BLACK FLASH ORBIT API";
const API_VERSION = "v1";

let telemetryAuthClient = null;
let telemetryAuthClientKey = "";

const projects = [
  {
    name: "BLACK-FLASH-ORBIT",
    type: "platform",
    status: "ACTIVE",
    score: null,
    lastScan: null,
  },
  {
    name: "ORBIT-WEB",
    type: "frontend",
    status: "SYNCED",
    score: null,
    lastScan: null,
  },
  {
    name: "ORBIT-AI-WORKSPACE",
    type: "ai-workspace",
    status: "READY",
    score: null,
    lastScan: null,
  },
  {
    name: "ORBIT-SECURITY",
    type: "security",
    status: "PROTECTED",
    score: null,
    lastScan: null,
  },
];

const automationEngines = {
  auditEngine: {
    name: "Project Audit",
    status: "ONLINE",
    description:
      "Inspect workspace structure, runtime health, and project readiness.",
  },
  fixEngine: {
    name: "Code Repair",
    status: "READY",
    description:
      "Prepare focused fixes for detected issues and build failures.",
  },
  workspaceScanner: {
    name: "Repository Scan",
    status: "ACTIVE",
    description:
      "Track project modules and surface operational workspace signals.",
  },
  deployEngine: {
    name: "Deploy Pipeline",
    status: "READY",
    description: "Prepare validated production builds for controlled release.",
  },
  workflowHistory: {
    name: "Workflow History",
    status: getWorkflowPersistenceStatus().configured ? "READY" : "DEGRADED",
    description: "Persist owner-scoped workflow runs, approvals, and audit events.",
  },
  workflowTemplates: {
    name: "Workflow Templates",
    status: getWorkflowPersistenceStatus().configured ? "READY" : "DEGRADED",
    description: "Persist owner-scoped reusable workflow templates.",
  },
};

function getTimestamp() {
  return new Date().toISOString();
}

function getEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function createHttpError(message, statusCode = 500, code = "server_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getRequestPath(req) {
  return req.originalUrl || req.url || "unknown";
}

function logTelemetryAuthEvent(req, reason, metadata = {}) {
  console.warn("[ORBIT Telemetry Auth]", {
    method: req.method,
    path: getRequestPath(req),
    reason,
    status: metadata.status || null,
    userId: metadata.userId || null,
  });
}

function getNestedErrorValues(error) {
  const values = [];
  let currentError = error;

  while (currentError && values.length < 8) {
    values.push(
      currentError.code,
      currentError.name,
      currentError.message,
      currentError.cause?.code,
      currentError.cause?.name,
      currentError.cause?.message,
    );
    currentError = currentError.cause;
  }

  return values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function isTelemetryAuthProviderNetworkError(error) {
  return getNestedErrorValues(error).some((value) =>
    [
      "aborterror",
      "aborted",
      "connect timeout",
      "connection timeout",
      "econnreset",
      "etimedout",
      "fetch failed",
      "networkerror",
      "timeout",
      "und_err_connect_timeout",
      "und_err_headers_timeout",
      "und_err_socket",
    ].some((pattern) => value.includes(pattern)),
  );
}

function getTelemetryAuthConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(
      "Supabase auth belum dikonfigurasi.",
      500,
      "telemetry_auth_not_configured",
    );
  }

  return { supabaseAnonKey, supabaseUrl };
}

function getTelemetryAuthClient() {
  const { supabaseAnonKey, supabaseUrl } = getTelemetryAuthConfig();
  const nextClientKey = `${supabaseUrl}:${supabaseAnonKey}`;

  if (!telemetryAuthClient || telemetryAuthClientKey !== nextClientKey) {
    telemetryAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    telemetryAuthClientKey = nextClientKey;
  }

  return telemetryAuthClient;
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || "";

  if (!authorization) {
    throw createHttpError(
      "Missing bearer token.",
      401,
      "missing_authorization",
    );
  }

  if (!authorization.startsWith("Bearer ")) {
    throw createHttpError(
      "Invalid bearer token.",
      401,
      "invalid_bearer_format",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw createHttpError(
      "Invalid bearer token.",
      401,
      "invalid_bearer_format",
    );
  }

  return token;
}

async function requireTelemetryAuth(req, res) {
  try {
    const token = getBearerToken(req);
    const authClient = getTelemetryAuthClient();
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user?.id) {
      throw createHttpError(
        "Invalid or expired token.",
        401,
        "invalid_supabase_token",
      );
    }

    req.user = data.user;

    return data.user;
  } catch (error) {
    const isProviderUnavailable = isTelemetryAuthProviderNetworkError(error);
    const statusCode = isProviderUnavailable
      ? 503
      : error.statusCode || error.status || 500;
    const safeStatusCode =
      statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const code = isProviderUnavailable
      ? "AUTH_PROVIDER_UNAVAILABLE"
      : error.code || "telemetry_auth_failed";

    logTelemetryAuthEvent(req, code, {
      status: safeStatusCode,
    });

    sendJson(
      res,
      {
        success: false,
        code,
        message:
          safeStatusCode === 401
            ? "Autentikasi diperlukan."
            : isProviderUnavailable
              ? "Auth provider temporarily unavailable. Try again."
              : "Telemetry auth gagal.",
      },
      safeStatusCode,
    );

    return null;
  }
}

function withTelemetryAuth(handler) {
  return async function protectedTelemetryHandler(req, res) {
    const user = await requireTelemetryAuth(req, res);

    if (!user) return undefined;

    return handler(req, res, user);
  };
}

function getMemory() {
  const memory = process.memoryUsage();

  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
  };
}

function getOrbitHealth() {
  return getHealthSnapshot();
}

function getOrbitMetrics() {
  return {
    projects: projects.length,
    reports: 0,
    uptime: process.uptime(),
    memory: getMemory(),
    timestamp: getTimestamp(),
  };
}

function getOrbitProjects() {
  return projects.map((project) => ({ ...project }));
}

function getOrbitActivity() {
  const timestamp = getTimestamp();

  return [
    {
      type: "system",
      message: "Dashboard telemetry Vercel API online.",
      time: timestamp,
    },
    {
      type: "ai",
      message: "ORBIT AI Workspace route tetap tersedia.",
      time: timestamp,
    },
    {
      type: "security",
      message: "Security Center status protected.",
      time: timestamp,
    },
  ];
}

function getOrbitSecurity() {
  return {
    securityScore: null,
    helmet: "PROTECTED",
    cors: "PROTECTED",
    rateLimit: "ACTIVE",
    lastAudit: null,
    issues: [],
  };
}

function getOrbitSystem() {
  const health = getHealthSnapshot();

  return {
    success: true,
    status: health.status === "healthy" ? "online" : health.status,
    module: "system",
    apiVersion: API_VERSION,
    environment: health.environment || getEnvironment(),
    runtime: health.runtime || (process.env.VERCEL ? "vercel" : "node"),
    timestamp: health.timestamp || getTimestamp(),
  };
}

function getOrbitAutomation() {
  return automationEngines;
}

function createDashboardData(context = {}) {
  return {
    activity: getOrbitActivity(),
    automation: getOrbitAutomation(),
    health: getOrbitHealth(),
    metrics: getOrbitMetrics(),
    operationalIntelligence: getOperationalIntelligence(context),
    projects: getOrbitProjects(),
    security: getOrbitSecurity(),
    system: getOrbitSystem(),
  };
}

function createDashboardResponse(context = {}) {
  const data = createDashboardData(context);

  return {
    success: true,
    status: "ready",
    module: "dashboard",
    message: "Dashboard telemetry ready.",
    data,
    metrics: data.metrics,
    timestamp: getTimestamp(),
  };
}

function sendJson(res, body, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return sendJson(
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  return sendJson(res, createDashboardResponse());
}

module.exports = handler;
module.exports.createDashboardData = createDashboardData;
module.exports.createDashboardResponse = createDashboardResponse;
module.exports.getOrbitActivity = getOrbitActivity;
module.exports.getOrbitAutomation = getOrbitAutomation;
module.exports.getOrbitHealth = getOrbitHealth;
module.exports.getOrbitMetrics = getOrbitMetrics;
module.exports.getOrbitProjects = getOrbitProjects;
module.exports.getOrbitSecurity = getOrbitSecurity;
module.exports.getOrbitSystem = getOrbitSystem;
module.exports.sendJson = sendJson;
module.exports.withTelemetryAuth = withTelemetryAuth;
