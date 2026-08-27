const DEFAULT_OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_CHAT_MODEL = "openrouter/auto";
const DEFAULT_CHAT_PROVIDER = "openrouter";
const DEFAULT_EMBEDDING_PROVIDER = "openai";
const MAX_EMBEDDING_INPUT_CHARS = 8000;
const EMBEDDING_BATCH_SIZE = 32;
const KNOWLEDGE_PROVIDER_TIMEOUT_MS = 30000;
const { generateCompletion, AI_USE_CASES } = require("../ai/aiRouter");

function createHttpError(
  message,
  statusCode = 500,
  code = "KNOWLEDGE_PROVIDER_REQUEST_FAILED",
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeProvider(value) {
  return String(value || DEFAULT_EMBEDDING_PROVIDER)
    .trim()
    .toLowerCase();
}

function normalizeBaseUrl(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/\/+$/, "");
}

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

function normalizeProviderApiKey(value) {
  return stripWrappingQuotes(
    stripWrappingQuotes(value).replace(/^Bearer\s+/i, ""),
  );
}

function getEmbeddingProviderConfig() {
  const provider = normalizeProvider(process.env.KNOWLEDGE_EMBEDDING_PROVIDER);

  if (provider !== "openai") {
    return {
      apiKey: "",
      baseUrl: "",
      code: "EMBEDDING_PROVIDER_UNSUPPORTED",
      configured: false,
      embeddingModel: "",
      message: "Embedding provider tidak didukung.",
      provider,
    };
  }

  const apiKey = normalizeProviderApiKey(process.env.OPENAI_API_KEY);

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(
      process.env.OPENAI_BASE_URL,
      DEFAULT_OPENAI_API_BASE_URL,
    ),
    code: apiKey ? null : "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    configured: Boolean(apiKey),
    embeddingModel:
      String(
        process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      ).trim() || DEFAULT_EMBEDDING_MODEL,
    message: apiKey
      ? null
      : "Embedding provider belum dikonfigurasi pada backend.",
    provider,
  };
}

function getKnowledgeChatProviderConfig() {
  const provider = normalizeProvider(
    process.env.KNOWLEDGE_CHAT_PROVIDER || DEFAULT_CHAT_PROVIDER,
  );

  if (provider !== "openrouter") {
    return {
      apiKey: "",
      baseUrl: "",
      code: "KNOWLEDGE_CHAT_PROVIDER_UNSUPPORTED",
      configured: false,
      message: "Knowledge chat provider tidak didukung.",
      model: "",
      provider,
    };
  }

  const apiKey = normalizeProviderApiKey(process.env.OPENROUTER_API_KEY);

  return {
    apiKey,
    code: apiKey ? null : "KNOWLEDGE_CHAT_PROVIDER_NOT_CONFIGURED",
    configured: Boolean(apiKey),
    message: apiKey
      ? null
      : "Knowledge chat provider belum dikonfigurasi pada backend.",
    model:
      String(
        process.env.KNOWLEDGE_CHAT_MODEL ||
          process.env.OPENROUTER_MODEL ||
          DEFAULT_CHAT_MODEL,
      ).trim() || DEFAULT_CHAT_MODEL,
    provider,
  };
}

function getEmbeddingProviderStatus() {
  const config = getEmbeddingProviderConfig();

  return {
    code: config.code,
    configured: config.configured,
    embeddingModel: config.embeddingModel,
    provider: config.provider,
  };
}

function getKnowledgeChatProviderStatus() {
  const config = getKnowledgeChatProviderConfig();

  return {
    code: config.code,
    configured: config.configured,
    model: config.model,
    provider: config.provider,
  };
}

function requireEmbeddingProviderConfig() {
  const config = getEmbeddingProviderConfig();

  if (!config.configured) {
    throw createHttpError(config.message, 503, config.code);
  }

  return config;
}

function requireKnowledgeChatProviderConfig() {
  const config = getKnowledgeChatProviderConfig();

  if (!config.configured) {
    throw createHttpError(config.message, 503, config.code);
  }

  return config;
}

