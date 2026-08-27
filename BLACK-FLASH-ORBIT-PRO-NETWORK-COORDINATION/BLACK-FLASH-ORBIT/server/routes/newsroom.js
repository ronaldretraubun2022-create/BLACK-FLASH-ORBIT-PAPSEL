const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const {
  getProviderCapability,
} = require("../services/ai/providerCapabilities");
const { AI_USE_CASES } = require("../services/ai/modelRegistry");
const { generateNewsroomCompletion } = require("../services/openrouter");
const {
  buildEditorialReviewReport,
} = require("../services/newsroom/editorialReviewReport");
const {
  buildIntelligenceSummary,
} = require("../services/newsroom/intelligenceSummary");
const { createExportArtifact } = require("../services/newsroom/export");
const { isSupabaseServiceConfigured } = require("../services/supabaseAdmin");
const {
  createGeneration,
  deleteGeneration,
  getGenerationById,
  listGenerations,
  recordEditorialDecision,
  updateGeneration,
} = require("../services/newsroom/historyRepository");
const { createPromptContract } = require("../services/newsroom/promptContract");
const { buildNewsroomPromptV2 } = require("../services/newsroom/prompts");
const { verifyNewsroomDraft } = require("../services/newsroom/verification");

const router = express.Router();
const MAX_TOPIC_LENGTH = 3000;
const FACT_CLASSIFICATIONS = new Set([
  "FACT",
  "OFFICIAL_CLAIM",
  "USER_INPUT",
  "OBSERVATION",
  "INFERENCE",
  "ASSUMPTION",
  "UNVERIFIED",
  "CONFLICTING",
]);
const DEFAULT_RECOMMENDED_SOURCES = [
  "Pemerintah Provinsi",
  "BPS",
  "Kemendagri",
  "Dokumen Resmi OPD",
];
const EVIDENCE_TYPES = [
  "Official Document",
  "Official Statement",
  "Government Website",
  "Statistical Data",
  "Independent Report",
  "News Media",
  "Social Media",
  "User Input",
];
const EVIDENCE_TYPE_WEIGHTS = {
  "Official Document": 30,
  "Official Statement": 20,
  "Government Website": 20,
  "Statistical Data": 20,
  "Independent Report": 15,
  "News Media": 10,
  "Social Media": 5,
  "User Input": 5,
};
const SOURCE_QUALITY_RULES = [
  {
    level: "Official Government Source",
    score: 100,
    pattern:
      /\b(?:kemendagri|kemenkeu|kementerian|pemerintah provinsi|pemprov|pemda|dinas|diskominfo|dokumen resmi opd|apbd|rkpd|rpjmd|peraturan|perda)\b/i,
  },
  {
    level: "BPS / statistical source",
    score: 100,
    pattern: /\b(?:bps|statistik|sensus|laporan statistik resmi)\b/i,
  },
  {
    level: "Official institution statement",
    score: 90,
    pattern:
      /\b(?:official statement|official statement|siaran pers resmi|pernyataan resmi|official statement)\b/i,
  },
  {
    level: "Government website",
    score: 90,
    pattern:
      /\b(?:government website|portal data pemerintah|go\.id|situs resmi pemerintah)\b/i,
  },
  {
    level: "Independent report",
    score: 75,
    pattern:
      /\b(?:independent report|laporan independen|lembaga riset|universitas|ngo|lsm)\b/i,
  },
  {
    level: "Established news media",
    score: 70,
    pattern:
      /\b(?:kompas|tempo|antara|reuters|bbc|cnn|detik|established news media)\b/i,
  },
  {
    level: "Local media",
    score: 60,
    pattern: /\b(?:media lokal|local media|wartawan lokal|koran lokal)\b/i,
  },
  {
    level: "Social media",
    score: 35,
    pattern:
      /\b(?:social media|media sosial|facebook|instagram|twitter|x\.com|tiktok|youtube|whatsapp|telegram)\b/i,
  },
  {
    level: "User input only",
    score: 20,
    pattern: /\b(?:user input|input pengguna)\b/i,
  },
];
const FACT_CLASSIFICATION_SCORES = {
  FACT: 100,
  OFFICIAL_CLAIM: 85,
  OBSERVATION: 75,
  INFERENCE: 60,
  USER_INPUT: 55,
  ASSUMPTION: 45,
  UNVERIFIED: 30,
  CONFLICTING: 20,
};
const CONFIDENCE_WEIGHTS = {
  evidence_score_weight: 40,
  source_quality_weight: 30,
  fact_classification_weight: 20,
  verification_weight: 10,
};
const OFFICIAL_SOURCE_KEYWORDS = [
  "bappenas",
  "bappeda",
  "bawaslu",
  "bps",
  "dinas",
  "diskominfo",
  "dprd",
  "kementerian",
  "kemendagri",
  "kemenkeu",
  "kemenpan",
  "kpu",
  "pemda",
  "pemerintah",
  "pemkab",
  "pemkot",
  "pemprov",
  "polri",
];
const DEBUG_NEWSROOM_AI = process.env.DEBUG_NEWSROOM_AI === "true";

function logNewsroomDebug(message, metadata) {
  if (DEBUG_NEWSROOM_AI) {
    console.info(message, metadata);
  }
}

function logNewsroomError(error) {
  if (DEBUG_NEWSROOM_AI) {
    console.error("[AI Newsroom Route] error", {
      name: error?.name || "Error",
    });
  }
}

function sendHistoryError(res, error, fallbackMessage, operation = "history") {
  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? fallbackMessage : error.message || fallbackMessage;

  if (DEBUG_NEWSROOM_AI) {
    console.warn("[AI Newsroom History] error", {
      errorCode: error.code || "newsroom_history_failed",
      operation,
      route: res.req?.originalUrl || res.req?.url || "unknown",
      status: statusCode,
      supabaseConfigured: isSupabaseServiceConfigured(),
    });
  }

  return res.status(statusCode).json({
    success: false,
    code: error.code || "newsroom_history_failed",
    message,
  });
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[\x00-\x1f\x7f<>]/g, " ")
    .trim();
}

