const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  rootDir,
  "supabase/migrations/20260824030000_orbit_intelligence_engine_v1_2.sql",
);
const reprocessMigrationPath = path.join(
  rootDir,
  "supabase/migrations/20260824040000_orbit_intelligence_reprocess_v1_2.sql",
);
const routePath = path.join(rootDir, "server/routes/intelligence.js");
const repositoryPath = path.join(
  rootDir,
  "server/services/intelligence/intelligenceRepository.js",
);
const pagePath = path.join(rootDir, "apps/web/src/pages/Intelligence.jsx");
const apiPath = path.join(rootDir, "apps/web/src/services/api.js");
const intakeHelperPath = path.join(
  rootDir,
  "apps/web/src/services/intelligenceIntake.mjs",
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getFunctionSource(source, functionName) {
  const start = source.indexOf(`async function ${functionName}`);
  assert(start >= 0, `${functionName} missing`);

  const nextFunction = source.indexOf("\nasync function ", start + 1);
  const nextPlainFunction = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextFunction, nextPlainFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;

  return source.slice(start, end);
}

test("intelligence migration creates owner-scoped RLS tables", () => {
  const sql = read(migrationPath);

  for (const table of [
    "orbit_intelligence_sources",
    "orbit_intelligence_entities",
    "orbit_intelligence_claims",
    "orbit_intelligence_relationships",
    "orbit_intelligence_source_links",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /claim_status text not null default 'unverified'/);
  assert.match(sql, /num_nonnulls\(entity_id, claim_id, relationship_id\) = 1/);
  assert.match(sql, /evidence_text text not null/);
  assert.match(sql, /source_url ~\* '\^https\?:\/\//);
});

test("intelligence reprocess migration stores source snapshots and owner-scoped audit", () => {
  const sql = read(reprocessMigrationPath);

  assert.match(sql, /add column if not exists content_snapshot text/);
  assert.match(sql, /add column if not exists metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /create table if not exists public\.orbit_intelligence_audit_events/);
  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /source_id uuid references public\.orbit_intelligence_sources\(id\)/);
  assert.match(sql, /event_type in \('source_reprocessed'\)/);
  assert.match(
    sql,
    /alter table public\.orbit_intelligence_audit_events enable row level security/,
  );
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /for insert\s+with check \(false\)/);
  assert.match(sql, /metadata::text !~\* '\(authorization\|cookie\|password/);
});

test("intelligence extractor defaults claims to unverified with source evidence", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "Bupati Merauke mengatakan Program Orbit akan berjalan pada 24 Agustus 2026. PT Papua Media menyatakan platform ORBIT memiliki dashboard baru.",
      createdAt: "2026-08-24T01:00:00.000Z",
      sourceId: "manual-1",
      sourceType: "manual_note",
      title: "Rapat Orbit",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(extracted.entities.length > 0);
  assert(extracted.claims.length > 0);
  assert(extracted.claims.every((claim) => claim.status === "unverified"));
  assert(extracted.claims.every((claim) => claim.claimText));
  assert(extracted.sourceReferences.length > 0);
  assert(extracted.relationships.every((relationship) => relationship.evidenceText));
  assert(!extracted.claims.some((claim) => claim.status === "confirmed"));
});

test("intelligence extractor parses Indonesian dates without fabricating partial dates", () => {
  const {
    extractDates,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const dates = extractDates([
    "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    "Rapat lanjutan direncanakan pada 20 Agustus.",
    "Evaluasi berlangsung Agustus 2026.",
  ]);
  const fullDate = dates.find((date) => date.dateText === "20 Agustus 2026");
  const dayMonth = dates.find((date) => date.dateText === "20 Agustus");
  const monthYear = dates.find((date) => date.dateText === "Agustus 2026");

  assert.strictEqual(fullDate.isoDate, "2026-08-20");
  assert.strictEqual(fullDate.precision, "day");
  assert.strictEqual(dayMonth.isoDate, null);
  assert.strictEqual(dayMonth.precision, "month_day");
  assert.strictEqual(monthYear.isoDate, null);
  assert.strictEqual(monthYear.precision, "month_year");
});

test("Indonesian month names are temporal tokens, not persisted entities", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      sourceId: "manual-month",
      sourceType: "manual_note",
      title: "Month entity regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(
    !extracted.entities.some(
      (entity) =>
        entity.normalizedName === "agustus" &&
        ["organization", "person", "project", "location", "product"].includes(
          entity.entityType,
        ),
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "project alpha" &&
        entity.entityType === "project",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "orbit" &&
        entity.entityType === "organization",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "merauke" &&
        entity.entityType === "location",
    ),
  );
});

