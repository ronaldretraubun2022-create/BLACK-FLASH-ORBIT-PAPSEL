const AI_ERROR_CODES = {
  AUTH: "AI_AUTH_ERROR",
  CONFIGURATION: "AI_CONFIGURATION_ERROR",
  INVALID_RESPONSE: "AI_INVALID_RESPONSE",
  MODEL_UNAVAILABLE: "AI_MODEL_UNAVAILABLE",
  PROVIDER: "AI_PROVIDER_ERROR",
  RATE_LIMITED: "AI_RATE_LIMITED",
  REQUEST: "AI_REQUEST_ERROR",
  TIMEOUT: "AI_TIMEOUT",
};

class AiRouterError extends Error {
  constructor(message, options = {}) {
    super(message || "AI provider request failed.");
    this.name = "AiRouterError";
    this.code = options.code || AI_ERROR_CODES.PROVIDER;
    this.status = options.status || options.statusCode || 502;
    this.statusCode = this.status;
    this.provider = options.provider || "openrouter";
    this.model = options.model || null;
    this.retryable = Boolean(options.retryable);
    this.safeMessage = options.safeMessage || this.message;
    this.details = options.details || null;
  }
}

function createAiRouterError(message, options = {}) {
  return new AiRouterError(message, options);
}

function isAiRouterError(error) {
  return (
    error instanceof AiRouterError || Boolean(error?.code?.startsWith?.("AI_"))
  );
}

function sanitizeAiError(error, fallbackMessage = "Request AI gagal.") {
  const status = Number(error?.statusCode || error?.status || 502);
  const safeStatus = status >= 400 && status < 600 ? status : 502;
  const message =
    safeStatus >= 500
      ? fallbackMessage
      : error?.safeMessage || error?.message || fallbackMessage;

  return {
    code: error?.code || AI_ERROR_CODES.PROVIDER,
    message,
    status: safeStatus,
  };
}

function mapOpenRouterStatusToError({ model, providerError, status }) {
  const providerCode = providerError?.code || null;
  const providerType = providerError?.type || providerError?.name || null;
  const safeDetails = {
    providerCode,
    providerType,
  };

  if (status === 401 || status === 403) {
    return createAiRouterError("Konfigurasi akses provider AI tidak valid.", {
      code: AI_ERROR_CODES.AUTH,
      details: safeDetails,
      model,
      retryable: false,
      status: 503,
    });
  }

  if (status === 404) {
    return createAiRouterError("Model AI tidak tersedia pada provider.", {
      code: AI_ERROR_CODES.MODEL_UNAVAILABLE,
      details: safeDetails,
      model,
      retryable: true,
      status: 502,
    });
  }

  if (status === 429) {
    return createAiRouterError(
      "Provider AI sedang membatasi request. Coba lagi nanti.",
      {
        code: AI_ERROR_CODES.RATE_LIMITED,
        details: safeDetails,
        model,
        retryable: false,
        status: 429,
      },
    );
  }

  const retryable = [408, 500, 502, 503, 504].includes(Number(status));

  return createAiRouterError("Provider AI gagal memproses request.", {
    code: retryable ? AI_ERROR_CODES.PROVIDER : AI_ERROR_CODES.REQUEST,
    details: safeDetails,
    model,
    retryable,
    status: retryable ? 502 : 400,
  });
}

module.exports = {
  AI_ERROR_CODES,
  AiRouterError,
  createAiRouterError,
  isAiRouterError,
  mapOpenRouterStatusToError,
  sanitizeAiError,
};
