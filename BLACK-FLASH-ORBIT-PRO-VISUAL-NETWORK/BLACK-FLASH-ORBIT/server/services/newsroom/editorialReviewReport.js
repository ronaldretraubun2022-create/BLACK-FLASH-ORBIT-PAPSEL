const REPORT_VERSION = "editorial-review-v1";

function safeValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  return value;
}

function getSafeMetadata(metadata = {}) {
  return {
    audience: safeValue(metadata.audience),
    channel: safeValue(metadata.channel),
    complexity: safeValue(metadata.complexity),
    durationMs: safeValue(metadata.durationMs),
    fallbackUsed: Boolean(metadata.fallbackUsed),
    mode: safeValue(metadata.mode),
    model: safeValue(metadata.model),
    promptVersion: safeValue(metadata.promptVersion),
    provider: safeValue(metadata.provider),
  };
}

function getConfiguration(configuration = {}) {
  return {
    audience: safeValue(configuration.audience),
    audienceLabel: safeValue(configuration.audienceLabel),
    channel: safeValue(configuration.channel),
    channelLabel: safeValue(configuration.channelLabel),
    complexity: safeValue(configuration.complexity),
    complexityLabel: safeValue(configuration.complexityLabel),
    language: safeValue(configuration.language),
    mode: safeValue(configuration.mode),
    promptVersion: safeValue(configuration.promptVersion),
  };
}

function getClaimsRequiringAttention(verification = {}) {
  const claims = Array.isArray(verification.claims) ? verification.claims : [];

  return claims
    .filter((claim) =>
      ["CONFLICTING", "PARTIALLY_SUPPORTED", "UNSUPPORTED"].includes(
        claim.status,
      ),
    )
    .slice(0, 10)
    .map((claim) => ({
      confidence: claim.confidence,
      id: claim.id,
      importance: claim.importance,
      status: claim.status,
      text: claim.text,
      type: claim.type,
    }));
}

function getVerificationSummary(verification = {}) {
  const factGuard = verification.factGuard || {};
  const citationGuard = verification.citationGuard || {};

  return {
    citationCoverage: citationGuard.coverage || 0,
    claimsRequiringAttention: getClaimsRequiringAttention(verification),
    conflictingCount: factGuard.conflictingCount || 0,
    partialCount: factGuard.partialCount || 0,
    publicationBlockers: Array.isArray(verification.publicationBlockers)
      ? verification.publicationBlockers.map((blocker) => ({
          claimId: blocker.claimId || null,
          code: blocker.code,
          message: blocker.message,
        }))
      : [],
    sourceConfidence: verification.sourceConfidence
      ? {
          factors: verification.sourceConfidence.factors,
          level: verification.sourceConfidence.level,
          score: verification.sourceConfidence.score,
          warnings: verification.sourceConfidence.warnings || [],
        }
      : null,
    supportedCount: factGuard.supportedCount || 0,
    unsupportedCount: factGuard.unsupportedCount || 0,
  };
}

function getSourceSummary(verification = {}) {
  const sourceConfidence = verification.sourceConfidence || {};
  const factors = sourceConfidence.factors || {};

  return {
    attribution: factors.attribution || "none",
    corroboration: factors.corroboration || "none",
    sourceConfidenceLevel: sourceConfidence.level || "INSUFFICIENT",
    sourceCount: factors.sourceCount || 0,
    sourceTypes: Array.isArray(factors.sourceTypes) ? factors.sourceTypes : [],
    staleSourceCount: factors.staleSourceCount || 0,
  };
}

function buildEditorialReviewReport({
  configuration,
  generatedAt = new Date().toISOString(),
  intelligenceSummary,
  metadata,
  verification,
} = {}) {
  return {
    actions: Array.isArray(intelligenceSummary?.editorActions)
      ? intelligenceSummary.editorActions
      : [],
    configuration: getConfiguration(configuration),
    generatedAt,
    reportVersion: REPORT_VERSION,
    safeMetadata: getSafeMetadata(metadata),
    sources: getSourceSummary(verification),
    summary: {
      confidence: intelligenceSummary?.confidence || null,
      editorialStatus: intelligenceSummary?.editorialStatus || "NEEDS_REVIEW",
      keyFindings: intelligenceSummary?.keyFindings || [],
      overview: intelligenceSummary?.overview || "",
      publicationReadiness:
        intelligenceSummary?.publicationReadiness || "NEEDS_REVIEW",
    },
    verification: getVerificationSummary(verification),
  };
}

module.exports = {
  REPORT_VERSION,
  buildEditorialReviewReport,
};
