const {
  AI_ERROR_CODES,
  createAiRouterError,
  mapOpenRouterStatusToError,
} = require("../errors");
const {
  createAbortController,
  normalizeTimeoutMs,
} = require("../requestPolicy");
const { normalizeAiResponseContent } = require("../responseValidator");

const DEFAULT_OPENROUTER_API_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_PROVIDER = "openrouter";

function stripWrappingQuotes(value) {
  const trimmedValue = String(value || "").trim();
  const firstCharacter = trimmedValue[0];
  const lastCharacter = trimmedValue[trimmedValue.length - 1];

  if (
    trimmedValue.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
}

function normalizeOpenRouterApiKey(rawApiKey) {
  return stripWrappingQuotes(
    stripWrappingQuotes(rawApiKey).replace(/^Bearer\s+/i, ""),
  );
}

function hasInvalidHeaderCharacters(value) {
  return /[^\x20-\x7E]/.test(value);
}

function normalizeBaseUrl(value, fallback = DEFAULT_OPENROUTER_API_BASE_URL) {
  return String(value || fallback)
    .trim()
    .replace(/\/+$/, "");
}

function getOpenRouterProviderConfig() {
  const apiKey = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);

  if (!apiKey) {
    return {
      apiKey,
      code: AI_ERROR_CODES.CONFIGURATION,
      configured: false,
      message: "OpenRouter provider belum dikonfigurasi pada backend.",
      provider: OPENROUTER_PROVIDER,
    };
  }

  if (hasInvalidHeaderCharacters(apiKey)) {
    return {
      apiKey: "",
      code: AI_ERROR_CODES.CONFIGURATION,
      configured: false,
      message: "OpenRouter API key mengandung karakter header tidak valid.",
      provider: OPENROUTER_PROVIDER,
    };
  }

  return {
    apiKey,
    appName:
      String(process.env.OPENROUTER_APP_NAME || "BLACK FLASH ORBIT").trim() ||
      "BLACK FLASH ORBIT",
    baseUrl: normalizeBaseUrl(process.env.OPENROUTER_BASE_URL),
    code: null,
    configured: true,
    provider: OPENROUTER_PROVIDER,
    siteUrl: String(process.env.OPENROUTER_SITE_URL || "").trim(),
  };
}

function getOpenRouterProviderStatus() {
  const config = getOpenRouterProviderConfig();

  return {
    code: config.code,
    configured: config.configured,
    provider: config.provider,
  };
}

function requireOpenRouterProviderConfig() {
  const config = getOpenRouterProviderConfig();

  if (!config.configured) {
    throw createAiRouterError(config.message, {
      code: config.code,
      provider: OPENROUTER_PROVIDER,
      retryable: false,
      status: 503,
    });
  }

  return config;
}

function getOpenRouterError(data) {
  return data?.error || data?.provider_error || data?.providerError || null;
}

async function parseProviderJson(response, model) {
  try {
    return await response.json();
  } catch {
    throw createAiRouterError("Provider AI mengembalikan JSON tidak valid.", {
      code: AI_ERROR_CODES.INVALID_RESPONSE,
      model,
      provider: OPENROUTER_PROVIDER,
      retryable: false,
      status: 502,
    });
  }
}

function getFinishReason(data) {
  const firstChoice = Array.isArray(data?.choices) ? data.choices[0] : null;

  return firstChoice?.finish_reason || firstChoice?.finishReason || null;
}

async function requestOpenRouterCompletion({
  maxTokens,
  messages,
  model,
  signal,
  temperature,
  timeoutMs,
}) {
  const config = requireOpenRouterProviderConfig();
  const timeout = normalizeTimeoutMs(timeoutMs);
  const abort = createAbortController({
    externalSignal: signal,
    timeoutMs: timeout,
  });

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        max_tokens: maxTokens,
        messages,
        model,
        temperature,
      }),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(config.siteUrl ? { "HTTP-Referer": config.siteUrl } : {}),
        ...(config.appName ? { "X-Title": config.appName } : {}),
      },
      method: "POST",
      signal: abort.controller.signal,
    });
    const data = await parseProviderJson(response, model);

    if (!response.ok) {
      throw mapOpenRouterStatusToError({
        model,
        providerError: getOpenRouterError(data),
        status: response.status,
      });
    }

    const content = normalizeAiResponseContent(data, {
      code: AI_ERROR_CODES.INVALID_RESPONSE,
      message: "Provider AI mengembalikan respons tidak valid.",
    });

    return {
      content,
      finishReason: getFinishReason(data),
      metadata: {
        id: data?.id || null,
        object: data?.object || null,
      },
      model: data?.model || model,
      provider: OPENROUTER_PROVIDER,
      usage: data?.usage || null,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createAiRouterError("Request ke provider AI timeout.", {
        code: AI_ERROR_CODES.TIMEOUT,
        model,
        provider: OPENROUTER_PROVIDER,
        retryable: true,
        status: 504,
      });
    }

    if (error?.code?.startsWith?.("AI_")) throw error;

    throw createAiRouterError("Gagal menghubungi provider AI.", {
      code: AI_ERROR_CODES.PROVIDER,
      model,
      provider: OPENROUTER_PROVIDER,
      retryable: true,
      status: 502,
    });
  } finally {
    abort.dispose();
  }
}

module.exports = {
  OPENROUTER_PROVIDER,
  getOpenRouterProviderConfig,
  getOpenRouterProviderStatus,
  normalizeOpenRouterApiKey,
  requestOpenRouterCompletion,
};
