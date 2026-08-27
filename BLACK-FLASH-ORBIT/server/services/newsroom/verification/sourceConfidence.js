const { CLAIM_STATUSES } = require("./factGuard");
const { SOURCE_TYPES } = require("./sourceNormalizer");

const SOURCE_CONFIDENCE_LEVELS = {
  HIGH: "HIGH",
  INSUFFICIENT: "INSUFFICIENT",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
};

const SOURCE_TYPE_SCORES = {
  [SOURCE_TYPES.OFFICIAL_DOCUMENT]: 88,
  [SOURCE_TYPES.DIRECT_INTERVIEW]: 82,
  [SOURCE_TYPES.PRIMARY_RECORD]: 84,
  [SOURCE_TYPES.OFFICIAL_STATEMENT]: 78,
  [SOURCE_TYPES.REPUTABLE_REPORTING]: 68,
  [SOURCE_TYPES.SECONDARY_REPORT]: 58,
  [SOURCE_TYPES.USER_PROVIDED]: 38,
  [SOURCE_TYPES.UNKNOWN]: 25,
};

function clampScore(value) {
  return Math.max(0, Math.min(95, Math.round(value)));
}

function getLevel(score, sourceCount) {
  if (!sourceCount || score < 30) return SOURCE_CONFIDENCE_LEVELS.INSUFFICIENT;
  if (score >= 75) return SOURCE_CONFIDENCE_LEVELS.HIGH;
  if (score >= 55) return SOURCE_CONFIDENCE_LEVELS.MEDIUM;
  return SOURCE_CONFIDENCE_LEVELS.LOW;
}

function isStaleSource(source) {
  const rawDate = source.publishedAt || source.retrievedAt;
  if (!rawDate) return false;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;

  const ageMs = Date.now() - date.getTime();
  const days = ageMs / (1000 * 60 * 60 * 24);

  return days > 730;
}

function calculateSourceConfidence({ citationGuard, factGuard } = {}) {
  const sources = factGuard?.sources || [];
  const claims = factGuard?.claims || [];
  const typeScores = sources.map(
    (source) => SOURCE_TYPE_SCORES[source.type] || SOURCE_TYPE_SCORES.unknown,
  );
  const baseScore = typeScores.length
    ? typeScores.reduce((sum, score) => sum + score, 0) / typeScores.length
    : 15;
  const supportedRatio = claims.length
    ? factGuard.supportedCount / claims.length
    : 0;
  const conflictingPenalty = (factGuard?.conflictingCount || 0) * 16;
  const unsupportedPenalty = (factGuard?.unsupportedCount || 0) * 8;
  const highRiskPenalty = (factGuard?.highRiskClaims || []).length * 12;
  const staleCount = sources.filter(isStaleSource).length;
  const stalePenalty = staleCount * 10;
  const corroborationBonus = sources.length >= 2 ? 8 : 0;
  const coverageBonus = Math.round((citationGuard?.coverage || 0) * 10);
  const score = clampScore(
    baseScore +
      supportedRatio * 20 +
      corroborationBonus +
      coverageBonus -
      conflictingPenalty -
      unsupportedPenalty -
      highRiskPenalty -
      stalePenalty,
  );
  const factors = {
    attribution: sources.some((source) => source.author || source.publisher)
      ? "named"
      : sources.length
        ? "unclear"
        : "none",
    citationCoverage: citationGuard?.coverage || 0,
    corroboration:
      sources.length >= 2
        ? "multiple_sources"
        : sources.length
          ? "single_source"
          : "none",
    evidenceStrength:
      supportedRatio >= 0.7
        ? "direct_support"
        : supportedRatio > 0
          ? "partial_support"
          : "contextual_or_absent",
    sourceCount: sources.length,
    sourceTypes: [...new Set(sources.map((source) => source.type))],
    staleSourceCount: staleCount,
  };
  const warnings = [];

  if (!sources.length) warnings.push("No source evidence supplied.");
  if (staleCount) warnings.push("One or more sources may be stale.");
  if (factGuard?.conflictingCount)
    warnings.push("Conflicting source evidence detected.");
  if ((factGuard?.highRiskClaims || []).length) {
    warnings.push("High-risk unsupported claims reduce source confidence.");
  }
  if (
    claims.some((claim) => claim.status === CLAIM_STATUSES.UNSUPPORTED) &&
    (citationGuard?.coverage || 0) < 0.8
  ) {
    warnings.push("Citation coverage is incomplete for important claims.");
  }

  return {
    factors,
    level: getLevel(score, sources.length),
    score,
    warnings,
  };
}

module.exports = {
  SOURCE_CONFIDENCE_LEVELS,
  calculateSourceConfidence,
};
