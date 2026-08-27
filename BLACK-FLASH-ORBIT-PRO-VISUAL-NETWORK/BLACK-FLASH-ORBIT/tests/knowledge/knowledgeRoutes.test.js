const assert = require("node:assert");
const express = require("express");
const test = require("node:test");

const {
  createAuthHeader,
  createMultipartFile,
  loadModuleWithMocks,
  requestJson,
  resolveKnowledgeRoutePath,
  startServer,
} = require("./testUtils");

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

    return next();
  };
}

function createMockKnowledgeService() {
  return {
    answerKnowledgeQuestion: async () => ({
      answer: "Answer with verified citations.",
      citations: [
        {
          id: "cit-1",
          label: "S1: Report",
          locator: "Page 2",
          quote: "Verified source chunk from report.",
          reliability: "High",
        },
      ],
      confidence: 91,
      context: [
        {
          chunks: ["Verified source chunk from report."],
          id: "doc-1",
          score: 91,
          source: "Editorial Desk",
          title: "Report",
        },
      ],
      mode: "rag-api",
      retrievedChunks: 1,
      retrievedContext: [
        {
          chunks: ["Verified source chunk from report."],
          id: "doc-1",
          score: 91,
          source: "Editorial Desk",
          title: "Report",
        },
      ],
      verificationRequired: false,
    }),
    deleteKnowledgeForUser: async ({ documentId }) => ({ id: documentId }),
    getKnowledgeDocumentForUser: async ({ documentId }) => ({
      chunkCount: 1,
      contextChunks: ["Verified source chunk from report."],
      id: documentId,
      ownerId: "user-1",
      status: "indexed",
      title: "Uploaded Report",
    }),
    getKnowledgeRetrievalStats: async () => ({
      chunkCount: 3,
      documentCount: 1,
    }),
    indexTextKnowledge: async () => ({
      chunksIndexed: 2,
      document: {
        createdAt: "2026-07-07T00:00:00Z",
        fileName: "report.txt",
        fileType: "txt",
        id: "doc-1",
        ownerId: "user-1",
        sourceLabel: "Editorial Desk",
        status: "indexed",
        storagePath: "user-1/doc-1/report.txt",
        title: "Uploaded Report",
        updatedAt: "2026-07-07T00:00:00Z",
      },
    }),
    indexUploadedKnowledge: async () => ({
      chunksIndexed: 3,
      document: {
        createdAt: "2026-07-07T00:00:00Z",
        fileName: "upload.pdf",
        fileType: "pdf",
        id: "doc-2",
        ownerId: "user-1",
        sourceLabel: "Upload Desk",
        status: "indexed",
        storagePath: "user-1/doc-2/upload.pdf",
        title: "Upload Document",
        updatedAt: "2026-07-07T00:00:00Z",
      },
    }),
    listKnowledgeForUser: async () => [
      {
        createdAt: "2026-07-07T00:00:00Z",
        fileName: "report.txt",
        fileType: "txt",
        id: "doc-1",
        ownerId: "user-1",
        sourceLabel: "Editorial Desk",
        status: "indexed",
        storagePath: "user-1/doc-1/report.txt",
        title: "Uploaded Report",
        updatedAt: "2026-07-07T00:00:00Z",
      },
    ],
    searchKnowledgeForUser: async () => [
      {
        id: "doc-1",
        ownerId: "user-1",
        status: "indexed",
        title: "Uploaded Report",
      },
    ],
  };
}

function loadKnowledgeRoutes({ serviceOverrides = {}, useRealService = false } = {}) {
  const serviceMock = useRealService
    ? null
    : {
        ...createMockKnowledgeService(),
        ...serviceOverrides,
      };
  const canonicalRoutePath = resolveKnowledgeRoutePath("knowledgeRoutes.js");
  const routePath = resolveKnowledgeRoutePath("knowledge.routes.js");
  delete require.cache[require.resolve(canonicalRoutePath)];

  if (useRealService) {
    try {
      delete require.cache[require.resolve("../../server/services/knowledge/ragService")];
    } catch {
      // Ignore when the module has not been loaded yet.
    }
  }
  const route = loadModuleWithMocks(routePath, {
    "../middleware/requireSupabaseAuth": {
      requireSupabaseAuth: createAuthMiddleware(),
    },
    ...(serviceMock
      ? {
          "../services/knowledge/ragService": serviceMock,
        }
      : {}),
  });

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/v1/knowledge", route);

  return app;
}

test("knowledge routes reject missing authorization header", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/documents");

    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.body.message, "Missing bearer token.");
  } finally {
    await server.close();
  }
});

