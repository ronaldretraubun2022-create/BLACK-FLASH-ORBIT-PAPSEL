const assert = require("node:assert");
const test = require("node:test");

const {
  AI_USE_CASES,
  generateCompletion,
} = require("../../server/services/ai/aiRouter");

function createProviderResponse({
  body,
  ok = true,
  status = 200,
  statusText = "OK",
}) {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
  };
}

function createSuccessBody({
  content = " Provider answer. ",
  finishReason = "stop",
  model = "openrouter/auto",
  usage = { completion_tokens: 4, prompt_tokens: 3, total_tokens: 7 },
} = {}) {
  return {
    choices: [
      {
        finish_reason: finishReason,
        message: {
          content,
        },
      },
    ],
    id: "chatcmpl-test",
    model,
    usage,
  };
}

async function withAiEnv(env, fn) {
  const originalFetch = global.fetch;
  const originalEnv = {};
  const keys = [
    "AI_ROUTER_MAX_ATTEMPTS",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_FALLBACK_MODELS",
  ];

  keys.forEach((key) => {
    originalEnv[key] = process.env[key];
  });
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });

  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
    keys.forEach((key) => {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    });
  }
}

function baseOptions(overrides = {}) {
  return {
    messages: [{ role: "user", content: "Hello" }],
    model: "openrouter/auto",
    requestId: "test-request",
    useCase: AI_USE_CASES.GENERAL_CHAT,
    ...overrides,
  };
}

test("AI Router returns successful OpenRouter response", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: createSuccessBody({ content: " Answer with citations. " }),
      });

    const result = await generateCompletion(baseOptions());

    assert.strictEqual(result.content, "Answer with citations.");
    assert.strictEqual(result.provider, "openrouter");
    assert.strictEqual(result.model, "openrouter/auto");
  });
});

test("AI Router rejects empty request messages with structured error", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () => {
      throw new Error("fetch should not run");
    };

    await assert.rejects(
      () => generateCompletion(baseOptions({ messages: [] })),
      (error) =>
        error.code === "AI_REQUEST_ERROR" &&
        error.statusCode === 400 &&
        error.retryable === false,
    );
  });
});

test("AI Router rejects invalid selected model with structured error", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () => {
      throw new Error("fetch should not run");
    };

    await assert.rejects(
      () => generateCompletion(baseOptions({ model: "invalid model id" })),
      (error) =>
        error.code === "AI_REQUEST_ERROR" &&
        error.statusCode === 400 &&
        error.retryable === false,
    );
  });
});

test("AI Router rejects empty provider response", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: createSuccessBody({ content: "" }),
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_INVALID_RESPONSE",
    );
  });
});

test("AI Router rejects whitespace provider response", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: createSuccessBody({ content: " \n\t " }),
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_INVALID_RESPONSE",
    );
  });
});

test("AI Router rejects malformed provider response", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { choices: [{}] },
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_INVALID_RESPONSE",
    );
  });
});

test("AI Router maps malformed JSON provider response", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_INVALID_RESPONSE",
    );
  });
});

test("AI Router maps provider 401 as auth error", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "invalid_api_key" } },
        ok: false,
        status: 401,
      });

    await assert.rejects(
      () =>
        generateCompletion(baseOptions({ fallbackModels: ["fallback/model"] })),
      (error) =>
        error.code === "AI_AUTH_ERROR" &&
        error.statusCode === 503 &&
        error.retryable === false,
    );
  });
});

test("AI Router maps provider 404 as model unavailable", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "model_not_found" } },
        ok: false,
        status: 404,
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_MODEL_UNAVAILABLE",
    );
  });
});

test("AI Router maps provider 429 as rate limited", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "rate_limited" } },
        ok: false,
        status: 429,
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_RATE_LIMITED" && error.statusCode === 429,
    );
  });
});

test("AI Router maps provider 500 as retryable provider error", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "server_error" } },
        ok: false,
        status: 500,
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => error.code === "AI_PROVIDER_ERROR" && error.retryable === true,
    );
  });
});

test("AI Router maps timeout", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });

    await assert.rejects(
      () => generateCompletion(baseOptions({ timeout: 5 })),
      (error) => error.code === "AI_TIMEOUT" && error.statusCode === 504,
    );
  });
});

test("AI Router fallback succeeds for configured alternate model", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    const requestedModels = [];
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      requestedModels.push(payload.model);

      if (payload.model === "missing/model") {
        return createProviderResponse({
          body: { error: { code: "model_not_found" } },
          ok: false,
          status: 404,
        });
      }

      return createProviderResponse({
        body: createSuccessBody({
          content: "Fallback answer",
          model: payload.model,
        }),
      });
    };

    const result = await generateCompletion(
      baseOptions({
        fallbackModels: ["fallback/model"],
        model: "missing/model",
      }),
    );

    assert.deepStrictEqual(requestedModels, [
      "missing/model",
      "fallback/model",
    ]);
    assert.strictEqual(result.content, "Fallback answer");
    assert.strictEqual(result.model, "fallback/model");
    assert.strictEqual(result.metadata.fallbackUsed, true);
  });
});

test("AI Router reports fallback exhaustion", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "model_not_found" } },
        ok: false,
        status: 404,
      });

    await assert.rejects(
      () =>
        generateCompletion(
          baseOptions({
            fallbackModels: ["fallback/model"],
            model: "missing/model",
          }),
        ),
      (error) => error.code === "AI_MODEL_UNAVAILABLE",
    );
  });
});

test("AI Router does not fallback on auth failure", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;

      return createProviderResponse({
        body: { error: { code: "invalid_api_key" } },
        ok: false,
        status: 401,
      });
    };

    await assert.rejects(
      () =>
        generateCompletion(
          baseOptions({
            fallbackModels: ["fallback/model"],
            model: "primary/model",
          }),
        ),
      (error) => error.code === "AI_AUTH_ERROR",
    );
    assert.strictEqual(callCount, 1);
  });
});

test("AI Router records selected model metadata", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);

      return createProviderResponse({
        body: createSuccessBody({ model: payload.model }),
      });
    };

    const result = await generateCompletion(
      baseOptions({ model: "custom/model" }),
    );

    assert.strictEqual(result.model, "custom/model");
    assert.strictEqual(result.metadata.requestedModel, "custom/model");
    assert.strictEqual(result.metadata.resolvedModel, "custom/model");
  });
});

test("AI Router normalizes usage metadata", async () => {
  await withAiEnv({ OPENROUTER_API_KEY: "test-openrouter-key" }, async () => {
    const usage = {
      completion_tokens: 8,
      prompt_tokens: 5,
      total_tokens: 13,
    };
    global.fetch = async () =>
      createProviderResponse({
        body: createSuccessBody({ usage }),
      });

    const result = await generateCompletion(baseOptions());

    assert.deepStrictEqual(result.usage, usage);
    assert.strictEqual(result.finishReason, "stop");
  });
});

test("AI Router public error never includes API key", async () => {
  const secretKey = "sk-or-v1-super-secret-router-test-key";

  await withAiEnv({ OPENROUTER_API_KEY: secretKey }, async () => {
    global.fetch = async () =>
      createProviderResponse({
        body: { error: { code: "invalid_api_key" } },
        ok: false,
        status: 401,
      });

    await assert.rejects(
      () => generateCompletion(baseOptions()),
      (error) => !JSON.stringify(error).includes(secretKey),
    );
  });
});
