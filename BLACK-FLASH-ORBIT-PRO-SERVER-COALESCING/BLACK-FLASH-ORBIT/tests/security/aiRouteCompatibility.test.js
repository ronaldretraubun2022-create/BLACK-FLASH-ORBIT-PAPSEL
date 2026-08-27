const assert = require("node:assert");
const express = require("express");
const test = require("node:test");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

function createJsonApp(routePath, mountPath, mocks) {
  const route = loadModuleWithMocks(routePath, mocks);
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(mountPath, route);

  return app;
}

function createAuthMiddleware() {
  return function requireTestAuth(req, res, next) {
    const authorization = String(req.headers.authorization || "").trim();

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    req.user = {
      email: "reporter@example.com",
      id: "user-1",
    };
    req.userId = "user-1";
    req.userEmail = "reporter@example.com";

    return next();
  };
}

test("POST /api/ai/newsroom preserves response schema through AI Router wrapper", async () => {
  const app = createJsonApp(
    "../../server/routes/newsroom",
    "/api/ai/newsroom",
    {
      "../middleware/requireAuth": {
        requireAuth: createAuthMiddleware(),
      },
      "../services/openrouter": {
        generateNewsroomCompletion: async () => ({
          content: "Provider newsroom draft.",
          metadata: {
            durationMs: 12,
            fallbackUsed: false,
          },
          model: "resolved/newsroom-model",
          provider: "openrouter",
        }),
      },
    },
  );
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/ai/newsroom", {
      body: JSON.stringify({
        audience: "Masyarakat",
        complexity: "Strategic",
        layer: "Editorial Layer",
        mode: "Artikel Berita",
        topic: "Pemprov memperkuat layanan publik digital.",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.match(result.body.draft, /Provider newsroom draft/);
    assert(result.body.evidence);
    assert(Array.isArray(result.body.factClassifications));
    assert(result.body.sourceQuality);
    assert(result.body.confidenceAnalysis);
    assert(result.body.confidence);
    assert(result.body.metadata);
    assert.strictEqual(result.body.metadata.promptVersion, "newsroom-v2");
  } finally {
    await server.close();
  }
});

test("POST /api/ai/chat preserves public response contract through AI Router", async () => {
  const {
    getOperationalIntelligence,
  } = require("../../server/services/observability/operationalTelemetry");

  const app = createJsonApp("../../server/routes/ai", "/api/ai", {
    "../lib/orbitKnowledge": {
      buildOrbitKnowledgeContext: async () => "",
    },
    "../lib/orbitMemory": {
      buildOrbitMemoryContext: async () => "",
      containsSensitiveData: () => false,
    },
    "../lib/orbitRuntimeContext": {
      buildOrbitRuntimeContext: () => "",
    },
    "../lib/supabase": null,
    "../services/ai/aiRouter": {
      AI_USE_CASES: {
        GENERAL_CHAT: "GENERAL_CHAT",
      },
      generateCompletion: async () => ({
        content: "Router chat answer.",
        metadata: {
          durationMs: 12,
        },
        model: "resolved/model",
        provider: "openrouter",
      }),
    },
    "@supabase/supabase-js": {
      createClient: () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                email: "reporter@example.com",
                id: "user-1",
              },
            },
            error: null,
          }),
        },
      }),
    },
  });
  const server = await startServer(app);
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test.anon.key";

  try {
    const result = await requestJson(server.baseUrl, "/api/ai/chat", {
      body: JSON.stringify({
        message: "Halo Orbit",
        sessionId: "session-1",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.body, {
      model: "resolved/model",
      response: "Router chat answer.",
      success: true,
    });

    const telemetry = getOperationalIntelligence();
    assert.strictEqual(telemetry.aiChat.latest.providerReached, true);
    assert.strictEqual(telemetry.aiChat.latest.provider, "openrouter");
    assert.strictEqual(telemetry.aiChat.latest.status, "success");
    assert(Number.isFinite(telemetry.aiChat.latest.providerLatencyMs));
  } finally {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }

    await server.close();
  }
});

test("POST /api/ai/chat accepts legacy payload without sessionId and reaches AI Router", async () => {
  let observedRequestId = "";

  const app = createJsonApp("../../server/routes/ai", "/api/ai", {
    "../lib/orbitKnowledge": {
      buildOrbitKnowledgeContext: async () => "",
    },
    "../lib/orbitMemory": {
      buildOrbitMemoryContext: async () => "",
      containsSensitiveData: () => false,
    },
    "../lib/orbitRuntimeContext": {
      buildOrbitRuntimeContext: () => "",
    },
    "../lib/supabase": null,
    "../services/ai/aiRouter": {
      AI_USE_CASES: {
        GENERAL_CHAT: "GENERAL_CHAT",
      },
      generateCompletion: async (options) => {
        observedRequestId = options.requestId;

        return {
          content: "Router legacy chat answer.",
          model: "resolved/model",
          provider: "openrouter",
        };
      },
    },
    "@supabase/supabase-js": {
      createClient: () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                email: "reporter@example.com",
                id: "user-1",
              },
            },
            error: null,
          }),
        },
      }),
    },
  });
  const server = await startServer(app);
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test.anon.key";

  try {
    const result = await requestJson(server.baseUrl, "/api/ai/chat", {
      body: JSON.stringify({
        message: "Halo Orbit legacy",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.response, "Router legacy chat answer.");
    assert.strictEqual(observedRequestId, "legacy-ai-chat");
  } finally {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }

    await server.close();
  }
});

test("POST /api/knowledge/ask remains compatible", async () => {
  const app = createJsonApp(
    "../../server/routes/knowledge.routes",
    "/api/knowledge",
    {
      "../middleware/requireSupabaseAuth": {
        requireSupabaseAuth: createAuthMiddleware(),
      },
      "../services/knowledge/ragService": {
        answerKnowledgeQuestion: async () => ({
          answer: "Knowledge answer.",
          citations: [],
          confidence: 88,
          context: [],
          mode: "rag-api",
          retrievedChunks: 1,
          retrievedContext: [],
          verificationRequired: false,
        }),
        getKnowledgeRetrievalStats: async () => ({
          chunkCount: 1,
          documentCount: 1,
        }),
      },
    },
  );
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/knowledge/ask", {
      body: JSON.stringify({ question: "Apa isi dokumen?" }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.data.answer, "Knowledge answer.");
    assert.strictEqual(result.body.data.confidence, 88);
  } finally {
    await server.close();
  }
});

test("GET /api/v1/health remains public", async () => {
  const app = require("../../server/index");
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/health");

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.module, "health");
    assert.ok(result.body.runtime);
  } finally {
    await server.close();
  }
});
