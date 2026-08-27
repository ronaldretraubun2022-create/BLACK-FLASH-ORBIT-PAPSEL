const crypto = require("node:crypto");
const path = require("node:path");

const { chunkText } = require("./chunkText");
const { parseUploadedDocument, sanitizeExtractedText } = require("./documentParser");
const {
  createChatCompletion,
  createEmbedding,
  createEmbeddings,
  getEmbeddingProviderStatus,
} = require("./embeddingService");
const {
  createDocument,
  deleteDocument,
  getDocument,
  getKnowledgeStats,
  insertChunks,
  listChunks,
  listDocuments,
  matchKnowledgeChunks,
  removeDocumentFile,
  searchChunksByKeyword,
  searchDocuments,
  updateDocumentStatus,
  uploadDocumentFile,
} = require("./knowledgeRepository");

const MIN_CONFIDENCE_SCORE = 58;
const MAX_QUESTION_LENGTH = 1200;

function createHttpError(message, statusCode = 500, code = "knowledge_rag_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isDevelopment() {
  return (process.env.NODE_ENV || "development") === "development";
}

function getUploadStageCode(stage, error, fallbackCode = "upload_stage_failed") {
  if (error?.code) return error.code;

  if (stage === "document_parser") return "document_parser_failed";
  if (stage === "embedding") return "embedding_failed";
  if (stage === "storage_upload") return "storage_upload_failed";

  return error?.code || fallbackCode;
}

function createUploadStageError(stage, error, fallbackCode) {
  console.error("[UPLOAD STAGE FAILED]", {
    code: error?.code || fallbackCode || "upload_stage_failed",
    stage,
    statusCode: error?.statusCode || error?.status || 500,
  });

  const uploadError = createHttpError(
    error?.message || "Knowledge upload stage failed.",
    error?.statusCode || error?.status || 500,
    getUploadStageCode(stage, error, fallbackCode),
  );
  uploadError.stage = stage;
  uploadError.details = isDevelopment() ? error?.stack : undefined;

  return uploadError;
}

async function runUploadStage(stage, action, fallbackCode) {
  try {
    return await action();
  } catch (error) {
    throw createUploadStageError(stage, error, fallbackCode);
  }
}

