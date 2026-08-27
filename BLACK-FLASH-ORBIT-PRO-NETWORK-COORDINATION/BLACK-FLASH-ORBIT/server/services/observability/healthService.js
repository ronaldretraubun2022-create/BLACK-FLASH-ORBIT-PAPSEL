const {
  getEmbeddingProviderStatus,
  getKnowledgeChatProviderStatus,
} = require("../knowledge/embeddingService");
const {
  isSupabaseServiceConfigured,
} = require("../supabaseAdmin");
const {
  checkWorkflowPersistence,
  getWorkflowPersistenceStatus,
} = require("../workflows/workflowRepository");

const SERVICE_NAME = "BLACK FLASH ORBIT API";
const VERSION = "1.0.0";

function hasEnvValue(key) {
  return Boolean(String(process.env[key] || "").trim());
}

function getEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function getRuntime() {
  return process.env.VERCEL ? "vercel" : "node";
}

function readiness(configured, details = {}) {
  return {
    configured: Boolean(configured),
    status: configured ? "ready" : "not_configured",
    ...details,
  };
}

function getLivenessSnapshot() {
  return {
    success: true,
    service: SERVICE_NAME,
    version: VERSION,
    status: "alive",
    module: "health",
    environment: getEnvironment(),
    runtime: getRuntime(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

function getHealthSnapshot() {
  const embedding = getEmbeddingProviderStatus();
  const knowledgeChat = getKnowledgeChatProviderStatus();

  const supabaseConfigured =
    isSupabaseServiceConfigured() ||
    (hasEnvValue("SUPABASE_URL") &&
      hasEnvValue("SUPABASE_ANON_KEY")) ||
    (hasEnvValue("VITE_SUPABASE_URL") &&
      hasEnvValue("VITE_SUPABASE_ANON_KEY"));

  const aiConfigured = hasEnvValue("OPENROUTER_API_KEY");
  const knowledgeConfigured =
    Boolean(embedding?.configured) && Boolean(knowledgeChat?.configured);

  const dependencies = {
    supabase: readiness(supabaseConfigured),
    ai: readiness(aiConfigured, {
      provider: "openrouter",
    }),
    knowledge: readiness(knowledgeConfigured, {
      embeddingProvider: embedding?.provider || null,
      embeddingConfigured: Boolean(embedding?.configured),
      chatProvider: knowledgeChat?.provider || null,
      chatConfigured: Boolean(knowledgeChat?.configured),
    }),
    workflowPersistence: getWorkflowPersistenceStatus(),
  };

  const allReady = Object.values(dependencies).every(
    (item) => item.status === "ready" || item.status === "configured",
  );

  return {
    success: true,
    service: SERVICE_NAME,
    version: VERSION,
    status: allReady ? "healthy" : "degraded",
    module: "health",
    environment: getEnvironment(),
    runtime: getRuntime(),
    uptime: process.uptime(),
    dependencies,
    timestamp: new Date().toISOString(),
  };
}

async function getReadinessSnapshot() {
  const health = getHealthSnapshot();
  const workflowPersistence = await checkWorkflowPersistence();
  const dependencies = {
    ...health.dependencies,
    workflowPersistence,
  };
  const ready = Object.values(dependencies).every(
    (item) => item.status === "ready" || item.status === "configured",
  );

  return {
    ...health,
    status: ready ? "ready" : "degraded",
    readiness: ready ? "ready" : "degraded",
    dependencies,
  };
}

module.exports = {
  getHealthSnapshot,
  getLivenessSnapshot,
  getReadinessSnapshot,
};
