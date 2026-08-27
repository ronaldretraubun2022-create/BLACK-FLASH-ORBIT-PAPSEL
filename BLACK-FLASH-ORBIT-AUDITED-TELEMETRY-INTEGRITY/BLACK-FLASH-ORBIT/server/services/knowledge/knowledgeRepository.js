const crypto = require("node:crypto");
const path = require("node:path");

const { getSupabaseAdmin } = require("../supabaseAdmin");

const STORAGE_BUCKET = "knowledge-documents";
let bucketReady = false;
const MAX_KEYWORD_SCAN_ROWS = 500;

function createHttpError(message, statusCode = 500, code = "knowledge_repository_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw createHttpError(
      "Supabase service role belum dikonfigurasi.",
      503,
      "supabase_service_not_configured",
    );
  }

  return client;
}

function isMissingSchemaError(error) {
  const text = String(error?.message || error?.details || error?.code || "").toLowerCase();
  return text.includes("does not exist") || text.includes("relation") || text.includes("schema");
}

function normalizeSupabaseError(error, fallbackCode) {
  if (isMissingSchemaError(error)) {
    return createHttpError(
      "Knowledge schema missing.",
      503,
      "knowledge_schema_missing",
    );
  }

  return createHttpError(error?.message || "Knowledge query failed.", 500, fallbackCode);
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  return trimmed || fallback;
}

function sanitizeStorageFilename(filename) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  const baseName =
    path
      .basename(String(filename || "knowledge-document"), extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "knowledge-document";

  return `${baseName}${extension || ".txt"}`;
}

function formatStoragePath({ documentId, fileName, ownerId }) {
  return `${ownerId}/${documentId}/${sanitizeStorageFilename(fileName)}`;
}

function mapKnowledgeDocument(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    fileName: row.file_name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    status: row.status,
    sourceLabel: row.source_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDocument({ documentId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_document_lookup_failed");
  }

  if (!data) {
    throw createHttpError(
      "Knowledge document tidak ditemukan.",
      404,
      "knowledge_document_not_found",
    );
  }

  return mapKnowledgeDocument(data);
}

function mapKnowledgeChunk(row) {
  const similarity = Number(row.similarity || 0);

  return {
    id: row.id,
    documentId: row.document_id,
    ownerId: row.owner_id,
    chunkIndex: Number(row.chunk_index || 0),
    content: row.content,
    tokenCount: Number(row.token_count || 0),
    sourcePage: row.source_page,
    citationLabel: row.citation_label,
    title: row.title,
    sourceLabel: row.source_label,
    fileName: row.file_name,
    similarity: Number.isFinite(similarity) ? similarity : 0,
  };
}

function mapStoredKnowledgeChunk(row, document, similarity = 0) {
  return {
    id: row.id,
    documentId: row.document_id,
    ownerId: row.owner_id,
    chunkIndex: Number(row.chunk_index || 0),
    content: row.content,
    tokenCount: Number(row.token_count || 0),
    sourcePage: row.source_page,
    citationLabel: row.citation_label,
    title: document?.title || "Knowledge Document",
    sourceLabel: document?.sourceLabel || document?.fileName || "Knowledge source",
    fileName: document?.fileName || "",
    similarity,
  };
}

function normalizeSearchValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenizeSearchQuery(query) {
  const normalized = normalizeSearchValue(query);

  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 12);
}

function calculateKeywordScore(haystack, query, terms) {
  const normalizedHaystack = normalizeSearchValue(haystack);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedHaystack || !terms.length) return 0;

  const phraseBoost =
    normalizedQuery && normalizedHaystack.includes(normalizedQuery) ? 0.28 : 0;
  const termHits = terms.filter((term) => normalizedHaystack.includes(term)).length;

  if (!termHits && !phraseBoost) return 0;

  return Math.min(0.92, 0.42 + phraseBoost + termHits / terms.length * 0.3);
}

async function listChunks({ documentId = "", limit = MAX_KEYWORD_SCAN_ROWS, ownerId }) {
  const client = getClient();
  let query = client
    .from("knowledge_chunks")
    .select("id, document_id, owner_id, chunk_index, content, token_count, source_page, citation_label")
    .eq("owner_id", ownerId)
    .order("chunk_index", { ascending: true })
    .limit(limit);

  if (documentId) {
    query = query.eq("document_id", documentId);
  }

  const { data, error } = await query;

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_chunks_list_failed");
  }

  return data || [];
}

async function getKnowledgeStats({ ownerId }) {
  const client = getClient();
  const [{ count: documentCount, error: documentError }, { count: chunkCount, error: chunkError }] =
    await Promise.all([
      client
        .from("knowledge_documents")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId),
      client
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId),
    ]);

  if (documentError) {
    throw normalizeSupabaseError(documentError, "knowledge_document_count_failed");
  }

  if (chunkError) {
    throw normalizeSupabaseError(chunkError, "knowledge_chunk_count_failed");
  }

  return {
    chunkCount: Number(chunkCount || 0),
    documentCount: Number(documentCount || 0),
  };
}

async function searchDocuments({ limit = 20, ownerId, query }) {
  const documents = await listDocuments({ ownerId });
  const terms = tokenizeSearchQuery(query);

  if (!terms.length) return documents.slice(0, limit);

  const chunks = await listChunks({ ownerId });
  const scores = new Map();

  documents.forEach((document) => {
    const score = calculateKeywordScore(
      [
        document.title,
        document.fileName,
        document.fileType,
        document.sourceLabel,
        document.status,
      ].join(" "),
      query,
      terms,
    );

    if (score > 0) scores.set(document.id, score);
  });

  chunks.forEach((chunk) => {
    const score = calculateKeywordScore(chunk.content, query, terms);

    if (score > 0) {
      scores.set(chunk.document_id, Math.max(scores.get(chunk.document_id) || 0, score));
    }
  });

  return documents
    .filter((document) => scores.has(document.id))
    .sort((first, second) => (scores.get(second.id) || 0) - (scores.get(first.id) || 0))
    .slice(0, limit);
}

