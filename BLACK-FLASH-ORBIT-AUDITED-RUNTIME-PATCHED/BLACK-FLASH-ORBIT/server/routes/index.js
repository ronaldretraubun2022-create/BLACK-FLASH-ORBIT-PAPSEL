const express = require("express");
const supabase = require("../lib/supabase");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
  getHealthSnapshot,
} = require("../services/observability/healthService");
const {
  getOperationalIntelligence,
} = require("../services/observability/operationalTelemetry");
const {
  defaultWorkflowEngine,
} = require("../services/automation/workflowEngine");
const {
  getWorkflowPersistenceStatus,
  listRuns: listWorkflowRuns,
} = require("../services/workflows/workflowRepository");

const router = express.Router();
const MAX_PROMPT_TITLE_LENGTH = 140;
const MAX_PROMPT_CATEGORY_LENGTH = 64;
const MAX_PROMPT_CONTENT_LENGTH = 12000;
const MAX_PROMPT_IMPORT_ITEMS = 100;

const fallbackProjects = [
  {
    name: "BLACK-FLASH-ORBIT",
    type: "platform",
    status: "CONFIGURED",
    score: null,
    lastScan: null,
  },
  {
    name: "ORBIT-DASHBOARD",
    type: "frontend",
    status: "CONFIGURED",
    score: null,
    lastScan: null,
  },
  {
    name: "SECURITY-AUDIT-CORE",
    type: "security",
    status: "CONFIGURED",
    score: null,
    lastScan: null,
  },
  {
    name: "CLI-AUTOMATION",
    type: "automation",
    status: "CONFIGURED",
    score: null,
    lastScan: null,
  },
];

const fallbackReports = [];

const promptCategories = [
  {
    slug: "newsroom",
    label: "Newsroom",
    color: "#d6a93a",
    icon: "newspaper",
  },
  { slug: "osint", label: "OSINT", color: "#7dd3fc", icon: "radar" },
  {
    slug: "engineering",
    label: "Engineering",
    color: "#94a3b8",
    icon: "code",
  },
  { slug: "security", label: "Security", color: "#991b1b", icon: "shield" },
  { slug: "product", label: "Product", color: "#a78bfa", icon: "box" },
  { slug: "audit", label: "Audit", color: "#fb7185", icon: "scan" },
  { slug: "codex", label: "Codex", color: "#22d3ee", icon: "terminal" },
  { slug: "backend", label: "Backend", color: "#38bdf8", icon: "server" },
  { slug: "frontend", label: "Frontend", color: "#f472b6", icon: "layout" },
  { slug: "database", label: "Database", color: "#2dd4bf", icon: "database" },
  { slug: "supabase", label: "Supabase", color: "#34d399", icon: "bolt" },
  {
    slug: "automation",
    label: "Automation",
    color: "#f59e0b",
    icon: "workflow",
  },
  {
    slug: "monitoring",
    label: "Monitoring",
    color: "#60a5fa",
    icon: "activity",
  },
  { slug: "reports", label: "Reports", color: "#c084fc", icon: "file" },
  { slug: "ai", label: "AI", color: "#06b6d4", icon: "sparkles" },
  { slug: "devops", label: "DevOps", color: "#f97316", icon: "rocket" },
];

const automationEngines = {
  auditEngine: {
    name: "Project Audit",
    status: "ONLINE",
    description:
      "Inspect workspace structure, runtime health, and project readiness.",
  },
  fixEngine: {
    name: "Code Repair",
    status: "READY",
    description:
      "Prepare focused fixes for detected issues and build failures.",
  },
  workspaceScanner: {
    name: "Repository Scan",
    status: "ACTIVE",
    description:
      "Track project modules and surface operational workspace signals.",
  },
  moduleInstaller: {
    name: "Module Registry",
    status: "SYNCED",
    description:
      "Coordinate approved module installation and dependency readiness.",
  },
  deployEngine: {
    name: "Deploy Pipeline",
    status: "READY",
    description: "Prepare validated production builds for controlled release.",
  },
};

const automationJobs = [
  {
    id: "workspace-audit",
    engine: "auditEngine",
    name: "Workspace Audit",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/audit/run",
  },
  {
    id: "build-validation",
    engine: "deployEngine",
    name: "Build Validation",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/automation/jobs",
  },
  {
    id: "security-review",
    engine: "fixEngine",
    name: "Security Review",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/security",
  },
];

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    score: row.score,
    lastScan: row.last_scan || "just now",
  };
}

function mapReport(row) {
  return {
    id: row.id,
    type: row.type,
    score: row.score,
    createdAt: row.created_at,
    status: row.status,
  };
}

