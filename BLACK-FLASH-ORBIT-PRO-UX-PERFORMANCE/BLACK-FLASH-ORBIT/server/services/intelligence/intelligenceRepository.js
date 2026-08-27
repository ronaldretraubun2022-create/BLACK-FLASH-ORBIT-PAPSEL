const { getSupabaseAdmin } = require("../supabaseAdmin");
const { redactValue } = require("../observability/logger");
const {
  buildConflictKey,
  createHttpError,
  extractIntelligence,
  getEntityKey,
  normalizeClaimStatus,
  normalizeEntityType,
  normalizeKeyword,
  normalizeSafeSourceUrl,
  normalizeSourceInput,
  normalizeSourceType,
  sanitizeText,
} = require("./intelligenceExtractor");

const EXTRACTOR_VERSION = "orbit-intelligence-extractor-v1.2-reprocess";
const SOURCE_COLUMNS =
  "id, owner_id, source_type, source_id, title, content_hash, content_snapshot, source_url, duplicate_of_source_id, status, metadata, processed_at, created_at, updated_at";
const ENTITY_COLUMNS =
  "id, owner_id, entity_type, canonical_name, normalized_name, confidence, mention_count, first_seen_at, last_seen_at, created_at, updated_at";
const CLAIM_COLUMNS =
  "id, owner_id, source_id, claim_text, normalized_claim, conflict_key, claim_status, confidence, polarity, observed_at, metadata, created_at, updated_at";
const RELATIONSHIP_COLUMNS =
  "id, owner_id, source_id, subject_entity_id, object_entity_id, relationship_type, status, confidence, evidence_text, created_at, updated_at";
const SOURCE_LINK_COLUMNS =
  "id, owner_id, source_id, entity_id, claim_id, relationship_id, link_type, target_key, evidence_text, confidence, created_at";
const MAX_LIMIT = 100;

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw createHttpError(
      "Supabase service role belum dikonfigurasi.",
      503,
      "INTELLIGENCE_SUPABASE_NOT_CONFIGURED",
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
      "Intelligence schema missing.",
      503,
      "INTELLIGENCE_SCHEMA_MISSING",
    );
  }

  return createHttpError("Intelligence persistence gagal.", 500, fallbackCode);
}

function normalizeLimit(value, fallback = 25) {
  const limit = Number(value || fallback);

  if (!Number.isFinite(limit)) return fallback;

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function mapSource(row, options = {}) {
  const mapped = {
    contentHash: row.content_hash,
    createdAt: row.created_at,
    duplicateOfSourceId: row.duplicate_of_source_id || null,
    id: row.id,
    metadata: row.metadata || {},
    ownerId: row.owner_id,
    processedAt: row.processed_at || null,
    reprocessedAt: row.metadata?.reprocessedAt || null,
    sourceId: row.source_id,
    sourceType: row.source_type,
    sourceUrl: row.source_url || null,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };

  if (options.includeContent) {
    mapped.contentSnapshot = row.content_snapshot || "";
  }

  return mapped;
}

function safeMetadata(metadata = {}) {
  return JSON.parse(JSON.stringify(redactValue(metadata || {}) || {}));
}

function redactPersistedSourceContent(content) {
  return sanitizeText(content, 20000).replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[REDACTED_EMAIL]",
  );
}

function mapEntity(row, links = []) {
  return {
    canonicalName: row.canonical_name,
    confidence: Number(row.confidence || 0),
    createdAt: row.created_at,
    entityType: row.entity_type,
    firstSeenAt: row.first_seen_at || null,
    id: row.id,
    lastSeenAt: row.last_seen_at || null,
    mentionCount: Number(row.mention_count || 0),
    normalizedName: row.normalized_name,
    ownerId: row.owner_id,
    sourceReferences: links.map(mapSourceLink),
    updatedAt: row.updated_at,
  };
}

function mapClaim(row, links = []) {
  return {
    claimText: row.claim_text,
    confidence: Number(row.confidence || 0),
    conflictKey: row.conflict_key,
    createdAt: row.created_at,
    id: row.id,
    dateMentions: Array.isArray(row.metadata?.dateMentions)
      ? row.metadata.dateMentions
      : [],
    normalizedClaim: row.normalized_claim,
    observedAt: row.observed_at || null,
    ownerId: row.owner_id,
    polarity: row.polarity || "positive",
    sourceId: row.source_id,
    sourceReferences: links.map(mapSourceLink),
    status: row.claim_status,
    updatedAt: row.updated_at,
  };
}

function mapRelationship(row, links = []) {
  return {
    confidence: Number(row.confidence || 0),
    createdAt: row.created_at,
    evidenceText: row.evidence_text || "",
    id: row.id,
    objectEntityId: row.object_entity_id,
    ownerId: row.owner_id,
    relationshipType: row.relationship_type,
    sourceId: row.source_id,
    sourceReferences: links.map(mapSourceLink),
    status: row.status,
    subjectEntityId: row.subject_entity_id,
    updatedAt: row.updated_at,
  };
}

