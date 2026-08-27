const crypto = require("node:crypto");

const ENTITY_TYPES = new Set([
  "person",
  "organization",
  "location",
  "project",
  "product",
  "event",
]);
const CLAIM_STATUSES = new Set([
  "confirmed",
  "supported",
  "conflicting",
  "unverified",
  "inferred",
]);
const SOURCE_TYPES = new Set([
  "knowledge_document",
  "newsroom_generation",
  "workflow_run",
  "automation_record",
  "manual_note",
]);
const INDONESIAN_MONTHS = new Map([
  ["januari", 1],
  ["februari", 2],
  ["maret", 3],
  ["april", 4],
  ["mei", 5],
  ["juni", 6],
  ["juli", 7],
  ["agustus", 8],
  ["september", 9],
  ["oktober", 10],
  ["november", 11],
  ["desember", 12],
]);
const ENGLISH_MONTHS = new Map([
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["may", 5],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12],
]);
const MONTHS = new Map([...INDONESIAN_MONTHS, ...ENGLISH_MONTHS]);
const MONTH_PATTERN = Array.from(MONTHS.keys()).join("|");
const SENSITIVE_TEXT_PATTERN =
  /(authorization\s*[:=]\s*bearer\s+[a-z0-9._~+/=-]+|bearer\s+[a-z0-9._~+/=-]+|[a-z0-9_.-]*(api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|password|passwd|secret)[a-z0-9_.-]*\s*[:=]\s*['"]?[^'",;\s)}\]]+)/gi;
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);
const NEGATION_PATTERN = /\b(tidak|bukan|belum|denied|not|never|no)\b/i;
const CLAIM_VERB_PATTERN =
  /\b(adalah|merupakan|mengatakan|menyatakan|melaporkan|mencatat|menunjukkan|mengumumkan|disebut|akan|telah|sudah|belum|memiliki|berada|terjadi|dimulai|mulai|selesai|menargetkan|mengklaim|confirmed|reported|said|will|has|is|are|was)\b/i;
const NON_CLAIM_FRAGMENT_PATTERN =
  /^(loading|search|filter|refresh|source type|manual note|process source|apply|entity|claim|timeline|evidence|dashboard|overview)\b/i;
const STRONG_LOCATION_CONTEXT_PATTERN =
  /\b(?:di|dari|menuju|berlokasi\s+di|berada\s+di)\s+$/i;

function createHttpError(message, statusCode = 500, code = "INTELLIGENCE_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeText(value, maxLength = 20000) {
  return String(value || "")
    .replace(SENSITIVE_TEXT_PATTERN, "[REDACTED]")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKeyword(value, maxLength = 120) {
  return sanitizeText(value, maxLength)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMonthName(value) {
  return normalizeKeyword(value, 40);
}

function isMonthName(value) {
  return MONTHS.has(normalizeMonthName(value));
}

function normalizeTitle(value) {
  return sanitizeText(value, 180) || "Untitled Intelligence Source";
}

function normalizeSourceType(value) {
  const sourceType = normalizeKeyword(value, 80).replace(/[\s-]+/g, "_");

  if (!SOURCE_TYPES.has(sourceType)) {
    throw createHttpError(
      "Source type intelligence tidak valid.",
      400,
      "INTELLIGENCE_INVALID_SOURCE_TYPE",
    );
  }

  return sourceType;
}

function normalizeEntityType(value) {
  const entityType = normalizeKeyword(value, 40).replace(/-/g, "_");

  return ENTITY_TYPES.has(entityType) ? entityType : "organization";
}

function normalizeClaimStatus(value, fallback = "unverified") {
  const status = normalizeKeyword(value, 40).replace(/[\s-]+/g, "_");

  return CLAIM_STATUSES.has(status) ? status : fallback;
}

function normalizeIsoDate(value) {
  if (!value) return new Date().toISOString();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();

  return date.toISOString();
}

function normalizeSafeSourceUrl(value) {
  const raw = sanitizeText(value, 500);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return null;
    if (!url.hostname || url.username || url.password) return null;

    return url.href.slice(0, 500);
  } catch {
    return null;
  }
}

function normalizeSourceInput(input = {}, ownerId) {
  const sourceType = normalizeSourceType(input.sourceType || input.source_type);
  const sourceId = sanitizeText(input.sourceId || input.source_id, 160);
  const content = sanitizeText(input.content, 120000);

  if (!ownerId) {
    throw createHttpError("Owner intelligence wajib tersedia.", 401, "INTELLIGENCE_OWNER_REQUIRED");
  }

  if (!sourceId) {
    throw createHttpError("Source id intelligence wajib tersedia.", 400, "INTELLIGENCE_SOURCE_ID_REQUIRED");
  }

  if (!content) {
    throw createHttpError("Content intelligence wajib tersedia.", 400, "INTELLIGENCE_CONTENT_REQUIRED");
  }

  return {
    content,
    contentHash: hashText(content),
    createdAt: normalizeIsoDate(input.createdAt || input.created_at),
    ownerId,
    sourceId,
    sourceType,
    sourceUrl: normalizeSafeSourceUrl(input.sourceUrl || input.source_url),
    title: normalizeTitle(input.title),
  };
}

function hashText(value) {
  return crypto
    .createHash("sha256")
    .update(sanitizeText(value, 120000).toLowerCase())
    .digest("hex");
}

function splitSentences(content) {
  return sanitizeText(content, 120000)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sanitizeText(sentence, 800))
    .filter((sentence) => sentence.length >= 24)
    .slice(0, 80);
}

function hasStrongLocationContext(sentence = "", startIndex = -1) {
  if (startIndex < 0) return false;

  const prefix = sentence.slice(Math.max(0, startIndex - 32), startIndex);

  return STRONG_LOCATION_CONTEXT_PATTERN.test(prefix);
}

function inferEntityType(name, sentence = "", options = {}) {
  const cleanName = sanitizeText(name, 120);
  const cleanSentence = sentence.toLowerCase();

  if (isMonthName(cleanName)) {
    return "";
  }

  if (/^[A-Z0-9]{2,}(?:\s+[A-Z0-9]{2,})?$/.test(cleanName)) {
    return "organization";
  }

  if (/\b(pt|cv|dinas|kementerian|komisi|universitas|pemda|polres|polda|badan|bank|media|redaksi)\b/i.test(cleanName)) {
    return "organization";
  }

  if (/\b(proyek|project|program|inisiatif|rencana)\b/i.test(cleanName)) {
    return "project";
  }

  if (/\b(aplikasi|platform|produk|sistem|dashboard|engine)\b/i.test(cleanName)) {
    return "product";
  }

  if (/\b(rapat|konferensi|sidang|peluncuran|festival|event|kejadian|insiden)\b/i.test(cleanSentence)) {
    return "event";
  }

  if (options.hasStrongLocationContext) {
    return "location";
  }

  if (/\b(kabupaten|provinsi|kota|distrik|kampung|jalan|papua|merauke|jayapura|asmat|mappi|boven digoel)\b/i.test(cleanName)) {
    return "location";
  }

  const words = cleanName.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) return "person";

  return "organization";
}