function mapPrompt(row) {
  return {
    id: row.id,
    title: normalizeText(row.title, "Prompt Template"),
    category: normalizePromptCategory(row.category),
    content: normalizePromptContent(row.content),
    isFavorite: Boolean(row.is_favorite),
    isPinned: Boolean(row.is_pinned),
    lastUsedAt: row.last_used_at || null,
    usageCount: Number(row.usage_count || 0),
    userId: row.user_id,
    userEmail: row.user_email || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPromptCategory(row) {
  const slug = normalizePromptCategory(row?.slug || row);
  const fallback = getPromptCategoryMeta(slug);

  return {
    slug,
    label: normalizeText(row?.label, fallback.label),
    color: normalizeColor(row?.color, fallback.color),
    icon: normalizePromptIcon(row?.icon, fallback.icon),
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    time: row.time || row.created_at || new Date().toISOString(),
  };
}

function mapProfile(row, authUser) {
  const fallback = createFallbackProfile(authUser);

  return {
    id: row.id || fallback.id,
    email: row.email || fallback.email,
    fullName: row.full_name || fallback.fullName,
    role: row.role || fallback.role,
    avatarInitials: row.avatar_initials || fallback.avatarInitials,
    workspace: row.workspace || fallback.workspace,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .trim();
  return trimmed || fallback;
}

function normalizePromptCategory(value, fallback = "newsroom") {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_PROMPT_CATEGORY_LENGTH);

  return normalized || fallback;
}

function getPromptCategories(extraCategories = []) {
  const categoriesBySlug = new Map(
    promptCategories.map((category) => [category.slug, category]),
  );

  extraCategories
    .map(mapPromptCategory)
    .filter((category) => category.slug)
    .filter((category) => !categoriesBySlug.has(category.slug))
    .forEach((category) => categoriesBySlug.set(category.slug, category));

  return Array.from(categoriesBySlug.values()).sort((first, second) => {
    const firstIndex = promptCategories.findIndex(
      (category) => category.slug === first.slug,
    );
    const secondIndex = promptCategories.findIndex(
      (category) => category.slug === second.slug,
    );

    if (firstIndex >= 0 && secondIndex >= 0) return firstIndex - secondIndex;
    if (firstIndex >= 0) return -1;
    if (secondIndex >= 0) return 1;

    return first.slug.localeCompare(second.slug);
  });
}

function getPromptCategoryMeta(slug) {
  return (
    promptCategories.find((category) => category.slug === slug) || {
      slug,
      label: slug,
      color: "#64748b",
      icon: "tag",
    }
  );
}

function normalizeColor(value, fallback = "#64748b") {
  const color = normalizeText(value, fallback);

  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizePromptIcon(value, fallback = "tag") {
  const icon = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return icon || fallback;
}

function normalizePromptContent(value) {
  return normalizeText(value).slice(0, MAX_PROMPT_CONTENT_LENGTH);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const cleanValue = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(cleanValue)) return true;
    if (["0", "false", "no", "off"].includes(cleanValue)) return false;
  }

  return fallback;
}

function getPromptCategorySlugs(extraCategories = []) {
  return getPromptCategories(extraCategories).map((category) => category.slug);
}

function getPromptSelectColumns() {
  return [
    "id",
    "title",
    "category",
    "content",
    "is_favorite",
    "is_pinned",
    "usage_count",
    "last_used_at",
    "user_id",
    "user_email",
    "created_by",
    "created_at",
    "updated_at",
  ].join(", ");
}

function normalizePromptPayload(body, { partial = false } = {}) {
  const payload = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body || {}, "title")) {
    const title = normalizeText(body?.title).slice(0, MAX_PROMPT_TITLE_LENGTH);

    if (!title) {
      throw createHttpError("title wajib diisi.", 400, "prompt_title_required");
    }

    if (containsSecretLikePrompt(title)) {
      throw createHttpError(
        "Judul prompt mengandung pola secret/token dan tidak disimpan.",
        400,
        "prompt_sensitive_title_rejected",
      );
    }

    payload.title = title;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body || {}, "content")) {
    const content = normalizePromptContent(body?.content || body?.prompt);

    if (!content) {
      throw createHttpError(
        "content wajib diisi.",
        400,
        "prompt_content_required",
      );
    }

    if (containsSecretLikePrompt(content)) {
      throw createHttpError(
        "Prompt mengandung pola secret/token dan tidak disimpan.",
        400,
        "prompt_sensitive_content_rejected",
      );
    }

    payload.content = content;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body || {}, "category")) {
    payload.category = normalizePromptCategory(body?.category);
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "isFavorite")) {
    payload.is_favorite = normalizeBoolean(body.isFavorite);
  } else if (Object.prototype.hasOwnProperty.call(body || {}, "is_favorite")) {
    payload.is_favorite = normalizeBoolean(body.is_favorite);
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "isPinned")) {
    payload.is_pinned = normalizeBoolean(body.isPinned);
  } else if (Object.prototype.hasOwnProperty.call(body || {}, "is_pinned")) {
    payload.is_pinned = normalizeBoolean(body.is_pinned);
  }

  return payload;
}

function containsSecretLikePrompt(value) {
  const text = String(value || "");

  const hasCredentialLikeToken = text
    .split(/\s+/)
    .some((part) => part.length >= 48 && /^[a-z0-9._~+/=-]+$/i.test(part));

  return (
    hasCredentialLikeToken ||
    [
      /sk-or-v1-[a-z0-9_-]+/i,
      /\bsk-[a-z0-9]{20,}\b/i,
      /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/i,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /\bBearer\s+[a-z0-9._~+/-]+=*/i,
      /\b(?:api[_ -]?key|password|passwd|pwd|token|secret|cookie|private[_ -]?key|seed[_ -]?phrase)\b\s*[:=]\s*\S+/i,
    ].some((pattern) => pattern.test(text))
  );
}

function createHttpError(message, statusCode = 500, code = "server_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sendPromptError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? fallbackMessage : error.message || fallbackMessage;

  return res.status(statusCode).json({
    success: false,
    code: error.code || "prompt_request_failed",
    message,
  });
}

function getPromptOwnerFilter(user) {
  const ownerId = getAuthUserId(user);
  const ownerEmail = getAuthUserEmail(user);
  const filters = [];

  if (ownerId) {
    filters.push(`user_id.eq.${ownerId}`, `created_by.eq.${ownerId}`);
  }

  if (ownerEmail) {
    filters.push(`user_email.eq.${ownerEmail.toLowerCase()}`);
  }

  return filters.join(",");
}

