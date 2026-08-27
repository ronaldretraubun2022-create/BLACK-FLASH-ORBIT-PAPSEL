const { getAudienceProfile } = require("./audienceRegistry");
const {
  getChannelTarget,
  isValidChannelId,
  normalizeChannelId,
} = require("./channelRegistry");
const { getComplexityLevel } = require("./complexityRegistry");

const PROMPT_VERSION = "newsroom-v2";
const DEFAULT_LANGUAGE = "id-ID";

function sanitizeContractText(value, maxLength = 12000) {
  return String(value || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((source) => {
      if (typeof source === "string") {
        const label = sanitizeContractText(source, 240);
        return label ? { label, type: "user_provided" } : null;
      }

      if (!source || typeof source !== "object") return null;

      const label = sanitizeContractText(
        source.label || source.title || source.name,
        240,
      );
      const type = sanitizeContractText(
        source.type || source.sourceType || "user_provided",
        80,
      );

      return label ? { label, type } : null;
    })
    .filter(Boolean)
    .slice(0, 12);
}

function createPromptContract(input = {}) {
  const topic = sanitizeContractText(input.topic || input.input, 3000);
  const sourceText = sanitizeContractText(
    input.sourceText || input.source || "",
    12000,
  );
  const mode = sanitizeContractText(input.mode, 120);
  const layer = sanitizeContractText(input.layer, 120);
  const language = sanitizeContractText(input.language || DEFAULT_LANGUAGE, 40);
  const additionalInstructions = sanitizeContractText(
    input.additionalInstructions,
    2000,
  );
  const audienceProfile = getAudienceProfile(input.audience);
  const complexityLevel = getComplexityLevel(input.complexity);
  const rawChannel = sanitizeContractText(input.channel, 80);
  const channelId = normalizeChannelId(input.channel, mode);
  const channelTarget = getChannelTarget(channelId, mode);
  const sources = normalizeSources(input.sources);

  if (!topic) {
    const error = new Error("Topic harus berupa teks dan tidak boleh kosong.");
    error.code = "NEWSROOM_CONTRACT_INVALID_TOPIC";
    error.statusCode = 400;
    throw error;
  }

  if (!mode) {
    const error = new Error("Mode harus berupa teks dan tidak boleh kosong.");
    error.code = "NEWSROOM_CONTRACT_INVALID_MODE";
    error.statusCode = 400;
    throw error;
  }

  if (!audienceProfile) {
    const error = new Error("Audience tidak dikenal.");
    error.code = "NEWSROOM_CONTRACT_INVALID_AUDIENCE";
    error.statusCode = 400;
    throw error;
  }

  if (!complexityLevel) {
    const error = new Error("Complexity tidak dikenal.");
    error.code = "NEWSROOM_CONTRACT_INVALID_COMPLEXITY";
    error.statusCode = 400;
    throw error;
  }

  if (rawChannel && !isValidChannelId(rawChannel)) {
    const error = new Error("Channel tidak dikenal.");
    error.code = "NEWSROOM_CONTRACT_INVALID_CHANNEL";
    error.statusCode = 400;
    throw error;
  }

  return {
    additionalInstructions,
    audience: audienceProfile.id,
    audienceProfile,
    channel: channelTarget.id,
    channelTarget,
    complexity: complexityLevel.id,
    complexityLevel,
    factGuard: input.factGuard !== false,
    citationEngine: input.citationEngine !== false,
    sourceConfidence: input.sourceConfidence !== false,
    language,
    layer,
    mode,
    promptVersion: PROMPT_VERSION,
    sourceText,
    sources,
    topic,
  };
}

module.exports = {
  DEFAULT_LANGUAGE,
  PROMPT_VERSION,
  createPromptContract,
  sanitizeContractText,
};