function mapSourceLink(row) {
  const source = row.orbit_intelligence_sources || row.source || null;

  return {
    confidence: Number(row.confidence || 0),
    createdAt: row.created_at,
    claimId: row.claim_id || null,
    entityId: row.entity_id || null,
    evidenceText: row.evidence_text || "",
    id: row.id,
    linkType: row.link_type,
    relationshipId: row.relationship_id || null,
    source: source
      ? {
          createdAt: source.created_at,
          id: source.id,
          sourceId: source.source_id,
          sourceType: source.source_type,
          sourceUrl: source.source_url || null,
          title: source.title,
        }
      : null,
    sourceId: row.source_id,
    targetKey: row.target_key || null,
  };
}

function buildLinkSelect(targetColumn) {
  return `${SOURCE_LINK_COLUMNS}, orbit_intelligence_sources:source_id(id, source_type, source_id, title, source_url, created_at)`;
}

async function selectSourceLinks({ claimIds = [], entityIds = [], ownerId, relationshipIds = [] }) {
  const client = getClient();
  const ids = [
    ...claimIds.map((id) => ({ column: "claim_id", id })),
    ...entityIds.map((id) => ({ column: "entity_id", id })),
    ...relationshipIds.map((id) => ({ column: "relationship_id", id })),
  ];

  if (!ids.length) return new Map();

  const linksByTarget = new Map();

  await Promise.all(
    ids.map(async ({ column, id }) => {
      const { data, error } = await client
        .from("orbit_intelligence_source_links")
        .select(buildLinkSelect(column))
        .eq("owner_id", ownerId)
        .eq(column, id)
        .limit(10);

      if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_LINK_LOOKUP_FAILED");

      linksByTarget.set(id, data || []);
    }),
  );

  return linksByTarget;
}