function isValidString(value) {
  return typeof value === "string" && sanitizeText(value).length > 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPublicationReadiness(score) {
  if (score >= 85) return "Ready";
  if (score >= 60) return "Review Required";
  return "Verification Required";
}

function buildResponseConfidence({
  confidenceAnalysis = {},
  editorial = {},
  intelligenceSummary = {},
  legacyConfidenceScore = 0,
  verification = {},
} = {}) {
  const inputReadinessScore = clampScore(legacyConfidenceScore);
  const sourceConfidence = verification?.sourceConfidence || {};

  return {
    score: inputReadinessScore,
    publicationReadiness: getPublicationReadiness(inputReadinessScore),
    input_readiness_score: inputReadinessScore,
    source_confidence_score: clampScore(sourceConfidence.score || 0),
    source_confidence_level: sourceConfidence.level || "INSUFFICIENT",
    publication_readiness:
      intelligenceSummary?.publicationReadiness || "BLOCKED",
    editorial_score: clampScore(editorial?.confidence?.score || 0),
    editorial_level: editorial?.confidence?.level || "INSUFFICIENT",
    confidence_score: clampScore(confidenceAnalysis?.confidence_score || 0),
    confidence_level: confidenceAnalysis?.confidence_level || "VERY LOW",
    confidence_breakdown: confidenceAnalysis?.confidence_breakdown || {},
    confidence_explanation: confidenceAnalysis?.confidence_explanation || "",
  };
}

function normalizeStatement(value) {
  return sanitizeText(value).replace(/\s+/g, " ");
}

function includesAnyKeyword(value, keywords) {
  const text = String(value || "").toLowerCase();

  return keywords.some((keyword) => text.includes(keyword));
}

function hasNumberLikeClaim(statement) {
  return /(?:\b\d+(?:[.,]\d+)?\b|rp\s*\d+|%|persen|miliar|juta|ribu|triliun)/i.test(
    statement,
  );
}

function hasOfficialSource(statement, context = {}) {
  const sourceHints = [
    statement,
    context.source,
    ...(Array.isArray(context.sources) ? context.sources : []),
  ].join(" ");

  return includesAnyKeyword(sourceHints, OFFICIAL_SOURCE_KEYWORDS);
}

function getRecommendedSources(statement, classification) {
  const sources = [];
  const text = String(statement || "").toLowerCase();

  if (/kemendagri|pemda|pemprov|pemerintah|dinas|diskominfo/.test(text)) {
    sources.push("Kemendagri", "Pemerintah Provinsi", "Diskominfo");
  }

  if (
    /bps|statistik|penduduk|kemiskinan|inflasi|ekonomi|tenaga kerja/.test(text)
  ) {
    sources.push("BPS", "Laporan Statistik Resmi");
  }

  if (/anggaran|rp\s*\d+|miliar|juta|triliun|dana/.test(text)) {
    sources.push("Kemenkeu", "APBD", "Dokumen Resmi OPD");
  }

  if (/pemilu|pilkada|suara|kpu|bawaslu/.test(text)) {
    sources.push("KPU", "Bawaslu");
  }

  if (classification === "OBSERVATION") {
    sources.push("Catatan Lapangan", "Dokumentasi Foto/Video");
  }

  if (sources.length === 0) {
    sources.push(...DEFAULT_RECOMMENDED_SOURCES);
  }

  return [...new Set(sources)].slice(0, 5);
}

function createFactClassification({
  classification,
  confidence,
  reason,
  statement,
  verificationNeeded,
}) {
  const safeClassification = FACT_CLASSIFICATIONS.has(classification)
    ? classification
    : "UNVERIFIED";

  return {
    statement,
    classification: safeClassification,
    confidence: clampScore(confidence),
    reason,
    verification_needed: Boolean(verificationNeeded),
    recommended_sources: getRecommendedSources(statement, safeClassification),
  };
}

function isUserProvidedStatement(statement, context = {}) {
  const cleanStatement = normalizeStatement(statement).toLowerCase();
  const cleanTopic = normalizeStatement(context.topic).toLowerCase();

  if (!cleanStatement || !cleanTopic) return false;

  return cleanStatement === cleanTopic || cleanTopic.includes(cleanStatement);
}

function classifyNewsroomFact(statement, context = {}) {
  const cleanStatement = normalizeStatement(statement);

  if (!cleanStatement) {
    return createFactClassification({
      classification: "UNVERIFIED",
      confidence: 0,
      reason: "Pernyataan kosong dan tidak dapat diverifikasi.",
      statement: "",
      verificationNeeded: true,
    });
  }

  const lowerStatement = cleanStatement.toLowerCase();
  const officialSource = hasOfficialSource(cleanStatement, context);
  const numberLikeClaim = hasNumberLikeClaim(cleanStatement);

  if (
    context.conflicting === true ||
    includesAnyKeyword(lowerStatement, [
      "bertentangan",
      "berbeda dengan",
      "konflik",
      "tidak sesuai",
    ])
  ) {
    return createFactClassification({
      classification: "CONFLICTING",
      confidence: 55,
      reason: "Pernyataan mengandung sinyal konflik atau perbedaan data.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (context.verified === true || context.sourceType === "verified") {
    return createFactClassification({
      classification: "FACT",
      confidence: 90,
      reason: "Pernyataan ditandai sebagai fakta terverifikasi dalam konteks.",
      statement: cleanStatement,
      verificationNeeded: false,
    });
  }

  if (
    officialSource &&
    includesAnyKeyword(lowerStatement, [
      "berdasarkan",
      "dilaporkan",
      "diumumkan",
      "mengklaim",
      "menurut",
      "menyampaikan",
      "menyatakan",
      "rilis",
    ])
  ) {
    return createFactClassification({
      classification: "OFFICIAL_CLAIM",
      confidence: 75,
      reason:
        "Pernyataan merujuk lembaga resmi, tetapi tetap perlu konfirmasi dokumen/sumber utama.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (numberLikeClaim && !officialSource) {
    return createFactClassification({
      classification: "UNVERIFIED",
      confidence: 45,
      reason: "Pernyataan memuat angka tanpa sumber resmi yang jelas.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "diasumsikan",
      "diperkirakan",
      "diprediksi",
      "kemungkinan",
      "potensi dampak",
      "berpotensi",
      "akan berdampak",
      "akan meningkatkan",
    ])
  ) {
    return createFactClassification({
      classification: "ASSUMPTION",
      confidence: 50,
      reason: "Pernyataan bersifat prediktif atau berbasis asumsi.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "dapat disimpulkan",
      "mengindikasikan",
      "merekomendasikan",
      "perlu",
      "rekomendasi",
      "sebaiknya",
      "strategi",
    ])
  ) {
    return createFactClassification({
      classification: "INFERENCE",
      confidence: 65,
      reason: "Pernyataan adalah rekomendasi atau kesimpulan analitis.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "catatan lapangan",
      "diamati",
      "ditemukan",
      "observasi",
      "terlihat",
      "terpantau",
    ])
  ) {
    return createFactClassification({
      classification: "OBSERVATION",
      confidence: 70,
      reason: "Pernyataan berasal dari pengamatan atau catatan lapangan.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    context.userInput === true ||
    isUserProvidedStatement(cleanStatement, context)
  ) {
    return createFactClassification({
      classification: "USER_INPUT",
      confidence: 80,
      reason:
        "Pernyataan berasal dari input pengguna dan belum berdiri sebagai fakta terverifikasi.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  return createFactClassification({
    classification: "UNVERIFIED",
    confidence: 40,
    reason:
      "Pernyataan belum memiliki sumber atau status verifikasi yang jelas.",
    statement: cleanStatement,
    verificationNeeded: true,
  });
}

function stripStatementListMarker(value) {
  return String(value || "")
    .replace(/^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/, "")
    .trim();
}

function isInstructionStatement(value) {
  const statement = normalizeStatement(value);

  if (!statement) return true;
  if (/^\d{1,3}$/.test(statement)) return true;

  if (
    /^(?:ketentuan|instruksi|petunjuk|format|struktur)(?:\s*:)?$/i.test(
      statement,
    )
  ) {
    return true;
  }

  if (
    /simulasi\s+internal/i.test(statement) &&
    /jangan\s+dipublikasikan/i.test(statement)
  ) {
    return true;
  }

  if (
    /^(?:buat|tulis|tuliskan|pastikan|jangan|bedakan|tandai|gunakan|sertakan|hindari|sebutkan|jelaskan|susun|ubah|jadikan)\b/i.test(
      statement,
    )
  ) {
    return true;
  }

  if (
    /^jika\b.*\b(?:tulis|tuliskan|gunakan|pastikan|jangan|tandai|sertakan)\b/i.test(
      statement,
    )
  ) {
    return true;
  }

  return false;
}

function splitFactStatements(value) {
  return String(value || "")
    .split(/\n+/)
    .flatMap((line) => {
      const cleanedLine = stripStatementListMarker(line);
      if (!cleanedLine) return [];

      return cleanedLine.split(/(?:[.!?]\s+|;\s+)/);
    })
    .map((statement) =>
      normalizeStatement(statement)
        .replace(/[.!?;:]+$/, "")
        .trim(),
    )
    .filter(Boolean)
    .filter((statement) => !isInstructionStatement(statement))
    .slice(0, 12);
}

function classifyNewsroomFacts(statements, context = {}) {
  return statements.map((statement) =>
    classifyNewsroomFact(statement, {
      ...context,
      topic: context.topic,
    }),
  );
}

function buildAllowedFactualClaims(factClassifications = []) {
  const excludedClassifications = new Set(["INFERENCE", "ASSUMPTION"]);

  return (Array.isArray(factClassifications) ? factClassifications : [])
    .filter(
      (fact) =>
        fact &&
        !excludedClassifications.has(String(fact.classification || "")),
    )
    .map((fact) => normalizeStatement(fact.statement))
    .filter(Boolean)
    .slice(0, 12);
}

function getProvidedSourceHints(context = {}) {
  const normalizedSources = (
    Array.isArray(context.sources) ? context.sources : []
  )
    .map((source) => {
      if (typeof source === "string") return source;
      if (!source || typeof source !== "object") return "";

      return [source.label, source.type].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  return [context.source, ...normalizedSources]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectEvidenceTypes(statement, context = {}) {
  const text = String(statement || "").toLowerCase();
  const hints = getProvidedSourceHints(context);
  const found = [];

  if (
    /(dokumen resmi|peraturan|perda|keputusan|rpjmd|rkpd|renstra|apbd|dokumen)\b/.test(
      hints,
    )
  ) {
    found.push("Official Document");
  }

  if (
    /(menurut|menyatakan|menyampaikan|diumumkan|rilis|siaran pers|keterangan resmi)/.test(
      text,
    ) &&
    hasOfficialSource(hints, context)
  ) {
    found.push("Official Statement");
  }

  if (
    /(go\.id|portal pemerintah|website pemerintah|situs resmi|pemprov|kemendagri|bps\.go\.id)/.test(
      hints,
    )
  ) {
    found.push("Government Website");
  }

  if (
    hasNumberLikeClaim(text) &&
    /(bps|statistik|sensus|data|angka|persen|inflasi|penduduk|kemiskinan|pengangguran)/.test(
      hints,
    )
  ) {
    found.push("Statistical Data");
  }

  if (
    /(laporan independen|lembaga riset|peneliti|universitas|ngo|lsm)/.test(
      hints,
    )
  ) {
    found.push("Independent Report");
  }

  if (
    /(media|berita|koran|majalah|redaksi|wartawan|jurnalis|\.com\b|\.id\b)/.test(
      hints,
    )
  ) {
    found.push("News Media");
  }

  if (
    /(facebook|instagram|twitter|x\.com|tiktok|youtube|whatsapp|telegram|media sosial)/.test(
      hints,
    )
  ) {
    found.push("Social Media");
  }

  if (
    context.userInput === true ||
    isUserProvidedStatement(statement, context)
  ) {
    found.push("User Input");
  }

  return EVIDENCE_TYPES.filter((type) => found.includes(type));
}

function getMissingEvidenceTypes(statement, foundTypes, classification) {
  const missing = [];
  const hasOfficialEvidence =
    foundTypes.includes("Official Document") ||
    foundTypes.includes("Official Statement") ||
    foundTypes.includes("Government Website");

  if (!hasOfficialEvidence) {
    missing.push("Official Document", "Official Statement");
  }

  if (
    hasNumberLikeClaim(statement) &&
    !foundTypes.includes("Statistical Data")
  ) {
    missing.push("Statistical Data");
  }

  if (
    ["INFERENCE", "ASSUMPTION", "CONFLICTING"].includes(classification) &&
    !foundTypes.includes("Independent Report") &&
    !foundTypes.includes("News Media")
  ) {
    missing.push("Independent Report", "News Media");
  }

  return [...new Set(missing)].filter((type) => !foundTypes.includes(type));
}

function calculateEvidenceScore(foundTypes, missingTypes) {
  const foundScore = foundTypes.reduce(
    (total, type) => total + (EVIDENCE_TYPE_WEIGHTS[type] || 0),
    0,
  );
  const missingPenalty = Math.min(missingTypes.length * 8, 35);

  return clampScore(foundScore - missingPenalty);
}

function getEvidenceStrength(score) {
  if (score >= 75) return "STRONG";
  if (score >= 50) return "MODERATE";
  if (score >= 25) return "LIMITED";
  return "MISSING";
}

function getMissingEvidenceRecommendations(missingTypes) {
  const recommendations = {
    "Official Document":
      "Tambahkan dokumen resmi seperti regulasi, APBD, RKPD, atau laporan OPD.",
    "Official Statement":
      "Konfirmasi melalui pernyataan resmi lembaga terkait.",
    "Government Website":
      "Cek situs resmi pemerintah atau portal data pemerintah.",
    "Statistical Data":
      "Validasi angka melalui BPS atau laporan statistik resmi.",
    "Independent Report":
      "Bandingkan dengan laporan lembaga riset atau kajian independen.",
    "News Media": "Cari pembanding dari media kredibel dan arsip berita.",
    "Social Media": "Gunakan unggahan media sosial hanya sebagai sinyal awal.",
    "User Input": "Pisahkan input pengguna dari fakta terverifikasi.",
  };

  return [...new Set(missingTypes)]
    .map((type) => recommendations[type])
    .filter(Boolean);
}

function buildEvidenceEngine(factClassifications, context = {}) {
  const items = factClassifications.map((fact) => {
    const evidenceFound = detectEvidenceTypes(fact.statement, {
      ...context,
      userInput: fact.classification === "USER_INPUT" || context.userInput,
    });
    const evidenceMissing = getMissingEvidenceTypes(
      fact.statement,
      evidenceFound,
      fact.classification,
    );
    const score = calculateEvidenceScore(evidenceFound, evidenceMissing);

    return {
      statement: fact.statement,
      classification: fact.classification,
      evidence_found: evidenceFound,
      evidence_missing: evidenceMissing,
      evidence_strength: getEvidenceStrength(score),
      evidence_score: score,
      missing_recommendations:
        getMissingEvidenceRecommendations(evidenceMissing),
    };
  });
  const evidenceScore =
    items.length === 0
      ? 0
      : clampScore(
          items.reduce((total, item) => total + item.evidence_score, 0) /
            items.length,
        );
  const missingEvidence = [
    ...new Set(items.flatMap((item) => item.evidence_missing)),
  ];

  return {
    items,
    evidence_score: evidenceScore,
    evidence_strength: getEvidenceStrength(evidenceScore),
    evidence_missing: missingEvidence,
    missing_recommendations: getMissingEvidenceRecommendations(missingEvidence),
  };
}

function formatEvidenceMatrix(evidence) {
  const rows = evidence.items.map((item) =>
    [
      escapeMarkdownCell(item.statement),
      item.evidence_found.length ? item.evidence_found.join(", ") : "None",
      item.evidence_missing.length ? item.evidence_missing.join(", ") : "None",
      item.evidence_strength,
      `${item.evidence_score}%`,
    ].join(" | "),
  );
  const recommendations = evidence.missing_recommendations.length
    ? evidence.missing_recommendations.map((item) => `- ${item}`)
    : ["- Tidak ada evidence utama yang hilang."];

  return [
    "## Evidence Matrix",
    "| Statement | evidence_found | evidence_missing | evidence_strength | Evidence Score |",
    "|---|---|---|---|---:|",
    ...rows.map((row) => `| ${row} |`),
    "",
    "## Evidence Score",
    `Overall Evidence Score: ${evidence.evidence_score}% (${evidence.evidence_strength})`,
    "",
    "## Missing Evidence Recommendations",
    ...recommendations,
  ].join("\n");
}

function classifySourceQuality(source) {
  const cleanSource = normalizeStatement(source);
  const matchedRule =
    SOURCE_QUALITY_RULES.find((rule) => rule.pattern.test(cleanSource)) ||
    SOURCE_QUALITY_RULES[SOURCE_QUALITY_RULES.length - 1];

  return {
    source: cleanSource || "User Input",
    source_quality_level: matchedRule.level,
    source_quality_score: matchedRule.score,
  };
}

function getSourceQualityLevel(score) {
  if (score >= 90) return "HIGH";
  if (score >= 70) return "MEDIUM";
  if (score >= 50) return "LIMITED";
  return "LOW";
}

function getConfidenceLevel(score) {
  if (score >= 90) return "VERY HIGH";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score >= 40) return "LOW";
  return "VERY LOW";
}

function buildSourceQualityEngine(
  _factClassifications,
  evidence,
  providedSources = [],
) {
  const evidenceSources = (evidence?.items || []).flatMap(
    (item) => item.evidence_found || [],
  );
  const providedSourceNames = (
    Array.isArray(providedSources) ? providedSources : []
  )
    .map((source) => {
      if (typeof source === "string") return normalizeStatement(source);
      if (!source || typeof source !== "object") return "";

      return normalizeStatement(
        [source.label, source.type].filter(Boolean).join(" "),
      );
    })
    .filter(Boolean);
  const sourceNames =
    providedSourceNames.length > 0 ? providedSourceNames : evidenceSources;
  const uniqueSources = [...new Set(sourceNames.filter(Boolean))];
  const qualityItems = (
    uniqueSources.length > 0 ? uniqueSources : ["User Input"]
  )
    .map(classifySourceQuality)
    .sort(
      (first, second) =>
        second.source_quality_score - first.source_quality_score ||
        first.source.localeCompare(second.source),
    );
  const sourceQualityScore =
    qualityItems.length === 0
      ? 0
      : clampScore(
          qualityItems.reduce(
            (total, item) => total + item.source_quality_score,
            0,
          ) / qualityItems.length,
        );

  return {
    source_quality_score: sourceQualityScore,
    source_quality_level: getSourceQualityLevel(sourceQualityScore),
    source_quality_items: qualityItems,
  };
}

function formatSourceQualityMatrix(sourceQuality) {
  const rows = sourceQuality.source_quality_items.map((item) =>
    [
      escapeMarkdownCell(item.source),
      item.source_quality_level,
      `${item.source_quality_score}%`,
    ].join(" | "),
  );

  return [
    "## Source Quality Matrix",
    "| Source | Trust Level | Source Quality Score |",
    "|---|---|---:|",
    ...rows.map((row) => `| ${row} |`),
    "",
    `Overall Source Quality Score: ${sourceQuality.source_quality_score}% (${sourceQuality.source_quality_level})`,
  ].join("\n");
}

function calculateFactClassificationScore(factClassifications) {
  if (!Array.isArray(factClassifications) || factClassifications.length === 0) {
    return 0;
  }

  const total = factClassifications.reduce((sum, fact) => {
    const classificationScore =
      FACT_CLASSIFICATION_SCORES[fact.classification] ||
      FACT_CLASSIFICATION_SCORES.UNVERIFIED;
    const statedConfidence = Number(fact.confidence) || 0;

    return sum + classificationScore * 0.7 + statedConfidence * 0.3;
  }, 0);

  return clampScore(total / factClassifications.length);
}

function calculateVerificationScore(factClassifications, evidence) {
  if (!Array.isArray(factClassifications) || factClassifications.length === 0) {
    return 0;
  }

  const totalFacts = factClassifications.length;
  const verificationNeededCount = factClassifications.filter(
    (fact) => fact.verification_needed === true,
  ).length;
  const missingEvidenceCount = (evidence?.items || []).reduce(
    (total, item) => total + (item.evidence_missing || []).length,
    0,
  );
  const verificationPenalty = (verificationNeededCount / totalFacts) * 30;
  const missingEvidencePenalty = Math.min(
    (missingEvidenceCount / totalFacts) * 15,
    60,
  );

  return clampScore(100 - verificationPenalty - missingEvidencePenalty);
}

function buildConfidenceEngine({
  evidence,
  sourceQuality,
  factClassifications,
}) {
  const evidenceScore = clampScore(evidence?.evidence_score || 0);
  const sourceQualityScore = clampScore(
    sourceQuality?.source_quality_score || 0,
  );
  const factClassificationScore =
    calculateFactClassificationScore(factClassifications);
  const verificationScore = calculateVerificationScore(
    factClassifications,
    evidence,
  );
  const evidenceContribution =
    (evidenceScore * CONFIDENCE_WEIGHTS.evidence_score_weight) / 100;
  const sourceQualityContribution =
    (sourceQualityScore * CONFIDENCE_WEIGHTS.source_quality_weight) / 100;
  const factClassificationContribution =
    (factClassificationScore * CONFIDENCE_WEIGHTS.fact_classification_weight) /
    100;
  const verificationContribution =
    (verificationScore * CONFIDENCE_WEIGHTS.verification_weight) / 100;
  const confidenceScore = clampScore(
    evidenceContribution +
      sourceQualityContribution +
      factClassificationContribution +
      verificationContribution,
  );
  const confidenceLevel = getConfidenceLevel(confidenceScore);

  return {
    confidence_score: confidenceScore,
    confidence_level: confidenceLevel,
    confidence_explanation:
      `Skor dihitung dari Evidence Score ${evidenceScore}%, ` +
      `Source Quality ${sourceQualityScore}%, ` +
      `Fact Classification ${factClassificationScore}%, dan ` +
      `Verification ${verificationScore}% dengan bobot 40/30/20/10.`,
    confidence_breakdown: {
      evidence_score: evidenceScore,
      evidence_score_weight: CONFIDENCE_WEIGHTS.evidence_score_weight,
      evidence_score_contribution: clampScore(evidenceContribution),
      source_quality_score: sourceQualityScore,
      source_quality_weight: CONFIDENCE_WEIGHTS.source_quality_weight,
      source_quality_contribution: clampScore(sourceQualityContribution),
      fact_classification_score: factClassificationScore,
      fact_classification_weight: CONFIDENCE_WEIGHTS.fact_classification_weight,
      fact_classification_contribution: clampScore(
        factClassificationContribution,
      ),
      verification_score: verificationScore,
      verification_weight: CONFIDENCE_WEIGHTS.verification_weight,
      verification_contribution: clampScore(verificationContribution),
    },
  };
}

function formatConfidenceAnalysis(confidence) {
  const breakdown = confidence.confidence_breakdown;
  const rows = [
    [
      "Evidence Score",
      `${breakdown.evidence_score}%`,
      `${breakdown.evidence_score_weight}%`,
      `${breakdown.evidence_score_contribution}%`,
    ],
    [
      "Source Quality",
      `${breakdown.source_quality_score}%`,
      `${breakdown.source_quality_weight}%`,
      `${breakdown.source_quality_contribution}%`,
    ],
    [
      "Fact Classification",
      `${breakdown.fact_classification_score}%`,
      `${breakdown.fact_classification_weight}%`,
      `${breakdown.fact_classification_contribution}%`,
    ],
    [
      "Verification",
      `${breakdown.verification_score}%`,
      `${breakdown.verification_weight}%`,
      `${breakdown.verification_contribution}%`,
    ],
  ];

  return [
    "## Confidence Analysis",
    `Overall Confidence Score: ${confidence.confidence_score}%`,
    `Confidence Level: ${confidence.confidence_level}`,
    "",
    "| Component | Score | Weight | Contribution |",
    "|---|---:|---:|---:|",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "### Confidence Explanation",
    confidence.confidence_explanation,
  ].join("\n");
}

function formatFactClassificationTable(items) {
  const rows = items.map((item) =>
    [
      escapeMarkdownCell(item.statement),
      item.classification,
      `${item.confidence}%`,
      item.verification_needed ? "Required" : "Not required",
      item.recommended_sources.join(", "),
    ].join(" | "),
  );

  return [
    "## Fact Classification Table",
    "| Statement | Type | Confidence | Verification | Sources |",
    "|---|---|---:|---|---|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function escapeMarkdownCell(value) {
  return String(value || "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTemporalReference(value) {
  if (typeof value !== "string") return false;
  return /\b(?:\d{4}|Q[1-4]|kuartal|triwulan|semester|tahun)\b/i.test(value);
}

function normalizeNewsroomDraft(text, userProvidedTemporalInfo = false) {
  if (typeof text !== "string") return "";

  let normalized = String(text);
  const citationReplacements = [
    {
      pattern:
        /\bDokumen\s+perencanaan\s+daerah\s*\(\s*(?:RPJMD|RKPD)\s*,\s*Renstra\s+OPD\s*\)/gi,
      replacement: "Dokumen RPJMD/RKPD dan Dokumen Resmi OPD",
    },
    {
      pattern: /\b(?:RPJMD|RKPD)\s*,\s*Renstra\s+OPD\b/gi,
      replacement: "Dokumen RPJMD/RKPD dan Dokumen Resmi OPD",
    },
    {
      pattern: /\bRenstra\s+OPD\b/gi,
      replacement: "Dokumen Resmi OPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s+\d{4}\s+(?:Provinsi\s+)?Papua\s+Selatan\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s+(?:Provinsi\s+)?Papua\s+Selatan\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s*\d{4}\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\bDokumen\s+(?:RPJMD|RKPD)\s*\d{4}\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern:
        /\bDiskominfo\s+(?:Provinsi(?:\s+Papua\s+Selatan)?|Papua\s+Selatan)\b/gi,
      replacement: "Diskominfo",
    },
    {
      pattern:
        /\bBPS\s+(?:Provinsi(?:\s+Papua\s+Selatan)?|Papua\s+Selatan)\b/gi,
      replacement: "BPS",
    },
    {
      pattern: /\bPemerintah\s+Provinsi\s+Papua\s+Selatan\b/gi,
      replacement: "Pemerintah Provinsi",
    },
    {
      pattern:
        /\bLaporan\s+Statistik(?:\s+(?:Resmi|Daerah|Provinsi))?(?:\s+\d{4})?\b/gi,
      replacement: "Laporan Statistik Resmi",
    },
    {
      pattern: /\bSiaran Pers(?: Resmi)?\s*(?:tahun\s*\d{4})?\b/gi,
      replacement: "Pemerintah Provinsi",
    },
  ];

  citationReplacements.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, replacement);
  });

  if (!userProvidedTemporalInfo) {
    const marker = "periode indikatif memerlukan verifikasi resmi";
    normalized = normalized
      .replace(/\bQ[1-4]\b/gi, marker)
      .replace(/\bkuartal\b/gi, marker)
      .replace(/\btriwulan\b/gi, marker)
      .replace(/\b20(?:24|25|26|27)\b/g, marker)
      .replace(/\bperiode periode\b/gi, "periode");
  }

  const timelineMarkerPattern =
    /\b(?:Q[1-4]|kuartal|triwulan|tahun\s*\d{4})\b/i;

  if (!userProvidedTemporalInfo && timelineMarkerPattern.test(text)) {
    normalized +=
      "\n\nCatatan: Rincian waktu dan referensi sumber harus divalidasi lebih lanjut. Hindari menyertakan detail periode atau dokumen khusus kecuali telah diberikan secara eksplisit oleh pengguna.";
  }

  return normalized.trim();
}

const ANALYTICAL_PROVENANCE_BY_SECTION = new Map([
  ["analisis", "AI_INFERENCE"],
  ["analysis", "AI_INFERENCE"],
  ["risiko", "ASSUMPTION"],
  ["risk", "ASSUMPTION"],
  ["risks", "ASSUMPTION"],
  ["rekomendasi", "AI_INFERENCE"],
  ["recommendation", "AI_INFERENCE"],
  ["recommendations", "AI_INFERENCE"],
  ["action plan", "AI_INFERENCE"],
]);

const KNOWN_OUTPUT_SECTION_NAMES = new Set([
  "executive summary",
  "headline",
  "lead",
  "isi berita",
  "factual narrative",
  "narasi faktual",
  "analisis",
  "analysis",
  "risiko",
  "risk",
  "risks",
  "rekomendasi",
  "recommendation",
  "recommendations",
  "action plan",
  "verification status",
  "catatan verifikasi",
  "recommended sources",
  "rekomendasi sumber",
]);

function normalizeOutputSectionName(line) {
  return String(line || "")
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/[:：]+$/, "")
    .trim()
    .toLowerCase();
}

function getMarkdownSectionName(line) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  const isHashHeading = /^#{1,6}\s+/.test(raw);
  const isBoldHeading = /^\*\*[^*]+\*\*\s*:?[\s]*$/.test(raw);
  const sectionName = normalizeOutputSectionName(raw);

  if (isHashHeading || isBoldHeading) return sectionName;
  if (KNOWN_OUTPUT_SECTION_NAMES.has(sectionName)) return sectionName;

  return null;
}

function hasAnalyticalProvenanceLabel(line) {
  return /(?:AI_INFERENCE|ASSUMPTION)\s*:/i.test(
    String(line || "").slice(0, 120),
  );
}

function prefixAnalyticalProvenance(line, provenance) {
  const raw = String(line || "");
  const trimmed = raw.trim();

  if (!trimmed || /^-{3,}$/.test(trimmed)) return raw;
  if (hasAnalyticalProvenanceLabel(raw)) return raw;

  const listMatch = raw.match(/^(\s*(?:[-*+]\s+|\d{1,2}[.)]\s+))(.*)$/);
  if (listMatch) {
    const content = String(listMatch[2] || "").trim();
    if (!content) return raw;
    return `${listMatch[1]}${provenance}: ${content}`;
  }

  return `${provenance}: ${trimmed}`;
}

function enforceAnalyticalProvenance(text) {
  if (typeof text !== "string") return "";

  let activeProvenance = null;

  return String(text)
    .split(/\r?\n/)
    .map((line) => {
      const sectionName = getMarkdownSectionName(line);

      if (sectionName !== null) {
        activeProvenance =
          ANALYTICAL_PROVENANCE_BY_SECTION.get(sectionName) || null;
        return line;
      }

      if (!activeProvenance) return line;

      return prefixAnalyticalProvenance(line, activeProvenance);
    })
    .join("\n")
    .trim();
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      input,
      topic,
      layer,
      mode,
      audience,
      complexity,
      channel,
      language,
      sourceText,
      sources,
      additionalInstructions,
      factGuard = true,
      citationEngine = true,
      sourceConfidence = true,
      assessment,
      priority,
    } = req.body || {};
    const rawTopic = topic || input;

    logNewsroomDebug("[AI Newsroom Route] request received", {
      layer,
      mode,
      audience,
      complexity,
      channel,
      factGuard,
      citationEngine,
      sourceConfidence,
    });

    if (!isValidString(rawTopic)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Topic harus berupa teks dan tidak boleh kosong.",
      });
    }

    const trimmedTopic = String(rawTopic).trim();

    if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: `Topic terlalu panjang. Panjang maksimum adalah ${MAX_TOPIC_LENGTH} karakter.`,
      });
    }

    if (!isValidString(layer)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Layer harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(mode)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Mode harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(audience)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Audience harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(complexity)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Complexity harus berupa teks dan tidak boleh kosong.",
      });
    }

    const verifiedFactsCount = Number(req.body.verifiedFactsCount) || 0;
    const verificationItemsCount = Number(req.body.verificationItemsCount) || 0;
    const assessmentData =
      assessment && typeof assessment === "object" ? assessment : {};

    const promptContract = createPromptContract({
      additionalInstructions,
      audience,
      channel,
      citationEngine,
      complexity,
      factGuard,
      input: trimmedTopic,
      language,
      layer,
      mode,
      sourceConfidence,
      sourceText,
      sources,
      topic: trimmedTopic,
    });
    const promptPayload = {
      topic: promptContract.topic,
      layer: promptContract.layer,
      mode: promptContract.mode,
      audience: promptContract.audience,
      audienceLabel: promptContract.audienceProfile.label,
      complexity: promptContract.complexity,
      complexityLabel: promptContract.complexityLevel.label,
      channel: promptContract.channel,
      channelLabel: promptContract.channelTarget.label,
      language: promptContract.language,
      promptVersion: promptContract.promptVersion,
      factGuard: factGuard !== false,
      citationEngine: citationEngine !== false,
      sourceConfidence: sourceConfidence !== false,
    };

    const factClassifications = classifyNewsroomFacts(
      splitFactStatements(trimmedTopic),
      {
        topic: trimmedTopic,
        userInput: true,
      },
    );
    const allowedFactualClaims =
      buildAllowedFactualClaims(factClassifications);
    const factClassificationTable =
      formatFactClassificationTable(factClassifications);
    const evidence = buildEvidenceEngine(factClassifications, {
      topic: trimmedTopic,
      userInput: true,
      sources: promptContract.sources,
    });
    const evidenceMatrix = formatEvidenceMatrix(evidence);
    const sourceQuality = buildSourceQualityEngine(
      factClassifications,
      evidence,
      promptContract.sources,
    );
    const sourceQualityMatrix = formatSourceQualityMatrix(sourceQuality);
    const confidenceAnalysis = buildConfidenceEngine({
      evidence,
      sourceQuality,
      factClassifications,
    });
    const confidenceAnalysisSection =
      formatConfidenceAnalysis(confidenceAnalysis);
    const prompt = buildNewsroomPromptV2(promptContract, {
      allowedFactualClaims,
    });
    const providerCapability = getProviderCapability({
      useCase: AI_USE_CASES.NEWSROOM,
    });
    const aiResult = await generateNewsroomCompletion({
      metadata: {
        audience: promptPayload.audience,
        channel: promptPayload.channel,
        complexity: promptPayload.complexity,
        mode: promptPayload.mode,
        promptVersion: promptPayload.promptVersion,
      },
      requestId: req.headers["x-request-id"] || req.id || null,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    });
    const draft = aiResult.content;
    const userProvidedTemporalInfo = hasTemporalReference(trimmedTopic);
    const normalizedBaseDraft = normalizeNewsroomDraft(
      String(draft || "").trim(),
      userProvidedTemporalInfo,
    );
    const normalizedDraft =
      factGuard !== false
        ? enforceAnalyticalProvenance(normalizedBaseDraft)
        : normalizedBaseDraft;
    const draftWithEvidence = [
      evidenceMatrix,
      factClassificationTable,
      sourceQualityMatrix,
      confidenceAnalysisSection,
      normalizedDraft,
    ]
      .filter(Boolean)
      .join("\n\n");

    logNewsroomDebug("[AI Newsroom Route] draft generated", {
      draftLength: normalizedDraft.length,
    });

    const baseScore =
      (Number(assessmentData.strategicValue) || 0) +
      (Number(assessmentData.decisionSupport) || 0) +
      (Number(assessmentData.publicImpact) || 0) +
      (Number(assessmentData.readiness) || 0);
    const confidenceScore = clampScore(baseScore / 4);
    const verificationPenalty = verificationItemsCount * 5;
    const verificationBonus = verifiedFactsCount * 3;
    const finalConfidenceScore = clampScore(
      confidenceScore + verificationBonus - verificationPenalty,
    );
    const publicationReadiness = getPublicationReadiness(finalConfidenceScore);
    const verification = verifyNewsroomDraft({
      draft: normalizedDraft,
      legacyConfidenceScore: finalConfidenceScore,
      sourceText: promptContract.sourceText,
      sources: Array.isArray(sources) ? sources : [],
    });
    const editorial = {
      confidence: verification.review.editorialConfidence,
      requiresHumanApproval: verification.review.requiresHumanApproval,
      reviewReasons: verification.review.reviewReasons,
      reviewStatus: verification.review.reviewStatus,
    };
    const safeNewsroomMetadata = {
      audience: promptPayload.audience,
      channel: promptPayload.channel,
      complexity: promptPayload.complexity,
      durationMs: aiResult.metadata?.durationMs || null,
      fallbackUsed: Boolean(aiResult.metadata?.fallbackUsed),
      mode: promptPayload.mode,
      model: aiResult.model || null,
      promptVersion: promptPayload.promptVersion,
      provider: aiResult.provider || null,
    };
    const intelligenceSummary = buildIntelligenceSummary({
      editorial,
      metadata: safeNewsroomMetadata,
      verification,
    });
    const editorialReviewReport = buildEditorialReviewReport({
      configuration: promptPayload,
      intelligenceSummary,
      metadata: safeNewsroomMetadata,
      verification,
    });
    const responseConfidence = buildResponseConfidence({
      confidenceAnalysis,
      editorial,
      intelligenceSummary,
      legacyConfidenceScore: finalConfidenceScore,
      verification,
    });

    logNewsroomDebug("[AI Newsroom Route] verification completed", {
      claims: verification.claims.length,
      citationCoverage: verification.citationGuard.coverage,
      publicationReadiness: intelligenceSummary.publicationReadiness,
      reviewStatus: editorial.reviewStatus,
      unsupported: verification.factGuard.unsupportedCount,
    });

    return res.status(200).json({
      success: true,
      draft: draftWithEvidence,
      evidence,
      factClassifications,
      sourceQuality,
      confidenceAnalysis,
      confidence: responseConfidence,
      verification: {
        claims: verification.claims,
        factGuard: verification.factGuard,
        citationGuard: verification.citationGuard,
        sourceConfidence: verification.sourceConfidence,
        publicationReady: verification.publicationReady,
        publicationBlockers: verification.publicationBlockers,
      },
      editorial,
      intelligenceSummary,
      editorialReviewReport,
      metadata: {
        ...promptPayload,
        assessment: assessment || null,
        priority: priority || null,
        source_quality_score: sourceQuality.source_quality_score,
        source_quality_level: sourceQuality.source_quality_level,
        source_quality_items: sourceQuality.source_quality_items,
        confidence_score: confidenceAnalysis.confidence_score,
        confidence_level: confidenceAnalysis.confidence_level,
        confidence_breakdown: confidenceAnalysis.confidence_breakdown,
        input_readiness_score: responseConfidence.input_readiness_score,
        source_confidence_score: responseConfidence.source_confidence_score,
        source_confidence_level: responseConfidence.source_confidence_level,
        verifiedFactsCount,
        verificationItemsCount,
        promptVersion: promptPayload.promptVersion,
        provider: safeNewsroomMetadata.provider,
        model: safeNewsroomMetadata.model,
        fallbackUsed: safeNewsroomMetadata.fallbackUsed,
        durationMs: safeNewsroomMetadata.durationMs,
        claimCount: verification.claims.length,
        unsupportedClaimCount: verification.factGuard.unsupportedCount,
        citationCoverage: verification.citationGuard.coverage,
        reviewStatus: editorial.reviewStatus,
        publicationReady: verification.publicationReady,
        publicationReadiness: intelligenceSummary.publicationReadiness,
        providerCapability: {
          fallbackEligibleModels:
            providerCapability.fallbackEligibleModels.length,
          modelConfigured: providerCapability.modelConfigured,
          provider: providerCapability.provider,
          providerConfigured: providerCapability.providerConfigured,
        },
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logNewsroomError(error);

    if (error?.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.code || "invalid_payload",
        message: error.message || "Payload Newsroom tidak valid.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "ai_newsroom_failed",
      message: "Gagal menghasilkan draf AI Newsroom. Silakan coba lagi nanti.",
    });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const result = await listGenerations({
      ownerId: req.userId,
      queryParams: req.query || {},
    });

    return res.json({
      success: true,
      data: result,
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendHistoryError(
      res,
      error,
      "Gagal membaca generation history.",
      "list",
    );
  }
});

router.post("/history", requireAuth, async (req, res) => {
  try {
    const result = await createGeneration({
      body: req.body || {},
      idempotencyKey: req.headers["idempotency-key"],
      ownerId: req.userId,
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        generation: result.generation,
      },
      generation: result.generation,
    });
  } catch (error) {
    return sendHistoryError(
      res,
      error,
      "Gagal menyimpan generation history.",
      "create",
    );
  }
});