function extractNamedEntities(sentences) {
  const entities = new Map();
  const capitalizedPhrasePattern =
    /\b([A-Z][\p{L}\p{N}.&'-]*(?:\s+(?:[A-Z][\p{L}\p{N}.&'-]*|di|dan|of|for|the)){0,5})\b/gu;
  const contextualLocationPattern =
    /\b(?:di|dari|menuju|berlokasi\s+di|berada\s+di)\s+([A-Z][\p{L}\p{N}.&'-]*(?:\s+[A-Z][\p{L}\p{N}.&'-]*){0,3})\b/gu;

  function addEntity({ confidence = 0.62, entityType, name, sentence }) {
    const normalizedName = normalizeKeyword(name, 120);
    const key = `${entityType}:${normalizedName}`;
    const existing = entities.get(key);

    if (existing) {
      existing.mentions += 1;
      existing.evidence.push(sentence);
      existing.confidence = Math.min(0.92, existing.confidence + 0.03);
    } else {
      entities.set(key, {
        confidence,
        entityType,
        evidence: [sentence],
        mentions: 1,
        name,
        normalizedName,
      });
    }
  }

  sentences.forEach((sentence) => {
    for (const match of sentence.matchAll(contextualLocationPattern)) {
      const name = sanitizeText(match[1], 120);
      const normalizedName = normalizeKeyword(name, 120);

      if (!normalizedName || normalizedName.length < 3) continue;
      if (isMonthName(name)) continue;

      const entityType = inferEntityType(name, sentence, {
        hasStrongLocationContext: true,
      });
      if (!entityType) continue;
      addEntity({ confidence: 0.7, entityType, name, sentence });
    }

    for (const match of sentence.matchAll(capitalizedPhrasePattern)) {
      const name = sanitizeText(match[1], 120);
      const normalizedName = normalizeKeyword(name, 120);

      if (!normalizedName || normalizedName.length < 3) continue;
      if (/^(dan|atau|the|a|an|ini|itu|sumber|catatan)$/i.test(name)) continue;
      if (isMonthName(name)) continue;
      if (/^\d+$/.test(normalizedName)) continue;

      const words = name.split(/\s+/).filter(Boolean);
      const firstWord = words[0] || "";

      if (
        words.length > 1 &&
        /^[A-Z0-9]{2,}$/.test(firstWord) &&
        !/^(PT|CV)$/i.test(firstWord)
      ) {
        addEntity({
          confidence: 0.7,
          entityType: "organization",
          name: firstWord,
          sentence,
        });
        continue;
      }

      const entityType = inferEntityType(name, sentence, {
        hasStrongLocationContext: hasStrongLocationContext(sentence, match.index),
      });
      if (!entityType) continue;
      addEntity({ entityType, name, sentence });
    }
  });

  return Array.from(entities.values()).slice(0, 60);
}

