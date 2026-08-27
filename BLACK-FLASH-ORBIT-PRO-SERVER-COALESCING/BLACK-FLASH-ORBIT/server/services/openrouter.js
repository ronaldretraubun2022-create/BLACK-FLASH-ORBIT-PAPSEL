const { generateCompletion, AI_USE_CASES } = require("./ai/aiRouter");
const {
  getLegacyNewsroomModels,
  isValidOpenRouterModel,
  normalizeModelId,
} = require("./ai/modelRegistry");

const NEWSROOM_SYSTEM_PROMPT =
  "Anda adalah agen AI newsroom profesional. Tulis dengan nada profesional, jelas, dan gunakan bahasa Indonesia. Jangan membuat klaim fakta tanpa peringatan verifikasi. Jangan menyertakan tahun, kuartal, triwulan, atau jadwal rinci kecuali diminta oleh pengguna. Gunakan referensi sumber generik jika sumber spesifik tidak tersedia.";

function normalizeOpenRouterModel(rawModel) {
  return normalizeModelId(rawModel);
}

function getOpenRouterModels() {
  return getLegacyNewsroomModels();
}

async function generateWithOpenRouter(prompt, options = {}) {
  const result = await generateNewsroomCompletion({
    maxTokens: options.maxTokens,
    metadata: options.metadata,
    model: options.model,
    requestId: options.requestId,
    systemPrompt: options.systemPrompt || NEWSROOM_SYSTEM_PROMPT,
    temperature: options.temperature,
    timeout: options.timeout,
    userPrompt: prompt,
  });

  return result.content;
}

async function generateNewsroomCompletion({
  maxTokens = 1500,
  metadata,
  model,
  requestId,
  systemPrompt = NEWSROOM_SYSTEM_PROMPT,
  temperature = 0.2,
  timeout = 45000,
  userPrompt,
} = {}) {
  return generateCompletion({
    maxTokens,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    metadata,
    model,
    requestId,
    systemPrompt,
    temperature,
    timeout,
    useCase: AI_USE_CASES.NEWSROOM,
  });
}

module.exports = {
  generateNewsroomCompletion,
  generateWithOpenRouter,
  getOpenRouterModels,
  isValidOpenRouterModel,
  normalizeOpenRouterModel,
};