function applyPromptFilters(query, user, filters = {}) {
  const ownerFilter = getPromptOwnerFilter(user);

  if (ownerFilter) {
    query = query.or(ownerFilter);
  }

  const category = normalizePromptCategory(filters.category, "");
  const search = normalizeText(filters.search || filters.q).slice(0, 120);

  if (category) {
    query = query.eq("category", category);
  }

  if (search) {
    const escapedSearch = search.replace(/[%,()]/g, " ").trim();

    if (!escapedSearch) return query;

    query = query.or(
      [
        `title.ilike.%${escapedSearch}%`,
        `content.ilike.%${escapedSearch}%`,
        `category.ilike.%${escapedSearch}%`,
      ].join(","),
    );
  }

  return query;
}

function createPromptAuditPayload(user) {
  return {
    user_id: getAuthUserId(user),
    user_email: getAuthUserEmail(user).toLowerCase() || null,
    created_by: getAuthUserId(user),
    updated_at: new Date().toISOString(),
  };
}

function normalizePromptId(value) {
  return normalizeText(value).slice(0, 80);
}

function normalizeUsageCount(value) {
  const count = Number(value || 0);

  if (!Number.isFinite(count) || count < 0) return 0;

  return Math.min(Math.floor(count), 999999);
}

function normalizeIsoDate(value) {
  const cleanValue = normalizeText(value, "");

  if (!cleanValue) return null;

  const date = new Date(cleanValue);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function createPromptExportPayload(prompts) {
  return {
    app: "BLACK FLASH ORBIT",
    exportedAt: new Date().toISOString(),
    prompts: prompts.map((prompt) => ({
      category: prompt.category,
      content: prompt.content,
      isFavorite: Boolean(prompt.isFavorite),
      isPinned: Boolean(prompt.isPinned),
      lastUsedAt: prompt.lastUsedAt || null,
      title: prompt.title,
      usageCount: normalizeUsageCount(prompt.usageCount),
    })),
    schema: "black-flash-orbit.prompt-library",
    version: 1,
  };
}

function getImportPromptSource(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.prompts)) return body.prompts;
  if (Array.isArray(body?.data?.prompts)) return body.data.prompts;

  return null;
}

function normalizePromptImportRows(body, user) {
  const source = getImportPromptSource(body);

  if (!Array.isArray(source)) {
    throw createHttpError(
      "Payload import wajib berisi array prompts.",
      400,
      "prompt_import_schema_invalid",
    );
  }

  if (source.length === 0 || source.length > MAX_PROMPT_IMPORT_ITEMS) {
    throw createHttpError(
      `Import prompt harus berisi 1-${MAX_PROMPT_IMPORT_ITEMS} item.`,
      400,
      "prompt_import_count_invalid",
    );
  }

  return source.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createHttpError(
        `Prompt import #${index + 1} tidak valid.`,
        400,
        "prompt_import_item_invalid",
      );
    }

    return {
      ...normalizePromptPayload(item),
      ...createPromptAuditPayload(user),
      is_favorite: normalizeBoolean(item.isFavorite ?? item.is_favorite),
      is_pinned: normalizeBoolean(item.isPinned ?? item.is_pinned),
      last_used_at: normalizeIsoDate(item.lastUsedAt || item.last_used_at),
      usage_count: normalizeUsageCount(item.usageCount || item.usage_count),
    };
  });
}

function createPromptCopyTitle(title) {
  const baseTitle = normalizeText(title, "Prompt Template").replace(
    /\s+\(Copy\)$/i,
    "",
  );

  return `${baseTitle} (Copy)`.slice(0, MAX_PROMPT_TITLE_LENGTH);
}

function getPromptCategorySlugsFromPrompts(prompts = []) {
  return prompts
    .map((prompt) => normalizePromptCategory(prompt?.category, ""))
    .filter(Boolean)
    .filter((category, index, categories) => categories.indexOf(category) === index);
}

function getAuthUserId(user) {
  return normalizeText(user?.id);
}

function getAuthUserEmail(user) {
  return normalizeText(user?.email || user?.user_metadata?.email);
}

function getAuthUserFullName(user) {
  const metadata = user?.user_metadata || {};

  return normalizeText(
    metadata.full_name || metadata.name || metadata.display_name,
    getAuthUserEmail(user).split("@")[0] || "Authenticated User",
  );
}

