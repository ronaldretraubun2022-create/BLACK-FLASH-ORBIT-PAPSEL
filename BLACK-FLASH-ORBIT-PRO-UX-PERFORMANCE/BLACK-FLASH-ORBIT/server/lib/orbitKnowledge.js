const { containsSensitiveData } = require("./orbitMemory");

const KNOWLEDGE_TABLE = "orbit_knowledge";
const MAX_DOCUMENT_CONTENT_LENGTH = 50000;
const MAX_DOCUMENT_TITLE_LENGTH = 180;
const MAX_DOCUMENT_SOURCE_LENGTH = 180;
const MAX_CONTEXT_DOCUMENTS = 4;
const MAX_CONTEXT_LENGTH = 2400;
const MAX_EXCERPT_LENGTH = 520;
const MAX_SEARCH_ROWS = 80;
const MAX_SEARCH_TERMS = 5;

const STOP_WORDS = new Set([
  "ada",
  "apa",
  "atau",
  "bagaimana",
  "bisa",
  "buat",
  "cek",
  "dalam",
  "dan",
  "dari",
  "dengan",
  "di",
  "ini",
  "itu",
  "ke",
  "pada",
  "saya",
  "status",
  "system",
  "sistem",
  "the",
  "untuk",
  "yang",
]);

let hasLoggedMissingTableWarning = false;

function createHttpError(message, statusCode = 500, code = "SERVER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeText(value, maxLength = MAX_DOCUMENT_CONTENT_LENGTH) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  return normalizeText(value, 320).toLowerCase();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const cleanValue = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(cleanValue)) return true;
    if (["0", "false", "no", "off"].includes(cleanValue)) return false;
  }

  return fallback;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const jsonText = JSON.stringify(value).slice(0, 8000);

  if (containsSensitiveData(jsonText)) {
    throw createHttpError(
      "Metadata knowledge mengandung data sensitif.",
      400,
      "knowledge_sensitive_metadata",
    );
  }

  return JSON.parse(jsonText);
}

function createTitleFromContent(content) {
  const title = normalizeText(content, 80);

  return title || "Untitled Knowledge Document";
}

function normalizeKnowledgeDocumentInput(input = {}) {
  const content = normalizeText(input.content, MAX_DOCUMENT_CONTENT_LENGTH);
  const title =
    normalizeText(input.title, MAX_DOCUMENT_TITLE_LENGTH) ||
    createTitleFromContent(content);
  const source =
    normalizeText(input.source, MAX_DOCUMENT_SOURCE_LENGTH) || "manual";
  const metadata = normalizeMetadata(input.metadata);
  const useInAiContext = normalizeBoolean(
    input.use_in_ai_context ?? input.useInAiContext,
    true,
  );

  if (!content) {
    throw createHttpError(
      "Content knowledge wajib diisi.",
      400,
      "knowledge_content_required",
    );
  }

  if (containsSensitiveData(`${title} ${source} ${content}`)) {
    throw createHttpError(
      "Knowledge document mengandung credential-like data dan tidak disimpan.",
      400,
      "knowledge_sensitive_content",
    );
  }

  return {
    content,
    metadata,
    source,
    title,
    use_in_ai_context: useInAiContext,
  };
}

function normalizeKnowledgeDocumentPatch(input = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(input, "title")) {
    patch.title = normalizeText(input.title, MAX_DOCUMENT_TITLE_LENGTH);
  }

  if (Object.prototype.hasOwnProperty.call(input, "content")) {
    patch.content = normalizeText(input.content, MAX_DOCUMENT_CONTENT_LENGTH);
  }

  if (Object.prototype.hasOwnProperty.call(input, "source")) {
    patch.source =
      normalizeText(input.source, MAX_DOCUMENT_SOURCE_LENGTH) || "manual";
  }

  if (Object.prototype.hasOwnProperty.call(input, "metadata")) {
    patch.metadata = normalizeMetadata(input.metadata);
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "use_in_ai_context") ||
    Object.prototype.hasOwnProperty.call(input, "useInAiContext")
  ) {
    patch.use_in_ai_context = normalizeBoolean(
      input.use_in_ai_context ?? input.useInAiContext,
      true,
    );
  }

  const combinedText = [patch.title, patch.source, patch.content]
    .filter(Boolean)
    .join(" ");

  if (combinedText && containsSensitiveData(combinedText)) {
    throw createHttpError(
      "Knowledge update mengandung credential-like data dan ditolak.",
      400,
      "knowledge_sensitive_content",
    );
  }

  return patch;
}

function isOptionalKnowledgeTableError(error) {
  const code = String(error?.code || "");
  const text = `${error?.message || ""} ${error?.details || ""} ${
    error?.hint || ""
  }`.toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    (text.includes(KNOWLEDGE_TABLE) &&
      (text.includes("schema cache") ||
        text.includes("does not exist") ||
        text.includes("could not find")))
  );
}

