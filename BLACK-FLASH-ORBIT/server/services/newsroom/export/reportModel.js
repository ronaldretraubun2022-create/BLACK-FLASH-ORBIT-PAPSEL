const REPORT_TITLE = "BLACK FLASH ORBIT Editorial Review Report";
const APP_NAME = "BLACK FLASH ORBIT";

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;

  return String(value)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeList(value) {
  return Array.isArray(value) ? value.map((item) => item).filter(Boolean) : [];
}

function getLatestDecision(generation) {
  const decisions = safeList(generation?.decisionHistory);

  return decisions[0] || null;
}

function buildReviewReportModel(
  generation,
  { exportedAt = new Date().toISOString() } = {},
) {
  const report = generation.editorialReviewReport || {};
  const summary = generation.intelligenceSummary || {};
  const verification = generation.verification || {};
  const latestDecision = getLatestDecision(generation);

  return {
    appName: APP_NAME,
    title: REPORT_TITLE,
    generation: {
      audience: generation.audience || report.configuration?.audience || "",
      channel: generation.channel || report.configuration?.channel || "",
      complexity:
        generation.complexity || report.configuration?.complexity || "",
      createdAt: generation.createdAt || report.generatedAt || "",
      id: generation.id,
      mode: generation.mode || report.configuration?.mode || "",
      model: generation.model || report.safeMetadata?.model || "",
      promptVersion:
        generation.promptVersion ||
        report.safeMetadata?.promptVersion ||
        report.reportVersion ||
        "",
      provider: generation.provider || report.safeMetadata?.provider || "",
      topic: generation.topic || "",
    },
    status: {
      confidence:
        summary.confidence?.score ??
        report.summary?.confidence?.score ??
        verification.review?.editorialConfidence?.score ??
        "",
      publicationReadiness:
        generation.publicationReadiness ||
        summary.publicationReadiness ||
        report.summary?.publicationReadiness ||
        "NEEDS_REVIEW",
      reviewStatus:
        generation.reviewStatus ||
        summary.editorialStatus ||
        report.summary?.editorialStatus ||
        "NEEDS_REVIEW",
    },
    sections: {
      editorActions: safeList(summary.editorActions || report.actions),
      keyFindings: safeList(summary.keyFindings || report.summary?.keyFindings),
      publicationBlockers: safeList(
        summary.blockers ||
          report.verification?.publicationBlockers ||
          verification.publicationBlockers,
      ),
      sourceGaps: safeList(summary.sourceGaps),
      sourceSummary: report.sources || verification.sourceConfidence || {},
      unsupportedClaims: safeList(
        summary.unsupportedClaims ||
          report.verification?.claimsRequiringAttention,
      ),
    },
    humanDecision: latestDecision
      ? {
          actorId: latestDecision.actorId,
          createdAt: latestDecision.createdAt,
          decision: latestDecision.decision,
          notes: latestDecision.notes,
          overrideBlockers: latestDecision.overrideBlockers,
          overrideReason: latestDecision.overrideReason,
        }
      : null,
    editorNotes: generation.editorNotes || "",
    footer: {
      exportedAt,
      generationId: generation.id,
      reportVersion: report.reportVersion || "editorial-review-v1",
    },
  };
}

function buildDraftReportModel(
  generation,
  { exportedAt = new Date().toISOString() } = {},
) {
  return {
    appName: APP_NAME,
    title: "BLACK FLASH ORBIT Newsroom Draft",
    draft: generation.draft || "",
    generation: {
      audience: generation.audience || "",
      channel: generation.channel || "",
      complexity: generation.complexity || "",
      createdAt: generation.createdAt || "",
      id: generation.id,
      mode: generation.mode || "",
      topic: generation.topic || "",
    },
    status: {
      publicationReadiness: generation.publicationReadiness,
      reviewStatus: generation.reviewStatus,
    },
    footer: {
      exportedAt,
      generationId: generation.id,
      reportVersion: "draft-export-v1",
    },
  };
}

function modelToLines(model) {
  const lines = [
    model.appName,
    model.title,
    "",
    "Generation information",
    `Generation ID: ${safeText(model.generation.id)}`,
    `Topic: ${safeText(model.generation.topic)}`,
    `Audience: ${safeText(model.generation.audience)}`,
    `Mode: ${safeText(model.generation.mode)}`,
    `Complexity: ${safeText(model.generation.complexity)}`,
    `Channel: ${safeText(model.generation.channel)}`,
    `Generated: ${safeText(model.generation.createdAt)}`,
    "",
    "Editorial status",
    `Review Status: ${safeText(model.status.reviewStatus)}`,
    `Publication Readiness: ${safeText(model.status.publicationReadiness)}`,
    `Confidence: ${safeText(model.status.confidence)}`,
    "",
  ];

  if (model.draft !== undefined) {
    lines.push("Draft", safeText(model.draft), "");
  } else {
    appendList(lines, "Key Findings", model.sections.keyFindings);
    appendList(
      lines,
      "Publication Blockers",
      model.sections.publicationBlockers,
    );
    appendList(
      lines,
      "Unsupported / Partial Claims",
      model.sections.unsupportedClaims,
    );
    appendList(lines, "Source Gaps", model.sections.sourceGaps);
    appendList(lines, "Editor Actions", model.sections.editorActions);
    lines.push(
      "Source Summary",
      JSON.stringify(model.sections.sourceSummary || {}, null, 2),
      "",
    );

    if (model.humanDecision) {
      lines.push(
        "Human Review Decision",
        `Decision: ${safeText(model.humanDecision.decision)}`,
        `Actor: ${safeText(model.humanDecision.actorId)}`,
        `Timestamp: ${safeText(model.humanDecision.createdAt)}`,
        `Notes: ${safeText(model.humanDecision.notes)}`,
        "",
      );
    }

    if (model.editorNotes) {
      lines.push("Editorial Notes", safeText(model.editorNotes), "");
    }
  }

  lines.push(
    `Footer: ${safeText(model.footer.reportVersion)} | ${safeText(model.footer.generationId)} | ${safeText(model.footer.exportedAt)}`,
  );

  return lines;
}

function appendList(lines, title, items) {
  lines.push(title);

  if (!items.length) {
    lines.push("- None");
  } else {
    items.slice(0, 20).forEach((item) => {
      if (typeof item === "string") {
        lines.push(`- ${safeText(item)}`);
      } else {
        lines.push(
          `- ${safeText(item.message || item.text || item.type || item.id || JSON.stringify(item))}`,
        );
      }
    });
  }

  lines.push("");
}

module.exports = {
  APP_NAME,
  REPORT_TITLE,
  buildDraftReportModel,
  buildReviewReportModel,
  modelToLines,
  safeText,
};
