const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 800;
const MAX_SLUG_LENGTH = 80;
const MAX_PATH_LENGTH = 120;
const MAX_ALT_TEXT_LENGTH = 240;
const MAX_TEXT_VALUE_LENGTH = 5000;
const MAX_JSON_BYTES = 120000;
const MAX_SECTIONS = 80;
const MAX_NESTING_DEPTH = 8;

const ALLOWED_PROJECT_STATUSES = new Set(["draft", "exported", "archived"]);
const ALLOWED_ASSET_TYPES = new Set([
  "image",
  "video",
  "audio",
  "font",
  "document",
  "external",
  "other",
]);
const ALLOWED_SECTION_TYPES = new Set([
  "hero",
  "text",
  "image",
  "gallery",
  "stats",
  "quote",
  "cta",
  "feature-grid",
  "article-list",
  "divider",
]);

const UNSAFE_STRING_PATTERNS = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /\bon[a-z0-9_-]+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
];

function createValidationError(message, code = "web_builder_validation_error") {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function normalizeText(value, maxLength = MAX_TEXT_VALUE_LENGTH) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength = MAX_TEXT_VALUE_LENGTH) {
  const cleanValue = normalizeText(value, maxLength);

  return cleanValue || null;
}

function assertSafeString(value, fieldName) {
  const text = String(value || "");

  if (UNSAFE_STRING_PATTERNS.some((pattern) => pattern.test(text))) {
    throw createValidationError(
      `${fieldName} mengandung konten HTML/JS yang tidak diizinkan.`,
      "web_builder_unsafe_content",
    );
  }
}

function assertSafeKey(key, path) {
  if (/^on[a-z0-9_-]+$/i.test(key)) {
    throw createValidationError(
      `${path}.${key} tidak boleh menggunakan event handler.`,
      "web_builder_unsafe_key",
    );
  }

  if (["script", "iframe", "__proto__", "constructor", "prototype"].includes(key)) {
    throw createValidationError(
      `${path}.${key} tidak boleh digunakan.`,
      "web_builder_unsafe_key",
    );
  }
}

function assertSafeJson(value, fieldName, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) {
    throw createValidationError(
      `${fieldName} terlalu dalam.`,
      "web_builder_payload_too_deep",
    );
  }

  if (typeof value === "string") {
    assertSafeString(value, fieldName);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertSafeJson(item, `${fieldName}[${index}]`, depth + 1);
    });
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    assertSafeKey(key, fieldName);
    assertSafeJson(item, `${fieldName}.${key}`, depth + 1);
  });
}

function assertJsonBudget(value, fieldName) {
  const bytes = Buffer.byteLength(JSON.stringify(value || null), "utf8");

  if (bytes > MAX_JSON_BYTES) {
    throw createValidationError(
      `${fieldName} terlalu besar.`,
      "web_builder_payload_too_large",
    );
  }
}

function requirePlainObject(value, fieldName, fallback = {}) {
  if (value === undefined || value === null) return fallback;

  if (typeof value !== "object" || Array.isArray(value)) {
    throw createValidationError(`${fieldName} harus berupa object.`);
  }

  assertJsonBudget(value, fieldName);
  assertSafeJson(value, fieldName);

  return value;
}

