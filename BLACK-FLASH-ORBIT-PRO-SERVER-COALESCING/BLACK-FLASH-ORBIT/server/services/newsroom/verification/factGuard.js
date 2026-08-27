const {
  CLAIM_TYPES,
  extractClaims,
  hasAttributionLanguage,
  normalizeText,
} = require("./claimExtractor");
const { normalizeSources } = require("./sourceNormalizer");

const CLAIM_STATUSES = {
  CONFLICTING: "CONFLICTING",
  NOT_VERIFIABLE: "NOT_VERIFIABLE",
  PARTIALLY_SUPPORTED: "PARTIALLY_SUPPORTED",
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
};

const MONTH_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_VALUE_PATTERN = new RegExp(
  `\\b(?:${MONTH_NAMES})\\s+\\d{1,2},\\s+\\d{4}\\b|\\b(?:${MONTH_NAMES})\\s+\\d{4}\\b`,
  "gi",
);

function lower(value) {
  return normalizeText(value).toLowerCase();
}

function includesNormalized(haystack, needle) {
  const cleanNeedle = lower(needle);

  return cleanNeedle.length > 0 && lower(haystack).includes(cleanNeedle);
}

function getEvidenceCorpus(sources) {
  return sources
    .map((source) => ({
      id: source.id,
      text: `${source.title} ${source.publisher} ${source.content}`,
      type: source.type,
    }))
    .filter((source) => source.text.trim());
}

function findExactEvidence(claim, corpus) {
  const target = claim.value || claim.text;

  return corpus
    .filter((source) => includesNormalized(source.text, target))
    .map((source) => source.id);
}

function extractDateValuesFromSources(corpus) {
  return corpus.flatMap((source) =>
    [...String(source.text || "").matchAll(DATE_VALUE_PATTERN)].map(
      (match) => ({
        sourceId: source.id,
        value: normalizeText(match[0]),
      }),
    ),
  );
}

function hasDateConflict(claim, corpus) {
  if (claim.type !== CLAIM_TYPES.DATE) return false;

  const claimValue = lower(claim.value);
  const sourceDates = extractDateValuesFromSources(corpus);
  const exactMatches = sourceDates.filter(
    (date) => lower(date.value) === claimValue,
  );

  if (exactMatches.length > 0) {
    return sourceDates.some((date) => lower(date.value) !== claimValue);
  }

  return false;
}

function evaluateQuoteClaim(claim, corpus) {
  const evidenceRefs = findExactEvidence(claim, corpus);

  if (evidenceRefs.length > 0) {
    return {
      confidence: 90,
      evidenceRefs,
      status: CLAIM_STATUSES.SUPPORTED,
      warnings: [],
    };
  }

  return {
    confidence: 15,
    evidenceRefs: [],
    status: CLAIM_STATUSES.UNSUPPORTED,
    warnings: ["Unsupported direct quote requires source evidence."],
  };
}

function evaluateAllegationClaim(claim, corpus) {
  const evidenceRefs = findExactEvidence(claim, corpus);
  const anyEvidenceMentionsClaim = corpus.some((source) =>
    includesNormalized(source.text, claim.text.replace(/^.*?\bthat\s+/i, "")),
  );
  const sourceHasAttribution = corpus.some((source) =>
    hasAttributionLanguage(source.text),
  );
  const claimHasAttribution = hasAttributionLanguage(claim.text);

  if (evidenceRefs.length > 0 && claimHasAttribution) {
    return {
      confidence: 78,
      evidenceRefs,
      status: CLAIM_STATUSES.SUPPORTED,
      warnings: [],
    };
  }

  if (
    anyEvidenceMentionsClaim &&
    sourceHasAttribution &&
    !claimHasAttribution
  ) {
    return {
      confidence: 20,
      evidenceRefs: corpus
        .filter((source) => hasAttributionLanguage(source.text))
        .map((source) => source.id),
      status: CLAIM_STATUSES.UNSUPPORTED,
      warnings: [
        "Serious allegation appears to lose required source attribution.",
      ],
    };
  }

  return {
    confidence: evidenceRefs.length ? 45 : 10,
    evidenceRefs,
    status: evidenceRefs.length
      ? CLAIM_STATUSES.PARTIALLY_SUPPORTED
      : CLAIM_STATUSES.UNSUPPORTED,
    warnings: ["Serious allegation requires strong attribution and evidence."],
  };
}