function createAvatarInitials(value) {
  const words = normalizeText(value, "U")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function createFallbackProfile(user) {
  const email = getAuthUserEmail(user);
  const fullName = getAuthUserFullName(user);

  return {
    id: getAuthUserId(user),
    email,
    fullName,
    role: "user",
    avatarInitials: createAvatarInitials(fullName || email),
    workspace: "BLACK FLASH ORBIT",
  };
}

function createFallbackPrompts(user) {
  const now = new Date().toISOString();
  const ownerId = getAuthUserId(user);
  const fallbackPromptMap = {
    newsroom: {
      title: "Newsroom Brief Generator",
      content: "Buat ringkasan berita cepat, faktual, dan siap publikasi.",
    },
    osint: {
      title: "OSINT Entity Analysis",
      content: "Analisis entitas publik secara etis dari sumber terbuka.",
    },
    engineering: {
      title: "Engineering Review",
      content:
        "Audit perubahan kode, risiko regresi, performa, dan rekomendasi patch production-ready.",
    },
    security: {
      title: "Security Risk Review",
      content:
        "Identifikasi risiko keamanan, validasi akses, dan langkah mitigasi defensif.",
    },
    product: {
      title: "Product Brief",
      content:
        "Susun brief produk berisi masalah pengguna, scope MVP, user flow, dan acceptance criteria.",
    },
    audit: {
      title: "Audit Report",
      content:
        "Buat laporan audit ringkas berisi temuan, severity, dampak, dan rekomendasi final.",
    },
    codex: {
      title: "Codex Operator Task",
      content:
        "Ubah instruksi menjadi task coding terstruktur dengan file target, batasan, dan test wajib.",
    },
    backend: {
      title: "Backend API Patch",
      content:
        "Rancang patch backend aman untuk endpoint, validasi input, ownership, dan error response.",
    },
    frontend: {
      title: "Frontend UI Patch",
      content:
        "Rancang perubahan UI responsif dengan state loading, empty, error, dan interaksi jelas.",
    },
    database: {
      title: "Database Migration Plan",
      content:
        "Buat rencana migrasi database aman, idempotent, indexed, dan kompatibel dengan data lama.",
    },
    supabase: {
      title: "Supabase RLS Review",
      content:
        "Review schema Supabase, RLS policy, auth.uid ownership, index, dan query efisien.",
    },
    automation: {
      title: "Automation Workflow",
      content:
        "Susun workflow automation untuk job, status, history, retry, dan observability.",
    },
    monitoring: {
      title: "Monitoring Checklist",
      content:
        "Buat checklist monitoring health, metrics, logs, alert, dan indikator service readiness.",
    },
    reports: {
      title: "Executive Report",
      content:
        "Buat report profesional berisi summary, data utama, analisis, risiko, dan next action.",
    },
    ai: {
      title: "AI Prompt Optimizer",
      content:
        "Optimalkan prompt AI agar instruksi jelas, konteks cukup, output terstruktur, dan aman.",
    },
    devops: {
      title: "DevOps Release Plan",
      content:
        "Susun release plan berisi build, env, migration, rollback, dan post-deploy verification.",
    },
  };

  return promptCategories.map((category) => ({
    id: `fallback-${category.slug}`,
    title: fallbackPromptMap[category.slug].title,
    category: category.slug,
    content: fallbackPromptMap[category.slug].content,
    isFavorite: false,
    isPinned: false,
    lastUsedAt: null,
    usageCount: 0,
    userId: ownerId,
    userEmail: getAuthUserEmail(user).toLowerCase() || null,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  }));
}

async function getProjects() {
  if (!supabase) return fallbackProjects;

  const { data, error } = await supabase
    .from("orbit_projects")
    .select("id, name, type, status, score, last_scan, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase projects error:", error.message);
    return fallbackProjects;
  }

  return data.map(mapProject);
}

async function getReports() {
  if (!supabase) return fallbackReports;

  const { data, error } = await supabase
    .from("orbit_reports")
    .select("id, type, score, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase reports error:", error.message);
    return fallbackReports;
  }

  return data.map(mapReport);
}

async function getPrompts(user, filters = {}) {
  if (!supabase) return createFallbackPrompts(user);

  const query = applyPromptFilters(
    supabase.from("orbit_prompts").select(getPromptSelectColumns()),
    user,
    filters,
  )
    .order("is_pinned", { ascending: false })
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Supabase prompts error:", error.message);
    return createFallbackPrompts(user);
  }

  return data.map(mapPrompt);
}

async function getPromptCategoriesFromDatabase() {
  if (!supabase) return getPromptCategories();

  const { data, error } = await supabase
    .from("orbit_prompt_categories")
    .select("slug, label, color, icon, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase prompt categories error:", error.message);
    return getPromptCategories();
  }

  return getPromptCategories(data || []);
}

async function getActivity(limit = 20) {
  if (!supabase) {
    return [
      {
        type: "system",
        message: "ORBIT backend online",
        time: new Date().toISOString(),
      },
    ];
  }

  const { data, error } = await supabase
    .from("orbit_activity")
    .select("id, type, message, time, created_at")
    .order("time", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase activity error:", error.message);

    return [
      {
        type: "system",
        message: "ORBIT backend online",
        time: new Date().toISOString(),
      },
    ];
  }

  return data.map(mapActivity);
}

async function getProfile(user) {
  const fallbackProfile = createFallbackProfile(user);

  if (!supabase) return fallbackProfile;

  const columns =
    "id, email, full_name, role, avatar_initials, workspace, created_at, updated_at";

  const { data: profileById, error: profileByIdError } = await supabase
    .from("orbit_profiles")
    .select(columns)
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    console.error("Supabase profile by id error:", profileByIdError.message);
    return fallbackProfile;
  }

  if (profileById) return mapProfile(profileById, user);

  const email = getAuthUserEmail(user);

  if (!email) return fallbackProfile;

  const { data: profileByEmail, error: profileByEmailError } = await supabase
    .from("orbit_profiles")
    .select(columns)
    .eq("email", email)
    .maybeSingle();

  if (profileByEmailError) {
    console.error(
      "Supabase profile by email error:",
      profileByEmailError.message,
    );
    return fallbackProfile;
  }

  return profileByEmail ? mapProfile(profileByEmail, user) : fallbackProfile;
}

function getAutomationEngines() {
  return {
    ...automationEngines,
    workflowHistory: {
      name: "Workflow History",
      status: getWorkflowPersistenceStatus().configured ? "READY" : "DEGRADED",
      description: "Persist owner-scoped workflow runs, approvals, and audit events.",
    },
  };
}

function getAutomationStatus(user) {
  const engines = Object.values(getAutomationEngines());
  const readyEngines = engines.filter((engine) =>
    ["ACTIVE", "ONLINE", "READY", "SYNCED"].includes(engine.status),
  );
  const workflow = defaultWorkflowEngine.getSnapshot();

  return {
    success: true,
    status: readyEngines.length === engines.length ? "READY" : "DEGRADED",
    userId: getAuthUserId(user),
    database: supabase ? "CONNECTED" : "NOT_CONFIGURED",
    workflowPersistence: getWorkflowPersistenceStatus(),
    uptime: process.uptime(),
    workflow,
    totalEngines: engines.length,
    readyEngines: readyEngines.length,
    timestamp: new Date().toISOString(),
  };
}

