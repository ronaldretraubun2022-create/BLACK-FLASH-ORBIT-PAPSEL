import { api, getAuthenticatedHeaders, resolveApiUrl } from "./api";
import { SharedRequestCache } from "./sharedRequestCache.mjs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"];
const KNOWLEDGE_MOCK_DATA_MODULE = "../data/knowledgeMock.js";
const KNOWLEDGE_MOCK_RAG_MODULE = "../lib/mockRagEngine.js";
const SUPPORTED_MIME_TYPES = {
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".md": ["", "text/markdown", "text/plain"],
  ".pdf": ["application/pdf"],
  ".txt": ["", "text/plain"],
};
const KNOWLEDGE_UPLOAD_ENDPOINT = "/api/v1/knowledge/upload";
const KNOWLEDGE_API_PREFIX = "/api/v1/knowledge";
const KNOWLEDGE_DOCUMENT_CACHE_TTL_MS = 10_000;
const sharedKnowledgeDocuments = new SharedRequestCache({
  ttlMs: KNOWLEDGE_DOCUMENT_CACHE_TTL_MS,
});

function getAuthorizationCacheKey(authorization = "") {
  // Non-cryptographic fingerprint used only as an in-memory cache namespace.
  // It avoids retaining the bearer token itself as a Map key.
  let hash = 2166136261;
  for (let index = 0; index < authorization.length; index += 1) {
    hash ^= authorization.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `session-${(hash >>> 0).toString(16)}`;
}

export function clearKnowledgeDocumentsCache() {
  sharedKnowledgeDocuments.clearAll();
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  return trimmed || fallback;
}

function isDevelopment() {
  return import.meta.env.DEV === true;
}

function logKnowledgeApiRequest({ method, url, hasBearerToken, status }) {
  if (
    !isDevelopment() ||
    import.meta.env.VITE_ENABLE_KNOWLEDGE_API_DEBUG !== "true"
  )
    return;

  console.info("[Knowledge API]", {
    method,
    url,
    hasBearerToken,
    status,
  });
}

function isSessionTokenError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("session login tidak aktif") ||
    message.includes("session token missing") ||
    message.includes("silakan login ulang") ||
    message.includes("login ulang")
  );
}

function normalizeKnowledgeError(error) {
  if (isSessionTokenError(error)) {
    return new Error("Session token missing. Please login again.");
  }

  return error;
}

function normalizeDateLabel(value) {
  if (!value) return "not synced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "not synced";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Jayapura",
    year: "numeric",
  });
}

function normalizeStatusLabel(value) {
  const status = normalizeText(value, "indexed");

  return status.toLowerCase() === "indexed" ? "Indexed" : status;
}

function getDocumentType(document) {
  const fileType = normalizeText(document?.fileType || document?.file_type);

  if (fileType) return fileType.toUpperCase();

  const fileName = normalizeText(document?.fileName || document?.file_name);
  const extension = SUPPORTED_EXTENSIONS.find((item) =>
    fileName.toLowerCase().endsWith(item),
  );

  return extension ? extension.slice(1).toUpperCase() : "DOCUMENT";
}

