const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const { requireSupabaseAuth } = require("../middleware/requireSupabaseAuth");
const { sanitizeScalar } = require("../services/observability/logger");
const { isSupabaseServiceConfigured } = require("../services/supabaseAdmin");
const { MAX_FILE_BYTES } = require("../services/knowledge/documentParser");
const {
  getEmbeddingProviderStatus,
  getKnowledgeChatProviderStatus,
} = require("../services/knowledge/embeddingService");
const {
  answerKnowledgeQuestion,
  deleteKnowledgeForUser,
  getKnowledgeDocumentForUser,
  getKnowledgeRetrievalStats,
  indexTextKnowledge,
  indexUploadedKnowledge,
  listKnowledgeForUser,
  searchKnowledgeForUser,
} = require("../services/knowledge/ragService");

const router = express.Router();

const upload = multer({
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

const askLimiter = rateLimit({
  legacyHeaders: false,
  max: process.env.NODE_ENV === "production" ? 40 : 240,
  message: {
    success: false,
    code: "knowledge_ask_rate_limited",
    message: "Terlalu banyak pertanyaan knowledge. Coba lagi nanti.",
  },
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
});

function shouldExposeDebugDetails() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEBUG_KNOWLEDGE_ERRORS === "true"
  );
}

function getSafeDebugDetails(error) {
  const value =
    error?.details || error?.cause?.message || error?.message || "Unknown error";

  return sanitizeScalar(value, 500);
}

function createHttpError(message, statusCode = 500, code = "knowledge_request_failed") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isSafeConfigurationError(error) {
  return [
    "EMBEDDING_PROVIDER_AUTH_FAILED",
    "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    "EMBEDDING_PROVIDER_UNSUPPORTED",
    "KNOWLEDGE_CHAT_PROVIDER_AUTH_FAILED",
    "KNOWLEDGE_CHAT_PROVIDER_NOT_CONFIGURED",
    "KNOWLEDGE_CHAT_PROVIDER_UNSUPPORTED",
    "knowledge_bucket_unavailable",
    "knowledge_schema_missing",
    "supabase_service_not_configured",
  ].includes(error?.code);
}

function sendError(res, error, fallbackMessage) {
  const status = error.statusCode || error.status || 500;

  return res.status(status).json({
    success: false,
    code: error.code || "knowledge_request_failed",
    message:
      status >= 500 && !isSafeConfigurationError(error)
        ? fallbackMessage
        : error.message || fallbackMessage,
    ...(shouldExposeDebugDetails()
      ? { details: getSafeDebugDetails(error) }
      : {}),
  });
}

function logKnowledgeError(error, req) {
  console.error("[ORBIT Knowledge]", {
    code: error?.code || "knowledge_request_failed",
    message: error?.message || "Unknown knowledge error",
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: error?.statusCode || error?.status || 500,
  });
}

function normalizeKnowledgeError(error) {
  if (!error || typeof error !== "object") {
    return createHttpError("Terjadi kesalahan knowledge.", 500);
  }

  if (
    isSafeConfigurationError(error)
  ) {
    return createHttpError(error.message, 503, error.code);
  }

  if (error.code === "knowledge_bucket_unavailable") {
    return createHttpError(error.message, 503, error.code);
  }

  if (error.code === "knowledge_schema_missing") {
    return createHttpError(error.message, 503, error.code);
  }

  return error;
}

function wrapAsync(handler, fallbackMessage) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const normalized = normalizeKnowledgeError(error);
      logKnowledgeError(normalized, req);
      return sendError(res, normalized, fallbackMessage || "Terjadi kesalahan knowledge.");
    }
  };
}

function setNoStoreHeaders(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}

function parseKnowledgeUpload(req, res, next) {
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return sendError(
        res,
        createHttpError(
          error.code === "LIMIT_FILE_SIZE"
            ? "Ukuran file maksimal 10 MB."
            : "Upload knowledge tidak valid.",
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          "knowledge_upload_invalid",
        ),
        "Gagal upload knowledge document.",
      );
    }

    return sendError(
      res,
      createHttpError("Gagal membaca upload knowledge.", 400, "knowledge_upload_invalid"),
      "Gagal upload knowledge document.",
    );
  });
}

