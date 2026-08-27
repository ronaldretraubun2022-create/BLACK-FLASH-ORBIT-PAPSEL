const PUBLICATION_READINESS = {
  BLOCKED: "BLOCKED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  READY_FOR_EDITOR: "READY_FOR_EDITOR",
};

const ACTION_TYPES = {
  ADD_PRIMARY_SOURCE: "ADD_PRIMARY_SOURCE",
  CONFIRM_DATE: "CONFIRM_DATE",
  CORROBORATE_ALLEGATION: "CORROBORATE_ALLEGATION",
  READY_FOR_EDITOR_REVIEW: "READY_FOR_EDITOR_REVIEW",
  RESOLVE_SOURCE_CONFLICT: "RESOLVE_SOURCE_CONFLICT",
  REVIEW_ATTRIBUTION: "REVIEW_ATTRIBUTION",
  VERIFY_QUOTE: "VERIFY_QUOTE",
  VERIFY_STATISTIC: "VERIFY_STATISTIC",
};

const CLAIM_STATUS_LABELS = {
  CONFLICTING: "conflicting",
  NOT_VERIFIABLE: "not verifiable",
  PARTIALLY_SUPPORTED: "partially supported",
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
};

const BLOCKER_ACTIONS = {
  CONFLICTING_CRITICAL_DATE: ACTION_TYPES.RESOLVE_SOURCE_CONFLICT,
  CRITICAL_CITATION_MISSING: ACTION_TYPES.ADD_PRIMARY_SOURCE,
  INSUFFICIENT_SOURCE_EVIDENCE: ACTION_TYPES.ADD_PRIMARY_SOURCE,
  UNSUPPORTED_CRITICAL_NUMBER: ACTION_TYPES.VERIFY_STATISTIC,
  UNSUPPORTED_DIRECT_QUOTE: ACTION_TYPES.VERIFY_QUOTE,
  UNSUPPORTED_SERIOUS_ALLEGATION: ACTION_TYPES.CORROBORATE_ALLEGATION,
};

const CLAIM_PRIORITIES = {
  ALLEGATION: 100,
  QUOTE: 95,
  NUMBER: 90,
  DATE: 85,
  CAUSAL: 75,
  EVENT: 70,
  INSTITUTIONAL: 60,
  PERSON: 60,
  ROLE: 55,
  LOCATION: 50,
  GENERAL: 20,
};

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFn(item);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getClaims(verification) {
  return Array.isArray(verification?.claims) ? verification.claims : [];
}

function getFactGuard(verification) {
  return verification?.factGuard || {};
}

function getPublicationBlockers(verification) {
  return Array.isArray(verification?.publicationBlockers)
    ? verification.publicationBlockers
    : [];
}

function getCitationCoverage(verification) {
  const coverage = Number(verification?.citationGuard?.coverage);

  return Number.isFinite(coverage) ? coverage : 0;
}

function getSourceConfidence(verification) {
  return verification?.sourceConfidence || {};
}

function getClaimById(claims, claimId) {
  return claims.find((claim) => claim.id === claimId) || null;
}

function getClaimRiskScore(claim) {
  const statusPenalty =
    {
      CONFLICTING: 45,
      PARTIALLY_SUPPORTED: 25,
      UNSUPPORTED: 40,
    }[claim.status] || 0;
  const importanceBonus =
    claim.importance === "CRITICAL" ? 15 : claim.importance === "HIGH" ? 10 : 0;

  return (CLAIM_PRIORITIES[claim.type] || 30) + statusPenalty + importanceBonus;
}

function normalizeBlockers(blockers) {
  return blockers.map((blocker) => {
    const type = blocker.code || "PUBLICATION_BLOCKER";
    const severity =
      type === "UNSUPPORTED_DIRECT_QUOTE" ||
      type === "UNSUPPORTED_SERIOUS_ALLEGATION" ||
      type === "CONFLICTING_CRITICAL_DATE"
        ? "CRITICAL"
        : "HIGH";

    return {
      claimId: blocker.claimId || null,
      message: blocker.message || "Publication issue requires editor review.",
      recommendedAction:
        BLOCKER_ACTIONS[type] || ACTION_TYPES.ADD_PRIMARY_SOURCE,
      severity,
      type,
    };
  });
}