test("Indonesian declarative project start sentence creates unverified dated claim", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      sourceId: "manual-claim",
      sourceType: "manual_note",
      title: "Claim regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);
  const claim = extracted.claims.find((item) =>
    item.normalizedClaim.includes("project alpha dimulai"),
  );

  assert(claim);
  assert.strictEqual(claim.status, "unverified");
  assert.strictEqual(claim.observedAt, "2026-08-20T00:00:00.000Z");
  assert(
    claim.dateMentions.some(
      (date) => date.dateText === "20 Agustus 2026" && date.isoDate === "2026-08-20",
    ),
  );
});

test("Indonesian location context classifies place names without month false positives", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Reprocess Test melaporkan Project Gamma dimulai pada 15 Oktober 2026 di Sorong. Project Gamma disebut kembali di Jayapura dan dari Merauke.",
      sourceId: "manual-location-context",
      sourceType: "manual_note",
      title: "Location context regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);
  const hasEntity = (normalizedName, entityType) =>
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === normalizedName &&
        entity.entityType === entityType,
    );

  assert(hasEntity("sorong", "location"));
  assert(hasEntity("jayapura", "location"));
  assert(hasEntity("merauke", "location"));
  assert(hasEntity("orbit", "organization"));
  assert(hasEntity("project gamma", "project"));
  assert(!extracted.entities.some((entity) => entity.normalizedName === "oktober"));
  assert(!hasEntity("sorong", "organization"));
  assert(
    extracted.claims.some(
      (claim) =>
        claim.status === "unverified" &&
        claim.observedAt === "2026-10-15T00:00:00.000Z",
    ),
  );
});

test("location context does not override stronger deterministic entity evidence", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "Rapat berlangsung di PT Papua Media. Project Gamma berada di Sorong.",
      sourceId: "manual-location-stronger-evidence",
      sourceType: "manual_note",
      title: "Location stronger evidence regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "pt papua media" &&
        entity.entityType === "organization",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "project gamma" &&
        entity.entityType === "project",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "sorong" &&
        entity.entityType === "location",
    ),
  );
});

test("repeated extraction for the same source remains stable for reprocess idempotency", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const input = {
    content:
      "ORBIT Reprocess Test melaporkan Project Gamma dimulai pada 15 Oktober 2026 di Sorong.",
    createdAt: "2026-08-24T05:00:00.000Z",
    sourceId: "manual-reprocess-idempotent",
    sourceType: "manual_note",
    title: "Reprocess idempotent fixture",
  };
  const first = extractIntelligence(normalizeSourceInput(input, "user-1"));
  const second = extractIntelligence(normalizeSourceInput(input, "user-1"));
  const entityKey = (entity) => `${entity.entityType}:${entity.normalizedName}`;
  const claimKey = (claim) => `${claim.normalizedClaim}:${claim.observedAt}`;

  assert.deepStrictEqual(
    first.entities.map(entityKey).sort(),
    second.entities.map(entityKey).sort(),
  );
  assert.deepStrictEqual(
    first.claims.map(claimKey).sort(),
    second.claims.map(claimKey).sort(),
  );
  assert.deepStrictEqual(
    first.dates.map((date) => date.isoDate).sort(),
    second.dates.map((date) => date.isoDate).sort(),
  );
  assert.strictEqual(new Set(first.entities.map(entityKey)).size, first.entities.length);
  assert.strictEqual(new Set(first.claims.map(claimKey)).size, first.claims.length);
  assert.strictEqual(first.dates[0].isoDate, "2026-10-15");
});

