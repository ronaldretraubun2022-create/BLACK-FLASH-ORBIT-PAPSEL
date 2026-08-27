"use strict";

const SERVER_SECRETS = [
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const SERVER_CONFIG = [
  "CORS_ALLOWED_ORIGINS",
  "HOST",
  "NODE_ENV",
  "OPENAI_BASE_URL",
  "OPENAI_EMBEDDING_MODEL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL",
  "PORT",
  "SUPABASE_ANON_KEY",
  "SUPABASE_URL",
];
const PUBLIC_CLIENT_CONFIG = [
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
];
const OPTIONAL_CONFIG = [
  "AI_CHAT_FALLBACK_MODELS",
  "AI_ROUTER_MAX_ATTEMPTS",
  "DEBUG_AI_AUTH",
  "DEBUG_AI_ROUTER",
  "DEBUG_KNOWLEDGE_ERRORS",
  "DEBUG_NEWSROOM_AI",
  "DEBUG_OPENROUTER",
  "KNOWLEDGE_CHAT_FALLBACK_MODELS",
  "KNOWLEDGE_CHAT_MODEL",
  "KNOWLEDGE_CHAT_PROVIDER",
  "KNOWLEDGE_EMBEDDING_PROVIDER",
  "NEWSROOM_AI_FALLBACK_MODELS",
  "NEWSROOM_AI_MODEL",
  "OPENROUTER_APP_NAME",
  "OPENROUTER_SITE_URL",
  "ORBIT_COALESCE_LOG",
  "ORBIT_ENABLE_HSTS",
  "ORBIT_WORKFLOW_ALLOWED_HOSTS",
  "VERCEL",
  "VERCEL_ENV",
];
const REQUIRED_PRODUCTION_KEYS = [
  "CORS_ALLOWED_ORIGINS",
  "OPENROUTER_API_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
];

function hasEnvValue(env, key) {
  return Boolean(String(env[key] || "").trim());
}

function getConfigInventory(env = process.env) {
  return {
    optionalConfig: OPTIONAL_CONFIG.map((key) => ({
      key,
      present: hasEnvValue(env, key),
    })),
    publicClientConfig: PUBLIC_CLIENT_CONFIG.map((key) => ({
      key,
      present: hasEnvValue(env, key),
    })),
    serverConfig: SERVER_CONFIG.map((key) => ({
      key,
      present: hasEnvValue(env, key),
    })),
    serverSecrets: SERVER_SECRETS.map((key) => ({
      key,
      present: hasEnvValue(env, key),
    })),
  };
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function validateProductionEnvironment(env = process.env) {
  const missing = REQUIRED_PRODUCTION_KEYS.filter((key) => !hasEnvValue(env, key));
  const origins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  const hasWildcardOrigin = origins.some((origin) => origin === "*");

  if (hasWildcardOrigin) {
    missing.push("CORS_ALLOWED_ORIGINS_NO_WILDCARD");
  }

  return {
    missing,
    ok: missing.length === 0,
  };
}

function assertProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return {
      ok: true,
      skipped: true,
    };
  }

  const result = validateProductionEnvironment(env);

  if (!result.ok) {
    const error = new Error(
      `Production environment validation failed: ${result.missing.join(", ")}`,
    );
    error.code = "PRODUCTION_ENV_INVALID";
    error.missing = result.missing;
    throw error;
  }

  return result;
}

module.exports = {
  OPTIONAL_CONFIG,
  PUBLIC_CLIENT_CONFIG,
  REQUIRED_PRODUCTION_KEYS,
  SERVER_CONFIG,
  SERVER_SECRETS,
  assertProductionEnvironment,
  getConfigInventory,
  parseAllowedOrigins,
  validateProductionEnvironment,
};
