const CHANNEL_IDS = {
  ANALYSIS: "ANALYSIS",
  ARTICLE: "ARTICLE",
  BREAKING_NEWS: "BREAKING_NEWS",
  EDITOR_BRIEF: "EDITOR_BRIEF",
  EXECUTIVE_BRIEF: "EXECUTIVE_BRIEF",
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  PRESS_RELEASE: "PRESS_RELEASE",
  X: "X",
};

const CHANNEL_TARGETS = {
  [CHANNEL_IDS.ARTICLE]: {
    id: CHANNEL_IDS.ARTICLE,
    label: "Article",
    expectedLength: "600-900 kata",
    structure: ["Headline", "Lead", "Body", "Context", "Closing"],
    headlineBehavior: "headline informatif dan akurat",
    ctaPolicy: "CTA hanya jika relevan untuk layanan publik",
    formality: "medium-formal",
    metadataExpectations: ["angle", "source needs", "verification notes"],
  },
  [CHANNEL_IDS.BREAKING_NEWS]: {
    id: CHANNEL_IDS.BREAKING_NEWS,
    label: "Breaking News",
    expectedLength: "150-300 kata",
    structure: ["Urgent Lead", "Known Facts", "Unknowns", "Next Update"],
    headlineBehavior: "langsung, tidak spekulatif",
    ctaPolicy: "tidak memakai CTA promosi",
    formality: "faktual-ringkas",
    metadataExpectations: ["timestamp caution", "verification status"],
  },
  [CHANNEL_IDS.FACEBOOK]: {
    id: CHANNEL_IDS.FACEBOOK,
    label: "Facebook",
    expectedLength: "120-220 kata",
    structure: ["Context", "Key Message", "Public Relevance", "CTA"],
    headlineBehavior: "pembuka jelas, bukan clickbait",
    ctaPolicy: "boleh CTA informasional yang tidak manipulatif",
    formality: "publik-ramah",
    metadataExpectations: ["public impact", "verification note"],
  },
  [CHANNEL_IDS.INSTAGRAM]: {
    id: CHANNEL_IDS.INSTAGRAM,
    label: "Instagram",
    expectedLength: "80-160 kata",
    structure: ["Hook", "Key Points", "Caption", "Hashtag Guidance"],
    headlineBehavior: "hook singkat tetap faktual",
    ctaPolicy: "CTA ringan untuk membaca info resmi",
    formality: "publik-ringkas",
    metadataExpectations: ["visual angle", "caption safety"],
  },
  [CHANNEL_IDS.X]: {
    id: CHANNEL_IDS.X,
    label: "X",
    expectedLength: "1-3 post pendek",
    structure: ["Post", "Context", "Verification Note"],
    headlineBehavior: "kalimat pertama memuat fakta utama",
    ctaPolicy: "CTA minimal",
    formality: "ringkas-faktual",
    metadataExpectations: ["thread risk", "source note"],
  },
  [CHANNEL_IDS.PRESS_RELEASE]: {
    id: CHANNEL_IDS.PRESS_RELEASE,
    label: "Press Release",
    expectedLength: "400-700 kata",
    structure: [
      "Title",
      "Dateline",
      "Lead",
      "Institutional Context",
      "Quote Placeholder",
      "Closing",
    ],
    headlineBehavior: "formal dan institusional",
    ctaPolicy: "CTA hanya berupa kanal resmi atau tindak lanjut layanan",
    formality: "formal",
    metadataExpectations: [
      "official source requirements",
      "quote verification",
    ],
  },
  [CHANNEL_IDS.EDITOR_BRIEF]: {
    id: CHANNEL_IDS.EDITOR_BRIEF,
    label: "Editor Brief",
    expectedLength: "300-600 kata",
    structure: [
      "Editorial Decision",
      "Evidence Gaps",
      "Risk Notes",
      "Recommended Edits",
    ],
    headlineBehavior: "judul kerja internal",
    ctaPolicy: "tidak ada CTA publik",
    formality: "internal-editorial",
    metadataExpectations: ["publication readiness", "verification blockers"],
  },
  [CHANNEL_IDS.EXECUTIVE_BRIEF]: {
    id: CHANNEL_IDS.EXECUTIVE_BRIEF,
    label: "Executive Brief",
    expectedLength: "250-500 kata",
    structure: [
      "Decision Summary",
      "Implications",
      "Risks",
      "Recommended Action",
    ],
    headlineBehavior: "keputusan/isu utama di depan",
    ctaPolicy: "tindakan internal yang spesifik",
    formality: "executive",
    metadataExpectations: ["decision relevance", "risk level"],
  },
  [CHANNEL_IDS.ANALYSIS]: {
    id: CHANNEL_IDS.ANALYSIS,
    label: "Analysis",
    expectedLength: "700-1200 kata",
    structure: [
      "Thesis",
      "Context",
      "Evidence",
      "Implications",
      "Risks",
      "Conclusion",
    ],
    headlineBehavior: "analitis, tidak sensasional",
    ctaPolicy: "tidak ada CTA promosi",
    formality: "analytical",
    metadataExpectations: ["assumptions", "uncertainty", "source confidence"],
  },
};

const MODE_TO_CHANNEL = new Map(
  Object.entries({
    "artikel berita": CHANNEL_IDS.ARTICLE,
    "breaking news": CHANNEL_IDS.BREAKING_NEWS,
    "editor brief": CHANNEL_IDS.EDITOR_BRIEF,
    "executive brief": CHANNEL_IDS.EXECUTIVE_BRIEF,
    "impact analysis": CHANNEL_IDS.ANALYSIS,
    "policy analysis": CHANNEL_IDS.ANALYSIS,
    "press release": CHANNEL_IDS.PRESS_RELEASE,
    "risk analysis": CHANNEL_IDS.ANALYSIS,
    "siaran pers pemerintah": CHANNEL_IDS.PRESS_RELEASE,
    "strategic memo": CHANNEL_IDS.EXECUTIVE_BRIEF,
  }),
);

function normalizeChannelId(value, mode) {
  const rawValue = String(value || "").trim();
  const directId = rawValue.toUpperCase().replace(/[\s-]+/g, "_");

  if (CHANNEL_TARGETS[directId]) return directId;

  const modeKey = String(mode || "")
    .trim()
    .toLowerCase();

  return MODE_TO_CHANNEL.get(modeKey) || CHANNEL_IDS.ARTICLE;
}

function isValidChannelId(value) {
  const directId = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return Boolean(CHANNEL_TARGETS[directId]);
}

function getChannelTarget(value, mode) {
  return CHANNEL_TARGETS[normalizeChannelId(value, mode)];
}

module.exports = {
  CHANNEL_IDS,
  CHANNEL_TARGETS,
  getChannelTarget,
  isValidChannelId,
  normalizeChannelId,
};