function extractDates(sentences) {
  const fullTextDatePattern = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`,
    "gi",
  );
  const dayMonthPattern = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\b(?!\\s+\\d{4})`,
    "gi",
  );
  const monthYearPattern = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{4})\\b`,
    "gi",
  );
  const isoDatePattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const slashDatePattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  const dates = [];

  sentences.forEach((sentence) => {
    const seenInSentence = new Set();
    const pushDate = (date) => {
      const key = `${date.dateText}:${date.precision}`;
      if (seenInSentence.has(key)) return;
      seenInSentence.add(key);
      dates.push({
        ...date,
        evidence: sentence,
      });
    };

    for (const match of sentence.matchAll(fullTextDatePattern)) {
      pushDate(
        normalizeDateParts({
          day: match[1],
          monthName: match[2],
          raw: match[0],
          year: match[3],
        }),
      );
    }

    for (const match of sentence.matchAll(isoDatePattern)) {
      pushDate(
        normalizeDateParts({
          day: match[3],
          month: match[2],
          raw: match[0],
          year: match[1],
        }),
      );
    }

    for (const match of sentence.matchAll(slashDatePattern)) {
      const year = String(match[3]).length === 2 ? `20${match[3]}` : match[3];
      pushDate(
        normalizeDateParts({
          day: match[1],
          month: match[2],
          raw: match[0],
          year,
        }),
      );
    }

    for (const match of sentence.matchAll(dayMonthPattern)) {
      pushDate({
        dateText: sanitizeText(match[0], 80),
        day: Number(match[1]),
        isoDate: null,
        month: MONTHS.get(normalizeMonthName(match[2])) || null,
        precision: "month_day",
      });
    }

    for (const match of sentence.matchAll(monthYearPattern)) {
      pushDate({
        dateText: sanitizeText(match[0], 80),
        day: null,
        isoDate: null,
        month: MONTHS.get(normalizeMonthName(match[1])) || null,
        precision: "month_year",
        year: Number(match[2]),
      });
    }
  });

  return dates.slice(0, 40);
}

function normalizeDateParts({ day, month, monthName, raw, year }) {
  const numericDay = Number(day);
  const numericMonth = Number(month || MONTHS.get(normalizeMonthName(monthName)));
  const numericYear = Number(year);
  const isFullDate =
    Number.isInteger(numericDay) &&
    numericDay >= 1 &&
    numericDay <= 31 &&
    Number.isInteger(numericMonth) &&
    numericMonth >= 1 &&
    numericMonth <= 12 &&
    Number.isInteger(numericYear) &&
    numericYear >= 1000 &&
    numericYear <= 9999;
  const isoDate = isFullDate
    ? `${String(numericYear).padStart(4, "0")}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`
    : null;

  return {
    dateText: sanitizeText(raw, 80),
    day: Number.isInteger(numericDay) ? numericDay : null,
    isoDate,
    month: Number.isInteger(numericMonth) ? numericMonth : null,
    precision: isoDate ? "day" : "partial",
    year: Number.isInteger(numericYear) ? numericYear : null,
  };
}

function extractTopics(content, title) {
  const stopWords = new Set([
    "yang",
    "dan",
    "atau",
    "untuk",
    "dengan",
    "pada",
    "dari",
    "dalam",
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
  ]);
  const frequency = new Map();

  normalizeKeyword(`${title} ${content}`, 30000)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
    .forEach((word) => frequency.set(word, (frequency.get(word) || 0) + 1));

  return Array.from(frequency.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 12)
    .map(([topic]) => topic);
}

function buildConflictKey(text) {
  const normalized = normalizeKeyword(text, 500)
    .replace(
      /^.*\b(project\s+[a-z0-9]+\s+(?:belum\s+)?(?:dimulai|selesai|berada|terjadi|memiliki|mengumumkan|menyatakan|akan|telah))\b/,
      "$1",
    )
    .replace(/\b(tidak|bukan|belum|denied|not|never|no|adalah|merupakan|is|are|was)\b/g, " ")
    .replace(/\b(melaporkan|mengatakan|menyatakan|disebut|kembali|dalam|catatan|operasional|sumber|lain|pada|di)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const projectDateMatch = normalized.match(
    /\b(project\s+[a-z0-9]+\s+dimulai\s+\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})\b/,
  );

  return projectDateMatch ? projectDateMatch[1] : normalized;
}

function isClaimCandidate(sentence) {
  const cleanSentence = sanitizeText(sentence, 800);
  const wordCount = cleanSentence.split(/\s+/).filter(Boolean).length;

  return (
    wordCount >= 4 &&
    cleanSentence.length >= 24 &&
    cleanSentence.length <= 800 &&
    CLAIM_VERB_PATTERN.test(cleanSentence) &&
    !NON_CLAIM_FRAGMENT_PATTERN.test(cleanSentence)
  );
}

function extractClaims(sentences, source, dates = []) {
  return sentences
    .filter(isClaimCandidate)
    .slice(0, 80)
    .map((sentence) => {
      const normalizedClaim = normalizeKeyword(sentence, 500);
      const polarity = NEGATION_PATTERN.test(sentence) ? "negative" : "positive";
      const dateMentions = dates
        .filter((date) => date.evidence === sentence)
        .map(({ dateText, day, isoDate, month, precision, year }) => ({
          dateText,
          day,
          isoDate,
          month,
          precision,
          year,
        }));
      const fullDate = dateMentions.find((date) => date.precision === "day" && date.isoDate);

      return {
        claimText: sentence,
        confidence: 0.58,
        conflictKey: buildConflictKey(sentence),
        dateMentions,
        extractedAt: new Date().toISOString(),
        normalizedClaim,
        observedAt: fullDate ? `${fullDate.isoDate}T00:00:00.000Z` : null,
        polarity,
        status: "unverified",
      };
    });
}

function extractRelationships(entities, claims) {
  const relationships = [];

  claims.forEach((claim) => {
    const related = entities.filter((entity) =>
      claim.normalizedClaim.includes(entity.normalizedName),
    );

    for (let index = 0; index < related.length - 1; index += 1) {
      const subject = related[index];
      const object = related[index + 1];

      if (!subject || !object || subject.normalizedName === object.normalizedName) {
        continue;
      }

      relationships.push({
        confidence: Math.min(subject.confidence, object.confidence, claim.confidence),
        evidenceText: claim.claimText,
        objectKey: `${object.entityType}:${object.normalizedName}`,
        relationshipType: "co_mentioned",
        sourceClaimText: claim.claimText,
        status: "supported",
        subjectKey: `${subject.entityType}:${subject.normalizedName}`,
      });
    }
  });

  const unique = new Map();
  relationships.forEach((relationship) => {
    const key = [
      relationship.subjectKey,
      relationship.relationshipType,
      relationship.objectKey,
      normalizeKeyword(relationship.evidenceText, 160),
    ].join("|");

    if (!unique.has(key)) unique.set(key, relationship);
  });

  return Array.from(unique.values()).slice(0, 80);
}

function extractIntelligence(source) {
  const sentences = splitSentences(source.content);
  const entities = extractNamedEntities(sentences);
  const dates = extractDates(sentences);
  const claims = extractClaims(sentences, source, dates);
  const topics = extractTopics(source.content, source.title);
  const relationships = extractRelationships(entities, claims);

  return {
    claims,
    dates,
    entities,
    relationships,
    sourceReferences: [
      {
        locator: source.sourceUrl || `${source.sourceType}:${source.sourceId}`,
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        title: source.title,
      },
    ],
    topics,
  };
}

function getEntityKey(entity) {
  return `${normalizeEntityType(entity.entityType)}:${normalizeKeyword(entity.normalizedName || entity.name, 120)}`;
}

module.exports = {
  CLAIM_STATUSES,
  ENTITY_TYPES,
  INDONESIAN_MONTHS,
  SOURCE_TYPES,
  buildConflictKey,
  createHttpError,
  extractIntelligence,
  extractDates,
  getEntityKey,
  hashText,
  isMonthName,
  normalizeClaimStatus,
  normalizeEntityType,
  normalizeKeyword,
  normalizeSafeSourceUrl,
  normalizeSourceInput,
  normalizeSourceType,
  sanitizeText,
};