function getAutomationJobs(user) {
  const timestamp = new Date().toISOString();
  const ownerId = getAuthUserId(user);
  const workflowJobs = defaultWorkflowEngine.listDefinitions().map((definition) => ({
    id: definition.id,
    engine: "workflowEngine",
    name: definition.name,
    ownerId,
    requiresApproval: definition.requiresApproval,
    route: "/api/v1/automation/runs",
    schedule: "manual",
    status: "READY",
    stepCount: definition.stepCount,
    updatedAt: timestamp,
  }));

  return [
    ...automationJobs.map((job) => ({
      ...job,
      ownerId,
      updatedAt: timestamp,
    })),
    ...workflowJobs,
  ];
}

function createModuleResponse({
  data = [],
  metrics = {},
  module,
  status = "ready",
  extra = {},
}) {
  return {
    success: true,
    status,
    module,
    data,
    metrics,
    message: "Module ready for staging.",
    ...extra,
  };
}

function mapAutomationHistory(row) {
  return {
    id: row.id,
    jobId: row.type || "workspace-audit",
    reportCode: row.report_code,
    type: row.type,
    score: row.score,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

async function getAutomationHistory(user, limit = 25) {
  const legacyWorkflowRuns = defaultWorkflowEngine.listRuns(user).map((run) => ({
    createdAt: run.createdAt,
    detail: `${run.completedSteps}/${run.totalSteps} steps completed.`,
    id: run.id,
    jobId: run.workflowId,
    result: run.state,
    status: run.state,
    title: run.definitionName,
    type: "workflow_run",
  }));
  let workflowRuns = [];

  try {
    const persistedRuns = await listWorkflowRuns({
      limit,
      ownerId: getAuthUserId(user),
    });

    workflowRuns = persistedRuns.map((run) => ({
      createdAt: run.createdAt,
      detail: `Workflow ${run.metadata?.templateName || run.definitionId} is ${run.status}.`,
      id: run.id,
      jobId: run.definitionId,
      result: run.status,
      status: run.status,
      time: run.createdAt,
      title: run.metadata?.templateName || run.definitionId,
      type: "workflow_run",
    }));
  } catch (error) {
    console.warn("Workflow automation history unavailable:", {
      code: error.code || null,
    });
  }

  const mergedWorkflowRuns = [
    ...workflowRuns,
    ...legacyWorkflowRuns.filter(
      (legacyRun) =>
        !workflowRuns.some((persistedRun) => persistedRun.id === legacyRun.id),
    ),
  ];

  if (!supabase) return mergedWorkflowRuns.slice(0, limit);

  const { data, error } = await supabase
    .from("orbit_audit_reports")
    .select("id, report_code, type, score, status, summary, created_at")
    .eq("user_id", getAuthUserId(user))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase automation history error:", error.message);
    return [];
  }

  return [...mergedWorkflowRuns, ...(data || []).map(mapAutomationHistory)].slice(0, limit);
}

function sendWorkflowError(res, error) {
  const statusCode = error.statusCode || error.status || 500;
  const safeStatusCode =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  return res.status(safeStatusCode).json({
    success: false,
    code: error.code || "WORKFLOW_REQUEST_FAILED",
    message:
      safeStatusCode >= 500
        ? "Workflow request failed."
        : error.message || "Workflow request failed.",
  });
}

async function updatePrompt(req, res, options = {}) {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const promptId = normalizePromptId(req.params?.id);

    if (!promptId) {
      throw createHttpError("Prompt id wajib diisi.", 400, "prompt_id_required");
    }

    const partial =
      typeof options.partial === "boolean"
        ? options.partial
        : req.method !== "PUT";
    const payload = normalizePromptPayload(options.body || req.body, {
      partial,
    });
    const cleanPayload = {
      ...payload,
      updated_at: new Date().toISOString(),
      user_email: getAuthUserEmail(req.user).toLowerCase() || null,
    };

    if (Object.keys(payload).length === 0) {
      throw createHttpError(
        "Tidak ada perubahan prompt.",
        400,
        "prompt_payload_empty",
      );
    }

    const { data, error } = await applyPromptFilters(
      supabase.from("orbit_prompts").update(cleanPayload).eq("id", promptId),
      req.user,
    )
      .select(getPromptSelectColumns())
      .maybeSingle();

    if (error) {
      console.error("Supabase prompt update error:", error.message);
      throw createHttpError(
        "Gagal memperbarui prompt.",
        500,
        "prompt_update_failed",
      );
    }

    if (!data) {
      throw createHttpError(
        "Prompt tidak ditemukan atau bukan milik user login.",
        404,
        "prompt_not_found",
      );
    }

    return res.json({
      success: true,
      data: mapPrompt(data),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal memperbarui prompt.");
  }
}

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "ready",
    module: "health",
    data: [],
    metrics: {
      uptime: process.uptime(),
    },
    message: "Module ready for staging.",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get("/healthz", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "ready",
    module: "health",
    data: [],
    metrics: {
      uptime: process.uptime(),
    },
    message: "Module ready for staging.",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.use(
  [
    "/activity",
    "/automation",
    "/dashboard",
    "/metrics",
    "/monitoring",
    "/osint",
    "/projects",
    "/reports",
    "/security",
    "/settings",
    "/system",
    "/workspace",
  ],
  requireAuth,
);

router.get("/system", (req, res) => {
  const health = getHealthSnapshot();

  res.json({
    success: true,
    status: health.status === "healthy" ? "ready" : health.status,
    module: "system",
    data: [],
    metrics: {
      uptime: process.uptime(),
    },
    message: "Module ready for staging.",
    apiVersion: "v1",
    environment: health.environment,
    runtime: health.runtime,
    timestamp: health.timestamp,
  });
});

router.get("/dashboard/status", async (req, res) => {
  let activity = [];
  let degradedReason = "";
  let projects = fallbackProjects;
  let reports = fallbackReports;

  try {
    [projects, reports, activity] = await Promise.all([
      getProjects(),
      getReports(),
      getActivity(20),
    ]);
  } catch (error) {
    degradedReason = "dashboard_status_provider_failed";
    activity = [
      {
        type: "system",
        message: "Dashboard telemetry degraded. Fallback data returned.",
        time: new Date().toISOString(),
      },
    ];
    console.error(
      "Dashboard status provider error:",
      error?.message || "Unknown provider error",
    );
  }

  const isDegraded = Boolean(degradedReason);
  const dashboardStatus = isDegraded ? "degraded" : "ready";
  const timestamp = new Date().toISOString();
  const healthSnapshot = getHealthSnapshot();
  const health = {
    ...healthSnapshot,
    status: isDegraded ? "degraded" : healthSnapshot.status,
    timestamp,
  };

  return res.json({
    success: true,
    status: dashboardStatus,
    module: "dashboard",
    message: isDegraded
      ? "Dashboard telemetry degraded. Fallback data returned."
      : "Module ready for staging.",
    ...(isDegraded
      ? {
          code: "DASHBOARD_STATUS_DEGRADED",
          degraded: true,
          degradedReason,
        }
      : {}),
    data: {
      activity,
      automation: getAutomationEngines(),
      health,
      metrics: {
        degraded: isDegraded,
        memory: process.memoryUsage(),
        projects: projects.length,
        reports: reports.length,
        timestamp,
        uptime: process.uptime(),
      },
      operationalIntelligence: getOperationalIntelligence({ user: req.user }),
      projects,
      security: {
        securityScore: null,
        helmet: "PROTECTED",
        cors: "PROTECTED",
        rateLimit: "ACTIVE",
        lastAudit: null,
        issues: [],
      },
      system: {
        status: isDegraded ? "degraded" : "online",
        module: "system",
        apiVersion: "v1",
        environment: health.environment,
        runtime: health.runtime,
        timestamp,
      },
    },
    metrics: {
      degraded: isDegraded,
      projects: projects.length,
      reports: reports.length,
      uptime: process.uptime(),
    },
    timestamp,
  });
});

router.get("/dashboard", async (req, res) => {
  const [projects, reports, activity] = await Promise.all([
    getProjects(),
    getReports(),
    getActivity(20),
  ]);
  const health = getHealthSnapshot();

  return res.json(
    createModuleResponse({
      module: "dashboard",
      data: {
        activity,
        automation: getAutomationEngines(),
        health,
        operationalIntelligence: getOperationalIntelligence({ user: req.user }),
        projects,
        system: {
          status: "online",
          module: "system",
          apiVersion: "v1",
          environment: health.environment,
          runtime: health.runtime,
          timestamp: health.timestamp,
        },
      },
      metrics: {
        projects: projects.length,
        reports: reports.length,
        uptime: process.uptime(),
      },
    }),
  );
});

router.get("/metrics", async (req, res) => {
  const memory = process.memoryUsage();
  const [projects, reports] = await Promise.all([getProjects(), getReports()]);

  res.json({
    projects: projects.length,
    reports: reports.length,
    uptime: process.uptime(),
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
    },
  });
});

router.get("/activity", async (req, res) => {
  const activity = await getActivity(20);
  res.json(activity);
});

router.get("/reports/summary", async (req, res) => {
  const reports = await getReports();

  const totalReports = reports.length;
  const averageScore =
    totalReports === 0
      ? 0
      : Math.round(
          reports.reduce((sum, report) => sum + Number(report.score || 0), 0) /
            totalReports,
        );

  const statusCount = reports.reduce((acc, report) => {
    const status = report.status || "UNKNOWN";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    totalReports,
    averageScore,
    statusCount,
    latestReport: reports[0] || null,
  });
});

router.get("/reports/:id", async (req, res) => {
  const reportId = normalizeText(req.params?.id);

  if (!reportId) {
    return res.status(400).json({
      success: false,
      message: "Report id wajib diisi.",
    });
  }

  const reports = await getReports();
  const report = reports.find((item) => item.id === reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: `Report tidak ditemukan: ${reportId}`,
    });
  }

  return res.json({
    success: true,
    data: report,
  });
});