function requireArray(value, fieldName, fallback = []) {
  if (value === undefined || value === null) return fallback;

  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldName} harus berupa array.`);
  }

  assertJsonBudget(value, fieldName);
  assertSafeJson(value, fieldName);

  return value;
}

function normalizeSlug(value, fallbackTitle = "") {
  const cleanValue = normalizeText(value, MAX_SLUG_LENGTH).toLowerCase();
  const source = cleanValue || normalizeText(fallbackTitle, MAX_SLUG_LENGTH);
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);

  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    throw createValidationError("Slug project tidak valid.");
  }

  return slug;
}

function normalizePath(value) {
  const cleanValue = normalizeText(value, MAX_PATH_LENGTH).toLowerCase() || "/";
  const path = cleanValue.startsWith("/") ? cleanValue : `/${cleanValue}`;

  if (path === "/") return path;

  if (!/^\/[a-z0-9][a-z0-9/_-]*$/.test(path)) {
    throw createValidationError("Path halaman tidak valid.");
  }

  return path.replace(/\/{2,}/g, "/").replace(/\/+$/g, "");
}

function normalizeStatus(value, fallback = "draft") {
  const status = normalizeText(value, 24).toLowerCase() || fallback;

  if (!ALLOWED_PROJECT_STATUSES.has(status)) {
    throw createValidationError("Status project tidak valid.");
  }

  return status;
}

function normalizeAssetType(value) {
  const assetType = normalizeText(value, 24).toLowerCase() || "image";

  if (!ALLOWED_ASSET_TYPES.has(assetType)) {
    throw createValidationError("Asset type tidak valid.");
  }

  return assetType;
}

function normalizeSection(section, index) {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    throw createValidationError(`Section ${index + 1} harus berupa object.`);
  }

  const type = normalizeText(section.type, 40).toLowerCase();

  if (!ALLOWED_SECTION_TYPES.has(type)) {
    throw createValidationError(`Section type '${type || "empty"}' tidak valid.`);
  }

  return {
    id: normalizeText(section.id, 80) || `section-${index + 1}`,
    type,
    props: requirePlainObject(section.props, `sections[${index}].props`, {}),
    styles: requirePlainObject(section.styles, `sections[${index}].styles`, {}),
  };
}

function normalizeSections(value) {
  const sections = requireArray(value, "sections", []);

  if (sections.length > MAX_SECTIONS) {
    throw createValidationError("Jumlah section terlalu banyak.");
  }

  return sections.map(normalizeSection);
}

function normalizeProjectInput(input = {}, { partial = false } = {}) {
  const title = normalizeText(input.title, MAX_TITLE_LENGTH);
  const output = {};

  if (!partial || title) {
    if (!title) throw createValidationError("Title project wajib diisi.");
    assertSafeString(title, "title");
    output.title = title;
  }

  if (!partial || input.slug !== undefined) {
    output.slug = normalizeSlug(input.slug, title || input.title);
  }

  if (input.description !== undefined) {
    const description = normalizeOptionalText(
      input.description,
      MAX_DESCRIPTION_LENGTH,
    );
    if (description) assertSafeString(description, "description");
    output.description = description;
  }

  if (!partial || input.status !== undefined) {
    output.status = normalizeStatus(input.status, partial ? undefined : "draft");
  }

  if (!partial || input.theme !== undefined) {
    output.theme = requirePlainObject(input.theme, "theme", {});
  }

  if (!partial || input.settings !== undefined) {
    output.settings = requirePlainObject(input.settings, "settings", {});
  }

  if (!partial || input.metadata !== undefined) {
    output.metadata = requirePlainObject(input.metadata, "metadata", {});
  }

  if (partial && Object.keys(output).length === 0) {
    throw createValidationError("Tidak ada field project yang diubah.");
  }

  return output;
}

function normalizePageInput(input = {}, { partial = false } = {}) {
  const title = normalizeText(input.title, MAX_TITLE_LENGTH);
  const output = {};

  if (!partial || title) {
    if (!title) throw createValidationError("Title halaman wajib diisi.");
    assertSafeString(title, "title");
    output.title = title;
  }

  if (!partial || input.path !== undefined) {
    output.path = normalizePath(input.path);
  }

  if (!partial || input.sortOrder !== undefined || input.sort_order !== undefined) {
    const sortOrder = Number(input.sortOrder ?? input.sort_order ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      throw createValidationError("Sort order halaman tidak valid.");
    }
    output.sort_order = sortOrder;
  }

  if (!partial || input.seo !== undefined) {
    output.seo = requirePlainObject(input.seo, "seo", {});
  }

  if (!partial || input.sections !== undefined) {
    output.sections = normalizeSections(input.sections);
  }

  if (!partial || input.metadata !== undefined) {
    output.metadata = requirePlainObject(input.metadata, "metadata", {});
  }

  if (partial && Object.keys(output).length === 0) {
    throw createValidationError("Tidak ada field halaman yang diubah.");
  }

  return output;
}

function normalizeAssetInput(input = {}, { partial = false } = {}) {
  const storagePath = normalizeOptionalText(input.storagePath ?? input.storage_path, 500);
  const sourceUrl = normalizeOptionalText(input.sourceUrl ?? input.source_url, 800);
  const output = {};

  if (!partial || input.assetType !== undefined || input.asset_type !== undefined) {
    output.asset_type = normalizeAssetType(input.assetType ?? input.asset_type);
  }

  if (!partial || input.storagePath !== undefined || input.storage_path !== undefined) {
    if (storagePath) assertSafeString(storagePath, "storagePath");
    output.storage_path = storagePath;
  }

  if (!partial || input.sourceUrl !== undefined || input.source_url !== undefined) {
    if (sourceUrl) assertSafeString(sourceUrl, "sourceUrl");
    output.source_url = sourceUrl;
  }

  if (!partial && !storagePath && !sourceUrl) {
    throw createValidationError("Asset wajib memiliki storage_path atau source_url.");
  }

  if (input.altText !== undefined || input.alt_text !== undefined) {
    const altText = normalizeOptionalText(
      input.altText ?? input.alt_text,
      MAX_ALT_TEXT_LENGTH,
    );
    if (altText) assertSafeString(altText, "altText");
    output.alt_text = altText;
  }

  if (!partial || input.metadata !== undefined) {
    output.metadata = requirePlainObject(input.metadata, "metadata", {});
  }

  if (partial && Object.keys(output).length === 0) {
    throw createValidationError("Tidak ada field asset yang diubah.");
  }

  return output;
}

module.exports = {
  createValidationError,
  normalizeAssetInput,
  normalizePageInput,
  normalizeProjectInput,
  normalizeText,
};