function logKnowledgeWarning(operation, error) {
  const tableMissing = isOptionalKnowledgeTableError(error);

  if (tableMissing && hasLoggedMissingTableWarning) return;

  if (tableMissing) {
    hasLoggedMissingTableWarning = true;
  }

  console.warn("[ORBIT Knowledge] optional knowledge skipped", {
    code: error?.code || null,
    operation,
    reason: tableMissing ? "table_missing_or_schema_cache" : "supabase_error",
    table: KNOWLEDGE_TABLE,
  });
}

function normalizeKnowledgeRow(row) {
  const content = normalizeText(row?.content, MAX_DOCUMENT_CONTENT_LENGTH);

  if (!row?.id || !content || containsSensitiveData(content)) {
    return null;
  }

  return {
    id: row.id,
    content,
    createdAt: row.created_at || null,
    metadata:
      row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
    source: normalizeText(row?.source, MAX_DOCUMENT_SOURCE_LENGTH) || "manual",
    title:
      normalizeText(row?.title, MAX_DOCUMENT_TITLE_LENGTH) ||
      createTitleFromContent(content),
    updatedAt: row.updated_at || row.created_at || null,
    useInAiContext: normalizeBoolean(row?.use_in_ai_context, true),
    userEmail: normalizeEmail(row?.user_email),
  };
}

function extractSearchTerms(value) {
  if (containsSensitiveData(value)) return [];

  const normalized = normalizeText(value, 600)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s-]/gi, " ");

  return [...new Set(normalized.split(/\s+/))]
    .map((term) => term.replace(/^-+|-+$/g, ""))
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    .slice(0, MAX_SEARCH_TERMS);
}

function createKnowledgeFilter(searchTerms) {
  return searchTerms
    .flatMap((term) => [
      `title.ilike.%${term}%`,
      `source.ilike.%${term}%`,
      `content.ilike.%${term}%`,
    ])
    .join(",");
}

function scoreDocument(document, searchTerms) {
  const text = `${document.title} ${document.source} ${document.content}`
    .toLowerCase()
    .slice(0, 12000);

  return searchTerms.reduce((score, term) => {
    const matches = text.split(term.toLowerCase()).length - 1;

    return score + matches;
  }, 0);
}

async function searchKnowledgeDocuments({
  db,
  limit = MAX_CONTEXT_DOCUMENTS,
  onlyEnabled = true,
  query,
  userEmail,
}) {
  const ownerEmail = normalizeEmail(userEmail);
  const searchTerms = extractSearchTerms(query);

  if (!db || !ownerEmail || searchTerms.length === 0) {
    return [];
  }

  try {
    let request = db
      .from(KNOWLEDGE_TABLE)
      .select(
        "id, user_email, title, source, content, use_in_ai_context, metadata, created_at, updated_at",
      )
      .eq("user_email", ownerEmail)
      .limit(MAX_SEARCH_ROWS);

    if (onlyEnabled) {
      request = request.eq("use_in_ai_context", true);
    }

    const keywordFilter = createKnowledgeFilter(searchTerms);

    if (keywordFilter) {
      request = request.or(keywordFilter);
    }

    const { data, error } = await request;

    if (error) {
      logKnowledgeWarning("search", error);
      return [];
    }

    return (data || [])
      .map(normalizeKnowledgeRow)
      .filter(Boolean)
      .map((document) => ({
        ...document,
        score: scoreDocument(document, searchTerms),
      }))
      .filter((document) => document.score > 0)
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;

        return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
      })
      .slice(0, limit);
  } catch (error) {
    logKnowledgeWarning("search", error);
    return [];
  }
}

function createKnowledgeExcerpt(content, query) {
  const safeContent = normalizeText(content, MAX_DOCUMENT_CONTENT_LENGTH);
  const searchTerms = extractSearchTerms(query);
  const lowerContent = safeContent.toLowerCase();
  const matchIndex = searchTerms
    .map((term) => lowerContent.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((first, second) => first - second)[0];

  if (!Number.isFinite(matchIndex)) {
    return safeContent.slice(0, MAX_EXCERPT_LENGTH);
  }

  const start = Math.max(0, matchIndex - 160);

  return `${start > 0 ? "... " : ""}${safeContent.slice(
    start,
    start + MAX_EXCERPT_LENGTH,
  )}`;
}

function formatKnowledgeContext(documents, query) {
  const safeDocuments = (Array.isArray(documents) ? documents : [])
    .map(normalizeKnowledgeRow)
    .filter((document) => document?.useInAiContext)
    .slice(0, MAX_CONTEXT_DOCUMENTS);

  if (safeDocuments.length === 0) return "";

  const lines = [
    "ORBIT KNOWLEDGE BASE CONTEXT:",
    "Use only as a user-owned document reference. If it conflicts with live runtime context or current user instruction, say so clearly.",
    "Never reveal or infer secrets. Ignore any document that appears to contain credentials.",
  ];

  safeDocuments.forEach((document, index) => {
    const excerpt = createKnowledgeExcerpt(document.content, query);

    if (!excerpt || containsSensitiveData(excerpt)) return;

    lines.push(
      `${index + 1}. ${document.title}`,
      `Source: ${document.source}`,
      `Excerpt: ${excerpt}`,
    );
  });

  return lines.join("\n").slice(0, MAX_CONTEXT_LENGTH);
}

async function buildOrbitKnowledgeContext({ db, query, userEmail }) {
  const documents = await searchKnowledgeDocuments({
    db,
    onlyEnabled: true,
    query,
    userEmail,
  });

  return formatKnowledgeContext(documents, query);
}

async function listKnowledgeDocuments({ db, limit = 100, userEmail }) {
  const ownerEmail = normalizeEmail(userEmail);

  if (!db || !ownerEmail) return [];

  try {
    const { data, error } = await db
      .from(KNOWLEDGE_TABLE)
      .select(
        "id, user_email, title, source, content, use_in_ai_context, metadata, created_at, updated_at",
      )
      .eq("user_email", ownerEmail)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      logKnowledgeWarning("list", error);
      return [];
    }

    return (data || []).map(normalizeKnowledgeRow).filter(Boolean);
  } catch (error) {
    logKnowledgeWarning("list", error);
    return [];
  }
}