router.get("/monitoring", async (req, res) => {
  const memory = process.memoryUsage();

  const [projects, reports, activity] = await Promise.all([
    getProjects(),
    getReports(),
    getActivity(10),
  ]);

  res.json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "online",
    apiVersion: "v1",
    environment: process.env.NODE_ENV || "development",
    telemetry: {
      health: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    metrics: {
      projects: projects.length,
      reports: reports.length,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
    },
    activity,
    modules: {
      health: "ACTIVE",
      system: "ACTIVE",
      metrics: "ACTIVE",
      activity: "ACTIVE",
      security: "ACTIVE",
      osint: "ACTIVE",
      automation: "ACTIVE",
      workspace: "ACTIVE",
      reports: "ACTIVE",
      prompts: "ACTIVE",
    },
  });
});

router.get("/projects", async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

router.get("/reports", async (req, res) => {
  const reports = await getReports();
  res.json(
    createModuleResponse({
      module: "reports",
      data: reports,
      metrics: {
        total: reports.length,
      },
    }),
  );
});

router.get("/prompts/categories", requireAuth, async (req, res) => {
  const categories = await getPromptCategoriesFromDatabase();

  res.json({
    success: true,
    data: categories,
    slugs: categories.map((category) => category.slug),
  });
});

router.get("/prompts", requireAuth, async (req, res) => {
  const prompts = await getPrompts(req.user, {
    category: req.query?.category,
    search: req.query?.search || req.query?.q,
  });

  res.json(prompts);
});

router.get("/prompts/export", requireAuth, async (req, res) => {
  try {
    const prompts = await getPrompts(req.user);

    return res.json({
      success: true,
      data: createPromptExportPayload(prompts),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal export prompt library.");
  }
});

router.post("/prompts/import", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const rows = normalizePromptImportRows(req.body, req.user);
    const { data, error } = await supabase
      .from("orbit_prompts")
      .insert(rows)
      .select(getPromptSelectColumns());

    if (error) {
      console.error("Supabase prompt import error:", error.message);
      throw createHttpError(
        "Gagal import prompt library.",
        500,
        "prompt_import_failed",
      );
    }

    return res.status(201).json({
      success: true,
      data: (data || []).map(mapPrompt),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal import prompt library.");
  }
});

router.post("/prompts", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const payload = {
      ...normalizePromptPayload(req.body),
      ...createPromptAuditPayload(req.user),
    };

    const { data, error } = await supabase
      .from("orbit_prompts")
      .insert([payload])
      .select(getPromptSelectColumns())
      .single();

    if (error) {
      console.error("Supabase prompt insert error:", error.message);
      throw createHttpError(
        "Gagal menyimpan prompt.",
        500,
        "prompt_insert_failed",
      );
    }

    return res.status(201).json({
      success: true,
      data: mapPrompt(data),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal menyimpan prompt.");
  }
});

router.patch("/prompts/:id", requireAuth, async (req, res) => {
  return updatePrompt(req, res);
});

router.put("/prompts/:id", requireAuth, async (req, res) => {
  return updatePrompt(req, res);
});

router.post("/prompts/:id/favorite", requireAuth, async (req, res) => {
  return updatePrompt(req, res, {
    body: {
      isFavorite:
        req.body?.isFavorite ?? req.body?.is_favorite ?? req.body?.favorite,
    },
    partial: true,
  });
});

router.post("/prompts/:id/pin", requireAuth, async (req, res) => {
  return updatePrompt(req, res, {
    body: {
      isPinned: req.body?.isPinned ?? req.body?.is_pinned ?? req.body?.pinned,
    },
    partial: true,
  });
});

router.post("/prompts/:id/duplicate", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const promptId = normalizePromptId(req.params?.id);

    if (!promptId) {
      throw createHttpError("Prompt id wajib diisi.", 400, "prompt_id_required");
    }

    const { data: sourcePrompt, error: sourceError } = await applyPromptFilters(
      supabase.from("orbit_prompts").select(getPromptSelectColumns()).eq("id", promptId),
      req.user,
    ).maybeSingle();

    if (sourceError) {
      console.error("Supabase prompt duplicate lookup error:", sourceError.message);
      throw createHttpError(
        "Gagal duplicate prompt.",
        500,
        "prompt_duplicate_lookup_failed",
      );
    }

    if (!sourcePrompt) {
      throw createHttpError(
        "Prompt tidak ditemukan atau bukan milik user login.",
        404,
        "prompt_not_found",
      );
    }

    const payload = {
      category: normalizePromptCategory(sourcePrompt.category),
      content: normalizePromptContent(sourcePrompt.content),
      is_favorite: Boolean(sourcePrompt.is_favorite),
      is_pinned: false,
      title: createPromptCopyTitle(sourcePrompt.title),
      ...createPromptAuditPayload(req.user),
    };

    const { data, error } = await supabase
      .from("orbit_prompts")
      .insert([payload])
      .select(getPromptSelectColumns())
      .single();

    if (error) {
      console.error("Supabase prompt duplicate error:", error.message);
      throw createHttpError(
        "Gagal duplicate prompt.",
        500,
        "prompt_duplicate_failed",
      );
    }

    return res.status(201).json({
      success: true,
      data: mapPrompt(data),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal duplicate prompt.");
  }
});

router.post("/prompts/:id/use", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const promptId = normalizePromptId(req.params?.id);

    if (!promptId) {
      throw createHttpError("Prompt id wajib diisi.", 400, "prompt_id_required");
    }

    const { data: sourcePrompt, error: sourceError } = await applyPromptFilters(
      supabase
        .from("orbit_prompts")
        .select("id, usage_count")
        .eq("id", promptId),
      req.user,
    ).maybeSingle();

    if (sourceError) {
      console.error("Supabase prompt use lookup error:", sourceError.message);
      throw createHttpError(
        "Gagal update usage prompt.",
        500,
        "prompt_use_lookup_failed",
      );
    }

    if (!sourcePrompt) {
      throw createHttpError(
        "Prompt tidak ditemukan atau bukan milik user login.",
        404,
        "prompt_not_found",
      );
    }

    const { data, error } = await applyPromptFilters(
      supabase
        .from("orbit_prompts")
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: normalizeUsageCount(sourcePrompt.usage_count) + 1,
        })
        .eq("id", promptId),
      req.user,
    )
      .select(getPromptSelectColumns())
      .maybeSingle();

    if (error) {
      console.error("Supabase prompt use error:", error.message);
      throw createHttpError(
        "Gagal update usage prompt.",
        500,
        "prompt_use_failed",
      );
    }

    return res.json({
      success: true,
      data: mapPrompt(data),
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal update usage prompt.");
  }
});

router.delete("/prompts/:id", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      throw createHttpError(
        "Supabase belum dikonfigurasi.",
        503,
        "supabase_not_configured",
      );
    }

    const promptId = normalizePromptId(req.params?.id);

    if (!promptId) {
      throw createHttpError("Prompt id wajib diisi.", 400, "prompt_id_required");
    }

    const { data, error } = await applyPromptFilters(
      supabase.from("orbit_prompts").delete().eq("id", promptId),
      req.user,
    )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Supabase prompt delete error:", error.message);
      throw createHttpError(
        "Gagal menghapus prompt.",
        500,
        "prompt_delete_failed",
      );
    }

    if (!data) {
      throw createHttpError(
        "Prompt tidak ditemukan atau bukan milik user login.",
        404,
        "prompt_not_found",
      );
    }

    return res.json({
      success: true,
      data: { id: promptId },
    });
  } catch (error) {
    return sendPromptError(res, error, "Gagal menghapus prompt.");
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfile(req.user);
  res.json(profile);
});