function ensureEmbeddingProviderConfigured() {
  const providerStatus = getEmbeddingProviderStatus();

  if (!providerStatus.configured) {
    throw createHttpError(
      providerStatus.code === "EMBEDDING_PROVIDER_UNSUPPORTED"
        ? "Embedding provider tidak didukung."
        : "Embedding provider belum dikonfigurasi pada backend.",
      503,
      providerStatus.code || "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    );
  }
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const cleanValue = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ").trim();

  return cleanValue || fallback;
}

function getUserId(user) {
  const userId = normalizeText(user?.id);

  if (!userId) {
    throw createHttpError(
      "User Supabase tidak valid.",
      401,
      "knowledge_user_required",
    );
  }

  return userId;
}

function createTitleFromFile(file, fallbackTitle) {
  const cleanTitle = normalizeText(fallbackTitle);

  if (cleanTitle) return cleanTitle.slice(0, 160);

  return (
    path
      .basename(String(file?.originalname || "Knowledge Document"))
      .replace(/\.[^.]+$/, "")
      .trim()
      .slice(0, 160) || "Knowledge Document"
  );
}

function createSourceLabel({ file, sourceLabel, title }) {
  return (
    normalizeText(sourceLabel).slice(0, 160) ||
    normalizeText(file?.originalname).slice(0, 160) ||
    title
  );
}

function formatDocumentForClient(document) {
  return {
    id: document.id,
    ownerId: document.ownerId,
    title: document.title,
    fileName: document.fileName,
    fileType: document.fileType,
    storagePath: document.storagePath,
    status: document.status,
    sourceLabel: document.sourceLabel,
    source: document.sourceLabel || document.fileName || "Knowledge upload",
    type: document.fileType || "document",
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function buildCitationLabel(title, index) {
  return `${title} [S${index + 1}]`;
}

function calculateConfidence(matches) {
  if (!matches.length) return 0;

  const topMatches = matches.slice(0, 6);
  const averageSimilarity =
    topMatches.reduce((total, item) => total + Math.max(0, item.similarity), 0) /
    topMatches.length;
  const coverageBonus = Math.min(topMatches.length, 4) * 4;
  const score = Math.round(averageSimilarity * 88 + coverageBonus);

  return Math.max(0, Math.min(98, score));
}

function getReliability(similarity) {
  if (similarity >= 0.78) return "High";
  if (similarity >= 0.62) return "Medium";

  return "Needs Verification";
}

function excerpt(value, maxLength = 260) {
  const cleanValue = normalizeText(value);

  if (cleanValue.length <= maxLength) return cleanValue;

  return `${cleanValue.slice(0, maxLength - 1).trim()}...`;
}

function formatContextGroups(matches) {
  const groups = new Map();

  matches.forEach((match) => {
    const groupId = match.documentId;
    const current = groups.get(groupId) || {
      chunks: [],
      documentId: groupId,
      id: groupId,
      score: Math.round(Math.max(0, match.similarity) * 100),
      source: match.sourceLabel || match.fileName || "Knowledge source",
      title: match.title || "Knowledge Document",
    };

    current.score = Math.max(
      current.score,
      Math.round(Math.max(0, match.similarity) * 100),
    );
    current.chunks.push(match.content);
    groups.set(groupId, current);
  });

  return Array.from(groups.values());
}

function formatCitations(matches) {
  return matches.slice(0, 6).map((match, index) => ({
    id: match.id,
    documentId: match.documentId,
    documentTitle: match.title,
    label: `S${index + 1}: ${match.title || "Knowledge source"}`,
    locator:
      match.sourcePage !== null && match.sourcePage !== undefined
        ? `Page ${match.sourcePage}`
        : `Chunk ${match.chunkIndex + 1}`,
    quote: excerpt(match.content),
    reliability: getReliability(match.similarity),
    score: Math.round(Math.max(0, match.similarity) * 100),
    source: match.sourceLabel || match.fileName || "Knowledge source",
  }));
}

function buildModelContext(matches) {
  return matches
    .slice(0, 8)
    .map((match, index) => {
      const label = `S${index + 1}`;
      const source = match.sourceLabel || match.fileName || match.title;

      return `[${label}] ${match.title} | ${source} | Chunk ${match.chunkIndex + 1}\n${match.content}`;
    })
    .join("\n\n---\n\n");
}

function createVerificationRequiredAnswer(question, confidence) {
  return [
    "Verification required.",
    `Pertanyaan: ${question}`,
    "Konteks knowledge yang ditemukan belum cukup kuat untuk menjawab secara faktual.",
    `Confidence: ${confidence}%.`,
    "Tambahkan dokumen sumber primer atau ajukan pertanyaan yang lebih spesifik sebelum dipakai untuk naskah publikasi.",
  ].join("\n");
}

async function indexTextKnowledge({ content, sourceLabel, title, user }) {
  const ownerId = getUserId(user);
  const cleanContent = sanitizeExtractedText(content);

  if (!cleanContent || cleanContent.length < 20) {
    throw createHttpError(
      "Konten knowledge terlalu pendek untuk diindeks.",
      400,
      "knowledge_content_too_short",
    );
  }

  const cleanTitle = normalizeText(title, "Knowledge Document").slice(0, 160);
  const chunks = chunkText(cleanContent);

  if (!chunks.length) {
    throw createHttpError(
      "Dokumen tidak menghasilkan chunk.",
      400,
      "knowledge_chunks_empty",
    );
  }

  ensureEmbeddingProviderConfigured();
  const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content));
  const document = await createDocument({
    fileType: "text/plain",
    ownerId,
    sourceLabel: normalizeText(sourceLabel, "Manual knowledge"),
    status: "indexing",
    title: cleanTitle,
  });

  try {
    await insertChunks({
      documentId: document.id,
      ownerId,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        citationLabel: buildCitationLabel(cleanTitle, index),
        embedding: embeddings[index],
      })),
    });
    const indexedDocument = await updateDocumentStatus({
      documentId: document.id,
      ownerId,
      status: "indexed",
    });

    return {
      chunksIndexed: chunks.length,
      document: formatDocumentForClient(indexedDocument),
    };
  } catch (error) {
    await deleteDocument({ documentId: document.id, ownerId }).catch(() => {});
    throw error;
  }
}