function normalizeKnowledgeDocument(document) {
  const fileName = normalizeText(document?.fileName || document?.file_name);
  const title = normalizeText(
    document?.title,
    fileName || "Untitled Knowledge Document",
  );
  const source =
    normalizeText(document?.sourceLabel || document?.source_label) ||
    normalizeText(document?.source) ||
    normalizeText(fileName, "Knowledge API");
  const updatedAt = document?.updatedAt || document?.updated_at;
  const createdAt = document?.createdAt || document?.created_at;
  const status = normalizeStatusLabel(document?.status);
  const type = getDocumentType(document);
  const contextChunks = Array.isArray(document?.contextChunks)
    ? document.contextChunks
    : Array.isArray(document?.context_chunks)
      ? document.context_chunks
      : Array.isArray(document?.chunks)
        ? document.chunks
        : [];
  const citations = Array.isArray(document?.citations)
    ? document.citations
    : [];
  const chunkCount = Number(document?.chunkCount || document?.chunk_count || 0);

  return {
    id: document?.id || "",
    citations,
    chunkCount,
    collectionId: document?.collectionId || document?.collection_id || "all",
    confidence: Number(document?.confidence || 0),
    contextChunks,
    createdAt,
    excerpt:
      normalizeText(document?.excerpt) ||
      `Dokumen ${title} sudah tersimpan di Knowledge RAG API.`,
    favorite: Boolean(document?.favorite),
    fileName,
    fileType: document?.fileType || document?.file_type || "",
    owner:
      document?.owner ||
      document?.ownerEmail ||
      document?.owner_email ||
      "Authenticated User",
    pages: document?.pages || "-",
    source,
    status,
    storagePath: document?.storagePath || document?.storage_path || "",
    summary:
      normalizeText(document?.summary) ||
      "Metadata tersedia. Ajukan pertanyaan ke AI Knowledge Copilot untuk mengambil konteks terverifikasi dari chunk dokumen.",
    tags: [
      "rag-api",
      type.toLowerCase(),
      source.toLowerCase().replace(/\s+/g, "-"),
    ].filter(Boolean),
    title,
    tokens: document?.tokens || (chunkCount ? `${chunkCount} chunks` : "-"),
    type,
    updatedAt: normalizeDateLabel(updatedAt || createdAt),
  };
}

function normalizeResponseDocument(response) {
  return normalizeKnowledgeDocument(response?.data || response);
}

function normalizeAskResponse(response) {
  const payload = response?.data || response || {};

  return {
    answer:
      normalizeText(payload.answer) ||
      "Verification required. Knowledge API tidak mengembalikan jawaban.",
    citations: Array.isArray(payload.citations) ? payload.citations : [],
    confidence: Number(payload.confidence || 0),
    context: Array.isArray(payload.retrievedContext)
      ? payload.retrievedContext
      : Array.isArray(payload.context)
        ? payload.context
        : [],
    mode: normalizeText(payload.mode, "rag-api"),
    retrievedChunks: Number(payload.retrievedChunks || 0),
    verificationRequired: Boolean(payload.verificationRequired),
  };
}

function parseJsonResponse(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractDataArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.documents)) return response.documents;
  if (Array.isArray(response?.results)) return response.results;

  return [];
}

function createKnowledgeRequestError(responseBody, status) {
  const error = new Error(
    responseBody?.message ||
      `Knowledge request gagal dengan status HTTP ${status}.`,
  );

  error.code = responseBody?.code ?? null;
  error.details = responseBody?.details ?? null;
  error.status = status;
  error.rawResponse = responseBody;

  return error;
}

async function requestKnowledgeJson(
  path,
  { body, headers: providedHeaders, method = "GET", signal } = {},
) {
  const headers = providedHeaders || (await getAuthenticatedHeaders());
  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };
  const hasBody = body !== undefined;

  if (hasBody) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(
    resolveApiUrl(`${KNOWLEDGE_API_PREFIX}${path}`),
    {
      body: hasBody ? JSON.stringify(body) : undefined,
      headers: requestHeaders,
      method,
      signal,
    },
  );
  const responseText = await response.text();
  const responseBody = parseJsonResponse(responseText);

  if (!response.ok) {
    throw createKnowledgeRequestError(responseBody, response.status);
  }

  return responseBody;
}

function getUploadErrorMessage(responseBody, status, fallbackMessage = "") {
  return (
    responseBody?.message ||
    responseBody?.error ||
    fallbackMessage ||
    `Upload gagal dengan status HTTP ${status}.`
  );
}

function logKnowledgeUploadFailure(status, responseBody) {
  if (!isDevelopment()) return;

  console.error("[Knowledge Upload]", {
    status,
    response: responseBody,
  });
}

function createKnowledgeUploadError(responseBody, status, fallbackMessage) {
  const uploadError = new Error(
    getUploadErrorMessage(responseBody, status, fallbackMessage),
  );

  uploadError.code = responseBody?.code ?? null;
  uploadError.stage = responseBody?.stage ?? null;
  uploadError.details = responseBody?.details ?? null;
  uploadError.status = status;
  uploadError.rawResponse = responseBody;

  return uploadError;
}

