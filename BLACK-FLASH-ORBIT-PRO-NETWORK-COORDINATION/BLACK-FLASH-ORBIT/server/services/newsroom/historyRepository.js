const { getSupabaseAdmin } = require("../supabaseAdmin");

const REVIEW_STATUSES = new Set([
  "DRAFT",
  "AI_REVIEWED",
  "NEEDS_REVIEW",
  "READY_FOR_EDITOR",
  "APPROVED",
  "REJECTED",
]);
const AI_WRITABLE_REVIEW_STATUSES = new Set([
  "DRAFT",
  "AI_REVIEWED",
  "NEEDS_REVIEW",
  "READY_FOR_EDITOR",
]);
const DECISIONS = new Set([
  "APPROVE",
  "REJECT",
  "RETURN_TO_REVIEW",
  "STATUS_CHANGE",
]);
const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "cookie",
  "openrouter_api_key",
  "password",
  "private_key",
  "rawprompt",
  "raw_prompt",
  "rawproviderpayload",
  "raw_provider_payload",
  "secret",
  "service_role",
  "service_role_key",
  "supabase_service_role_key",
  "systemprompt",
  "system_prompt",
  "token",
]);
const MAX_DRAFT_LENGTH = 120000;
const MAX_TOPIC_LENGTH = 3000;
const MAX_SUMMARY_LENGTH = 1200;
const MAX_NOTES_LENGTH = 4000;
const MAX_TEXT_FIELD_LENGTH = 160;
const MAX_SEARCH_LENGTH = 120;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function createHttpError(message, statusCode = 500, code = "server_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getDatabase() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw createHttpError(
      "Supabase service belum dikonfigurasi.",
      503,
      "supabase_not_configured",
    );
  }

  return supabase;
}

function normalizeText(value, maxLength = MAX_TEXT_FIELD_LENGTH) {
  if (typeof value !== "string" && typeof value !== "number") return "";

  return String(value)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeId(value) {
  const id = normalizeText(value, 80);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    throw createHttpError("Generation id tidak valid.", 400, "invalid_id");
  }

  return id;
}

function normalizeReviewStatus(value, fallback = "NEEDS_REVIEW") {
  const status = normalizeText(value, 40).toUpperCase();

  return REVIEW_STATUSES.has(status) ? status : fallback;
}

function normalizeAiReviewStatus(value) {
  const status = normalizeReviewStatus(value);

  if (AI_WRITABLE_REVIEW_STATUSES.has(status)) return status;

  return "READY_FOR_EDITOR";
}

function normalizeDecision(value) {
  const decision = normalizeText(value, 40).toUpperCase();

  if (!DECISIONS.has(decision)) {
    throw createHttpError(
      "Decision editorial tidak valid.",
      400,
      "invalid_editorial_decision",
    );
  }

  return decision;
}

function sanitizeStructuredValue(value, depth = 0) {
  if (depth > 8) return null;
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, 200)
      .map((item) => sanitizeStructuredValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((next, [key, item]) => {
      const normalizedKey = String(key || "")
        .replace(/[^a-z0-9_]/gi, "_")
        .toLowerCase();

      if (SENSITIVE_KEYS.has(normalizedKey)) return next;
      if (
        normalizedKey.includes("authorization") ||
        normalizedKey.includes("apikey") ||
        normalizedKey.includes("api_key") ||
        normalizedKey.includes("password") ||
        normalizedKey.includes("prompt_raw") ||
        normalizedKey.includes("raw_prompt") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("service_role") ||
        normalizedKey.includes("system_prompt") ||
        normalizedKey.includes("systemprompt") ||
        normalizedKey.includes("token")
      ) {
        return next;
      }

      next[key] = sanitizeStructuredValue(item, depth + 1);
      return next;
    }, {});
  }
  if (typeof value === "string") {
    return value
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
      .slice(0, 20000);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;

  return null;
}