router.get("/security", requireAdmin, (req, res) => {
  const security = {
    securityScore: 94,
    helmet: "PROTECTED",
    cors: "PROTECTED",
    rateLimit: "ACTIVE",
    lastAudit: "8 min ago",
    issues: [
      {
        id: "SEC-001",
        severity: "low",
        message: "Review development CORS policy before production deploy.",
      },
      {
        id: "SEC-002",
        severity: "low",
        message: "Rotate audit snapshots after the next release cycle.",
      },
    ],
  };

  res.json({
    ...createModuleResponse({
      module: "security",
      data: security.issues,
      metrics: {
        securityScore: security.securityScore,
        issues: security.issues.length,
      },
    }),
    ...security,
  });
});

router.get("/osint", (req, res) => {
  res.json({
    mode: "DEFENSIVE_ONLY",
    status: "SAFE",
    backend: "workspace-ready",
    scraping: false,
    exploitation: false,
    privateDataAccess: false,
    message:
      "OSINT Workspace berjalan dalam mode legal defensive. Tidak menyediakan scraping agresif, bypass login, exploit, atau akses data privat.",
    entityTypes: [
      "Public figure",
      "Government program",
      "Public institution",
      "Company",
      "Location",
      "Community organization",
      "Project contractor",
    ],
    sourceCategories: [
      {
        id: "official-records",
        name: "Official Records",
        risk: "Low",
        credibility: "High",
      },
      {
        id: "news-archive",
        name: "News Archive",
        risk: "Medium",
        credibility: "Medium",
      },
      {
        id: "public-signal",
        name: "Public Signal",
        risk: "Medium",
        credibility: "Medium",
      },
      {
        id: "document-trail",
        name: "Document Trail",
        risk: "Low",
        credibility: "High",
      },
    ],
    workflow: [
      {
        step: 1,
        title: "Case Scope Defined",
        status: "Scope",
      },
      {
        step: 2,
        title: "Source Collection",
        status: "Collect",
      },
      {
        step: 3,
        title: "Cross-check Evidence",
        status: "Verify",
      },
      {
        step: 4,
        title: "Editorial Risk Review",
        status: "Review",
      },
    ],
    ethicalNotice: [
      "Gunakan hanya sumber terbuka yang sah, relevan, dan dapat diverifikasi.",
      "Respect privacy and consent.",
      "Record source provenance.",
      "Escalate sensitive findings to editor/legal review.",
    ],
  });
});

