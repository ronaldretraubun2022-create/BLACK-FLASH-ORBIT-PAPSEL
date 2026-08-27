const assert = require("node:assert");
const test = require("node:test");

const { loadModuleWithMocks } = require("./testUtils");

function loadRagService(overrides = {}) {
  return loadModuleWithMocks("../../server/services/knowledge/ragService", {
    "./chunkText": {
      chunkText: overrides.chunkText || ((text) => [
        {
          chunkIndex: 0,
          content: String(text).slice(0, 120),
          tokenCount: 30,
        },
      ]),
    },
    "./documentParser": {
      parseUploadedDocument:
        overrides.parseUploadedDocument ||
        (async () => ({
          extension: ".txt",
          text: "Primary knowledge document content",
        })),
      sanitizeExtractedText:
        overrides.sanitizeExtractedText ||
        ((value) => String(value || "").trim()),
    },
    "./embeddingService": {
      createChatCompletion:
        overrides.createChatCompletion ||
        (async () => "Answer with verified citations."),
      createEmbedding:
        overrides.createEmbedding || (async () => [0.1, 0.2, 0.3]),
      createEmbeddings:
        overrides.createEmbeddings ||
        (async (inputs) => inputs.map((input, index) => [index, input.length])),
      getEmbeddingProviderStatus:
        overrides.getEmbeddingProviderStatus ||
        (() => ({
          code: null,
          configured: true,
          embeddingModel: "text-embedding-3-small",
          provider: "openai",
        })),
    },
    "./knowledgeRepository": {
      createDocument:
        overrides.createDocument ||
        (async (input) => ({
          createdAt: "2026-07-07T00:00:00Z",
          fileName: input.fileName || "report.txt",
          fileType: input.fileType || "txt",
          id: input.documentId || "doc-1",
          ownerId: input.ownerId || "user-1",
          sourceLabel: input.sourceLabel || "Editorial Desk",
          status: input.status || "indexed",
          storagePath: input.storagePath || "user-1/doc-1/report.txt",
          title: input.title || "Report",
          updatedAt: "2026-07-07T00:00:00Z",
        })),
      deleteDocument: overrides.deleteDocument || (async () => ({ id: "doc-1" })),
      getDocument:
        overrides.getDocument ||
        (async () => ({
          createdAt: "2026-07-07T00:00:00Z",
          fileName: "report.txt",
          fileType: "txt",
          id: "doc-1",
          ownerId: "user-1",
          sourceLabel: "Editorial Desk",
          status: "indexed",
          storagePath: "user-1/doc-1/report.txt",
          title: "Report",
          updatedAt: "2026-07-07T00:00:00Z",
        })),
      getKnowledgeStats:
        overrides.getKnowledgeStats ||
        (async () => ({
          chunkCount: 1,
          documentCount: 1,
        })),
      insertChunks:
        overrides.insertChunks ||
        (async (payload) =>
          payload.chunks.map((chunk, index) => ({
            ...chunk,
            id: `chunk-${index + 1}`,
          }))),
      listChunks:
        overrides.listChunks ||
        (async () => [
          {
            content: "Verified source chunk from report.",
          },
        ]),
      listDocuments:
        overrides.listDocuments ||
        (async () => [
          {
            createdAt: "2026-07-07T00:00:00Z",
            fileName: "report.txt",
            fileType: "txt",
            id: "doc-1",
            ownerId: "user-1",
            sourceLabel: "Editorial Desk",
            status: "indexed",
            storagePath: "user-1/doc-1/report.txt",
            title: "Report",
            updatedAt: "2026-07-07T00:00:00Z",
          },
        ]),
      matchKnowledgeChunks:
        overrides.matchKnowledgeChunks ||
        (async () => [
          {
            citationLabel: "Report [S1]",
            chunkIndex: 0,
            content: "Verified source chunk from report.",
            documentId: "doc-1",
            fileName: "report.txt",
            id: "chunk-1",
            ownerId: "user-1",
            similarity: 0.92,
            sourceLabel: "Editorial Desk",
            sourcePage: 2,
            tokenCount: 120,
            title: "Report",
          },
        ]),
      removeDocumentFile:
        overrides.removeDocumentFile || (async () => undefined),
      searchChunksByKeyword:
        overrides.searchChunksByKeyword || (async () => []),
      searchDocuments:
        overrides.searchDocuments || (async () => []),
      updateDocumentStatus:
        overrides.updateDocumentStatus ||
        (async ({ documentId, ownerId, status }) => ({
          createdAt: "2026-07-07T00:00:00Z",
          fileName: "report.txt",
          fileType: "txt",
          id: documentId,
          ownerId,
          sourceLabel: "Editorial Desk",
          status,
          storagePath: "user-1/doc-1/report.txt",
          title: "Uploaded report",
          updatedAt: "2026-07-07T00:00:00Z",
        })),
      uploadDocumentFile:
        overrides.uploadDocumentFile || (async () => "user-1/doc-1/report.txt"),
    },
  });
}