function requestKnowledgeUpload({ formData, onProgress }) {
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = resolveApiUrl(KNOWLEDGE_UPLOAD_ENDPOINT);
    const headers = await getAuthenticatedHeaders().catch((error) => {
      logKnowledgeApiRequest({
        hasBearerToken: false,
        method: "POST",
        status: 0,
        url,
      });
      reject(normalizeKnowledgeError(error));
      return null;
    });

    if (!headers) return;

    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.(35);
        return;
      }

      onProgress?.(Math.round((event.loaded / event.total) * 90));
    };

    xhr.onload = () => {
      const responseBody = parseJsonResponse(xhr.responseText);
      const hasBearerToken = Boolean(headers.Authorization);
      logKnowledgeApiRequest({
        hasBearerToken,
        method: "POST",
        status: xhr.status,
        url,
      });

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(responseBody);
        return;
      }

      logKnowledgeUploadFailure(xhr.status, responseBody);
      reject(createKnowledgeUploadError(responseBody, xhr.status));
    };

    xhr.onerror = () => {
      const responseBody = parseJsonResponse(xhr.responseText);

      logKnowledgeApiRequest({
        hasBearerToken: Boolean(headers.Authorization),
        method: "POST",
        status: xhr.status || 0,
        url,
      });
      logKnowledgeUploadFailure(xhr.status || 0, responseBody);
      reject(
        createKnowledgeUploadError(
          responseBody,
          xhr.status || 0,
          "Koneksi upload knowledge gagal.",
        ),
      );
    };

    xhr.ontimeout = () => {
      const responseBody = parseJsonResponse(xhr.responseText);

      logKnowledgeApiRequest({
        hasBearerToken: Boolean(headers.Authorization),
        method: "POST",
        status: xhr.status || 0,
        url,
      });
      logKnowledgeUploadFailure(xhr.status || 0, responseBody);
      reject(
        createKnowledgeUploadError(
          responseBody,
          xhr.status || 0,
          "Upload knowledge timeout.",
        ),
      );
    };

    xhr.timeout = 120000;
    xhr.send(formData);
  });
}

export function isKnowledgeMockFallbackEnabled() {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ENABLE_KNOWLEDGE_MOCK_FALLBACK === "true"
  );
}

export async function loadKnowledgeMockDocuments() {
  if (!isKnowledgeMockFallbackEnabled()) {
    throw new Error(
      "Knowledge mock fallback hanya tersedia di development dengan flag eksplisit.",
    );
  }

  const { knowledgeDocuments } = await import(
    /* @vite-ignore */ KNOWLEDGE_MOCK_DATA_MODULE
  );

  return knowledgeDocuments;
}

export async function createKnowledgeMockFallbackResult(query, documents) {
  if (!isKnowledgeMockFallbackEnabled()) {
    throw new Error(
      "Knowledge mock fallback hanya tersedia di development dengan flag eksplisit.",
    );
  }

  const {
    buildCitations,
    calculateConfidence,
    generateMockAnswer,
    retrieveContext,
  } = await import(/* @vite-ignore */ KNOWLEDGE_MOCK_RAG_MODULE);
  const context = retrieveContext(query, documents);
  const citations = buildCitations(context);
  const confidence = calculateConfidence(context);

  return {
    answer: generateMockAnswer(query, context),
    citations,
    confidence,
    context,
    mode: "dev-mock-fallback",
    verificationRequired: context.length === 0,
  };
}