test("controlled notes keep recurring entities and contradictory start claims comparable", () => {
  const {
    buildConflictKey,
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const notes = [
    "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    "Project Alpha disebut kembali dalam catatan operasional ORBIT pada 22 Agustus 2026 di Merauke.",
    "Sumber lain menyatakan Project Alpha belum dimulai pada 20 Agustus 2026.",
  ].map((content, index) =>
    extractIntelligence(
      normalizeSourceInput(
        {
          content,
          sourceId: `controlled-${index + 1}`,
          sourceType: "manual_note",
          title: `Controlled ${index + 1}`,
        },
        "user-1",
      ),
    ),
  );
  const entities = notes.flatMap((note) => note.entities);
  const claims = notes.flatMap((note) => note.claims);
  const dates = notes.flatMap((note) => note.dates);
  const positiveKey = buildConflictKey(notes[0].claims[0].claimText);
  const negativeKey = buildConflictKey(notes[2].claims[0].claimText);

  assert.strictEqual(
    entities.filter((entity) => entity.normalizedName === "project alpha").length,
    3,
  );
  assert.strictEqual(
    entities.filter((entity) => entity.normalizedName === "merauke").length,
    2,
  );
  assert(dates.some((date) => date.isoDate === "2026-08-20"));
  assert(dates.some((date) => date.isoDate === "2026-08-22"));
  assert(claims.length >= 2);
  assert(claims.every((claim) => claim.status === "unverified"));
  assert(!claims.some((claim) => claim.status === "confirmed"));
  assert.strictEqual(notes[0].claims[0].polarity, "positive");
  assert.strictEqual(notes[1].claims[0].observedAt, "2026-08-22T00:00:00.000Z");
  assert.strictEqual(notes[2].claims[0].polarity, "negative");
  assert.strictEqual(positiveKey, negativeKey);
});

test("intelligence normalization redacts secrets and rejects unsafe source URLs", () => {
  const { normalizeSafeSourceUrl, normalizeSourceInput } =
    require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "Authorization: Bearer secret-token-value OPENROUTER_API_KEY=secret-key PT Papua Media mengatakan sistem aktif.",
      sourceId: "manual-secret",
      sourceType: "manual_note",
      sourceUrl: "file:///etc/passwd",
      title: "Secret check",
    },
    "user-1",
  );

  assert(!source.content.includes("secret-token-value"));
  assert(!source.content.includes("secret-key"));
  assert.strictEqual(source.sourceUrl, null);
  assert.strictEqual(normalizeSafeSourceUrl("https://example.test/source"), "https://example.test/source");
});

test("intelligence claim conflict keys represent positive and negative claim conflict", () => {
  const { buildConflictKey } = require("../../server/services/intelligence/intelligenceExtractor");
  const positive = buildConflictKey("ORBIT adalah sistem intelligence aktif.");
  const negative = buildConflictKey("ORBIT bukan sistem intelligence aktif.");

  assert.strictEqual(positive, negative);
});

test("source evidence grouping deduplicates cards while preserving target links", () => {
  const { groupSourceLinksForPresentation } = require("../../server/services/intelligence/intelligenceRepository");
  const grouped = groupSourceLinksForPresentation([
    {
      claimId: null,
      confidence: 0.62,
      entityId: "entity-1",
      evidenceText: "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      id: "link-1",
      linkType: "entity_mention",
      relationshipId: null,
      source: { id: "source-1", title: "Controlled 1" },
      sourceId: "source-1",
      targetKey: "entity:entity-1",
    },
    {
      claimId: "claim-1",
      confidence: 0.58,
      entityId: null,
      evidenceText: "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      id: "link-2",
      linkType: "claim_evidence",
      relationshipId: null,
      source: { id: "source-1", title: "Controlled 1" },
      sourceId: "source-1",
      targetKey: "claim:claim-1",
    },
  ]);

  assert.strictEqual(grouped.length, 1);
  assert.deepStrictEqual(grouped[0].entityIds, ["entity-1"]);
  assert.deepStrictEqual(grouped[0].claimIds, ["claim-1"]);
  assert.deepStrictEqual(grouped[0].linkTypes.sort(), [
    "claim_evidence",
    "entity_mention",
  ]);
});

test("reprocess source input preserves the original persisted source identity", () => {
  const {
    buildReprocessSourceInput,
  } = require("../../server/services/intelligence/intelligenceRepository");
  const input = buildReprocessSourceInput({
    contentSnapshot:
      "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    createdAt: "2026-08-24T01:00:00.000Z",
    id: "source-row-1",
    sourceId: "manual-1",
    sourceType: "manual_note",
    sourceUrl: "https://example.test/source",
    title: "Original Source",
  });

  assert.deepStrictEqual(input, {
    content:
      "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    createdAt: "2026-08-24T01:00:00.000Z",
    sourceId: "manual-1",
    sourceType: "manual_note",
    sourceUrl: "https://example.test/source",
    title: "Original Source",
  });
});

