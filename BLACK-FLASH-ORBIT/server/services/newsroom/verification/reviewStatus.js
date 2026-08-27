const { CLAIM_TYPES } = require("./claimExtractor");
const { CLAIM_STATUSES } = require("./factGuard");

const REVIEW_STATUSES = {
  AI_REVIEWED: "AI_REVIEWED",
  APPROVED: "APPROVED",
  DRAFT: "DRAFT",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  READY_FOR_EDITOR: "READY_FOR_EDITOR",
  REJECTED: "REJECTED",
};

function clampScore(value) {
  return Math.max(0, Math.min(95, Math.round(value)));
}

function createPublicationBlockers({
  citationGuard,
  factGuard,
  sourceConfidence,
}) {
  const blockers = [];

  (factGuard.highRiskClaims || []).forEach((claim) => {
    if (
      claim.type === CLAIM_TYPES.QUOTE &&
      claim.status === CLAIM_STATUSES.UNSUPPORTED
    ) {
      blockers.push({
        claimId: claim.id,
        code: "UNSUPPORTED_DIRECT_QUOTE",
        message: "Direct quote lacks matching source evidence.",
      });
    }

    if (
      claim.type === CLAIM_TYPES.ALLEGATION &&
      [CLAIM_STATUSES.UNSUPPORTED, CLAIM_STATUSES.PARTIALLY_SUPPORTED].includes(
        claim.status,
      )
    ) {
      blockers.push({
        claimId: claim.id,
        code: "UNSUPPORTED_SERIOUS_ALLEGATION",
        message:
          "Serious allegation requires stronger attribution and evidence.",
      });
    }

    if (
      claim.type === CLAIM_TYPES.NUMBER &&
      claim.status === CLAIM_STATUSES.UNSUPPORTED
    ) {
      blockers.push({
        claimId: claim.id,
        code: "UNSUPPORTED_CRITICAL_NUMBER",
        message: "Critical numerical claim lacks source evidence.",
      });
    }

    if (
      claim.type === CLAIM_TYPES.DATE &&
      claim.status === CLAIM_STATUSES.CONFLICTING
    ) {
      blockers.push({
        claimId: claim.id,
        code: "CONFLICTING_CRITICAL_DATE",
        message: "Critical date conflicts across supplied sources.",
      });
    }
  });

  if (sourceConfidence.level === "INSUFFICIENT") {
    blockers.push({
      claimId: null,
      code: "INSUFFICIENT_SOURCE_EVIDENCE",
      message:
        "Supplied source evidence is insufficient for publication-ready status.",
    });
  }

  if ((citationGuard?.missingCritical || []).length) {
    blockers.push({
      claimId: null,
      code: "CRITICAL_CITATION_MISSING",
      message: "Critical claims require stronger citation coverage.",
    });
  }

  return blockers;
}

function calculateEditorialConfidence({
  citationGuard,
  factGuard,
  legacyConfidenceScore = 0,
  sourceConfidence,
}) {
  const totalClaims = factGuard.claims.length || 1;
  const supportRatio =
    (factGuard.supportedCount + factGuard.partialCount * 0.5) / totalClaims;
  const citationScore = Math.round((citationGuard.coverage || 0) * 100);
  const score = clampScore(
    (Number(legacyConfidenceScore) || 0) * 0.25 +
      supportRatio * 35 +
      sourceConfidence.score * 0.25 +
      citationScore * 0.15 -
      factGuard.highRiskClaims.length * 8 -
      factGuard.conflictingCount * 12,
  );
  const level =
    score >= 75
      ? "HIGH"
      : score >= 55
        ? "MEDIUM"
        : score >= 35
          ? "LOW"
          : "INSUFFICIENT";
  const reasons = [
    `Claim support ratio: ${Math.round(supportRatio * 100)}%.`,
    `Citation coverage: ${Math.round((citationGuard.coverage || 0) * 100)}%.`,
    `Source confidence: ${sourceConfidence.level}.`,
  ];

  if (factGuard.highRiskClaims.length) {
    reasons.push(
      `${factGuard.highRiskClaims.length} high-risk claim(s) need review.`,
    );
  }
  if (factGuard.conflictingCount) {
    reasons.push(
      `${factGuard.conflictingCount} conflicting claim(s) detected.`,
    );
  }

  return {
    blockers: [],
    level,
    reasons,
    score,
  };
}

function determineReviewStatus({
  citationGuard,
  factGuard,
  legacyConfidenceScore,
  sourceConfidence,
}) {
  const editorialConfidence = calculateEditorialConfidence({
    citationGuard,
    factGuard,
    legacyConfidenceScore,
    sourceConfidence,
  });
  const publicationBlockers = createPublicationBlockers({
    citationGuard,
    factGuard,
    sourceConfidence,
  });
  const publicationReady =
    publicationBlockers.length === 0 &&
    editorialConfidence.score >= 65 &&
    factGuard.unsupportedCount === 0 &&
    factGuard.conflictingCount === 0;
  const reviewStatus = publicationReady
    ? REVIEW_STATUSES.READY_FOR_EDITOR
    : REVIEW_STATUSES.NEEDS_REVIEW;
  const reviewReasons = [
    ...editorialConfidence.reasons,
    ...publicationBlockers.map((blocker) => blocker.message),
  ];

  return {
    editorialConfidence: {
      ...editorialConfidence,
      blockers: publicationBlockers,
    },
    publicationBlockers,
    publicationReady,
    requiresHumanApproval: true,
    reviewReasons: [...new Set(reviewReasons)],
    reviewStatus,
  };
}

module.exports = {
  REVIEW_STATUSES,
  determineReviewStatus,
};