async function findDuplicateSource({ contentHash, ownerId, sourceId, sourceType }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_sources")
    .select(SOURCE_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("content_hash", contentHash)
    .neq("source_id", sourceId)
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_DUPLICATE_LOOKUP_FAILED");

  if (data) return mapSource(data);

  const { data: sameIdentity, error: identityError } = await client
    .from("orbit_intelligence_sources")
    .select(SOURCE_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (identityError) {
    throw normalizeSupabaseError(identityError, "INTELLIGENCE_SOURCE_LOOKUP_FAILED");
  }

  return sameIdentity ? mapSource(sameIdentity) : null;
}

async function upsertSource(source) {
  const duplicate = await findDuplicateSource(source);
  const client = getClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("orbit_intelligence_sources")
    .upsert(
      {
        content_hash: source.contentHash,
        content_snapshot: redactPersistedSourceContent(source.content),
        duplicate_of_source_id:
          duplicate && duplicate.sourceId !== source.sourceId ? duplicate.id : null,
        metadata: safeMetadata({
          extractorVersion: EXTRACTOR_VERSION,
          ...(source.reprocessedAt ? { reprocessedAt: source.reprocessedAt } : {}),
        }),
        owner_id: source.ownerId,
        processed_at: now,
        source_id: source.sourceId,
        source_type: source.sourceType,
        source_url: source.sourceUrl,
        status: duplicate && duplicate.sourceId !== source.sourceId ? "duplicate" : "processed",
        title: source.title,
        updated_at: now,
      },
      {
        onConflict: "owner_id,source_type,source_id",
      },
    )
    .select(SOURCE_COLUMNS)
    .single();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_UPSERT_FAILED");

  return mapSource(data);
}

async function updateSourceReprocessMetadata({ ownerId, reprocessedAt, sourceUuid }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_sources")
    .update({
      metadata: safeMetadata({
        extractorVersion: EXTRACTOR_VERSION,
        reprocessedAt,
      }),
      processed_at: reprocessedAt,
      status: "processed",
      updated_at: reprocessedAt,
    })
    .eq("owner_id", ownerId)
    .eq("id", sourceUuid)
    .select(SOURCE_COLUMNS)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_REPROCESS_UPDATE_FAILED");
  if (!data) {
    throw createHttpError("Intelligence source tidak ditemukan.", 404, "INTELLIGENCE_SOURCE_NOT_FOUND");
  }

  return mapSource(data);
}

async function countEntitySourceLinks({ entityId, ownerId }) {
  const client = getClient();
  const { count, error } = await client
    .from("orbit_intelligence_source_links")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("entity_id", entityId);

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_ENTITY_LINK_COUNT_FAILED");

  return Number(count || 0);
}

async function upsertEntity({ entity, ownerId, source, sourceRow }) {
  const client = getClient();
  const entityType = normalizeEntityType(entity.entityType);
  const normalizedName = normalizeKeyword(entity.normalizedName || entity.name, 120);
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await client
    .from("orbit_intelligence_entities")
    .select(ENTITY_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("entity_type", entityType)
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (lookupError) throw normalizeSupabaseError(lookupError, "INTELLIGENCE_ENTITY_LOOKUP_FAILED");

  const existingLinkCount = existing
    ? await countEntitySourceLinks({ entityId: existing.id, ownerId })
    : 0;
  const payload = {
    canonical_name: sanitizeText(entity.name, 120),
    confidence: existing
      ? Math.min(0.99, Math.max(Number(existing.confidence || 0), entity.confidence || 0))
      : Number(entity.confidence || 0.5),
    entity_type: entityType,
    first_seen_at: existing?.first_seen_at || source.createdAt,
    last_seen_at: source.createdAt,
    mention_count: existing
      ? Math.max(1, existingLinkCount + Number(entity.mentions || 1))
      : Number(entity.mentions || 1),
    normalized_name: normalizedName,
    owner_id: ownerId,
    updated_at: now,
  };

  const query = existing
    ? client
        .from("orbit_intelligence_entities")
        .update(payload)
        .eq("owner_id", ownerId)
        .eq("id", existing.id)
    : client.from("orbit_intelligence_entities").insert(payload);
  const { data, error } = await query.select(ENTITY_COLUMNS).single();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_ENTITY_UPSERT_FAILED");

  const row = mapEntity(data);

  const sourceLink = await upsertSourceLink({
    confidence: row.confidence,
    entityId: row.id,
    evidenceText: entity.evidence?.[0] || source.title,
    linkType: "entity_mention",
    ownerId,
    sourceId: sourceRow.id,
  });

  return {
    ...row,
    sourceReferences: [sourceLink],
  };
}

async function upsertClaim({ claim, ownerId, sourceRow }) {
  const client = getClient();
  const normalizedClaim = normalizeKeyword(claim.normalizedClaim || claim.claimText, 500);
  const conflictKey = claim.conflictKey || buildConflictKey(claim.claimText);
  const polarity = claim.polarity === "negative" ? "negative" : "positive";
  const status = normalizeClaimStatus(claim.status, "unverified");
  const { data, error } = await client
    .from("orbit_intelligence_claims")
    .upsert(
      {
        claim_status: status,
        claim_text: sanitizeText(claim.claimText, 1200),
        confidence: Number(claim.confidence || 0.5),
        conflict_key: conflictKey,
        metadata: {
          dateMentions: Array.isArray(claim.dateMentions)
            ? claim.dateMentions
            : [],
        },
        normalized_claim: normalizedClaim,
        observed_at: claim.observedAt || null,
        owner_id: ownerId,
        polarity,
        source_id: sourceRow.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "owner_id,source_id,normalized_claim",
      },
    )
    .select(CLAIM_COLUMNS)
    .single();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_CLAIM_UPSERT_FAILED");

  let row = mapClaim(data);

  const sourceLink = await upsertSourceLink({
    claimId: row.id,
    confidence: row.confidence,
    evidenceText: claim.claimText,
    linkType: "claim_evidence",
    ownerId,
    sourceId: sourceRow.id,
  });
  row = await applyConflictStatus({ claim: row, ownerId });

  return {
    ...row,
    sourceReferences: [sourceLink],
  };
}

async function applyConflictStatus({ claim, ownerId }) {
  const client = getClient();
  const oppositePolarity = claim.polarity === "negative" ? "positive" : "negative";
  const { data, error } = await client
    .from("orbit_intelligence_claims")
    .select("id, polarity")
    .eq("owner_id", ownerId)
    .eq("conflict_key", claim.conflictKey)
    .eq("polarity", oppositePolarity)
    .limit(25);

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_CONFLICT_LOOKUP_FAILED");
  if (!data?.length) return claim;

  const conflictIds = [claim.id, ...data.map((row) => row.id)];
  const { error: updateError } = await client
    .from("orbit_intelligence_claims")
    .update({
      claim_status: "conflicting",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .in("id", conflictIds);

  if (updateError) throw normalizeSupabaseError(updateError, "INTELLIGENCE_CONFLICT_UPDATE_FAILED");

  return {
    ...claim,
    status: "conflicting",
  };
}

async function refreshConflictStatuses({ conflictKeys = [], ownerId }) {
  const uniqueKeys = Array.from(new Set(conflictKeys.filter(Boolean)));
  const client = getClient();

  for (const conflictKey of uniqueKeys) {
    const { data, error } = await client
      .from("orbit_intelligence_claims")
      .select("id, polarity")
      .eq("owner_id", ownerId)
      .eq("conflict_key", conflictKey)
      .limit(50);

    if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_CONFLICT_REFRESH_LOOKUP_FAILED");
    if (!data?.length) continue;

    const hasPositive = data.some((claim) => claim.polarity === "positive");
    const hasNegative = data.some((claim) => claim.polarity === "negative");
    const nextStatus = hasPositive && hasNegative ? "conflicting" : "unverified";
    const { error: updateError } = await client
      .from("orbit_intelligence_claims")
      .update({
        claim_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", ownerId)
      .eq("conflict_key", conflictKey);

    if (updateError) {
      throw normalizeSupabaseError(updateError, "INTELLIGENCE_CONFLICT_REFRESH_UPDATE_FAILED");
    }
  }
}

async function upsertRelationship({ entityByKey, ownerId, relationship, sourceRow }) {
  const subject = entityByKey.get(relationship.subjectKey);
  const object = entityByKey.get(relationship.objectKey);

  if (!subject || !object || !relationship.evidenceText) return null;

  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_relationships")
    .upsert(
      {
        confidence: Number(relationship.confidence || 0.5),
        evidence_text: sanitizeText(relationship.evidenceText, 1000),
        object_entity_id: object.id,
        owner_id: ownerId,
        relationship_type: sanitizeText(relationship.relationshipType, 80) || "co_mentioned",
        source_id: sourceRow.id,
        status: relationship.status === "inferred" ? "inferred" : "supported",
        subject_entity_id: subject.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "owner_id,source_id,subject_entity_id,relationship_type,object_entity_id",
      },
    )
    .select(RELATIONSHIP_COLUMNS)
    .single();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_RELATIONSHIP_UPSERT_FAILED");

  const row = mapRelationship(data);

  const sourceLink = await upsertSourceLink({
    confidence: row.confidence,
    evidenceText: relationship.evidenceText,
    linkType: "relationship_evidence",
    ownerId,
    relationshipId: row.id,
    sourceId: sourceRow.id,
  });

  return {
    ...row,
    sourceReferences: [sourceLink],
  };
}

async function upsertSourceLink({
  claimId = null,
  confidence,
  entityId = null,
  evidenceText,
  linkType,
  ownerId,
  relationshipId = null,
  sourceId,
}) {
  if (!sourceId || (!entityId && !claimId && !relationshipId)) {
    throw createHttpError(
      "Source evidence linkage wajib tersedia.",
      400,
      "INTELLIGENCE_SOURCE_LINK_REQUIRED",
    );
  }

  const targetKey = entityId
    ? `entity:${entityId}`
    : claimId
      ? `claim:${claimId}`
      : `relationship:${relationshipId}`;
  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_source_links")
    .upsert(
      {
        claim_id: claimId,
        confidence: Number(confidence || 0.5),
        entity_id: entityId,
        evidence_text: sanitizeText(evidenceText, 1000),
        link_type: linkType,
        owner_id: ownerId,
        relationship_id: relationshipId,
        source_id: sourceId,
        target_key: targetKey,
      },
      {
        onConflict: "owner_id,source_id,link_type,target_key",
      },
    )
    .select(buildLinkSelect())
    .single();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_LINK_UPSERT_FAILED");

  return mapSourceLink(data);
}

function groupSourceLinksForPresentation(links = []) {
  const groups = new Map();

  links.forEach((link) => {
    const mappedLink = link.sourceId ? link : mapSourceLink(link);
    const key = [
      mappedLink.sourceId,
      normalizeKeyword(mappedLink.evidenceText, 500),
    ].join("|");
    const current =
      groups.get(key) || {
        ...mappedLink,
        claimIds: [],
        entityIds: [],
        linkTypes: [],
        relationshipIds: [],
        targetKeys: [],
      };

    if (mappedLink.claimId) current.claimIds.push(mappedLink.claimId);
    if (mappedLink.entityId) current.entityIds.push(mappedLink.entityId);
    if (mappedLink.relationshipId) current.relationshipIds.push(mappedLink.relationshipId);
    if (mappedLink.linkType && !current.linkTypes.includes(mappedLink.linkType)) {
      current.linkTypes.push(mappedLink.linkType);
    }
    if (mappedLink.targetKey && !current.targetKeys.includes(mappedLink.targetKey)) {
      current.targetKeys.push(mappedLink.targetKey);
    }

    current.confidence = Math.max(current.confidence || 0, mappedLink.confidence || 0);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    claimIds: Array.from(new Set(group.claimIds)),
    entityIds: Array.from(new Set(group.entityIds)),
    relationshipIds: Array.from(new Set(group.relationshipIds)),
  }));
}

async function persistExtractionForSource({ ownerId, source, sourceRow }) {
  const extraction = extractIntelligence(source);
  const entities = [];
  const entityByKey = new Map();

  for (const entity of extraction.entities) {
    const row = await upsertEntity({ entity, ownerId, source, sourceRow });
    entities.push(row);
    entityByKey.set(getEntityKey(entity), row);
  }

  const claims = [];
  for (const claim of extraction.claims) {
    claims.push(await upsertClaim({ claim, ownerId, sourceRow }));
  }

  const relationships = [];
  for (const relationship of extraction.relationships) {
    const row = await upsertRelationship({
      entityByKey,
      ownerId,
      relationship,
      sourceRow,
    });
    if (row) relationships.push(row);
  }

  return {
    claims,
    dates: extraction.dates,
    entities,
    relationships,
    source: sourceRow,
    telemetry: {
      claimsExtracted: claims.length,
      conflictingClaimsCount: claims.filter((claim) => claim.status === "conflicting").length,
      entitiesExtracted: entities.length,
      processingFailures: 0,
      sourcesProcessed: 1,
      unverifiedClaimsCount: claims.filter((claim) => claim.status === "unverified").length,
      lastProcessingTimestamp: sourceRow.processedAt,
    },
    topics: extraction.topics,
  };
}

async function processSourceInput({ input, ownerId }) {
  const normalized = normalizeSourceInput(input, ownerId);
  const source = {
    ...normalized,
    reprocessedAt: input?.reprocessedAt || null,
  };
  const sourceRow = await upsertSource(source);

  return persistExtractionForSource({ ownerId, source, sourceRow });
}

async function getSourceForReprocess({ ownerId, sourceUuid }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_sources")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("id", sourceUuid)
    .select(SOURCE_COLUMNS)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_REPROCESS_LOCK_FAILED");
  if (!data) {
    throw createHttpError("Intelligence source tidak ditemukan.", 404, "INTELLIGENCE_SOURCE_NOT_FOUND");
  }

  return mapSource(data, { includeContent: true });
}

async function markSourceReprocessFailed({ ownerId, sourceUuid }) {
  const client = getClient();
  const { error } = await client
    .from("orbit_intelligence_sources")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("id", sourceUuid);

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_REPROCESS_FAIL_FAILED");
}

function buildReprocessSourceInput(sourceRow) {
  const content = redactPersistedSourceContent(sourceRow?.contentSnapshot || "").trim();

  if (!content) return null;

  return {
    content,
    createdAt: sourceRow.createdAt,
    sourceId: sourceRow.sourceId,
    sourceType: sourceRow.sourceType,
    sourceUrl: sourceRow.sourceUrl,
    title: sourceRow.title,
  };
}

async function loadSourceInputForReprocess({ ownerId, sourceRow }) {
  const persistedInput = buildReprocessSourceInput(sourceRow);

  if (persistedInput) return persistedInput;

  if (sourceRow.sourceType === "knowledge_document") {
    return loadKnowledgeSource({ ownerId, sourceId: sourceRow.sourceId });
  }

  if (sourceRow.sourceType === "newsroom_generation") {
    return loadNewsroomSource({ ownerId, sourceId: sourceRow.sourceId });
  }

  if (sourceRow.sourceType === "workflow_run" || sourceRow.sourceType === "automation_record") {
    return loadWorkflowSource({ ownerId, sourceId: sourceRow.sourceId });
  }

  throw createHttpError(
    "Persisted source content tidak tersedia untuk reprocess.",
    409,
    "INTELLIGENCE_SOURCE_CONTENT_UNAVAILABLE",
  );
}

async function getDerivedCountsForSource({ ownerId, sourceUuid }) {
  const client = getClient();
  const [
    { count: sourceLinks, error: sourceLinksError },
    { count: claims, error: claimsError },
    { count: relationships, error: relationshipsError },
    { count: entityLinks, error: entityLinksError },
  ] = await Promise.all([
    client
      .from("orbit_intelligence_source_links")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid),
    client
      .from("orbit_intelligence_claims")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid),
    client
      .from("orbit_intelligence_relationships")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid),
    client
      .from("orbit_intelligence_source_links")
      .select("entity_id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid)
      .not("entity_id", "is", null),
  ]);
  const firstError = sourceLinksError || claimsError || relationshipsError || entityLinksError;

  if (firstError) throw normalizeSupabaseError(firstError, "INTELLIGENCE_SOURCE_COUNTS_FAILED");

  return {
    claims: Number(claims || 0),
    entityLinks: Number(entityLinks || 0),
    relationships: Number(relationships || 0),
    sourceLinks: Number(sourceLinks || 0),
  };
}

async function cleanupSourceDerivedData({ ownerId, sourceUuid }) {
  const client = getClient();
  const { data: links, error: linkLookupError } = await client
    .from("orbit_intelligence_source_links")
    .select("id, entity_id")
    .eq("owner_id", ownerId)
    .eq("source_id", sourceUuid);

  if (linkLookupError) {
    throw normalizeSupabaseError(linkLookupError, "INTELLIGENCE_SOURCE_LINK_CLEANUP_LOOKUP_FAILED");
  }

  const entityIds = Array.from(
    new Set((links || []).map((link) => link.entity_id).filter(Boolean)),
  );
  const [
    { data: deletedLinks, error: deleteLinksError },
    { data: deletedRelationships, error: deleteRelationshipsError },
    { data: deletedClaims, error: deleteClaimsError },
  ] = await Promise.all([
    client
      .from("orbit_intelligence_source_links")
      .delete()
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid)
      .select("id"),
    client
      .from("orbit_intelligence_relationships")
      .delete()
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid)
      .select("id"),
    client
      .from("orbit_intelligence_claims")
      .delete()
      .eq("owner_id", ownerId)
      .eq("source_id", sourceUuid)
      .select("id, conflict_key"),
  ]);
  const firstDeleteError = deleteLinksError || deleteRelationshipsError || deleteClaimsError;

  if (firstDeleteError) {
    throw normalizeSupabaseError(firstDeleteError, "INTELLIGENCE_SOURCE_DERIVED_CLEANUP_FAILED");
  }

  const conflictKeysReviewed = Array.from(
    new Set((deletedClaims || []).map((claim) => claim.conflict_key).filter(Boolean)),
  );

  await refreshConflictStatuses({ conflictKeys: conflictKeysReviewed, ownerId });

  let orphanEntitiesDeleted = 0;

  for (const entityId of entityIds) {
    const remainingLinks = await countEntitySourceLinks({ entityId, ownerId });

    if (remainingLinks > 0) continue;

    const { data: deletedEntity, error: deleteEntityError } = await client
      .from("orbit_intelligence_entities")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", entityId)
      .select("id")
      .maybeSingle();

    if (deleteEntityError) {
      throw normalizeSupabaseError(deleteEntityError, "INTELLIGENCE_ORPHAN_ENTITY_DELETE_FAILED");
    }

    if (deletedEntity) orphanEntitiesDeleted += 1;
  }

  return {
    claimsDeleted: (deletedClaims || []).length,
    conflictKeysReviewed: conflictKeysReviewed.length,
    orphanEntitiesDeleted,
    relationshipsDeleted: (deletedRelationships || []).length,
    sourceLinksDeleted: (deletedLinks || []).length,
  };
}

function buildReprocessAuditMetadata({ afterCounts, beforeCounts, cleanup, reprocessedAt, source }) {
  return safeMetadata({
    afterCounts,
    beforeCounts,
    cleanup,
    extractorVersion: EXTRACTOR_VERSION,
    reprocessedAt,
    sourceHash: source.contentHash,
    sourceRecordId: source.id,
    sourceType: source.sourceType,
  });
}

async function recordIntelligenceAuditEvent({ eventType, metadata = {}, ownerId, sourceId }) {
  const client = getClient();
  const { error } = await client.from("orbit_intelligence_audit_events").insert({
    event_type: eventType,
    metadata: safeMetadata(metadata),
    owner_id: ownerId,
    source_id: sourceId,
  });

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_AUDIT_EVENT_FAILED");
}

async function reprocessSource({ ownerId, sourceUuid }) {
  const source = await getSourceForReprocess({ ownerId, sourceUuid });
  const reprocessedAt = new Date().toISOString();

  try {
    const input = await loadSourceInputForReprocess({ ownerId, sourceRow: source });
    const normalized = normalizeSourceInput(input, ownerId);
    const extractionSource = {
      ...normalized,
      reprocessedAt,
    };
    const beforeCounts = await getDerivedCountsForSource({ ownerId, sourceUuid: source.id });
    const cleanup = await cleanupSourceDerivedData({ ownerId, sourceUuid: source.id });
    const refreshedSource = await updateSourceReprocessMetadata({
      ownerId,
      reprocessedAt,
      sourceUuid: source.id,
    });
    const data = await persistExtractionForSource({
      ownerId,
      source: extractionSource,
      sourceRow: refreshedSource,
    });
    const afterCounts = await getDerivedCountsForSource({ ownerId, sourceUuid: source.id });
    const auditMetadata = buildReprocessAuditMetadata({
      afterCounts,
      beforeCounts,
      cleanup,
      reprocessedAt,
      source,
    });

    await recordIntelligenceAuditEvent({
      eventType: "source_reprocessed",
      metadata: auditMetadata,
      ownerId,
      sourceId: source.id,
    });

    return {
      ...data,
      reprocess: {
        afterCounts,
        beforeCounts,
        cleanup,
        extractorVersion: EXTRACTOR_VERSION,
        reprocessedAt,
      },
    };
  } catch (error) {
    try {
      await markSourceReprocessFailed({ ownerId, sourceUuid: source.id });
    } catch (_statusError) {
      // Preserve the original safe error; status repair is best effort.
    }
    throw error;
  }
}

async function loadKnowledgeSource({ ownerId, sourceId }) {
  const client = getClient();
  const [{ data: document, error: documentError }, { data: chunks, error: chunksError }] =
    await Promise.all([
      client
        .from("knowledge_documents")
        .select("id, owner_id, title, source_label, created_at")
        .eq("owner_id", ownerId)
        .eq("id", sourceId)
        .maybeSingle(),
      client
        .from("knowledge_chunks")
        .select("content, chunk_index")
        .eq("owner_id", ownerId)
        .eq("document_id", sourceId)
        .order("chunk_index", { ascending: true })
        .limit(80),
    ]);

  if (documentError) throw normalizeSupabaseError(documentError, "INTELLIGENCE_KNOWLEDGE_LOOKUP_FAILED");
  if (chunksError) throw normalizeSupabaseError(chunksError, "INTELLIGENCE_KNOWLEDGE_CHUNK_LOOKUP_FAILED");
  if (!document) {
    throw createHttpError("Knowledge source tidak ditemukan.", 404, "INTELLIGENCE_SOURCE_NOT_FOUND");
  }

  return {
    content: (chunks || []).map((chunk) => chunk.content).join("\n"),
    createdAt: document.created_at,
    ownerId,
    sourceId: document.id,
    sourceType: "knowledge_document",
    title: document.title || document.source_label || "Knowledge Document",
  };
}

async function loadNewsroomSource({ ownerId, sourceId }) {
  const client = getClient();
  const { data, error } = await client
    .from("newsroom_generations")
    .select("id, owner_id, topic, source_input_summary, draft, created_at")
    .eq("owner_id", ownerId)
    .eq("id", sourceId)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_NEWSROOM_LOOKUP_FAILED");
  if (!data) {
    throw createHttpError("Newsroom source tidak ditemukan.", 404, "INTELLIGENCE_SOURCE_NOT_FOUND");
  }

  return {
    content: [data.source_input_summary, data.draft].filter(Boolean).join("\n"),
    createdAt: data.created_at,
    ownerId,
    sourceId: data.id,
    sourceType: "newsroom_generation",
    title: data.topic || "Newsroom Generation",
  };
}

async function loadWorkflowSource({ ownerId, sourceId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_workflow_runs")
    .select("id, owner_id, definition_id, status, metadata, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("id", sourceId)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_WORKFLOW_LOOKUP_FAILED");
  if (!data) {
    throw createHttpError("Workflow source tidak ditemukan.", 404, "INTELLIGENCE_SOURCE_NOT_FOUND");
  }

  return {
    content: sanitizeText(
      [
        `Workflow ${data.definition_id} status ${data.status}.`,
        JSON.stringify(data.metadata || {}),
      ].join(" "),
      20000,
    ),
    createdAt: data.created_at || data.updated_at,
    ownerId,
    sourceId: data.id,
    sourceType: "workflow_run",
    title: `Workflow ${data.definition_id}`,
  };
}

async function processExistingSource({ ownerId, sourceId, sourceType }) {
  const normalizedType = normalizeSourceType(sourceType);

  if (normalizedType === "knowledge_document") {
    return processSourceInput({
      input: await loadKnowledgeSource({ ownerId, sourceId }),
      ownerId,
    });
  }

  if (normalizedType === "newsroom_generation") {
    return processSourceInput({
      input: await loadNewsroomSource({ ownerId, sourceId }),
      ownerId,
    });
  }

  if (normalizedType === "workflow_run" || normalizedType === "automation_record") {
    return processSourceInput({
      input: await loadWorkflowSource({ ownerId, sourceId }),
      ownerId,
    });
  }

  throw createHttpError(
    "Gunakan body content untuk manual note.",
    400,
    "INTELLIGENCE_MANUAL_CONTENT_REQUIRED",
  );
}

function applySourceFilters(query, filters = {}) {
  const sourceType = filters.sourceType ? normalizeSourceType(filters.sourceType) : "";

  if (sourceType) query = query.eq("source_type", sourceType);
  if (filters.dateFrom) query = query.gte("created_at", sanitizeText(filters.dateFrom, 40));
  if (filters.dateTo) query = query.lte("created_at", sanitizeText(filters.dateTo, 40));
  if (filters.keyword) {
    const keyword = sanitizeText(filters.keyword, 80).replace(/[%,()]/g, " ");
    if (keyword) query = query.ilike("title", `%${keyword}%`);
  }

  return query;
}

async function getOverview({ ownerId }) {
  const client = getClient();
  const [
    { count: sourcesProcessed, error: sourcesError },
    { count: entitiesExtracted, error: entitiesError },
    { count: claimsExtracted, error: claimsError },
    { count: conflictingClaimsCount, error: conflictError },
    { count: unverifiedClaimsCount, error: unverifiedError },
    { data: latestSource, error: latestError },
  ] = await Promise.all([
    client
      .from("orbit_intelligence_sources")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId),
    client
      .from("orbit_intelligence_entities")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId),
    client
      .from("orbit_intelligence_claims")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId),
    client
      .from("orbit_intelligence_claims")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("claim_status", "conflicting"),
    client
      .from("orbit_intelligence_claims")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("claim_status", "unverified"),
    client
      .from("orbit_intelligence_sources")
      .select("processed_at")
      .eq("owner_id", ownerId)
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = sourcesError || entitiesError || claimsError || conflictError || unverifiedError || latestError;
  if (firstError) throw normalizeSupabaseError(firstError, "INTELLIGENCE_OVERVIEW_FAILED");

  return {
    metrics: {
      claimsExtracted: Number(claimsExtracted || 0),
      conflictingClaimsCount: Number(conflictingClaimsCount || 0),
      entitiesExtracted: Number(entitiesExtracted || 0),
      processingFailures: 0,
      sourcesProcessed: Number(sourcesProcessed || 0),
      unverifiedClaimsCount: Number(unverifiedClaimsCount || 0),
      lastProcessingTimestamp: latestSource?.processed_at || null,
    },
  };
}

async function listEntities({ filters = {}, ownerId }) {
  const client = getClient();
  const limit = normalizeLimit(filters.limit);
  let query = client
    .from("orbit_intelligence_entities")
    .select(ENTITY_COLUMNS)
    .eq("owner_id", ownerId);

  if (filters.entityType) query = query.eq("entity_type", normalizeEntityType(filters.entityType));
  if (filters.keyword) query = query.ilike("canonical_name", `%${sanitizeText(filters.keyword, 80)}%`);

  const { data, error } = await query
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_ENTITY_LIST_FAILED");

  const linksByEntity = await selectSourceLinks({
    entityIds: (data || []).map((row) => row.id),
    ownerId,
  });

  return (data || []).map((row) => mapEntity(row, linksByEntity.get(row.id) || []));
}

async function getEntityDetail({ entityId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_intelligence_entities")
    .select(ENTITY_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("id", entityId)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_ENTITY_DETAIL_FAILED");
  if (!data) throw createHttpError("Entity intelligence tidak ditemukan.", 404, "INTELLIGENCE_ENTITY_NOT_FOUND");

  const linksByEntity = await selectSourceLinks({ entityIds: [data.id], ownerId });
  const claims = await searchClaims({
    filters: { keyword: data.canonical_name, limit: 20 },
    ownerId,
  });

  return {
    ...mapEntity(data, linksByEntity.get(data.id) || []),
    claims,
  };
}

async function searchClaims({ filters = {}, ownerId }) {
  const client = getClient();
  const limit = normalizeLimit(filters.limit);
  let query = client
    .from("orbit_intelligence_claims")
    .select(CLAIM_COLUMNS)
    .eq("owner_id", ownerId);

  if (filters.claimStatus) query = query.eq("claim_status", normalizeClaimStatus(filters.claimStatus));
  if (filters.dateFrom) query = query.gte("observed_at", sanitizeText(filters.dateFrom, 40));
  if (filters.dateTo) query = query.lte("observed_at", sanitizeText(filters.dateTo, 40));
  if (filters.keyword) query = query.ilike("claim_text", `%${sanitizeText(filters.keyword, 80)}%`);

  const { data, error } = await query
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_CLAIM_LIST_FAILED");

  const linksByClaim = await selectSourceLinks({
    claimIds: (data || []).map((row) => row.id),
    ownerId,
  });

  return (data || []).map((row) => mapClaim(row, linksByClaim.get(row.id) || []));
}

async function listTimeline({ filters = {}, ownerId }) {
  const claims = await searchClaims({
    filters: {
      ...filters,
      limit: normalizeLimit(filters.limit, 50),
    },
    ownerId,
  });

  return claims
    .filter((claim) => claim.observedAt)
    .map((claim) => ({
      date: claim.observedAt,
      id: claim.id,
      sourceReferences: claim.sourceReferences,
      status: claim.status,
      title: claim.claimText,
      type: "claim",
    }));
}

async function searchIntelligence({ filters = {}, ownerId }) {
  const [entities, claims] = await Promise.all([
    listEntities({ filters, ownerId }),
    searchClaims({ filters, ownerId }),
  ]);

  return {
    claims,
    entities,
  };
}

async function listSourceLinks({ filters = {}, ownerId }) {
  const client = getClient();
  let query = client
    .from("orbit_intelligence_source_links")
    .select(buildLinkSelect())
    .eq("owner_id", ownerId);

  if (filters.sourceId) query = query.eq("source_id", sanitizeText(filters.sourceId, 80));

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(filters.limit));

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_LINK_LIST_FAILED");

  return groupSourceLinksForPresentation((data || []).map(mapSourceLink));
}

async function listSources({ filters = {}, ownerId }) {
  const client = getClient();
  let query = client
    .from("orbit_intelligence_sources")
    .select(SOURCE_COLUMNS)
    .eq("owner_id", ownerId);

  query = applySourceFilters(query, filters);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(filters.limit));

  if (error) throw normalizeSupabaseError(error, "INTELLIGENCE_SOURCE_LIST_FAILED");

  return (data || []).map(mapSource);
}

module.exports = {
  buildReprocessAuditMetadata,
  buildReprocessSourceInput,
  getEntityDetail,
  getOverview,
  groupSourceLinksForPresentation,
  listEntities,
  listSourceLinks,
  listSources,
  listTimeline,
  processExistingSource,
  processSourceInput,
  reprocessSource,
  searchClaims,
  searchIntelligence,
};
