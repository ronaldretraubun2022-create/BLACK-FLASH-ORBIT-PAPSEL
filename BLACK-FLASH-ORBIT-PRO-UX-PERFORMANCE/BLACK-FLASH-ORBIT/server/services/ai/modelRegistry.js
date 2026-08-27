const AI_USE_CASES = {
  GENERAL_CHAT: "GENERAL_CHAT",
  KNOWLEDGE_CHAT: "KNOWLEDGE_CHAT",
  NEWSROOM: "NEWSROOM",
};

const DEFAULT_MODELS = {
  [AI_USE_CASES.GENERAL_CHAT]: "openrouter/auto",
  [AI_USE_CASES.KNOWLEDGE_CHAT]: "openrouter/auto",
  [AI_USE_CASES.NEWSROOM]: "deepseek/deepseek-chat",
};

const FALLBACK_ENV_KEYS = {
  [AI_USE_CASES.GENERAL_CHAT]: [
    "AI_CHAT_FALLBACK_MODELS",
    "OPENROUTER_FALLBACK_MODELS",
  ],
  [AI_USE_CASES.KNOWLEDGE_CHAT]: [
    "KNOWLEDGE_CHAT_FALLBACK_MODELS",
    "OPENROUTER_FALLBACK_MODELS",
  ],
  [AI_USE_CASES.NEWSROOM]: [
    "NEWSROOM_AI_FALLBACK_MODELS",
    "OPENROUTER_FALLBACK_MODELS",
  ],
};

const MODEL_ENV_KEYS = {
  [AI_USE_CASES.GENERAL_CHAT]: ["OPENROUTER_MODEL"],
  [AI_USE_CASES.KNOWLEDGE_CHAT]: ["KNOWLEDGE_CHAT_MODEL", "OPENROUTER_MODEL"],
  [AI_USE_CASES.NEWSROOM]: ["NEWSROOM_AI_MODEL", "OPENROUTER_MODEL"],
};

function normalizeUseCase(useCase) {
  return Object.values(AI_USE_CASES).includes(useCase)
    ? useCase
    : AI_USE_CASES.GENERAL_CHAT;
}

function normalizeModelId(value) {
  if (typeof value !== "string") return "";

  const model = value.trim();
  if (!model || /^(null|undefined)$/i.test(model)) return "";

  return model.slice(0, 120);
}

function isValidModelId(value) {
  const model = normalizeModelId(value);

  if (!model) return false;
  if (/[\x00-\x1f\x7f]/.test(model)) return false;
  if (/\s/.test(model)) return false;

  return true;
}

function parseModelList(value) {
  return String(value || "")
    .split(",")
    .map(normalizeModelId)
    .filter(isValidModelId);
}

function getFirstConfiguredModel(envKeys) {
  for (const key of envKeys) {
    const model = normalizeModelId(process.env[key]);

    if (isValidModelId(model)) return model;
  }

  return "";
}

function getConfiguredFallbackModels(useCase) {
  const normalizedUseCase = normalizeUseCase(useCase);
  const envKeys = FALLBACK_ENV_KEYS[normalizedUseCase] || [];

  return envKeys.flatMap((key) => parseModelList(process.env[key]));
}

function dedupeModels(models) {
  const seen = new Set();
  const deduped = [];

  models.forEach((model) => {
    const normalizedModel = normalizeModelId(model);
    const key = normalizedModel.toLowerCase();

    if (!isValidModelId(normalizedModel) || seen.has(key)) return;

    seen.add(key);
    deduped.push(normalizedModel);
  });

  return deduped;
}

function resolveModel({ model, useCase } = {}) {
  const normalizedUseCase = normalizeUseCase(useCase);
  const requestedModel = normalizeModelId(model);

  if (isValidModelId(requestedModel)) return requestedModel;

  return (
    getFirstConfiguredModel(MODEL_ENV_KEYS[normalizedUseCase]) ||
    DEFAULT_MODELS[normalizedUseCase]
  );
}

function getModelCandidates({ fallbackModels = [], model, useCase } = {}) {
  const primaryModel = resolveModel({ model, useCase });

  return dedupeModels([
    primaryModel,
    ...fallbackModels,
    ...getConfiguredFallbackModels(useCase),
  ]);
}

function isValidOpenRouterModel(model) {
  const normalizedModel = normalizeModelId(model);

  if (!isValidModelId(normalizedModel)) return false;

  return !/:(?:free)\b/i.test(normalizedModel);
}

function getLegacyNewsroomModels() {
  const configured = normalizeModelId(process.env.OPENROUTER_MODEL);
  const newsroomDefault = DEFAULT_MODELS[AI_USE_CASES.NEWSROOM];

  if (!isValidOpenRouterModel(configured)) {
    return [newsroomDefault];
  }

  return dedupeModels([newsroomDefault, configured]);
}

module.exports = {
  AI_USE_CASES,
  DEFAULT_MODELS,
  getConfiguredFallbackModels,
  getLegacyNewsroomModels,
  getModelCandidates,
  isValidModelId,
  isValidOpenRouterModel,
  normalizeModelId,
  resolveModel,
};