router.get("/history/:id/export", requireAuth, async (req, res) => {
  try {
    const generation = await getGenerationById({
      generationId: req.params.id,
      ownerId: req.userId,
    });
    const artifact = createExportArtifact(generation, {
      format: req.query?.format,
      type: req.query?.type,
    });

    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.filename}"`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.status(200).send(artifact.buffer);
  } catch (error) {
    return sendHistoryError(res, error, "Gagal membuat export newsroom.");
  }
});

router.get("/history/:id", requireAuth, async (req, res) => {
  try {
    const generation = await getGenerationById({
      generationId: req.params.id,
      ownerId: req.userId,
    });

    return res.json({
      success: true,
      data: {
        generation,
      },
      generation,
    });
  } catch (error) {
    return sendHistoryError(res, error, "Generation tidak ditemukan.");
  }
});

router.patch("/history/:id", requireAuth, async (req, res) => {
  try {
    const generation = await updateGeneration({
      body: req.body || {},
      generationId: req.params.id,
      ownerId: req.userId,
    });

    return res.json({
      success: true,
      data: {
        generation,
      },
      generation,
    });
  } catch (error) {
    return sendHistoryError(res, error, "Gagal memperbarui generation.");
  }
});

router.post("/history/:id/decision", requireAuth, async (req, res) => {
  try {
    const result = await recordEditorialDecision({
      body: req.body || {},
      generationId: req.params.id,
      ownerId: req.userId,
    });

    return res.json({
      success: true,
      data: result,
      decision: result.decision,
      generation: result.generation,
    });
  } catch (error) {
    return sendHistoryError(res, error, "Gagal menyimpan keputusan editorial.");
  }
});

