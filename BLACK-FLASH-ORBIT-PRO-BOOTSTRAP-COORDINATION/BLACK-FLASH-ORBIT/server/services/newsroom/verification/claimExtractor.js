const ANALYTICAL_PROVENANCE = {
  AI_INFERENCE: "AI_INFERENCE",
  ASSUMPTION: "ASSUMPTION",
};

const CLAIM_TYPES = {
  ALLEGATION: "ALLEGATION",
  CAUSAL: "CAUSAL",
  DATE: "DATE",
  EVENT: "EVENT",
  GENERAL: "GENERAL",
  INSTITUTIONAL: "INSTITUTIONAL",
  LOCATION: "LOCATION",
  NUMBER: "NUMBER",
  PERSON: "PERSON",
  QUOTE: "QUOTE",
  ROLE: "ROLE",
};

const DIRECT_QUOTE_PATTERN = /["“”']([^"“”'\n]{6,280})["“”']/g;
const DATE_PATTERN =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}\b|\b\d{4}\b/g;
const NUMBER_PATTERN =
  /\b\d+(?:[.,]\d+)?\s?(?:%|persen|percent|orang|peserta|korban|suara|miliar|juta|ribu|triliun|USD|Rp)(?=\b|[\s.,!?]|$)/gi;
const ALLEGATION_PATTERN =
  /\b(?:alleged|alleges|accused|fraud|corruption|crime|misconduct|misuse of funds|misused funds|abuse|negligence|korupsi|penipuan|kejahatan|pelanggaran|penyalahgunaan dana|kekerasan|kelalaian|diduga|menuduh|dugaan)\b/i;
const ATTRIBUTION_PATTERN =
  /\b(?:alleged|alleges|according to|source said|reported|menurut|diduga|menuduh|melaporkan|menyebutkan)\b/i;
const CAUSAL_PATTERN =
  /\b(?:caused|causes|because|therefore|resulted in|menyebabkan|mengakibatkan|karena|sehingga|berdampak)\b/i;
const INSTITUTION_PATTERN =
  /\b(?:Organization|Institution|Agency|Pemprov|Pemerintah|Kementerian|Dinas|Badan|Komisi)\s+[A-Z0-9][A-Za-z0-9 .-]{0,80}\b/g;
const PERSON_PATTERN = /\b(?:Person|Mr\.|Ms\.|Dr\.)\s+[A-Z][A-Za-z.-]*\b/g;

function normalizeText(value) {
  return String(value || "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .split(/\n+/)
    .flatMap((line) =>
      normalizeText(line)
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean),
    )
    .filter(Boolean);
}

function detectAnalyticalProvenance(text) {
  const value = String(text || "");

  if (/\bAI_INFERENCE\s*:/i.test(value)) {
    return ANALYTICAL_PROVENANCE.AI_INFERENCE;
  }

  if (/\bASSUMPTION\s*:/i.test(value)) {
    return ANALYTICAL_PROVENANCE.ASSUMPTION;
  }

  return null;
}

function createClaim({ index, text, type, evidenceRequired = true, value }) {
  const provenance = detectAnalyticalProvenance(text);
  const importance = provenance
    ? "LOW"
    : type === CLAIM_TYPES.QUOTE ||
        type === CLAIM_TYPES.ALLEGATION ||
        type === CLAIM_TYPES.DATE ||
        type === CLAIM_TYPES.NUMBER
      ? "HIGH"
      : "MEDIUM";

  return {
    confidence: 0,
    evidenceRefs: [],
    evidenceRequired: provenance ? false : evidenceRequired,
    id: `claim-${String(index + 1).padStart(3, "0")}`,
    importance,
    provenance,
    status: "NOT_VERIFIABLE",
    text: normalizeText(text),
    type,
    value: value ? normalizeText(value) : null,
  };
}

function pushUniqueClaim(claims, claim) {
  const key = `${claim.type}:${claim.text.toLowerCase()}:${claim.value || ""}`;

  if (
    claims.some(
      (existing) =>
        `${existing.type}:${existing.text.toLowerCase()}:${existing.value || ""}` ===
        key,
    )
  ) {
    return;
  }

  claims.push({
    ...claim,
    id: `claim-${String(claims.length + 1).padStart(3, "0")}`,
  });
}

function extractClaims(draft) {
  const text = normalizeText(draft);
  const claims = [];
  const sentences = splitSentences(text);

  sentences.forEach((sentence, index) => {
    const quoteMatches = [...sentence.matchAll(DIRECT_QUOTE_PATTERN)];
    quoteMatches.forEach((match) => {
      pushUniqueClaim(
        claims,
        createClaim({
          index,
          text: sentence,
          type: CLAIM_TYPES.QUOTE,
          value: match[1],
        }),
      );
    });

    const dateMatches = [...sentence.matchAll(DATE_PATTERN)];
    dateMatches.forEach((match) => {
      pushUniqueClaim(
        claims,
        createClaim({
          index,
          text: sentence,
          type: CLAIM_TYPES.DATE,
          value: match[0],
        }),
      );
    });

    const numberMatches = [...sentence.matchAll(NUMBER_PATTERN)];
    numberMatches.forEach((match) => {
      pushUniqueClaim(
        claims,
        createClaim({
          index,
          text: sentence,
          type: CLAIM_TYPES.NUMBER,
          value: match[0],
        }),
      );
    });

    if (ALLEGATION_PATTERN.test(sentence)) {
      pushUniqueClaim(
        claims,
        createClaim({
          index,
          text: sentence,
          type: CLAIM_TYPES.ALLEGATION,
        }),
      );
    }

    if (CAUSAL_PATTERN.test(sentence)) {
      pushUniqueClaim(
        claims,
        createClaim({
          index,
          text: sentence,
          type: CLAIM_TYPES.CAUSAL,
        }),
      );
    }

    [...sentence.matchAll(INSTITUTION_PATTERN)].forEach((match) => {
      pushUniqueClaim(
        claims,
        createClaim({
          evidenceRequired: false,
          index,
          text: match[0],
          type: CLAIM_TYPES.INSTITUTIONAL,
          value: match[0],
        }),
      );
    });

    [...sentence.matchAll(PERSON_PATTERN)].forEach((match) => {
      pushUniqueClaim(
        claims,
        createClaim({
          evidenceRequired: false,
          index,
          text: match[0],
          type: CLAIM_TYPES.PERSON,
          value: match[0],
        }),
      );
    });

    if (
      claims.length < 40 &&
      sentence.length > 40 &&
      !quoteMatches.length &&
      !ALLEGATION_PATTERN.test(sentence)
    ) {
      pushUniqueClaim(
        claims,
        createClaim({
          evidenceRequired: false,
          index,
          text: sentence,
          type: CLAIM_TYPES.GENERAL,
        }),
      );
    }
  });

  return claims.slice(0, 80);
}

function hasAttributionLanguage(text) {
  return ATTRIBUTION_PATTERN.test(String(text || ""));
}

module.exports = {
  ANALYTICAL_PROVENANCE,
  CLAIM_TYPES,
  detectAnalyticalProvenance,
  extractClaims,
  hasAttributionLanguage,
  normalizeText,
  splitSentences,
};