async function indexUploadedKnowledge({ body = {}, file, user }) {
  const ownerId = await runUploadStage(
    "auth",
    () => getUserId(user),
    "knowledge_user_required",
  );
  let documentCreated = false;
  let storagePath = "";

  const parsed = await runUploadStage(
    "document_parser",
    () => parseUploadedDocument(file),
    "document_parser_failed",
  );
  const title = createTitleFromFile(file, body.title);
  const sourceLabel = createSourceLabel({
    file,
    sourceLabel: body.source_label || body.sourceLabel,
    title,
  });
  const chunks = await runUploadStage(
    "chunking",
    () => {
      const nextChunks = chunkText(parsed.text);

      if (!nextChunks.length) {
        throw createHttpError(
          "Dokumen tidak menghasilkan chunk.",
          400,
          "knowledge_chunks_empty",
        );
      }

      return nextChunks;
    },
    "knowledge_chunks_empty",
  );
  console.info("[UPLOAD] chunking OK");
  await runUploadStage(
    "embedding",
    () => {
      ensureEmbeddingProviderConfigured();
      return true;
    },
    "EMBEDDING_PROVIDER_NOT_CONFIGURED",
  );
  const embeddings = await runUploadStage(
    "embedding",
    () => createEmbeddings(chunks.map((chunk) => chunk.content)),
    "embedding_failed",
  );
  console.info("[UPLOAD] embedding OK");
  const documentId = crypto.randomUUID();

  try {
    storagePath = await runUploadStage(
      "storage_upload",
      () =>
        uploadDocumentFile({
          documentId,
          file,
          ownerId,
        }),
      "storage_upload_failed",
    );
    console.info("[UPLOAD] storage upload OK");

    const document = await runUploadStage(
      "document_insert",
      () =>
        createDocument({
          documentId,
          fileName: file.originalname || null,
          fileType: parsed.extension.replace(/^\./, ""),
          ownerId,
          sourceLabel,
          storagePath,
          title,
          status: "indexing",
        }),
      "knowledge_document_insert_failed",
    );
    documentCreated = true;
    console.info("[UPLOAD] document inserted");

    await runUploadStage(
      "chunks_insert",
      () =>
        insertChunks({
          documentId,
          ownerId,
          chunks: chunks.map((chunk, index) => ({
            ...chunk,
            citationLabel: buildCitationLabel(title, index),
            embedding: embeddings[index],
          })),
        }),
      "knowledge_chunk_insert_failed",
    );
    console.info("[UPLOAD] chunks inserted");
    const indexedDocument = await runUploadStage(
      "document_status",
      () =>
        updateDocumentStatus({
          documentId,
          ownerId,
          status: "indexed",
        }),
      "knowledge_document_status_update_failed",
    );
    console.info("[UPLOAD] completed");

    return {
      chunksIndexed: chunks.length,
      document: formatDocumentForClient(indexedDocument),
    };
  } catch (error) {
    if (documentCreated) {
      await deleteDocument({ documentId, ownerId }).catch(() => {});
    } else if (storagePath) {
      await removeDocumentFile(storagePath).catch(() => {});
    }

    throw error;
  }
}

async function listKnowledgeForUser({ user }) {
  const ownerId = getUserId(user);
  const documents = await listDocuments({ ownerId });

  return documents.map(formatDocumentForClient);
}

async function getKnowledgeDocumentForUser({ documentId, user }) {
  const ownerId = getUserId(user);
  const [document, chunks] = await Promise.all([
    getDocument({ documentId, ownerId }),
    listChunks({
      documentId,
      limit: 12,
      ownerId,
    }),
  ]);
  const contextChunks = chunks.map((chunk) => chunk.content).filter(Boolean);

  return {
    ...formatDocumentForClient(document),
    chunkCount: contextChunks.length,
    contextChunks,
    excerpt: excerpt(contextChunks[0] || ""),
  };
}

async function getKnowledgeRetrievalStats({ user }) {
  const ownerId = getUserId(user);

  return getKnowledgeStats({ ownerId });
}