router.delete("/history/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteGeneration({
      generationId: req.params.id,
      ownerId: req.userId,
    });

    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    return sendHistoryError(res, error, "Gagal menghapus generation.");
  }
});

module.exports = router;
module.exports.normalizeNewsroomDraft = normalizeNewsroomDraft;
module.exports.buildResponseConfidence = buildResponseConfidence;
module.exports.enforceAnalyticalProvenance = enforceAnalyticalProvenance;
module.exports.hasTemporalReference = hasTemporalReference;
module.exports.classifyNewsroomFact = classifyNewsroomFact;
module.exports.classifyNewsroomFacts = classifyNewsroomFacts;
module.exports.splitFactStatements = splitFactStatements;
module.exports.buildAllowedFactualClaims = buildAllowedFactualClaims;
module.exports.buildEvidenceEngine = buildEvidenceEngine;
module.exports.buildSourceQualityEngine = buildSourceQualityEngine;
module.exports.buildConfidenceEngine = buildConfidenceEngine;
module.exports.formatEvidenceMatrix = formatEvidenceMatrix;
module.exports.formatFactClassificationTable = formatFactClassificationTable;
module.exports.formatSourceQualityMatrix = formatSourceQualityMatrix;
module.exports.formatConfidenceAnalysis = formatConfidenceAnalysis;