test("GET /api/v1/knowledge/documents returns owner documents", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/documents", {
      headers: createAuthHeader(),
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.mode, "rag-api");
    assert.strictEqual(result.body.data.length, 1);
    assert.strictEqual(result.body.data[0].title, "Uploaded Report");
    assert.strictEqual(result.body.meta.chunkCount, 3);
    assert.strictEqual(result.body.meta.documentCount, 1);
  } finally {
    await server.close();
  }
});

test("GET /api/v1/knowledge/search returns owner-scoped documents", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(
      server.baseUrl,
      "/api/v1/knowledge/search?q=report",
      {
        headers: createAuthHeader(),
      },
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.mode, "rag-api");
    assert.strictEqual(result.body.data.length, 1);
    assert.strictEqual(result.body.data[0].ownerId, "user-1");
  } finally {
    await server.close();
  }
});

test("POST /api/v1/knowledge/ask returns answer and verification payload", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/ask", {
      body: JSON.stringify({ question: "What is in the report?" }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.data.answer, "Answer with verified citations.");
    assert(Array.isArray(result.body.data.retrievedContext));
    assert(Array.isArray(result.body.data.citations));
    assert.strictEqual(result.body.data.confidence, 91);
    assert.strictEqual(result.body.data.verificationRequired, false);
  } finally {
    await server.close();
  }
});

test("GET /api/v1/knowledge/documents/:id returns owner-scoped preview", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(
      server.baseUrl,
      "/api/v1/knowledge/documents/doc-1",
      {
        headers: createAuthHeader(),
      },
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.id, "doc-1");
    assert.strictEqual(result.body.data.chunkCount, 1);
    assert.deepStrictEqual(result.body.data.contextChunks, [
      "Verified source chunk from report.",
    ]);
  } finally {
    await server.close();
  }
});

test("POST /api/v1/knowledge/upload accepts authenticated upload requests", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/upload", {
      body: createMultipartFile({
        content: "Knowledge upload content",
        filename: "report.txt",
        mimeType: "text/plain",
      }),
      headers: createAuthHeader(),
      method: "POST",
    });

    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.body.data.title, "Upload Document");
    assert.strictEqual(result.body.chunksIndexed, 3);
  } finally {
    await server.close();
  }
});

test("POST /api/v1/knowledge/upload returns safe provider configuration error", async () => {
  const app = loadKnowledgeRoutes({
    serviceOverrides: {
      indexUploadedKnowledge: async () => {
        const error = new Error(
          "Embedding provider belum dikonfigurasi pada backend.",
        );
        error.code = "EMBEDDING_PROVIDER_NOT_CONFIGURED";
        error.statusCode = 503;
        throw error;
      },
    },
  });
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/upload", {
      body: createMultipartFile({
        content: "Knowledge upload content",
        filename: "report.txt",
        mimeType: "text/plain",
      }),
      headers: createAuthHeader(),
      method: "POST",
    });

    assert.strictEqual(result.status, 503);
    assert.strictEqual(result.body.success, false);
    assert.strictEqual(
      result.body.code,
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    );
    assert.match(result.body.message, /Embedding provider/);
  } finally {
    await server.close();
  }
});

test("POST /api/v1/knowledge/upload rejects files over 10 MB", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);
  const oversized = "a".repeat(10 * 1024 * 1024 + 1);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/upload", {
      body: createMultipartFile({
        content: oversized,
        filename: "big.txt",
        mimeType: "text/plain",
      }),
      headers: createAuthHeader(),
      method: "POST",
    });

    assert.strictEqual(result.status, 413);
    assert.match(result.body.message, /10 MB/);
  } finally {
    await server.close();
  }
});

test("POST /api/v1/knowledge/upload rejects unsupported file types", async () => {
  const app = loadKnowledgeRoutes({ useRealService: true });
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/v1/knowledge/upload", {
      body: createMultipartFile({
        content: "binary",
        filename: "malware.exe",
        mimeType: "application/octet-stream",
      }),
      headers: createAuthHeader(),
      method: "POST",
    });

    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.body.code, "knowledge_upload_type_unsupported");
  } finally {
    await server.close();
  }
});

test("DELETE /api/v1/knowledge/documents/:id deletes owner document", async () => {
  const app = loadKnowledgeRoutes();
  const server = await startServer(app);

  try {
    const result = await requestJson(
      server.baseUrl,
      "/api/v1/knowledge/documents/doc-1",
      {
        headers: createAuthHeader(),
        method: "DELETE",
      },
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.id, "doc-1");
  } finally {
    await server.close();
  }
});
