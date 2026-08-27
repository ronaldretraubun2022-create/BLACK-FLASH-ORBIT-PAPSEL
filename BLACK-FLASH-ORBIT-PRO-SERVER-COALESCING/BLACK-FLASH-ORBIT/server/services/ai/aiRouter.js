const {
  requestOpenRouterCompletion,
} = require("./providers/openrouterProvider");
const {
  getConfiguredMaxAttempts,
  isRetryableAiError,
  normalizeTimeoutMs,
  shouldFallbackAfterError,
} = require("./requestPolicy");
const {
  AI_USE_CASES,
  getModelCandidates,
  isValidModelId,
  normalizeModelId,
  resolveModel,
} = require("./modelRegistry");
const { AI_ERROR_CODES, createAiRouterError } = require("./errors");

const DEBUG_AI_ROUTER = process.env.DEBUG_AI_ROUTER === "true";
const SAFE_TELEMETRY_KEYS = new Set([
  "audience",
  "channel",
  "complexity",
  "mode",
  "promptVersion",
]);

function normalizeMessages({ messages, systemPrompt }) {
  const normalizedMessages = [];
  const cleanSystemPrompt =
    typeof systemPrompt === "string" ? systemPrompt.trim() : "";

  if (cleanSystemPrompt) {
    normalizedMessages.push({
      content: cleanSystemPrompt,
      role: "system",
    });
  }

  if (Array.isArray(messages)) {
    messages.forEach((message) => {
      const role = String(message?.role || "").trim();
      const content =
        typeof message?.content === "string" ? message.content.trim() : "";

      if (!["system", "user", "assistant"].includes(role) || !content) return;

      normalizedMessages.push({ content, role });
    });
  }

  return normalizedMessages;
}

function logAiRouterDiagnostic(event, metadata) {
  if (!DEBUG_AI_ROUTER) return;

  console.info("[AI Router]", {
    attempt: metadata.attempt || null,
    durationMs: metadata.durationMs || null,
    fallbackUsed: Boolean(metadata.fallbackUsed),
    provider: metadata.provider || "openrouter",
    requestId: metadata.requestId || null,
    requestedModel: metadata.requestedModel || null,
    resolvedModel: metadata.resolvedModel || null,
    status: event,
    telemetry: metadata.telemetry || null,
  });
}

function normalizeSafeTelemetry(metadata = {}) {
  const telemetry = {};

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (!SAFE_TELEMETRY_KEYS.has(key)) return;

    const cleanValue = String(value || "")
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .trim()
      .slice(0, 120);

    if (cleanValue) telemetry[key] = cleanValue;
  });

  return telemetry;
}

async function generateCompletion(options = {}) {
  const startedAt = Date.now();
  const useCase = options.useCase || AI_USE_CASES.GENERAL_CHAT;
  const messages = normalizeMessages(options);
  const safeTelemetry = normalizeSafeTelemetry(options.metadata);
  const requestedModel = options.model || null;
  const resolvedPrimaryModel = resolveModel({ model: requestedModel, useCase });
  const candidateModels = getModelCandidates({
    fallbackModels: options.fallbackModels,
    model: requestedModel,
    useCase,
  });
  const maxAttempts = getConfiguredMaxAttempts(options.maxAttempts);
  const timeoutMs = normalizeTimeoutMs(options.timeout || options.timeoutMs);
  const requestId = options.requestId || options.metadata?.requestId || null;
  let lastError = null;
  let attemptCounter = 0;

  if (!messages.length) {
    throw createAiRouterError("AI messages tidak boleh kosong.", {
      code: AI_ERROR_CODES.REQUEST,
      provider: "openrouter",
      retryable: false,
      status: 400,
    });
  }

  if (options.model && !isValidModelId(normalizeModelId(options.model))) {
    throw createAiRouterError("Model AI tidak valid.", {
      code: AI_ERROR_CODES.REQUEST,
      provider: "openrouter",
      retryable: false,
      status: 400,
    });
  }

  for (const [modelIndex, model] of candidateModels.entries()) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attemptCounter += 1;
      const attemptStartedAt = Date.now();

      try {
        const result = await requestOpenRouterCompletion({
          maxTokens: options.maxTokens,
          messages,
          model,
          signal: options.signal,
          temperature: options.temperature,
          timeoutMs,
        });
        const fallbackUsed = modelIndex > 0;

        logAiRouterDiagnostic("success", {
          attempt: attemptCounter,
          durationMs: Date.now() - attemptStartedAt,
          fallbackUsed,
          provider: result.provider,
          requestId,
          requestedModel: requestedModel || resolvedPrimaryModel,
          resolvedModel: result.model || model,
          telemetry: {
            useCase: String(useCase).toLowerCase(),
            ...safeTelemetry,
          },
        });

        return {
          content: result.content,
          finishReason: result.finishReason,
          metadata: {
            ...(result.metadata || {}),
            attempts: attemptCounter,
            durationMs: Date.now() - startedAt,
            fallbackUsed,
            requestId,
            requestedModel: requestedModel || resolvedPrimaryModel,
            resolvedModel: result.model || model,
            telemetry: {
              useCase: String(useCase).toLowerCase(),
              ...safeTelemetry,
            },
            useCase,
          },
          model: result.model || model,
          provider: result.provider,
          usage: result.usage,
        };
      } catch (error) {
        lastError = error;
        logAiRouterDiagnostic("failed", {
          attempt: attemptCounter,
          durationMs: Date.now() - attemptStartedAt,
          fallbackUsed: modelIndex > 0,
          provider: error.provider || "openrouter",
          requestId,
          requestedModel: requestedModel || resolvedPrimaryModel,
          resolvedModel: model,
          telemetry: {
            useCase: String(useCase).toLowerCase(),
            ...safeTelemetry,
          },
        });

        if (attempt < maxAttempts && isRetryableAiError(error)) {
          continue;
        }

        if (
          modelIndex < candidateModels.length - 1 &&
          shouldFallbackAfterError(error)
        ) {
          break;
        }

        throw error;
      }
    }
  }

  throw lastError || new Error("AI Router tidak mendapatkan respons valid.");
}

module.exports = {
  AI_USE_CASES,
  generateCompletion,
};
