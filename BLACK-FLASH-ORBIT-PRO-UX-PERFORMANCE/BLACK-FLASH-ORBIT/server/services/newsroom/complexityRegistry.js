const COMPLEXITY_IDS = {
  DEEP: "DEEP",
  INVESTIGATIVE: "INVESTIGATIVE",
  QUICK: "QUICK",
  STANDARD: "STANDARD",
};

const COMPLEXITY_LEVELS = {
  [COMPLEXITY_IDS.QUICK]: {
    id: COMPLEXITY_IDS.QUICK,
    label: "Quick",
    analysisDepth: "ringkas",
    sourceSynthesis: "sumber utama dan gap paling kritis",
    context: "konteks minimum untuk memahami isu",
    lengthGuidance: "pendek dan langsung",
    uncertaintyGuidance: "sebutkan ketidakpastian paling penting",
  },
  [COMPLEXITY_IDS.STANDARD]: {
    id: COMPLEXITY_IDS.STANDARD,
    label: "Standard",
    analysisDepth: "menengah",
    sourceSynthesis: "sintesis sumber utama dan kebutuhan verifikasi",
    context: "konteks isu, dampak, dan pihak terkait",
    lengthGuidance: "panjang sedang",
    uncertaintyGuidance: "jelaskan gap bukti yang memengaruhi publikasi",
  },
  [COMPLEXITY_IDS.DEEP]: {
    id: COMPLEXITY_IDS.DEEP,
    label: "Deep",
    analysisDepth: "mendalam",
    sourceSynthesis: "bandingkan klaim, bukti, dan sumber yang hilang",
    context: "konteks historis, kebijakan, stakeholder, dan risiko",
    lengthGuidance: "lebih panjang dengan struktur analitis",
    uncertaintyGuidance: "bahas ketidakpastian dan dampaknya pada kesimpulan",
  },
  [COMPLEXITY_IDS.INVESTIGATIVE]: {
    id: COMPLEXITY_IDS.INVESTIGATIVE,
    label: "Investigative",
    analysisDepth: "investigatif dan evidence-first",
    sourceSynthesis:
      "petakan klaim, bukti, kontradiksi, dan prioritas verifikasi",
    context:
      "konteks mendalam, risiko hukum, aktor, dan timeline hanya bila tersedia",
    lengthGuidance: "komprehensif tetapi tidak spekulatif",
    uncertaintyGuidance:
      "pisahkan fakta, indikasi, asumsi, dan pertanyaan terbuka",
  },
};

const COMPLEXITY_ALIASES = new Map(
  Object.entries({
    advanced: COMPLEXITY_IDS.STANDARD,
    basic: COMPLEXITY_IDS.QUICK,
    deep: COMPLEXITY_IDS.DEEP,
    expert: COMPLEXITY_IDS.DEEP,
    high: COMPLEXITY_IDS.DEEP,
    investigative: COMPLEXITY_IDS.INVESTIGATIVE,
    low: COMPLEXITY_IDS.QUICK,
    medium: COMPLEXITY_IDS.STANDARD,
    quick: COMPLEXITY_IDS.QUICK,
    sovereign: COMPLEXITY_IDS.INVESTIGATIVE,
    standard: COMPLEXITY_IDS.STANDARD,
    strategic: COMPLEXITY_IDS.INVESTIGATIVE,
  }),
);

function normalizeComplexityId(value) {
  const rawValue = String(value || "").trim();
  const directId = rawValue.toUpperCase().replace(/[\s-]+/g, "_");

  if (COMPLEXITY_LEVELS[directId]) return directId;

  return COMPLEXITY_ALIASES.get(rawValue.toLowerCase()) || "";
}

function getComplexityLevel(value) {
  const id = normalizeComplexityId(value);

  return id ? COMPLEXITY_LEVELS[id] : null;
}

module.exports = {
  COMPLEXITY_IDS,
  COMPLEXITY_LEVELS,
  getComplexityLevel,
  normalizeComplexityId,
};