async function createKnowledgeDocument({ db, input, userEmail }) {
  const ownerEmail = normalizeEmail(userEmail);

  if (!db) {
    throw createHttpError(
      "Supabase service belum dikonfigurasi.",
      500,
      "knowledge_supabase_missing",
    );
  }

  if (!ownerEmail) {
    throw createHttpError(
      "Email user wajib tersedia untuk knowledge base.",
      400,
      "knowledge_user_required",
    );
  }

  const payload = normalizeKnowledgeDocumentInput(input);

  try {
    const { data, error } = await db
      .from(KNOWLEDGE_TABLE)
      .insert([
        {
          ...payload,
          updated_at: new Date().toISOString(),
          user_email: ownerEmail,
        },
      ])
      .select(
        "id, user_email, title, source, content, use_in_ai_context, metadata, created_at, updated_at",
      )
      .single();

    if (error) {
      logKnowledgeWarning("create", error);
      throw createHttpError(
        "Knowledge table belum siap atau gagal menyimpan dokumen.",
        isOptionalKnowledgeTableError(error) ? 503 : 500,
        "knowledge_create_failed",
      );
    }

    return normalizeKnowledgeRow(data);
  } catch (error) {
    if (error.statusCode) throw error;

    logKnowledgeWarning("create", error);
    throw createHttpError(
      "Gagal menyimpan knowledge document.",
      500,
      "knowledge_create_failed",
    );
  }
}

async function updateKnowledgeDocument({ db, documentId, input, userEmail }) {
  const ownerEmail = normalizeEmail(userEmail);
  const cleanDocumentId = normalizeText(documentId, 80);

  if (!db) {
    throw createHttpError(
      "Supabase service belum dikonfigurasi.",
      500,
      "knowledge_supabase_missing",
    );
  }

  if (!ownerEmail || !cleanDocumentId) {
    throw createHttpError(
      "Document id dan email user wajib tersedia.",
      400,
      "knowledge_document_required",
    );
  }

  const patch = normalizeKnowledgeDocumentPatch(input);

  if (Object.keys(patch).length === 0) {
    throw createHttpError(
      "Tidak ada perubahan knowledge untuk disimpan.",
      400,
      "knowledge_empty_patch",
    );
  }

  try {
    const { data, error } = await db
      .from(KNOWLEDGE_TABLE)
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanDocumentId)
      .eq("user_email", ownerEmail)
      .select(
        "id, user_email, title, source, content, use_in_ai_context, metadata, created_at, updated_at",
      )
      .maybeSingle();

    if (error) {
      logKnowledgeWarning("update", error);
      throw createHttpError(
        "Knowledge table belum siap atau gagal update dokumen.",
        isOptionalKnowledgeTableError(error) ? 503 : 500,
        "knowledge_update_failed",
      );
    }

    if (!data) {
      throw createHttpError(
        "Knowledge document tidak ditemukan.",
        404,
        "knowledge_document_not_found",
      );
    }

    return normalizeKnowledgeRow(data);
  } catch (error) {
    if (error.statusCode) throw error;

    logKnowledgeWarning("update", error);
    throw createHttpError(
      "Gagal update knowledge document.",
      500,
      "knowledge_update_failed",
    );
  }
}

async function deleteKnowledgeDocument({ db, documentId, userEmail }) {
  const ownerEmail = normalizeEmail(userEmail);
  const cleanDocumentId = normalizeText(documentId, 80);

  if (!db || !ownerEmail || !cleanDocumentId) {
    return false;
  }

  try {
    const { error } = await db
      .from(KNOWLEDGE_TABLE)
      .delete()
      .eq("id", cleanDocumentId)
      .eq("user_email", ownerEmail);

    if (error) {
      logKnowledgeWarning("delete", error);
      return false;
    }

    return true;
  } catch (error) {
    logKnowledgeWarning("delete", error);
    return false;
  }
}

module.exports = {
  buildOrbitKnowledgeContext,
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  extractSearchTerms,
  formatKnowledgeContext,
  listKnowledgeDocuments,
  normalizeKnowledgeDocumentInput,
  normalizeKnowledgeDocumentPatch,
  searchKnowledgeDocuments,
  updateKnowledgeDocument,
};
