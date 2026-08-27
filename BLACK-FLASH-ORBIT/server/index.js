require("dotenv").config();

const http = require("node:http");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const {
  assertProductionEnvironment,
  getConfigInventory,
} = require("./config/environment");
const apiRoutes = require("./routes");
const aiRoutes = require("./routes/ai");
const newsroomRoutes = require("./routes/newsroom.js");
const auditRoutes = require("./routes/audit.routes");
const backupRoutes = require("./routes/backup");
const chatRoutes = require("./routes/chat.routes");
const knowledgeRoutes = require("./routes/knowledge.routes");
const intelligenceRoutes = require("./routes/intelligence");
const agentRoutes = require("./routes/agent");
const webBuilderRoutes = require("./routes/webBuilder.routes");
const workflowRoutes = require("./routes/workflows");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const requestContext = require("./middleware/requestContext");
const {
  createRouteRateLimiters,
} = require("./middleware/routeRateLimits");
const { securityHeaders } = require("./middleware/securityHeaders");
const {
  getEmbeddingProviderStatus,
  getKnowledgeChatProviderStatus,
} = require("./services/knowledge/embeddingService");
const {
  getHealthSnapshot,
  getLivenessSnapshot,
  getReadinessSnapshot,
} = require("./services/observability/healthService");
const {
  error: logError,
  info: logInfo,
} = require("./services/observability/logger");
const {
  getWorkflowPersistenceStatus,
} = require("./services/workflows/workflowRepository");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const localDevelopmentOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
];

function normalizeCorsOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}

function parseCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeCorsOrigin)
    .filter((origin) => origin && origin !== "*");
}

function parseUrlOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      if (!item || item === "*") return "";

      try {
        return new URL(item).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function uniqueValues(values) {
  return values.filter(
    (value, index, source) => value && source.indexOf(value) === index,
  );
}

function sanitizeLogValue(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.once("finish", () => {
    console.info("[ORBIT HTTP]", {
      durationMs: Date.now() - startedAt,
      method: sanitizeLogValue(req.method, 12),
      path: sanitizeLogValue(String(req.originalUrl || req.url || "").split(/[?#]/, 1)[0]),
      status: res.statusCode,
    });
  });

  next();
}

function isDevelopmentHostname(hostname) {
  const cleanHostname = String(hostname || "").toLowerCase();
  const parts = cleanHostname.split(".").map((part) => Number(part));

  if (cleanHostname === "localhost" || cleanHostname === "127.0.0.1") {
    return true;
  }

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isDevelopmentCorsOrigin(origin) {
  if (isProduction) return false;

  try {
    const url = new URL(origin);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      isDevelopmentHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

const configuredCorsOrigins = [
  ...parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ...(isProduction ? [] : parseCorsOrigins(process.env.CORS_ORIGIN)),
];

const allowedOrigins = uniqueValues([
  ...(isProduction ? [] : localDevelopmentOrigins),
  ...configuredCorsOrigins,
]);

const localDevelopmentResourceOrigins = uniqueValues([
  ...localDevelopmentOrigins,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]);

const localDevelopmentConnectOrigins = uniqueValues([
  ...localDevelopmentResourceOrigins,
  "ws://localhost:5173",
  "ws://127.0.0.1:5173",
  "ws://localhost:3000",
  "ws://127.0.0.1:3000",
  `ws://localhost:${PORT}`,
  `ws://127.0.0.1:${PORT}`,
]);

function getExternalConnectSources() {
  return uniqueValues([
    ...parseUrlOrigins(process.env.SUPABASE_URL),
    ...parseUrlOrigins(process.env.VITE_SUPABASE_URL),
    ...parseUrlOrigins(process.env.VITE_API_BASE_URL),
    ...parseUrlOrigins(process.env.OPENROUTER_BASE_URL),
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://openrouter.ai",
    "https://*.openrouter.ai",
  ]);
}

function getHelmetOptions() {
  const developmentResourceSources = isProduction
    ? []
    : uniqueValues(localDevelopmentResourceOrigins);
  const developmentConnectSources = isProduction
    ? []
    : uniqueValues(localDevelopmentConnectOrigins);

  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          ...developmentResourceSources,
          ...(isProduction ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", ...developmentResourceSources],
        imgSrc: ["'self'", "data:", "blob:", ...developmentResourceSources],
        connectSrc: [
          "'self'",
          ...getExternalConnectSources(),
          ...developmentConnectSources,
        ],
        fontSrc: ["'self'", "data:", ...developmentResourceSources],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: {
      policy: isProduction ? "same-origin" : "cross-origin",
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    xContentTypeOptions: true,
  };
}

function requireRouteHandler(routeName, handler) {
  if (typeof handler !== "function") {
    throw new TypeError(`${routeName} harus export Express router/function.`);
  }

  return handler;
}

function healthPayload() {
  return getLivenessSnapshot();
}

async function readinessPayload() {
  return getReadinessSnapshot();
}

function hasEnvValue(key) {
  return Boolean(String(process.env[key] || "").trim());
}

function validateRequiredEnv() {
  const embeddingProvider = getEmbeddingProviderStatus();
  const knowledgeChatProvider = getKnowledgeChatProviderStatus();
  const workflowPersistence = getWorkflowPersistenceStatus();
  const inventory = getConfigInventory();

  logInfo("startup_configuration", {
    embeddingProvider,
    knowledgeChatProvider,
    optionalConfig: inventory.optionalConfig,
    publicClientConfig: inventory.publicClientConfig,
    serverConfig: inventory.serverConfig,
    serverSecrets: inventory.serverSecrets,
    serviceRoleConfigured:
      hasEnvValue("SUPABASE_URL") &&
      hasEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
    workflowPersistence,
  });
}

function getStartupEnvironmentDiagnostics() {
  const hasSupabaseUrl = hasEnvValue("SUPABASE_URL");
  const hasSupabaseAnonKey = hasEnvValue("SUPABASE_ANON_KEY");
  const hasViteSupabaseUrl = hasEnvValue("VITE_SUPABASE_URL");
  const hasViteSupabaseAnonKey = hasEnvValue("VITE_SUPABASE_ANON_KEY");

  return {
    SUPABASE_URL: hasSupabaseUrl,
    SUPABASE_ANON_KEY: hasSupabaseAnonKey,
    VITE_SUPABASE_URL: hasViteSupabaseUrl,
    VITE_SUPABASE_ANON_KEY: hasViteSupabaseAnonKey,
    OPENROUTER_API_KEY: hasEnvValue("OPENROUTER_API_KEY"),
    aiAuthAnonKeyAvailable: hasSupabaseAnonKey || hasViteSupabaseAnonKey,
    aiAuthConfigured:
      (hasSupabaseUrl || hasViteSupabaseUrl) &&
      (hasSupabaseAnonKey || hasViteSupabaseAnonKey),
    aiAuthUrlAvailable: hasSupabaseUrl || hasViteSupabaseUrl,
  };
}

function logStartupEnvironmentDiagnostics() {
  const diagnostics = getStartupEnvironmentDiagnostics();

  logInfo("startup_environment_diagnostics", diagnostics);

  if (!diagnostics.aiAuthConfigured) {
    logError("startup_auth_env_missing", {
      code: "AUTH_ENV_MISSING",
      message:
        "AI auth env missing. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.",
      statusCode: 500,
    });
  }
}

function validateStartupEnvironment() {
  try {
    assertProductionEnvironment(process.env);
  } catch (error) {
    logError("startup_environment_invalid", {
      code: error.code || "PRODUCTION_ENV_INVALID",
      missing: error.missing || [],
      statusCode: 500,
    });
    throw error;
  }
}

if (NODE_ENV !== "test") {
  validateStartupEnvironment();
  logStartupEnvironmentDiagnostics();
  validateRequiredEnv();
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet(getHelmetOptions()));
app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(requestContext);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = normalizeCorsOrigin(origin);

      if (
        allowedOrigins.includes(cleanOrigin) ||
        isDevelopmentCorsOrigin(cleanOrigin)
      ) {
        return callback(null, true);
      }

      const error = new Error("CORS origin denied.");
      error.code = "CORS_ORIGIN_DENIED";
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
  }),
);

if (NODE_ENV !== "test") {
  app.use(requestLogger);
}

app.get(
  [
    "/",
    "/api",
    "/health",
    "/healthz",
    "/api/health",
    "/api/healthz",
    "/api/v1/health",
    "/api/v1/healthz",
  ],
  (req, res) => {
    res.status(200).json(healthPayload());
  },
);

app.get(["/ready", "/readyz", "/api/ready", "/api/readyz", "/api/v1/readiness"], async (req, res) => {
  const readiness = await readinessPayload();
  const statusCode = readiness.status === "ready" ? 200 : 503;

  res.status(statusCode).json(readiness);
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    [
      "/",
      "/api",
      "/health",
      "/healthz",
      "/api/health",
      "/api/healthz",
      "/api/v1/health",
      "/api/v1/healthz",
      "/ready",
      "/readyz",
      "/api/ready",
      "/api/readyz",
      "/api/v1/readiness",
    ].includes(req.path),
  message: {
    success: false,
    message: "Terlalu banyak request. Coba lagi nanti.",
  },
});

app.use(apiLimiter);

const routeLimiters = createRouteRateLimiters({ isProduction });

app.use(
  "/api/v1/audit",
  requireRouteHandler("routes/audit.routes.js", auditRoutes),
);

app.use("/api/v1", requireRouteHandler("routes/index.js", apiRoutes));
app.use(
  "/api/ai/newsroom",
  routeLimiters.newsroom,
  requireRouteHandler("routes/newsroom.js", newsroomRoutes),
);
app.use("/api/ai", routeLimiters.ai, requireRouteHandler("routes/ai.js", aiRoutes));
app.use("/api/backup", requireRouteHandler("routes/backup.js", backupRoutes));
app.use("/api/chat", requireRouteHandler("routes/chat.routes.js", chatRoutes));
app.use(
  ["/api/knowledge", "/api/v1/knowledge"],
  routeLimiters.knowledge,
  requireRouteHandler("routes/knowledge.routes.js", knowledgeRoutes),
);
app.use(
  "/api/v1/intelligence",
  requireRouteHandler("routes/intelligence.js", intelligenceRoutes),
);
app.use(
  "/api/v1/agent",
  requireRouteHandler("routes/agent.js", agentRoutes),
);
app.use(
  "/api/v1/web-builder",
  routeLimiters.webBuilder,
  requireRouteHandler("routes/webBuilder.routes.js", webBuilderRoutes),
);
app.use(
  "/api/v1/workflows",
  requireRouteHandler("routes/workflows.js", workflowRoutes),
);

app.use(notFound);
app.use(errorHandler);

function startServer() {
  const server = http.createServer(app);

  server.listen(PORT, HOST, () => {
    const publicHost = HOST === "0.0.0.0" ? "localhost" : HOST;

    console.log(
      `BLACK FLASH ORBIT server berjalan di http://${publicHost}:${PORT}`,
    );
  });

  server.on("error", (error) => {
    console.error("[ORBIT Server Error]", error);
    process.exit(1);
  });

  function shutdown(signal) {
    console.log(`\n[ORBIT] Received ${signal}. Shutting down server...`);
    const shutdownTimer = setTimeout(() => {
      console.error("[ORBIT Shutdown Error]", {
        code: "SHUTDOWN_TIMEOUT",
        signal,
      });
      process.exit(1);
    }, 10000);

    server.close((error) => {
      clearTimeout(shutdownTimer);

      if (error) {
        console.error("[ORBIT Shutdown Error]", error);
        process.exit(1);
      }

      process.exit(0);
    });
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.healthPayload = healthPayload;
module.exports.readinessPayload = readinessPayload;