router.get("/automation", (req, res) => {
  const engines = getAutomationEngines();

  res.json(
    createModuleResponse({
      module: "automation",
      data: engines,
      metrics: {
        totalEngines: Object.keys(engines).length,
      },
      extra: {
        engines,
        workflow: defaultWorkflowEngine.getSnapshot(),
        workflowDefinitions: defaultWorkflowEngine.listDefinitions(),
      },
    }),
  );
});

router.get("/automation/status", requireAuth, (req, res) => {
  res.json(getAutomationStatus(req.user));
});

router.get("/automation/jobs", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: getAutomationJobs(req.user),
  });
});

router.get("/automation/definitions", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: defaultWorkflowEngine.listDefinitions(),
  });
});

router.get("/automation/history", requireAuth, async (req, res) => {
  const history = await getAutomationHistory(req.user);

  res.json({
    success: true,
    data: history,
  });
});

router.get("/automation/runs", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: defaultWorkflowEngine.listRuns(req.user),
  });
});

router.get("/automation/runs/:id", requireAuth, (req, res) => {
  try {
    return res.json({
      success: true,
      data: defaultWorkflowEngine.getOwnedRun(req.params.id, req.user),
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/automation/runs", requireAuth, async (req, res) => {
  try {
    const run = await defaultWorkflowEngine.startRun({
      input: req.body?.input || {},
      user: req.user,
      workflowId: req.body?.workflowId || req.body?.workflow_id,
    });

    return res.status(201).json({
      success: true,
      data: run,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/automation/runs/:id/approve", requireAuth, async (req, res) => {
  try {
    const run = await defaultWorkflowEngine.approveRun({
      runId: req.params.id,
      user: req.user,
    });

    return res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/automation/runs/:id/cancel", requireAuth, (req, res) => {
  try {
    return res.json({
      success: true,
      data: defaultWorkflowEngine.cancelRun({
        runId: req.params.id,
        user: req.user,
      }),
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.get("/workspace", (req, res) => {
  res.json({
    path: "D:\\Projects",
    totalProjects: 6,
    activeProject: "BLACK-FLASH-ORBIT",
    scannerStatus: "READY",
    lastScan: "2 min ago",
  });
});

router.get("/settings", (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || "development",
    apiVersion: "v1",
    workspacePath: "D:\\Projects",
    securityMode: "Defensive",
    appName: "BLACK FLASH ORBIT",
  });
});

module.exports = router;
