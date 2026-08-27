const { CLAIM_TYPES } = require("./claimExtractor");
const { CLAIM_STATUSES } = require("./factGuard");

const CITATION_STRENGTH = {
  MODERATE: "MODERATE",
  NONE: "NONE",
  STRONG: "STRONG",
  WEAK: "WEAK",
};

function isCitationRequired(claim) {
  if (claim?.provenance) return false;

  return (
    claim.evidenceRequired === true ||
    [
      CLAIM_TYPES.ALLEGATION,
      CLAIM_TYPES.DATE,
      CLAIM_TYPES.NUMBER,
      CLAIM_TYPES.QUOTE,
    ].includes(claim.type)
  );
}

function getCitationStrength(claim) {
  const evidenceCount = Array.isArray(claim.evidenceRefs)
    ? claim.evidenceRefs.length
    : 0;

  if (evidenceCount === 0) return CITATION_STRENGTH.NONE;
  if (claim.status === CLAIM_STATUSES.SUPPORTED && evidenceCount >= 2) {
    return CITATION_STRENGTH.STRONG;
  }
  if (claim.status === CLAIM_STATUSES.SUPPORTED) {
    return CITATION_STRENGTH.MODERATE;
  }
  return CITATION_STRENGTH.WEAK;
}

function runCitationGuard({ claims = [] } = {}) {
  const claimCitations = claims.map((claim) => {
    const citationRequired = isCitationRequired(claim);
    const citationPresent =
      Array.isArray(claim.evidenceRefs) && claim.evidenceRefs.length > 0;

    return {
      citationPresent,
      citationRequired,
      citationStrength: citationRequired
        ? getCitationStrength(claim)
        : citationPresent
          ? getCitationStrength(claim)
          : CITATION_STRENGTH.NONE,
      claimId: claim.id,
      sourceRefs: claim.evidenceRefs || [],
    };
  });
  const required = claimCitations.filter((item) => item.citationRequired);
  const covered = required.filter((item) => item.citationPresent);
  const coverage = required.length ? covered.length / required.length : 1;
  const missingCritical = claimCitations.filter(
    (item) =>
      item.citationRequired &&
      !item.citationPresent &&
      claims.some(
        (claim) =>
          claim.id === item.claimId &&
          [
            CLAIM_TYPES.ALLEGATION,
            CLAIM_TYPES.QUOTE,
            CLAIM_TYPES.NUMBER,
          ].includes(claim.type),
      ),
  );

  return {
    claimCitations,
    coverage,
    missingCritical,
    requiredCount: required.length,
    warningCount: missingCritical.length,
    warnings: missingCritical.map(
      (item) => `Claim ${item.claimId} requires stronger citation evidence.`,
    ),
  };
}

module.exports = {
  CITATION_STRENGTH,
  runCitationGuard,
};
