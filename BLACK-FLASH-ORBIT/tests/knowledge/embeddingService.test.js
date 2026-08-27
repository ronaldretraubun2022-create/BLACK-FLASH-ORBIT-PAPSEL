const assert = require("node:assert");
const test = require("node:test");

const { loadModuleWithMocks } = require("./testUtils");

const servicePath = "../../server/services/knowledge/embeddingService";

function loadEmbeddingService() {
  return loadModuleWithMocks(servicePath, {});
}

test("createEmbeddings batches inputs and returns OpenAI embeddings", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const calls = [];

  process.env.OPENAI_API_KEY = "test-openai-key";
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload.input);

    return {
      ok: true,
      json: async () => ({
        data: payload.input.map((input, index) => ({
          embedding: [input.length, index, 1],
          index,
        })),
      }),
    };
  };

  try {
    const { createEmbeddings } = loadEmbeddingService();
    const embeddings = await createEmbeddings([
      "alpha",
      "beta",
      "gamma",
      "delta",
    ]);

    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], ["alpha", "beta", "gamma", "delta"]);
    assert.strictEqual(embeddings.length, 4);
    assert.deepStrictEqual(embeddings[0], [5, 0, 1]);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("createChatCompletion returns trimmed response text", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalChatModel = process.env.KNOWLEDGE_CHAT_MODEL;
  const originalChatProvider = process.env.KNOWLEDGE_CHAT_PROVIDER;

  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.KNOWLEDGE_CHAT_MODEL = "openrouter/auto";
  process.env.KNOWLEDGE_CHAT_PROVIDER = "openrouter";
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);

    assert.match(url, /openrouter\.ai\/api\/v1\/chat\/completions$/);
    assert.strictEqual(payload.model, "openrouter/auto");

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "  Answer with citations.  ",
            },
          },
        ],
      }),
    };
  };

  try {
    const { createChatCompletion } = loadEmbeddingService();
    const answer = await createChatCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    assert.strictEqual(answer, "Answer with citations.");
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;

    if (originalChatModel === undefined) {
      delete process.env.KNOWLEDGE_CHAT_MODEL;
    } else {
      process.env.KNOWLEDGE_CHAT_MODEL = originalChatModel;
    }

    if (originalChatProvider === undefined) {
      delete process.env.KNOWLEDGE_CHAT_PROVIDER;
    } else {
      process.env.KNOWLEDGE_CHAT_PROVIDER = originalChatProvider;
    }
  }
});

test("createChatCompletion fails safely when OpenRouter key is missing", async () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalChatProvider = process.env.KNOWLEDGE_CHAT_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
  process.env.KNOWLEDGE_CHAT_PROVIDER = "openrouter";

  try {
    const { createChatCompletion, getKnowledgeChatProviderStatus } =
      loadEmbeddingService();
    const status = getKnowledgeChatProviderStatus();

    assert.strictEqual(status.configured, false);
    assert.strictEqual(status.code, "KNOWLEDGE_CHAT_PROVIDER_NOT_CONFIGURED");
    await assert.rejects(
      () =>
        createChatCompletion({
          messages: [{ role: "user", content: "Hello" }],
        }),
      (error) => error.code === "KNOWLEDGE_CHAT_PROVIDER_NOT_CONFIGURED",
    );
  } finally {
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;

    if (originalChatProvider === undefined) {
      delete process.env.KNOWLEDGE_CHAT_PROVIDER;
    } else {
      process.env.KNOWLEDGE_CHAT_PROVIDER = originalChatProvider;
    }
  }
});

test("createEmbedding fails fast when api key missing", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = "openai";

  try {
    const { createEmbedding } = loadEmbeddingService();

    await assert.rejects(
      () => createEmbedding("question"),
      (error) => error.code === "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    );
  } finally {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;

    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
    } else {
      process.env.KNOWLEDGE_EMBEDDING_PROVIDER = originalProvider;
    }
  }
});

test("embedding provider normalizes quoted Bearer api key", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
  let authorizationHeader = "";

  process.env.OPENAI_API_KEY = '"Bearer test-openai-key"';
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = "openai";
  global.fetch = async (_url, options) => {
    authorizationHeader = options.headers.Authorization;

    return {
      ok: true,
      json: async () => ({
        data: [
          {
            embedding: [1, 2, 3],
            index: 0,
          },
        ],
      }),
    };
  };

  try {
    const { createEmbedding } = loadEmbeddingService();
    const embedding = await createEmbedding("credential normalization test");

    assert.deepStrictEqual(embedding, [1, 2, 3]);
    assert.strictEqual(authorizationHeader, "Bearer test-openai-key");
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;

    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
    } else {
      process.env.KNOWLEDGE_EMBEDDING_PROVIDER = originalProvider;
    }
  }
});

test("embedding provider validation rejects unsupported providers safely", async () => {
  const originalProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = "openrouter";

  try {
    const { createEmbedding, getEmbeddingProviderStatus } =
      loadEmbeddingService();
    const status = getEmbeddingProviderStatus();

    assert.strictEqual(status.configured, false);
    assert.strictEqual(status.code, "EMBEDDING_PROVIDER_UNSUPPORTED");
    await assert.rejects(
      () => createEmbedding("question"),
      (error) => error.code === "EMBEDDING_PROVIDER_UNSUPPORTED",
    );
  } finally {
    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
    } else {
      process.env.KNOWLEDGE_EMBEDDING_PROVIDER = originalProvider;
    }
  }
});

test("embedding provider maps rate limits to a safe error code", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = "openai";
  global.fetch = async () => ({
    ok: false,
    status: 429,
  });

  try {
    const { createEmbedding } = loadEmbeddingService();

    await assert.rejects(
      () => createEmbedding("rate limit test"),
      (error) =>
        error.code === "KNOWLEDGE_PROVIDER_RATE_LIMITED" &&
        error.statusCode === 429,
    );
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;

    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
    } else {
      process.env.KNOWLEDGE_EMBEDDING_PROVIDER = originalProvider;
    }
  }
});

test("embedding provider maps invalid credentials safely", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
  process.env.OPENAI_API_KEY = "invalid-openai-key";
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = "openai";
  global.fetch = async () => ({
    ok: false,
    status: 401,
  });

  try {
    const { createEmbedding } = loadEmbeddingService();

    await assert.rejects(
      () => createEmbedding("credential validation test"),
      (error) =>
        error.code === "EMBEDDING_PROVIDER_AUTH_FAILED" &&
        error.statusCode === 503,
    );
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;

    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_EMBEDDING_PROVIDER;
    } else {
      process.env.KNOWLEDGE_EMBEDDING_PROVIDER = originalProvider;
    }
  }
});