function evaluateClaim(claim, corpus) {
  if (claim.provenance) {
    return {
      ...claim,
      confidence: 35,
      evidenceRefs: [],
      status: CLAIM_STATUSES.NOT_VERIFIABLE,
      warnings: [
        `${claim.provenance} is an analytical hypothesis, not a verified factual claim.`,
      ],
    };
  }

  if (!corpus.length) {
    return {
      ...claim,
      confidence: claim.evidenceRequired ? 5 : 20,
      status: claim.evidenceRequired
        ? CLAIM_STATUSES.UNSUPPORTED
        : CLAIM_STATUSES.NOT_VERIFIABLE,
      warnings: claim.evidenceRequired
        ? ["No source evidence supplied for claim."]
        : ["No source evidence supplied."],
    };
  }

  if (claim.type === CLAIM_TYPES.QUOTE) {
    return {
      ...claim,
      ...evaluateQuoteClaim(claim, corpus),
    };
  }

  if (claim.type === CLAIM_TYPES.ALLEGATION) {
    return {
      ...claim,
      ...evaluateAllegationClaim(claim, corpus),
    };
  }

  const evidenceRefs = findExactEvidence(claim, corpus);
  const conflicting = hasDateConflict(claim, corpus);

  if (conflicting) {
    return {
      ...claim,
      confidence: 30,
      evidenceRefs: [
        ...new Set([
          ...evidenceRefs,
          ...extractDateValuesFromSources(corpus).map((date) => date.sourceId),
        ]),
      ],
      status: CLAIM_STATUSES.CONFLICTING,
      warnings: ["Conflicting source evidence detected for date claim."],
    };
  }

  if (evidenceRefs.length > 0) {
    return {
      ...claim,
      confidence: 82,
      evidenceRefs,
      status: CLAIM_STATUSES.SUPPORTED,
      warnings: [],
    };
  }

  if (claim.evidenceRequired) {
    return {
      ...claim,
      confidence: 18,
      evidenceRefs: [],
      status: CLAIM_STATUSES.UNSUPPORTED,
      warnings: [
        `Unsupported ${claim.type.toLowerCase()} claim requires evidence.`,
      ],
    };
  }

  return {
    ...claim,
    confidence: 35,
    evidenceRefs: [],
    status: CLAIM_STATUSES.NOT_VERIFIABLE,
    warnings: ["Claim not verifiable from supplied evidence."],
  };
}

function runFactGuard({ draft, sourceText, sources } = {}) {
  const normalizedSources = normalizeSources({ sourceText, sources });
  const corpus = getEvidenceCorpus(normalizedSources);
  const claims = extractClaims(draft).map((claim) =>
    evaluateClaim(claim, corpus),
  );
  const supportedCount = claims.filter(
    (claim) => claim.status === CLAIM_STATUSES.SUPPORTED,
  ).length;
  const partialCount = claims.filter(
    (claim) => claim.status === CLAIM_STATUSES.PARTIALLY_SUPPORTED,
  ).length;
  const unsupportedCount = claims.filter(
    (claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED,
  ).length;
  const conflictingCount = claims.filter(
    (claim) => claim.status === CLAIM_STATUSES.CONFLICTING,
  ).length;
  const highRiskClaims = claims.filter(
    (claim) =>
      ["HIGH", "CRITICAL"].includes(claim.importance) &&
      [
        CLAIM_STATUSES.UNSUPPORTED,
        CLAIM_STATUSES.CONFLICTING,
        CLAIM_STATUSES.PARTIALLY_SUPPORTED,
      ].includes(claim.status),
  );
  const warnings = [
    ...new Set(claims.flatMap((claim) => claim.warnings || [])),
  ];

  return {
    claims,
    conflictingCount,
    highRiskClaims,
    partialCount,
    sourceCount: normalizedSources.length,
    sources: normalizedSources,
    supportedCount,
    unsupportedCount,
    warnings,
  };
}

module.exports = {
  CLAIM_STATUSES,
  runFactGuard,
};