export function getKnowledgeFileValidation(file) {
  if (!file) return "Pilih file knowledge terlebih dahulu.";
  if (!file.size) return "File knowledge tidak boleh kosong.";

  const lowerName = file.name.toLowerCase();
  const extension = SUPPORTED_EXTENSIONS.find((item) =>
    lowerName.endsWith(item),
  );
  const isSupported = Boolean(extension);

  if (!isSupported) {
    return "Format file harus .txt, .md, .pdf, atau .docx.";
  }

  const mimeType = String(file.type || "").toLowerCase();
  const isMimeSupported = SUPPORTED_MIME_TYPES[extension].includes(mimeType);

  if (!isMimeSupported) {
    return "Tipe file tidak sesuai dengan extension dokumen.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Ukuran file maksimal 10 MB.";
  }

  return "";
}

export function getKnowledgeFileType(file) {
  const lowerName = String(file?.name || "").toLowerCase();
  const extension = SUPPORTED_EXTENSIONS.find((item) =>
    lowerName.endsWith(item),
  );

  return extension ? extension.slice(1).toUpperCase() : "FILE";
}

export function formatKnowledgeFileSize(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export async function getKnowledgeDocuments({ force = false } = {}) {
  try {
    const headers = await getAuthenticatedHeaders();
    const cacheKey = getAuthorizationCacheKey(headers.Authorization || "");

    return await sharedKnowledgeDocuments.resolve(
      cacheKey,
      async () => {
        const response = await requestKnowledgeJson("/documents", { headers });
        const documents = extractDataArray(response);
        return documents.map(normalizeKnowledgeDocument);
      },
      { force },
    );
  } catch (error) {
    throw normalizeKnowledgeError(error);
  }
}

export async function getKnowledgeDocument(documentId, { signal } = {}) {
  const cleanDocumentId = normalizeText(documentId);

  if (!cleanDocumentId) {
    throw new Error("Knowledge document ID wajib tersedia.");
  }

  try {
    const response = await requestKnowledgeJson(
      `/documents/${encodeURIComponent(cleanDocumentId)}`,
      { signal },
    );

    return normalizeResponseDocument(response);
  } catch (error) {
    throw normalizeKnowledgeError(error);
  }
}

export async function searchKnowledgeDocuments(query, { signal } = {}) {
  try {
    const searchParams = new URLSearchParams();
    const cleanQuery = normalizeText(query);

    if (cleanQuery) {
      searchParams.set("q", cleanQuery);
    }

    const response = await requestKnowledgeJson(
      `/search${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      { signal },
    );
    const documents = extractDataArray(response);

    return documents.map(normalizeKnowledgeDocument);
  } catch (error) {
    throw normalizeKnowledgeError(error);
  }
}

export async function createKnowledgeDocument({
  content,
  source,
  title,
  useInAiContext,
}) {
  const response = await api.createKnowledgeDocument({
    content: normalizeText(content),
    source_label: normalizeText(source) || "manual",
    title: normalizeText(title),
    use_in_ai_context: Boolean(useInAiContext),
  });

  return normalizeResponseDocument(response);
}

export async function updateKnowledgeDocument() {
  throw new Error("Update dokumen knowledge RAG belum tersedia.");
}

export async function toggleKnowledgeAiContext() {
  throw new Error("Toggle konteks knowledge RAG belum tersedia.");
}

export async function deleteKnowledgeDocument(documentId) {
  try {
    await api.deleteKnowledgeDocument(documentId);
    clearKnowledgeDocumentsCache();
  } catch (error) {
    throw normalizeKnowledgeError(error);
  }

  return { id: documentId };
}

export async function uploadKnowledgeDocument({
  file,
  onProgress,
  title,
  useInAiContext = true,
}) {
  const validationError = getKnowledgeFileValidation(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", normalizeText(title));
  formData.append("use_in_ai_context", String(Boolean(useInAiContext)));

  const response = await requestKnowledgeUpload({
    formData,
    onProgress,
  });

  clearKnowledgeDocumentsCache();
  return normalizeResponseDocument(response);
}

export async function askKnowledge({ documentId, question, signal } = {}) {
  try {
    const response = await requestKnowledgeJson("/ask", {
      body: {
        documentId: normalizeText(documentId),
        question: normalizeText(question),
      },
      method: "POST",
      signal,
    });

    return normalizeAskResponse(response);
  } catch (error) {
    throw normalizeKnowledgeError(error);
  }
}