function getPublicationReadiness({
  blockers,
  editorial,
  factGuard,
  sourceGaps,
}) {
  if (blockers.length) return PUBLICATION_READINESS.BLOCKED;

  if (
    (sourceGaps || []).some(
      (gap) => gap.type === "ALLEGATION_CORROBORATION_GAP",
    )
  ) {
    return PUBLICATION_READINESS.NEEDS_REVIEW;
  }

  if (
    editorial?.reviewStatus === "READY_FOR_EDITOR" &&
    (factGuard.unsupportedCount || 0) === 0 &&
    (factGuard.conflictingCount || 0) === 0
  ) {
    return PUBLICATION_READINESS.READY_FOR_EDITOR;
  }

  return PUBLICATION_READINESS.NEEDS_REVIEW;
}

function buildOverview({ blockers, editorial, factGuard, readiness }) {
  if (readiness === PUBLICATION_READINESS.READY_FOR_EDITOR) {
    return "Draft is broadly supported by available evidence and is ready for editor review. Human approval is still required before publication.";
  }

  if (blockers.some((blocker) => blocker.type === "UNSUPPORTED_DIRECT_QUOTE")) {
    return "Draft requires review because one or more direct quotations are not supported by supplied evidence.";
  }

  if (
    blockers.some(
      (blocker) => blocker.type === "UNSUPPORTED_SERIOUS_ALLEGATION",
    )
  ) {
    return "Draft requires review because a serious allegation needs stronger attribution and supporting evidence.";
  }

  if (factGuard.conflictingCount > 0) {
    return "Draft requires editor review because supplied evidence contains conflicting claim support.";
  }

  if (factGuard.unsupportedCount > 0 || factGuard.partialCount > 0) {
    return "Draft needs review because some claims are unsupported or only partially supported by supplied evidence.";
  }

  return `Draft remains in ${editorial?.reviewStatus || "NEEDS_REVIEW"} status pending human editorial review.`;
}

function buildKeyFindings({ factGuard, sourceConfidence, verification }) {
  const findings = [];
  const supportedCount = factGuard.supportedCount || 0;
  const partialCount = factGuard.partialCount || 0;
  const unsupportedCount = factGuard.unsupportedCount || 0;
  const conflictingCount = factGuard.conflictingCount || 0;
  const citationCoverage = clampPercent(
    getCitationCoverage(verification) * 100,
  );

  findings.push(`${supportedCount} supported claim(s).`);

  if (partialCount)
    findings.push(`${partialCount} partially supported claim(s).`);
  if (unsupportedCount)
    findings.push(`${unsupportedCount} unsupported claim(s).`);
  if (conflictingCount)
    findings.push(`${conflictingCount} conflicting claim(s).`);

  findings.push(`Citation coverage is ${citationCoverage}%.`);
  findings.push(
    `Source confidence is ${sourceConfidence.level || "INSUFFICIENT"}.`,
  );

  return findings;
}

function getTopUnsupportedClaims(claims, limit = 5) {
  return claims
    .filter((claim) =>
      ["CONFLICTING", "PARTIALLY_SUPPORTED", "UNSUPPORTED"].includes(
        claim.status,
      ),
    )
    .sort(
      (first, second) => getClaimRiskScore(second) - getClaimRiskScore(first),
    )
    .slice(0, limit)
    .map((claim) => ({
      confidence: claim.confidence,
      id: claim.id,
      importance: claim.importance,
      status: claim.status,
      text: claim.text,
      type: claim.type,
    }));
}

function hasPrimarySourceType(sourceConfidence) {
  const types = sourceConfidence?.factors?.sourceTypes || [];

  return types.some((type) =>
    [
      "direct_interview",
      "official_document",
      "official_statement",
      "primary_record",
    ].includes(type),
  );
}