function getUploadedFile(req) {
  return req.files?.file?.[0] || req.files?.document?.[0] || null;
}

router.use(requireSupabaseAuth);
router.use(setNoStoreHeaders);

router.get(
  "/documents",
  wrapAsync(async (req, res) => {
    const [documents, stats] = await Promise.all([
      listKnowledgeForUser({ user: req.user }),
      getKnowledgeRetrievalStats({ user: req.user }),
    ]);

    return res.json({
      success: true,
      data: documents,
      meta: {
        chunkCount: stats.chunkCount,
        documentCount: stats.documentCount,
      },
      mode: "rag-api",
    });
  }, "Gagal mengambil knowledge documents."),
);

router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const documents = await searchKnowledgeForUser({
      query: req.query?.q || req.query?.query || "",
      user: req.user,
    });

    return res.json({
      success: true,
      data: documents,
      mode: "rag-api",
    });
  }, "Gagal mencari knowledge documents."),
);

router.post(
  "/documents",
  wrapAsync(async (req, res) => {
    const result = await indexTextKnowledge({
      content: req.body?.content,
      sourceLabel: req.body?.source_label || req.body?.source,
      title: req.body?.title,
      user: req.user,
    });

    return res.status(201).json({
      success: true,
      data: result.document,
      chunksIndexed: result.chunksIndexed,
      mode: "rag-api",
    });
  }, "Gagal menyimpan knowledge document."),
);

router.get(
  "/documents/:id",
  wrapAsync(async (req, res) => {
    const document = await getKnowledgeDocumentForUser({
      documentId: req.params.id,
      user: req.user,
    });

    return res.json({
      success: true,
      data: document,
      mode: "rag-api",
    });
  }, "Gagal mengambil preview knowledge document."),
);

router.post(
  "/upload",
  parseKnowledgeUpload,
  wrapAsync(async (req, res) => {
    const file = getUploadedFile(req);

    if (!file) {
      throw createHttpError("File knowledge wajib tersedia.", 400, "knowledge_upload_required");
    }

    const result = await indexUploadedKnowledge({
      body: req.body,
      file,
      user: req.user,
    });

    return res.status(201).json({
      success: true,
      data: result.document,
      chunksIndexed: result.chunksIndexed,
      mode: "rag-api",
    });
  }, "Gagal upload knowledge document."),
);

router.post(
  "/documents/upload",
  parseKnowledgeUpload,
  wrapAsync(async (req, res) => {
    const file = getUploadedFile(req);

    if (!file) {
      throw createHttpError("File knowledge wajib tersedia.", 400, "knowledge_upload_required");
    }

    const result = await indexUploadedKnowledge({
      body: req.body,
      file,
      user: req.user,
    });

    return res.status(201).json({
      success: true,
      data: result.document,
      chunksIndexed: result.chunksIndexed,
      mode: "rag-api",
    });
  }, "Gagal upload knowledge document."),
);

router.post(
  "/ask",
  askLimiter,
  wrapAsync(async (req, res) => {
    const result = await answerKnowledgeQuestion({
      body: req.body,
      user: req.user,
    });

    return res.json({
      success: true,
      data: result,
    });
  }, "Gagal menjalankan Knowledge RAG."),
);

router.delete(
  "/documents/:id",
  wrapAsync(async (req, res) => {
    const deleted = await deleteKnowledgeForUser({
      documentId: req.params.id,
      user: req.user,
    });

    return res.json({
      success: true,
      data: deleted,
      mode: "rag-api",
    });
  }, "Gagal menghapus knowledge document."),
);

router.get(
  ["/debug", "/debug/upload"],
  wrapAsync(async (req, res) => {
    if (!isDevelopment()) {
      throw createHttpError("Not found.", 404, "not_found");
    }

    const embeddingProvider = getEmbeddingProviderStatus();
    const knowledgeChatProvider = getKnowledgeChatProviderStatus();

    return res.json({
      success: true,
      auth: "protected",
      serviceRoleConfigured: isSupabaseServiceConfigured(),
      embeddingProvider,
      knowledgeChatProvider,
      bucket: "knowledge-documents",
      schema: {
        knowledge_documents: true,
        knowledge_chunks: true,
        match_knowledge_chunks: true,
      },
    });
  }, "Gagal mengambil debug knowledge."),
);

module.exports = router;