async function searchChunksByKeyword({
  documentId = "",
  matchCount = 8,
  ownerId,
  query,
}) {
  const terms = tokenizeSearchQuery(query);

  if (!terms.length) return [];

  const [documents, chunks] = await Promise.all([
    listDocuments({ ownerId }),
    listChunks({ documentId, ownerId }),
  ]);
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  return chunks
    .map((chunk) => ({
      chunk,
      document: documentsById.get(chunk.document_id),
      score: calculateKeywordScore(chunk.content, query, terms),
    }))
    .filter((item) => item.score > 0 && item.document)
    .sort((first, second) => second.score - first.score)
    .slice(0, matchCount)
    .map((item) => mapStoredKnowledgeChunk(item.chunk, item.document, item.score));
}

async function ensureKnowledgeBucket(client) {
  if (bucketReady) return;

  const { data, error } = await client.storage.getBucket(STORAGE_BUCKET);

  if (error || !data) {
    throw createHttpError(
      "Knowledge bucket unavailable.",
      503,
      "knowledge_bucket_unavailable",
    );
  }

  bucketReady = true;
}

async function uploadDocumentFile({ documentId, file, ownerId }) {
  const client = getClient();

  await ensureKnowledgeBucket(client);

  const storagePath = formatStoragePath({
    documentId,
    fileName: file.originalname,
    ownerId,
  });
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw createHttpError(
      "Gagal menyimpan file knowledge.",
      500,
      "storage_upload_failed",
    );
  }

  return storagePath;
}

async function checkKnowledgeStorageBucket() {
  const client = getSupabaseAdmin();

  if (!client) return false;

  const { data, error } = await client.storage.getBucket(STORAGE_BUCKET);

  return !error && Boolean(data);
}

async function checkKnowledgeVectorTable() {
  const client = getSupabaseAdmin();

  if (!client) return false;

  const { error } = await client
    .from("knowledge_chunks")
    .select("id")
    .limit(1);

  return !error;
}

async function removeDocumentFile(storagePath) {
  if (!storagePath) return;

  const client = getClient();
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw normalizeSupabaseError(error, "storage_delete_failed");
  }
}

async function createDocument({
  documentId = crypto.randomUUID(),
  fileName = null,
  fileType = null,
  ownerId,
  sourceLabel = null,
  status = "indexed",
  storagePath = null,
  title,
}) {
  const client = getClient();
  const { data, error } = await client
    .from("knowledge_documents")
    .insert([
      {
        id: documentId,
        file_name: fileName,
        file_type: fileType,
        owner_id: ownerId,
        source_label: sourceLabel,
        status,
        storage_path: storagePath,
        title: normalizeText(title, "Untitled Knowledge Document"),
      },
    ])
    .select("*")
    .single();

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_document_insert_failed");
  }

  return mapKnowledgeDocument(data);
}

async function insertChunks({ chunks, documentId, ownerId }) {
  if (!chunks.length) return [];

  const client = getClient();
  const rows = chunks.map((chunk) => ({
    citation_label: chunk.citationLabel,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    document_id: documentId,
    embedding: chunk.embedding,
    owner_id: ownerId,
    source_page: chunk.sourcePage || null,
    token_count: chunk.tokenCount || 0,
  }));
  const { data, error } = await client
    .from("knowledge_chunks")
    .insert(rows)
    .select("id, document_id, owner_id, chunk_index, content, token_count, source_page, citation_label");

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_chunk_insert_failed");
  }

  return data || [];
}

async function listDocuments({ ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("knowledge_documents")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_documents_list_failed");
  }

  return (data || []).map(mapKnowledgeDocument);
}

async function updateDocumentStatus({ documentId, ownerId, status }) {
  const client = getClient();
  const { data, error } = await client
    .from("knowledge_documents")
    .update({ status })
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_document_status_update_failed");
  }

  return mapKnowledgeDocument(data);
}

async function deleteDocument({ documentId, ownerId }) {
  const client = getClient();
  const { data: document, error: lookupError } = await client
    .from("knowledge_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (lookupError) {
    throw normalizeSupabaseError(lookupError, "knowledge_document_lookup_failed");
  }

  if (!document) {
    throw createHttpError(
      "Knowledge document tidak ditemukan.",
      404,
      "knowledge_document_not_found",
    );
  }

  await removeDocumentFile(document.storage_path);

  const { error } = await client
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", ownerId);

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_document_delete_failed");
  }

  return {
    id: documentId,
  };
}

async function matchKnowledgeChunks({ matchCount = 8, ownerId, queryEmbedding }) {
  const client = getClient();
  const { data, error } = await client.rpc("match_knowledge_chunks", {
    match_count: matchCount,
    owner_filter: ownerId,
    query_embedding: queryEmbedding,
  });

  if (error) {
    throw normalizeSupabaseError(error, "knowledge_match_failed");
  }

  return (data || []).map(mapKnowledgeChunk);
}

module.exports = {
  STORAGE_BUCKET,
  createDocument,
  deleteDocument,
  getDocument,
  getKnowledgeStats,
  insertChunks,
  listChunks,
  listDocuments,
  matchKnowledgeChunks,
  removeDocumentFile,
  checkKnowledgeStorageBucket,
  checkKnowledgeVectorTable,
  searchChunksByKeyword,
  searchDocuments,
  updateDocumentStatus,
  uploadDocumentFile,
};