async function searchKnowledgeForUser({ query, user }) {
  const ownerId = getUserId(user);
  const documents = await searchDocuments({
    ownerId,
    query,
  });

  console.info("[RAG RETRIEVAL] SEARCH RESULT COUNT", {
    count: documents.length,
  });

  return documents.map(formatDocumentForClient);
}

async function deleteKnowledgeForUser({ documentId, user }) {
  const ownerId = getUserId(user);

  return deleteDocument({
    documentId,
    ownerId,
  });
}

async function answerKnowledgeQuestion({ body = {}, user }) {
  const ownerId = getUserId(user);
  const question = normalizeText(body.question || body.query).slice(
    0,
    MAX_QUESTION_LENGTH,
  );

  if (!question) {
    throw createHttpError(
      "Pertanyaan knowledge wajib diisi.",
      400,
      "knowledge_question_required",
    );
  }

  const stats = await getKnowledgeStats({ ownerId });
  console.info("[RAG RETRIEVAL] DOCUMENT COUNT", {
    count: stats.documentCount,
  });
  console.info("[RAG RETRIEVAL] CHUNK COUNT", {
    count: stats.chunkCount,
  });

  const queryEmbedding = await createEmbedding(question);
  const documentId = normalizeText(body.documentId || body.document_id);
  let rpcMatches = [];

  try {
    rpcMatches = await matchKnowledgeChunks({
      matchCount: 10,
      ownerId,
      queryEmbedding,
    });
    console.info("[RAG RETRIEVAL] RPC RESULT", {
      count: rpcMatches.length,
    });
  } catch (error) {
    console.error("[RAG RETRIEVAL] RPC RESULT", {
      count: 0,
      code: error?.code,
      message: error?.message,
    });
  }

  let matches = rpcMatches;
  let matchMode = "vector";
  if (documentId) {
    const scopedMatches = matches.filter((match) => match.documentId === documentId);

    if (scopedMatches.length) {
      matches = scopedMatches;
    } else {
      matches = [];
    }
  }

  if (!matches.length) {
    matches = await searchChunksByKeyword({
      documentId,
      matchCount: 10,
      ownerId,
      query: question,
    });
    matchMode = "keyword";
  }

  console.info("[RAG RETRIEVAL] MATCHED CHUNKS", {
    count: matches.length,
    mode: matchMode,
  });

  const confidence = calculateConfidence(matches);
  const citations = formatCitations(matches);
  const context = formatContextGroups(matches);

  if (!matches.length) {
    return {
      answer: createVerificationRequiredAnswer(question, confidence),
      citations,
      confidence,
      context,
      retrievedContext: context,
      mode: "rag-api",
      retrievedChunks: matches.length,
      verificationRequired: true,
    };
  }

  const verificationRequired = confidence < MIN_CONFIDENCE_SCORE;

  if (verificationRequired) {
    return {
      answer: createVerificationRequiredAnswer(question, confidence),
      citations,
      confidence,
      context,
      retrievedContext: context,
      mode: "rag-api",
      retrievedChunks: matches.length,
      verificationRequired: true,
    };
  }

  const answer = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: [
          "Anda adalah AI Knowledge Copilot untuk newsroom BLACK FLASH ORBIT.",
          "Jawab dalam bahasa Indonesia jurnalistik profesional.",
          "Gunakan hanya konteks yang diberikan.",
          "Cantumkan label sumber seperti [S1], [S2] untuk klaim faktual.",
          "Jangan membuat fakta, angka, nama, atau kutipan yang tidak ada di konteks.",
          "Jika konteks tidak cukup, nyatakan bahwa verifikasi tambahan diperlukan.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Pertanyaan: ${question}`,
          "",
          "Konteks terverifikasi:",
          buildModelContext(matches),
        ].join("\n"),
      },
    ],
  });

  return {
    answer,
    citations,
    confidence,
    context,
    retrievedContext: context,
    mode: "rag-api",
    retrievedChunks: matches.length,
    verificationRequired: false,
  };
}

module.exports = {
  answerKnowledgeQuestion,
  deleteKnowledgeForUser,
  getKnowledgeDocumentForUser,
  getKnowledgeRetrievalStats,
  indexTextKnowledge,
  indexUploadedKnowledge,
  listKnowledgeForUser,
  searchKnowledgeForUser,
};