function mapKnowledgeChatError(error) {
  if (!error?.code?.startsWith?.("AI_")) return error;

  if (error.code === "AI_AUTH_ERROR") {
    return createHttpError(
      "Credential knowledge chat provider tidak valid.",
      503,
      "KNOWLEDGE_CHAT_PROVIDER_AUTH_FAILED",
    );
  }

  if (error.code === "AI_RATE_LIMITED") {
    return createHttpError(
      "Knowledge chat provider membatasi request. Coba lagi nanti.",
      429,
      "KNOWLEDGE_CHAT_PROVIDER_RATE_LIMITED",
    );
  }

  if (error.code === "AI_TIMEOUT") {
    return createHttpError(
      "Knowledge chat provider timeout.",
      504,
      "KNOWLEDGE_CHAT_PROVIDER_TIMEOUT",
    );
  }

  if (error.code === "AI_INVALID_RESPONSE") {
    return createHttpError(
      "Respons AI knowledge tidak valid.",
      502,
      "KNOWLEDGE_CHAT_PROVIDER_INVALID_RESPONSE",
    );
  }

  return createHttpError(
    "Knowledge chat provider tidak tersedia.",
    502,
    "KNOWLEDGE_CHAT_PROVIDER_UNAVAILABLE",
  );
}

function isOpenAiConfigured() {
  const config = getEmbeddingProviderConfig();

  return config.provider === "openai" && config.configured;
}

function normalizeEmbeddingInput(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

async function requestOpenAi(endpoint, payload) {
  const config = requireEmbeddingProviderConfig();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    KNOWLEDGE_PROVIDER_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createHttpError(
          "Credential embedding provider tidak valid.",
          503,
          "EMBEDDING_PROVIDER_AUTH_FAILED",
        );
      }

      if (response.status === 429) {
        throw createHttpError(
          "Embedding provider membatasi request. Coba lagi nanti.",
          429,
          "KNOWLEDGE_PROVIDER_RATE_LIMITED",
        );
      }

      throw createHttpError(
        "Embedding provider tidak tersedia.",
        502,
        response.status >= 500
          ? "KNOWLEDGE_PROVIDER_UNAVAILABLE"
          : "KNOWLEDGE_PROVIDER_REQUEST_FAILED",
      );
    }

    try {
      return await response.json();
    } catch {
      throw createHttpError(
        "Respons embedding provider tidak valid.",
        502,
        "KNOWLEDGE_PROVIDER_INVALID_RESPONSE",
      );
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createHttpError(
        "Embedding provider timeout.",
        504,
        "KNOWLEDGE_PROVIDER_TIMEOUT",
      );
    }

    if (error?.code) throw error;

    throw createHttpError(
      "Embedding provider tidak tersedia.",
      502,
      "KNOWLEDGE_PROVIDER_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function createEmbeddings(inputs) {
  const cleanInputs = inputs.map(normalizeEmbeddingInput).filter(Boolean);
  const embeddings = [];

  if (!cleanInputs.length) {
    throw createHttpError(
      "Teks embedding tidak boleh kosong.",
      400,
      "embedding_input_required",
    );
  }

  for (
    let index = 0;
    index < cleanInputs.length;
    index += EMBEDDING_BATCH_SIZE
  ) {
    const input = cleanInputs.slice(index, index + EMBEDDING_BATCH_SIZE);
    const config = requireEmbeddingProviderConfig();
    const payload = await requestOpenAi("/embeddings", {
      input,
      model: config.embeddingModel,
    });

    const batchEmbeddings = Array.isArray(payload?.data)
      ? payload.data
          .sort((first, second) => first.index - second.index)
          .map((item) => item.embedding)
      : [];

    if (batchEmbeddings.length !== input.length) {
      throw createHttpError(
        "Respons embedding tidak valid.",
        502,
        "KNOWLEDGE_PROVIDER_INVALID_RESPONSE",
      );
    }

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

async function createEmbedding(input) {
  const [embedding] = await createEmbeddings([input]);

  return embedding;
}

async function createChatCompletion({
  messages,
  maxTokens = 700,
  temperature = 0.1,
}) {
  const config = requireKnowledgeChatProviderConfig();
  let result;

  try {
    result = await generateCompletion({
      maxTokens,
      messages,
      model: config.model,
      temperature,
      timeout: KNOWLEDGE_PROVIDER_TIMEOUT_MS,
      useCase: AI_USE_CASES.KNOWLEDGE_CHAT,
    });
  } catch (error) {
    throw mapKnowledgeChatError(error);
  }

  return result.content;
}

module.exports = {
  CHAT_MODEL: DEFAULT_CHAT_MODEL,
  EMBEDDING_MODEL: DEFAULT_EMBEDDING_MODEL,
  createChatCompletion,
  createEmbedding,
  createEmbeddings,
  getEmbeddingProviderStatus,
  getKnowledgeChatProviderStatus,
  isOpenAiConfigured,
};
