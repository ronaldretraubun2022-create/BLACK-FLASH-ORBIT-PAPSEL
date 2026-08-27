const { runCitationGuard } = require("./citationGuard");
const { runFactGuard } = require("./factGuard");
const { calculateSourceConfidence } = require("./sourceConfidence");
const { determineReviewStatus } = require("./reviewStatus");

function verifyNewsroomDraft({
  draft,
  legacyConfidenceScore = 0,
  sourceText,
  sources,
} = {}) {
  const factGuard = runFactGuard({ draft, sourceText, sources });
  const citationGuard = runCitationGuard({ claims: factGuard.claims });
  const sourceConfidence = calculateSourceConfidence({
    citationGuard,
    factGuard,
  });
  const review = determineReviewStatus({
    citationGuard,
    factGuard,
    legacyConfidenceScore,
    sourceConfidence,
  });

  return {
    citationGuard,
    claims: factGuard.claims,
    factGuard: {
      claims: factGuard.claims,
      conflictingCount: factGuard.conflictingCount,
      highRiskClaims: factGuard.highRiskClaims,
      partialCount: factGuard.partialCount,
      sourceCount: factGuard.sourceCount,
      supportedCount: factGuard.supportedCount,
      unsupportedCount: factGuard.unsupportedCount,
      warnings: factGuard.warnings,
    },
    publicationBlockers: review.publicationBlockers,
    publicationReady: review.publicationReady,
    review,
    sourceConfidence,
  };
}

module.exports = {
  verifyNewsroomDraft,
};