function getSafeJson(value) {
  const safeValue = sanitizeStructuredValue(value);

  return safeValue && typeof safeValue === "object" ? safeValue : {};
}

function getSafeDraft(value) {
  const draft = typeof value === "string" ? value.trim() : "";

  if (!draft) {
    throw createHttpError("Draft wajib diisi.", 400, "draft_required");
  }

  return draft
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .slice(0, MAX_DRAFT_LENGTH);
}

function getPublicationReadiness(body) {
  return (
    normalizeText(body?.publicationReadiness, 80) ||
    normalizeText(body?.intelligenceSummary?.publicationReadiness, 80) ||
    normalizeText(
      body?.editorialReviewReport?.summary?.publicationReadiness,
      80,
    ) ||
    normalizeText(body?.confidence?.publicationReadiness, 80) ||
    "NEEDS_REVIEW"
  );
}

function getPromptVersion(body) {
  return (
    normalizeText(body?.promptVersion, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(body?.metadata?.promptVersion, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(
      body?.editorialReviewReport?.safeMetadata?.promptVersion,
      MAX_TEXT_FIELD_LENGTH,
    ) ||
    normalizeText(
      body?.editorialReviewReport?.configuration?.promptVersion,
      MAX_TEXT_FIELD_LENGTH,
    )
  );
}

function getProvider(body) {
  return (
    normalizeText(body?.provider, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(body?.metadata?.provider, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(
      body?.editorialReviewReport?.safeMetadata?.provider,
      MAX_TEXT_FIELD_LENGTH,
    )
  );
}

function getModel(body) {
  return (
    normalizeText(body?.model, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(body?.metadata?.model, MAX_TEXT_FIELD_LENGTH) ||
    normalizeText(
      body?.editorialReviewReport?.safeMetadata?.model,
      MAX_TEXT_FIELD_LENGTH,
    )
  );
}

function buildGenerationInsert({ body, idempotencyKey, ownerId }) {
  const topic = normalizeText(body?.topic || body?.input, MAX_TOPIC_LENGTH);

  if (!topic) {
    throw createHttpError("Topic wajib diisi.", 400, "topic_required");
  }

  return {
    audience: normalizeText(body?.audience || body?.configuration?.audience),
    channel: normalizeText(body?.channel || body?.configuration?.channel),
    complexity: normalizeText(
      body?.complexity || body?.configuration?.complexity,
    ),
    draft: getSafeDraft(body?.draft),
    editorial_review_report: getSafeJson(body?.editorialReviewReport),
    idempotency_key: idempotencyKey || null,
    intelligence_summary: getSafeJson(body?.intelligenceSummary),
    mode: normalizeText(body?.mode || body?.configuration?.mode),
    model: getModel(body) || null,
    owner_id: ownerId,
    prompt_version: getPromptVersion(body) || null,
    provider: getProvider(body) || null,
    publication_readiness: getPublicationReadiness(body),
    review_status: normalizeAiReviewStatus(
      body?.reviewStatus ||
        body?.editorial?.reviewStatus ||
        body?.intelligenceSummary?.editorialStatus ||
        body?.editorialReviewReport?.summary?.editorialStatus,
    ),
    source_input_summary: normalizeText(
      body?.sourceInputSummary || body?.source_input_summary || topic,
      MAX_SUMMARY_LENGTH,
    ),
    topic,
    verification: getSafeJson(body?.verification),
  };
}

function mapGeneration(row, { includeDetails = true, decisions = [] } = {}) {
  if (!row) return null;

  const generation = {
    approvedAt: row.approved_at || null,
    approvedBy: row.approved_by || null,
    audience: row.audience || null,
    channel: row.channel || null,
    complexity: row.complexity || null,
    createdAt: row.created_at,
    editorNotes: row.editor_notes || "",
    id: row.id,
    mode: row.mode || null,
    model: row.model || null,
    ownerId: row.owner_id,
    promptVersion: row.prompt_version || null,
    provider: row.provider || null,
    publicationReadiness: row.publication_readiness || "NEEDS_REVIEW",
    rejectedAt: row.rejected_at || null,
    rejectedBy: row.rejected_by || null,
    reviewStatus: row.review_status || "NEEDS_REVIEW",
    sourceInputSummary: row.source_input_summary || "",
    topic: row.topic || "",
    updatedAt: row.updated_at,
  };

  if (includeDetails) {
    generation.decisionHistory = decisions.map(mapDecision);
    generation.draft = row.draft || "";
    generation.editorialReviewReport = row.editorial_review_report || {};
    generation.intelligenceSummary = row.intelligence_summary || {};
    generation.verification = row.verification || {};
  }

  return generation;
}

function mapDecision(row) {
  return {
    actorId: row.actor_id,
    createdAt: row.created_at,
    decision: row.decision,
    generationId: row.generation_id,
    id: row.id,
    nextStatus: row.next_status,
    notes: row.notes || "",
    overrideBlockers: Boolean(row.override_blockers),
    overrideReason: row.override_reason || "",
    ownerId: row.owner_id,
    previousStatus: row.previous_status || null,
  };
}

function getSelectColumns({ includeDetails = true } = {}) {
  const base = [
    "id",
    "owner_id",
    "created_at",
    "updated_at",
    "topic",
    "source_input_summary",
    "audience",
    "mode",
    "complexity",
    "channel",
    "provider",
    "model",
    "prompt_version",
    "review_status",
    "publication_readiness",
    "approved_at",
    "approved_by",
    "rejected_at",
    "rejected_by",
    "editor_notes",
  ];

  if (!includeDetails) return base.join(", ");

  return [
    ...base,
    "draft",
    "verification",
    "intelligence_summary",
    "editorial_review_report",
  ].join(", ");
}

async function getExistingByIdempotencyKey({ idempotencyKey, ownerId }) {
  if (!idempotencyKey) return null;

  const { data, error } = await getDatabase()
    .from("newsroom_generations")
    .select(getSelectColumns({ includeDetails: true }))
    .eq("owner_id", ownerId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw createHttpError(
      "Gagal membaca generation history.",
      500,
      "history_lookup_failed",
    );
  }

  return data ? mapGeneration(data) : null;
}

async function createGeneration({ body, idempotencyKey, ownerId }) {
  const safeKey = normalizeText(idempotencyKey || body?.idempotencyKey, 160);
  const existing = await getExistingByIdempotencyKey({
    idempotencyKey: safeKey,
    ownerId,
  });

  if (existing) {
    return {
      created: false,
      generation: existing,
    };
  }

  const payload = buildGenerationInsert({
    body,
    idempotencyKey: safeKey,
    ownerId,
  });
  const { data, error } = await getDatabase()
    .from("newsroom_generations")
    .insert([payload])
    .select(getSelectColumns({ includeDetails: true }))
    .single();

  if (error) {
    throw createHttpError(
      "Gagal menyimpan generation history.",
      500,
      "history_insert_failed",
    );
  }

  return {
    created: true,
    generation: mapGeneration(data),
  };
}

function applyHistoryFilters(query, queryParams = {}) {
  const reviewStatus = normalizeReviewStatus(queryParams.reviewStatus, "");
  const audience = normalizeText(queryParams.audience, MAX_TEXT_FIELD_LENGTH);
  const mode = normalizeText(queryParams.mode, MAX_TEXT_FIELD_LENGTH);
  const search = normalizeText(
    queryParams.search || queryParams.q,
    MAX_SEARCH_LENGTH,
  )
    .replace(/[%,()]/g, " ")
    .trim();
  const cursor = normalizeText(queryParams.cursor, 80);

  if (reviewStatus) query = query.eq("review_status", reviewStatus);
  if (audience) query = query.eq("audience", audience);
  if (mode) query = query.eq("mode", mode);
  if (cursor) query = query.lt("created_at", cursor);
  if (search) {
    query = query.or(
      [
        `topic.ilike.%${search}%`,
        `source_input_summary.ilike.%${search}%`,
        `mode.ilike.%${search}%`,
      ].join(","),
    );
  }

  return query;
}

function normalizeLimit(value) {
  const limit = Number(value || DEFAULT_LIMIT);

  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

async function listGenerations({ ownerId, queryParams = {} }) {
  const limit = normalizeLimit(queryParams.limit);
  let query = getDatabase()
    .from("newsroom_generations")
    .select(getSelectColumns({ includeDetails: false }))
    .eq("owner_id", ownerId);

  query = applyHistoryFilters(query, queryParams)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  const { data, error } = await query;

  if (error) {
    throw createHttpError(
      "Gagal membaca generation history.",
      500,
      "history_list_failed",
    );
  }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) =>
    mapGeneration(row, {
      includeDetails: false,
    }),
  );
  const nextCursor = hasMore
    ? items[items.length - 1]?.createdAt || null
    : null;

  return {
    items,
    pagination: {
      hasMore,
      limit,
      nextCursor,
    },
  };
}

async function getDecisionRows({ generationId, ownerId }) {
  const { data, error } = await getDatabase()
    .from("newsroom_editorial_decisions")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("generation_id", generationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw createHttpError(
      "Gagal membaca decision history.",
      500,
      "decision_history_failed",
    );
  }

  return data || [];
}

async function getGenerationById({ generationId, ownerId }) {
  const id = normalizeId(generationId);
  const { data, error } = await getDatabase()
    .from("newsroom_generations")
    .select(getSelectColumns({ includeDetails: true }))
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw createHttpError(
      "Gagal membaca generation.",
      500,
      "history_detail_failed",
    );
  }

  if (!data) {
    throw createHttpError(
      "Generation tidak ditemukan.",
      404,
      "history_not_found",
    );
  }

  const decisions = await getDecisionRows({ generationId: id, ownerId });

  return mapGeneration(data, { decisions });
}

function hasCriticalBlockers(generation) {
  const blockers = generation?.intelligenceSummary?.blockers;
  const reportBlockers =
    generation?.editorialReviewReport?.verification?.publicationBlockers;
  const verificationBlockers = generation?.verification?.publicationBlockers;

  return [blockers, reportBlockers, verificationBlockers].some(
    (items) => Array.isArray(items) && items.length > 0,
  );
}

function normalizePatchPayload(body = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "editorNotes")) {
    payload.editor_notes = normalizeText(body.editorNotes, MAX_NOTES_LENGTH);
  }

  if (Object.prototype.hasOwnProperty.call(body, "draft")) {
    payload.draft = getSafeDraft(body.draft);
  }

  if (Object.prototype.hasOwnProperty.call(body, "reviewStatus")) {
    const status = normalizeReviewStatus(body.reviewStatus);

    if (["APPROVED", "REJECTED"].includes(status)) {
      throw createHttpError(
        "Gunakan endpoint editorial decision untuk approve/reject.",
        400,
        "decision_endpoint_required",
      );
    }

    payload.review_status = status;
  }

  return payload;
}

async function updateGeneration({ body, generationId, ownerId }) {
  const id = normalizeId(generationId);
  const payload = normalizePatchPayload(body);

  if (Object.keys(payload).length === 0) {
    throw createHttpError(
      "Tidak ada field yang dapat diperbarui.",
      400,
      "empty_update",
    );
  }

  const { data, error } = await getDatabase()
    .from("newsroom_generations")
    .update(payload)
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select(getSelectColumns({ includeDetails: true }))
    .maybeSingle();

  if (error) {
    throw createHttpError(
      "Gagal memperbarui generation.",
      500,
      "history_update_failed",
    );
  }

  if (!data) {
    throw createHttpError(
      "Generation tidak ditemukan.",
      404,
      "history_not_found",
    );
  }

  return mapGeneration(data);
}

function buildDecisionUpdate({ body, generation, ownerId }) {
  const decision = normalizeDecision(body?.decision);
  const now = new Date().toISOString();
  const notes = normalizeText(
    body?.notes || body?.editorNotes,
    MAX_NOTES_LENGTH,
  );
  const overrideBlockers = Boolean(body?.overrideBlockers);
  const overrideReason = normalizeText(body?.overrideReason, MAX_NOTES_LENGTH);
  const blockersExist = hasCriticalBlockers(generation);

  if (decision === "APPROVE") {
    if (blockersExist && (!overrideBlockers || !overrideReason)) {
      throw createHttpError(
        "Approval diblokir oleh publication blocker. Override wajib memiliki alasan editor.",
        409,
        "approval_blocked",
      );
    }

    return {
      audit: {
        decision,
        next_status: "APPROVED",
        notes,
        override_blockers: overrideBlockers,
        override_reason: overrideReason || null,
      },
      generation: {
        approved_at: now,
        approved_by: ownerId,
        editor_notes: notes || generation.editorNotes || null,
        review_status: "APPROVED",
      },
    };
  }

  if (decision === "REJECT") {
    return {
      audit: {
        decision,
        next_status: "REJECTED",
        notes,
        override_blockers: false,
        override_reason: null,
      },
      generation: {
        editor_notes: notes || generation.editorNotes || null,
        rejected_at: now,
        rejected_by: ownerId,
        review_status: "REJECTED",
      },
    };
  }

  return {
    audit: {
      decision,
      next_status: "NEEDS_REVIEW",
      notes,
      override_blockers: false,
      override_reason: null,
    },
    generation: {
      editor_notes: notes || generation.editorNotes || null,
      review_status: "NEEDS_REVIEW",
    },
  };
}

async function recordEditorialDecision({ body, generationId, ownerId }) {
  const generation = await getGenerationById({ generationId, ownerId });
  const update = buildDecisionUpdate({ body, generation, ownerId });
  const id = normalizeId(generationId);
  const { data: updatedRow, error: updateError } = await getDatabase()
    .from("newsroom_generations")
    .update(update.generation)
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select(getSelectColumns({ includeDetails: true }))
    .maybeSingle();

  if (updateError) {
    throw createHttpError(
      "Gagal menyimpan keputusan editorial.",
      500,
      "decision_update_failed",
    );
  }

  if (!updatedRow) {
    throw createHttpError(
      "Generation tidak ditemukan.",
      404,
      "history_not_found",
    );
  }

  const { data: decisionRow, error: decisionError } = await getDatabase()
    .from("newsroom_editorial_decisions")
    .insert([
      {
        ...update.audit,
        actor_id: ownerId,
        generation_id: id,
        owner_id: ownerId,
        previous_status: generation.reviewStatus,
      },
    ])
    .select("*")
    .single();

  if (decisionError) {
    throw createHttpError(
      "Gagal menyimpan audit keputusan editorial.",
      500,
      "decision_audit_failed",
    );
  }

  const decisions = await getDecisionRows({ generationId: id, ownerId });

  return {
    decision: mapDecision(decisionRow),
    generation: mapGeneration(updatedRow, { decisions }),
  };
}

async function deleteGeneration({ generationId, ownerId }) {
  const id = normalizeId(generationId);
  const { data, error } = await getDatabase()
    .from("newsroom_generations")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw createHttpError(
      "Gagal menghapus generation.",
      500,
      "history_delete_failed",
    );
  }

  if (!data) {
    throw createHttpError(
      "Generation tidak ditemukan.",
      404,
      "history_not_found",
    );
  }

  return { id };
}

module.exports = {
  AI_WRITABLE_REVIEW_STATUSES,
  REVIEW_STATUSES,
  createGeneration,
  createHttpError,
  deleteGeneration,
  getGenerationById,
  hasCriticalBlockers,
  listGenerations,
  mapGeneration,
  normalizeAiReviewStatus,
  recordEditorialDecision,
  sanitizeStructuredValue,
  updateGeneration,
};
