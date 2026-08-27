const {
  getOpenRouterProviderStatus,
} = require("./providers/openrouterProvider");
const { getModelCandidates, isValidModelId } = require("./modelRegistry");

function getProviderCapability({ fallbackModels = [], model, useCase } = {}) {
  const providerStatus = getOpenRouterProviderStatus();
  const modelCandidates = getModelCandidates({
    fallbackModels,
    model,
    useCase,
  });

  return {
    fallbackEligibleModels: modelCandidates.filter(isValidModelId),
    modelConfigured: modelCandidates.length > 0,
    primaryModel: modelCandidates[0] || null,
    provider: providerStatus.provider,
    providerConfigured: providerStatus.configured,
    providerCode: providerStatus.code,
  };
}

module.exports = {
  getProviderCapability,
};