test("reprocess audit metadata excludes raw source text and sensitive values", () => {
  const {
    buildReprocessAuditMetadata,
  } = require("../../server/services/intelligence/intelligenceRepository");
  const rawText =
    "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.";
  const metadata = buildReprocessAuditMetadata({
    afterCounts: { claims: 1, entityLinks: 3, relationships: 1, sourceLinks: 5 },
    beforeCounts: { claims: 0, entityLinks: 4, relationships: 0, sourceLinks: 4 },
    cleanup: {
      claimsDeleted: 0,
      orphanEntitiesDeleted: 1,
      relationshipsDeleted: 0,
      sourceLinksDeleted: 4,
    },
    reprocessedAt: "2026-08-24T04:00:00.000Z",
    source: {
      contentHash: "hash-1",
      contentSnapshot: rawText,
      id: "source-row-1",
      sourceType: "manual_note",
      title: rawText,
    },
  });
  const serialized = JSON.stringify(metadata);

  assert(!serialized.includes(rawText));
  assert(!serialized.includes("Bearer"));
  assert(!serialized.includes("service_role"));
  assert.strictEqual(metadata.sourceRecordId, "source-row-1");
  assert.strictEqual(metadata.sourceHash, "hash-1");
});

test("reprocess with current extractor removes stale month entity and creates claim timeline", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      sourceId: "manual-reprocess-current",
      sourceType: "manual_note",
      title: "Reprocess current extractor",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(
    !extracted.entities.some(
      (entity) =>
        entity.normalizedName === "agustus" &&
        entity.entityType === "organization",
    ),
  );
  assert(
    extracted.claims.some(
      (claim) =>
        claim.status === "unverified" &&
        claim.observedAt === "2026-08-20T00:00:00.000Z",
    ),
  );
});

