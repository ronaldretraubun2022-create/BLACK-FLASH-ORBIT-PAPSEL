function createAiResponseError(
  reason,
  {
    code = "AI_PROVIDER_INVALID_RESPONSE",
    message = "Provider AI mengembalikan respons tidak valid.",
    statusCode = 502,
  } = {},
) {
  const error = new Error(message);

  error.code = code;
  error.reason = reason;
  error.statusCode = statusCode;

  return error;
}

function normalizeAiResponseContent(response, options = {}) {
  const {
    code = "AI_PROVIDER_INVALID_RESPONSE",
    message = "Provider AI mengembalikan respons tidak valid.",
  } = options;

  if (response === null) {
    throw createAiResponseError("null_response", { code, message });
  }

  if (response === undefined) {
    throw createAiResponseError("undefined_response", { code, message });
  }

  if (!Array.isArray(response?.choices) || response.choices.length === 0) {
    throw createAiResponseError("missing_choices", { code, message });
  }

  const firstChoice = response.choices[0];

  if (!firstChoice?.message || typeof firstChoice.message !== "object") {
    throw createAiResponseError("missing_message", { code, message });
  }

  if (!Object.prototype.hasOwnProperty.call(firstChoice.message, "content")) {
    throw createAiResponseError("missing_content", { code, message });
  }

  const content = firstChoice.message.content;

  if (content === null) {
    throw createAiResponseError("null_content", { code, message });
  }

  if (content === undefined) {
    throw createAiResponseError("undefined_content", { code, message });
  }

  if (typeof content !== "string") {
    throw createAiResponseError("non_string_content", { code, message });
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw createAiResponseError("empty_content", { code, message });
  }

  return normalizedContent;
}

module.exports = {
  createAiResponseError,
  normalizeAiResponseContent,
};