function buildSourceGaps({ claims, sourceConfidence, verification }) {
  const gaps = [];
  const missingCritical = verification?.citationGuard?.missingCritical || [];
  const missingCriticalIds = new Set(
    missingCritical.map((item) => item.claimId).filter(Boolean),
  );

  claims.forEach((claim) => {
    const sourceCount = Array.isArray(claim.evidenceRefs)
      ? claim.evidenceRefs.length
      : 0;

    if (claim.type === "QUOTE" && claim.status !== "SUPPORTED") {
      gaps.push({
        claimId: claim.id,
        message:
          "Direct quote needs matching transcript, recording, or document evidence.",
        type: "QUOTE_EVIDENCE_GAP",
      });
    }

    if (claim.type === "NUMBER" && !hasPrimarySourceType(sourceConfidence)) {
      gaps.push({
        claimId: claim.id,
        message:
          "Numerical claim should be checked against a primary statistical, budget, or official source.",
        type: "PRIMARY_NUMERIC_SOURCE_GAP",
      });
    }

    if (claim.type === "DATE" && claim.status === "CONFLICTING") {
      gaps.push({
        claimId: claim.id,
        message: "Conflicting dates need reconciliation before publication.",
        type: "DATE_CONFLICT_GAP",
      });
    }

    if (claim.type === "ALLEGATION" && sourceCount < 2) {
      gaps.push({
        claimId: claim.id,
        message:
          "Sensitive allegation needs attribution review and corroboration where available.",
        type: "ALLEGATION_CORROBORATION_GAP",
      });
    }

    if (missingCriticalIds.has(claim.id)) {
      gaps.push({
        claimId: claim.id,
        message: "Critical claim lacks citation coverage.",
        type: "CRITICAL_CITATION_GAP",
      });
    }
  });

  if (
    ["INSUFFICIENT", "LOW"].includes(sourceConfidence?.level) &&
    !hasPrimarySourceType(sourceConfidence)
  ) {
    gaps.push({
      claimId: null,
      message: "Available evidence lacks a strong primary source.",
      type: "PRIMARY_SOURCE_GAP",
    });
  }

  return uniqueBy(
    gaps,
    (gap) => `${gap.type}:${gap.claimId || "global"}`,
  ).slice(0, 8);
}

function createAction({ message, priority, relatedClaimIds = [], type }) {
  return {
    id: `action-${type.toLowerCase()}-${relatedClaimIds.join("-") || "global"}`,
    message,
    priority,
    relatedClaimIds,
    type,
  };
}