test("reprocess cleanup is source-link aware so shared entities survive", () => {
  const source = read(repositoryPath);

  assert.match(source, /const entityIds = Array\.from\(/);
  assert.match(source, /\.from\("orbit_intelligence_source_links"\)\s*\.delete\(\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("source_id", sourceUuid\)/s);
  assert.match(source, /const remainingLinks = await countEntitySourceLinks\(\{ entityId, ownerId \}\)/);
  assert.match(source, /if \(remainingLinks > 0\) continue/);
  assert.match(source, /\.from\("orbit_intelligence_entities"\)\s*\.delete\(\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("id", entityId\)/s);
});

test("reprocess remains idempotent through cleanup and scoped upsert keys", () => {
  const source = read(repositoryPath);
  const reprocessBody = getFunctionSource(source, "reprocessSource");

  assert.match(source, /const cleanup = await cleanupSourceDerivedData\(\{ ownerId, sourceUuid: source\.id \}\)/);
  assert.match(reprocessBody, /await updateSourceReprocessMetadata\(\{/);
  assert.match(reprocessBody, /await persistExtractionForSource\(\{/);
  assert.doesNotMatch(reprocessBody, /processSourceInput\(/);
  assert.doesNotMatch(reprocessBody, /upsertSource\(/);
  assert.match(source, /onConflict: "owner_id,source_type,source_id"/);
  assert.match(source, /onConflict: "owner_id,source_id,normalized_claim"/);
  assert.match(source, /onConflict: "owner_id,source_id,link_type,target_key"/);
  assert.match(source, /mention_count: existing\s*\?\s*Math\.max\(1, existingLinkCount \+ Number\(entity\.mentions \|\| 1\)\)/s);
});

test("reprocess updates the requested source row without changing source identity", () => {
  const source = read(repositoryPath);
  const route = read(routePath);
  const reprocessBody = getFunctionSource(source, "reprocessSource");
  const updateBody = getFunctionSource(source, "updateSourceReprocessMetadata");

  assert.match(route, /sourceUuid: req\.params\.id/);
  assert.match(reprocessBody, /const source = await getSourceForReprocess\(\{ ownerId, sourceUuid \}\)/);
  assert.match(updateBody, /\.eq\("owner_id", ownerId\)\s*\.eq\("id", sourceUuid\)/s);
  assert.match(updateBody, /status: "processed"/);
  assert.match(updateBody, /processed_at: reprocessedAt/);
  assert.doesNotMatch(updateBody, /source_id:/);
  assert.doesNotMatch(updateBody, /source_type:/);
  assert.doesNotMatch(updateBody, /title:/);
  assert.doesNotMatch(updateBody, /content_snapshot:/);
  assert.match(reprocessBody, /sourceRow: refreshedSource/);
  assert.match(source, /return \{\s*claims,\s*dates: extraction\.dates,\s*entities,\s*relationships,\s*source: sourceRow/s);
});

test("reprocess cleanup targets only derived rows for the requested source id", () => {
  const source = read(repositoryPath);
  const cleanupBody = getFunctionSource(source, "cleanupSourceDerivedData");

  assert.match(cleanupBody, /\.from\("orbit_intelligence_source_links"\)\s*\.select\("id, entity_id"\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("source_id", sourceUuid\)/s);
  assert.match(cleanupBody, /\.from\("orbit_intelligence_source_links"\)\s*\.delete\(\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("source_id", sourceUuid\)/s);
  assert.match(cleanupBody, /\.from\("orbit_intelligence_claims"\)\s*\.delete\(\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("source_id", sourceUuid\)/s);
  assert.match(cleanupBody, /\.from\("orbit_intelligence_relationships"\)\s*\.delete\(\)\s*\.eq\("owner_id", ownerId\)\s*\.eq\("source_id", sourceUuid\)/s);
  assert.match(cleanupBody, /if \(remainingLinks > 0\) continue/);
});

test("intelligence routes require auth and expose scoped endpoints", () => {
  const source = read(routePath);

  assert.match(source, /router\.use\(requireAuth\)/);
  for (const endpoint of [
    "/overview",
    "/entities",
    "/claims",
    "/timeline",
    "/search",
    "/source-links",
    "/sources/:id/reprocess",
    "/process",
  ]) {
    assert(source.includes(endpoint), `${endpoint} route missing`);
  }
  assert.match(source, /reprocessSource\(\{\s*ownerId: getOwnerId\(req\),\s*sourceUuid: req\.params\.id/s);
  assert.doesNotMatch(source, /ownerId:\s*req\.body/);
  assert.doesNotMatch(source, /content:\s*req\.body[^,}]*reprocess/s);
});

test("intelligence repository scopes persistence and search by owner", () => {
  const source = read(repositoryPath);

  assert.match(source, /\.eq\("owner_id", ownerId\)/);
  assert.match(source, /\.eq\("id", sourceUuid\)/);
  assert.match(source, /owner_id: ownerId/);
  assert.match(source, /onConflict: "owner_id,source_type,source_id"/);
  assert.match(source, /onConflict: "owner_id,source_id,normalized_claim"/);
  assert.match(source, /onConflict: "owner_id,source_id,link_type,target_key"/);
  assert.match(source, /duplicate_of_source_id/);
  assert.match(source, /claim_status: "conflicting"/);
  assert.match(source, /INTELLIGENCE_SOURCE_LINK_REQUIRED/);
  assert.match(source, /const sourceLink = await upsertSourceLink/);
  assert.match(source, /sourceReferences: \[sourceLink\]/);
  assert.match(source, /cleanupSourceDerivedData/);
  assert.match(source, /refreshConflictStatuses/);
  assert.match(source, /conflictKeysReviewed/);
  assert.match(source, /orphanEntitiesDeleted/);
  assert.match(source, /countEntitySourceLinks\(\{ entityId, ownerId \}\)/);
  assert.match(source, /source_id: sourceRow\.id/);
  assert.doesNotMatch(source, /Authorization\s*[:=]/);
  assert.doesNotMatch(source, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("intelligence API client attaches authenticated v1 requests", () => {
  const source = read(apiPath);

  for (const method of [
    "getIntelligenceOverview",
    "getIntelligenceEntities",
    "getIntelligenceClaims",
    "getIntelligenceTimeline",
    "searchIntelligence",
    "getIntelligenceSourceLinks",
    "processIntelligenceSource",
    "reprocessIntelligenceSource",
  ]) {
    assert(source.includes(method), `${method} missing`);
  }

  assert.match(source, /\/api\/v1\/intelligence\/overview/);
  assert.match(source, /\/api\/v1\/intelligence\/sources\/\$\{encodeURIComponent\(sourceId\)\}\/reprocess/);
  assert.match(source, /headers: await getAuthenticatedHeaders\(\)/);
});

test("intelligence frontend renders untrusted content as text, not raw HTML", () => {
  const source = read(pagePath);

  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /new Function/);
  assert.doesNotMatch(source, /\beval\(/);
  assert.match(source, /\{claim\.claimText\}/);
  assert.match(source, /\{link\.evidenceText\}/);
});

test("intelligence frontend renders reprocess only for valid source evidence", () => {
  const source = read(pagePath);

  assert.match(source, /api\.reprocessIntelligenceSource\(source\.id\)/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /disabled=\{Boolean\(reprocessingSourceId\)\}/);
  assert.match(source, /await loadIntelligence\(filters\)/);
  assert.match(source, /getSafeIntelligenceIntakeError\(reprocessError\)/);
  assert.match(source, /\{link\.source\?\.id \? \(/);
  assert.match(source, /Reprocess Source/);
});

test("manual note intake renders a bound textarea and explicit source type state", () => {
  const source = read(pagePath);
  const helperSource = read(intakeHelperPath);

  assert.match(helperSource, /sourceType: "manual_note"/);
  assert.match(source, /useState\(DEFAULT_MANUAL_NOTE\)/);
  assert.match(source, /htmlFor="manual-intelligence-note"/);
  assert.match(source, /id="manual-intelligence-note"/);
  assert.match(source, /aria-label="Manual note content"/);
  assert.match(source, /value=\{manualNote\.content\}/);
  assert.match(source, /sourceType: event\.target\.value/);
});

test("manual note intake enablement follows source type, trimmed content, and loading state", async () => {
  const { canSubmitManualNote } = await import(pathToFileURL(intakeHelperPath));

  assert.strictEqual(
    canSubmitManualNote({
      content: "   ",
      isProcessing: false,
      sourceType: "manual_note",
    }),
    false,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: false,
      sourceType: "manual_note",
    }),
    true,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: true,
      sourceType: "manual_note",
    }),
    false,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: false,
      sourceType: "newsroom_generation",
    }),
    false,
  );
});

test("manual note intake builds the authenticated process API payload shape", async () => {
  const { buildManualNotePayload } = await import(pathToFileURL(intakeHelperPath));
  const now = new Date("2026-08-24T03:00:00.000Z");
  const payload = buildManualNotePayload({
    content: "  ORBIT Intelligence Test melaporkan Project Alpha.  ",
    now,
    sourceType: "manual_note",
    title: "  Smoke note  ",
  });
  const source = read(pagePath);
  const apiSource = read(apiPath);

  assert.deepStrictEqual(payload, {
    content: "ORBIT Intelligence Test melaporkan Project Alpha.",
    createdAt: "2026-08-24T03:00:00.000Z",
    sourceId: "manual-1787540400000",
    sourceType: "manual_note",
    title: "Smoke note",
  });
  assert.match(source, /api\.processIntelligenceSource\(payload\)/);
  assert.match(apiSource, /\/api\/v1\/intelligence\/process/);
  assert.match(apiSource, /headers: await getAuthenticatedHeaders\(\)/);
  assert.match(apiSource, /body: JSON\.stringify\(payload\)/);
});

test("manual note intake renders safe error text without secrets", async () => {
  const { getSafeIntelligenceIntakeError } = await import(
    pathToFileURL(intakeHelperPath)
  );
  const message = getSafeIntelligenceIntakeError({
    message:
      "Authorization: Bearer secret-token-value SUPABASE_SERVICE_ROLE_KEY=secret stack trace",
  });

  assert(!message.includes("secret-token-value"));
  assert(!message.includes("SUPABASE_SERVICE_ROLE_KEY=secret"));
  assert.strictEqual(message, "Gagal memproses intelligence source.");

  const source = read(pagePath);
  assert.match(source, /getSafeIntelligenceIntakeError\(processError\)/);
  assert.match(source, /\{intakeMessage\}/);
});