test("indexUploadedKnowledge stores uploaded document and chunk metadata", async () => {
  const createdStatuses = [];
  const updatedStatuses = [];
  const ragService = loadRagService({
    createDocument: async (input) => {
      createdStatuses.push(input.status);

      return {
        createdAt: "2026-07-07T00:00:00Z",
        fileName: input.fileName,
        fileType: input.fileType,
        id: input.documentId,
        ownerId: input.ownerId,
        sourceLabel: input.sourceLabel,
        status: input.status,
        storagePath: input.storagePath,
        title: input.title,
        updatedAt: "2026-07-07T00:00:00Z",
      };
    },
    updateDocumentStatus: async (input) => {
      updatedStatuses.push(input.status);

      return {
        createdAt: "2026-07-07T00:00:00Z",
        fileName: "report.txt",
        fileType: "txt",
        id: input.documentId,
        ownerId: input.ownerId,
        sourceLabel: "Editorial Desk",
        status: input.status,
        storagePath: "user-1/doc-1/report.txt",
        title: "Uploaded report",
        updatedAt: "2026-07-07T00:00:00Z",
      };
    },
  });
  const result = await ragService.indexUploadedKnowledge({
    body: { title: "Uploaded report" },
    file: {
      buffer: Buffer.from("Uploaded newsroom content"),
      mimetype: "text/plain",
      originalname: "report.txt",
      size: 24,
    },
    user: { id: "user-1" },
  });

  assert.strictEqual(result.document.title, "Uploaded report");
  assert.strictEqual(result.chunksIndexed, 1);
  assert.strictEqual(result.document.status, "indexed");
  assert.deepStrictEqual(createdStatuses, ["indexing"]);
  assert.deepStrictEqual(updatedStatuses, ["indexed"]);
});

test("indexUploadedKnowledge fails before persistence when provider is missing", async () => {
  let documentCreated = false;
  const ragService = loadRagService({
    createDocument: async () => {
      documentCreated = true;
      return {};
    },
    getEmbeddingProviderStatus: () => ({
      code: "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      configured: false,
      embeddingModel: "text-embedding-3-small",
      provider: "openai",
    }),
  });

  await assert.rejects(
    () =>
      ragService.indexUploadedKnowledge({
        file: {
          buffer: Buffer.from("Uploaded newsroom content"),
          mimetype: "text/plain",
          originalname: "report.txt",
          size: 24,
        },
        user: { id: "user-1" },
      }),
    (error) =>
      error.code === "EMBEDDING_PROVIDER_NOT_CONFIGURED" &&
      error.statusCode === 503,
  );
  assert.strictEqual(documentCreated, false);
});