function buildEditorActions({ blockers, claims, readiness, sourceGaps }) {
  const actions = [];

  blockers.forEach((blocker) => {
    actions.push(
      createAction({
        message: blocker.recommendedAction
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/^\w/, (char) => char.toUpperCase()),
        priority: blocker.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
        relatedClaimIds: blocker.claimId ? [blocker.claimId] : [],
        type: blocker.recommendedAction,
      }),
    );
  });

  claims.forEach((claim) => {
    if (claim.status === "CONFLICTING") {
      actions.push(
        createAction({
          message: "Resolve conflicting source evidence before publication.",
          priority: "HIGH",
          relatedClaimIds: [claim.id],
          type: ACTION_TYPES.RESOLVE_SOURCE_CONFLICT,
        }),
      );
    }

    if (claim.type === "DATE" && claim.status !== "SUPPORTED") {
      actions.push(
        createAction({
          message: "Confirm date against source material.",
          priority: claim.status === "CONFLICTING" ? "HIGH" : "MEDIUM",
          relatedClaimIds: [claim.id],
          type: ACTION_TYPES.CONFIRM_DATE,
        }),
      );
    }

    if (claim.type === "NUMBER" && claim.status !== "SUPPORTED") {
      actions.push(
        createAction({
          message: "Verify statistic or numerical claim before publication.",
          priority: "HIGH",
          relatedClaimIds: [claim.id],
          type: ACTION_TYPES.VERIFY_STATISTIC,
        }),
      );
    }

    if (claim.type === "ALLEGATION") {
      actions.push(
        createAction({
          message: "Review allegation attribution and corroboration.",
          priority: claim.status === "SUPPORTED" ? "MEDIUM" : "HIGH",
          relatedClaimIds: [claim.id],
          type: ACTION_TYPES.REVIEW_ATTRIBUTION,
        }),
      );
    }
  });

  sourceGaps.forEach((gap) => {
    if (
      [
        "PRIMARY_SOURCE_GAP",
        "PRIMARY_NUMERIC_SOURCE_GAP",
        "CRITICAL_CITATION_GAP",
      ].includes(gap.type)
    ) {
      actions.push(
        createAction({
          message: gap.message,
          priority: gap.claimId ? "HIGH" : "MEDIUM",
          relatedClaimIds: gap.claimId ? [gap.claimId] : [],
          type: ACTION_TYPES.ADD_PRIMARY_SOURCE,
        }),
      );
    }

    if (gap.type === "ALLEGATION_CORROBORATION_GAP") {
      actions.push(
        createAction({
          message: gap.message,
          priority: "HIGH",
          relatedClaimIds: gap.claimId ? [gap.claimId] : [],
          type: ACTION_TYPES.CORROBORATE_ALLEGATION,
        }),
      );
    }
  });

  if (readiness === PUBLICATION_READINESS.READY_FOR_EDITOR) {
    actions.push(
      createAction({
        message: "Proceed to human editor review before publication.",
        priority: "LOW",
        relatedClaimIds: [],
        type: ACTION_TYPES.READY_FOR_EDITOR_REVIEW,
      }),
    );
  }

  return uniqueBy(
    actions,
    (action) => `${action.type}:${action.relatedClaimIds.join(",")}`,
  ).slice(0, 10);
}

function buildConflictingEvidence(claims) {
  return claims
    .filter((claim) => claim.status === "CONFLICTING")
    .slice(0, 5)
    .map((claim) => ({
      claimId: claim.id,
      message: "Claim has conflicting support in supplied evidence.",
      text: claim.text,
      type: claim.type,
    }));
}

function buildIntelligenceSummary({ editorial, metadata, verification } = {}) {
  const claims = getClaims(verification);
  const factGuard = getFactGuard(verification);
  const sourceConfidence = getSourceConfidence(verification);
  const blockers = normalizeBlockers(getPublicationBlockers(verification));
  const unsupportedClaims = getTopUnsupportedClaims(claims);
  const sourceGaps = buildSourceGaps({
    claims,
    sourceConfidence,
    verification,
  });
  const publicationReadiness = getPublicationReadiness({
    blockers,
    editorial,
    factGuard,
    sourceGaps,
  });
  const editorActions = buildEditorActions({
    blockers,
    claims: unsupportedClaims.length ? unsupportedClaims : claims,
    readiness: publicationReadiness,
    sourceGaps,
  });

  return {
    blockers,
    confidence: {
      level: editorial?.confidence?.level || "INSUFFICIENT",
      reasons: Array.isArray(editorial?.confidence?.reasons)
        ? editorial.confidence.reasons.slice(0, 5)
        : [],
      score: clampPercent(editorial?.confidence?.score),
    },
    conflictingEvidence: buildConflictingEvidence(claims),
    editorialStatus: editorial?.reviewStatus || "NEEDS_REVIEW",
    editorActions,
    keyFindings: buildKeyFindings({
      factGuard,
      sourceConfidence,
      verification,
    }),
    overview: buildOverview({
      blockers,
      editorial,
      factGuard,
      readiness: publicationReadiness,
    }),
    publicationReadiness,
    sourceGaps,
    unsupportedClaims,
    metadata: {
      audience: metadata?.audience || null,
      channel: metadata?.channel || null,
      complexity: metadata?.complexity || null,
      mode: metadata?.mode || null,
      promptVersion: metadata?.promptVersion || null,
    },
  };
}

module.exports = {
  ACTION_TYPES,
  PUBLICATION_READINESS,
  buildIntelligenceSummary,
};