test("indexUploadedKnowledge does not persist when embedding fails", async () => {
  let documentCreated = false;
  const deletedDocuments = [];
  let fileUploaded = false;
  const ragService = loadRagService({
    createDocument: async () => {
      documentCreated = true;
      return {};
    },
    createEmbeddings: async () => {
      const error = new Error("Provider unavailable.");
      error.code = "KNOWLEDGE_PROVIDER_UNAVAILABLE";
      error.statusCode = 502;
      throw error;
    },
    deleteDocument: async (input) => {
      deletedDocuments.push(input);
      return { id: input.documentId };
    },
    uploadDocumentFile: async () => {
      fileUploaded = true;
      return "user-1/doc-1/report.txt";
    },
  });

  await assert.rejects(
    () =>
      ragService.indexUploadedKnowledge({
        file: {
          buffer: Buffer.from("Uploaded newsroom content"),
          mimetype: "text/plain",
          originalname: "report.txt",
          size: 24,
        },
        user: { id: "user-1" },
      }),
    (error) => error.code === "KNOWLEDGE_PROVIDER_UNAVAILABLE",
  );
  assert.strictEqual(documentCreated, false);
  assert.strictEqual(fileUploaded, false);
  assert.strictEqual(deletedDocuments.length, 0);
});

test("indexUploadedKnowledge cleans persisted data when chunk insert fails", async () => {
  const deletedDocuments = [];
  const ragService = loadRagService({
    deleteDocument: async (input) => {
      deletedDocuments.push(input);
      return { id: input.documentId };
    },
    insertChunks: async () => {
      const error = new Error("Chunk persistence failed.");
      error.code = "knowledge_chunk_insert_failed";
      error.statusCode = 500;
      throw error;
    },
  });

  await assert.rejects(
    () =>
      ragService.indexUploadedKnowledge({
        file: {
          buffer: Buffer.from("Uploaded newsroom content"),
          mimetype: "text/plain",
          originalname: "report.txt",
          size: 24,
        },
        user: { id: "user-1" },
      }),
    (error) => error.code === "knowledge_chunk_insert_failed",
  );
  assert.strictEqual(deletedDocuments.length, 1);
  assert.strictEqual(deletedDocuments[0].ownerId, "user-1");
});

test("getKnowledgeDocumentForUser returns owner-scoped preview chunks", async () => {
  const ragService = loadRagService();
  const result = await ragService.getKnowledgeDocumentForUser({
    documentId: "doc-1",
    user: { id: "user-1" },
  });

  assert.strictEqual(result.id, "doc-1");
  assert.strictEqual(result.chunkCount, 1);
  assert.deepStrictEqual(result.contextChunks, [
    "Verified source chunk from report.",
  ]);
});

test("answerKnowledgeQuestion returns answer, retrievedContext, citations, confidence", async () => {
  const ragService = loadRagService();
  const result = await ragService.answerKnowledgeQuestion({
    body: { question: "What does the report say?" },
    user: { id: "user-1" },
  });

  assert.strictEqual(result.answer, "Answer with verified citations.");
  assert(Array.isArray(result.retrievedContext));
  assert(Array.isArray(result.citations));
  assert.strictEqual(typeof result.confidence, "number");
  assert.strictEqual(result.verificationRequired, false);
  assert.strictEqual(result.retrievedContext[0].title, "Report");
});

test("answerKnowledgeQuestion falls back to verification required when context is weak", async () => {
  const ragService = loadRagService({
    matchKnowledgeChunks: async () => [
      {
        citationLabel: "Report [S1]",
        chunkIndex: 0,
        content: "Thin context.",
        documentId: "doc-1",
        fileName: "report.txt",
        id: "chunk-1",
        ownerId: "user-1",
        similarity: 0.21,
        sourceLabel: "Editorial Desk",
        sourcePage: 2,
        tokenCount: 12,
        title: "Report",
      },
    ],
  });

  const result = await ragService.answerKnowledgeQuestion({
    body: { question: "Can we publish this?" },
    user: { id: "user-1" },
  });

  assert.strictEqual(result.verificationRequired, true);
  assert(result.answer.includes("Verification required"));
  assert(result.confidence < 58);
});
