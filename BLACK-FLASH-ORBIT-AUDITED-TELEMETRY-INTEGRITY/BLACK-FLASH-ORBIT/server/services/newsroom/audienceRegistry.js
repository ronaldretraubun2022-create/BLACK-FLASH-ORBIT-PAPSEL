const AUDIENCE_IDS = {
  EDITOR: "EDITOR",
  EXECUTIVE: "EXECUTIVE",
  GENERAL_PUBLIC: "GENERAL_PUBLIC",
  GOVERNMENT: "GOVERNMENT",
  JOURNALIST: "JOURNALIST",
  STRATEGIC: "STRATEGIC",
};

const AUDIENCE_PROFILES = {
  [AUDIENCE_IDS.GENERAL_PUBLIC]: {
    id: AUDIENCE_IDS.GENERAL_PUBLIC,
    label: "General Public",
    description: "Publik luas yang membutuhkan informasi jelas dan relevan.",
    tone: "jelas, netral, mudah dipahami",
    vocabulary: "bahasa publik tanpa jargon internal",
    detailLevel: "ringkas-menengah",
    contextDepth: "konteks dasar dan dampak langsung",
    riskSensitivity: "hindari alarmisme dan jelaskan ketidakpastian",
    citationExpectation: "jelaskan sumber resmi yang perlu diverifikasi",
    recommendedChannels: ["ARTICLE", "FACEBOOK", "INSTAGRAM"],
    writingGuidance:
      "Tekankan apa yang terjadi, mengapa penting, dampak bagi warga, dan langkah verifikasi berikutnya.",
  },
  [AUDIENCE_IDS.JOURNALIST]: {
    id: AUDIENCE_IDS.JOURNALIST,
    label: "Journalist",
    description:
      "Reporter atau redaksi yang membutuhkan angle, fakta, dan bahan liputan.",
    tone: "tajam, faktual, newsroom-ready",
    vocabulary: "istilah jurnalistik umum dan 5W+1H",
    detailLevel: "menengah",
    contextDepth: "angle berita, nilai berita, dan kebutuhan narasumber",
    riskSensitivity:
      "pisahkan fakta terlapor, dugaan, dan klaim yang perlu konfirmasi",
    citationExpectation:
      "cantumkan kategori sumber dan kebutuhan kutipan resmi",
    recommendedChannels: ["ARTICLE", "BREAKING_NEWS", "ANALYSIS"],
    writingGuidance:
      "Buat lead kuat, angle jelas, verifikasi narasumber, dan hindari kutipan fiktif.",
  },
  [AUDIENCE_IDS.EDITOR]: {
    id: AUDIENCE_IDS.EDITOR,
    label: "Editor",
    description:
      "Editor yang menilai kelayakan publikasi, risiko, dan struktur naskah.",
    tone: "analitis, presisi, editorial",
    vocabulary: "istilah editorial dan verifikasi sumber",
    detailLevel: "mendalam",
    contextDepth: "struktur naskah, gap bukti, risiko publikasi",
    riskSensitivity:
      "tinggi pada klaim tanpa bukti, tuduhan, dan atribusi lemah",
    citationExpectation: "eksplisit tentang evidence missing dan sumber resmi",
    recommendedChannels: ["EDITOR_BRIEF", "ANALYSIS", "ARTICLE"],
    writingGuidance:
      "Tampilkan kelayakan publikasi, bagian yang perlu diperkuat, dan keputusan editorial yang disarankan.",
  },
  [AUDIENCE_IDS.GOVERNMENT]: {
    id: AUDIENCE_IDS.GOVERNMENT,
    label: "Government",
    description: "Komunikasi formal kelembagaan, bukan propaganda.",
    tone: "formal, institusional, netral",
    vocabulary: "bahasa administrasi publik yang tetap mudah dipahami",
    detailLevel: "menengah",
    contextDepth: "kebijakan, layanan publik, akuntabilitas, koordinasi",
    riskSensitivity:
      "hindari klaim keberhasilan tanpa data dan bahasa promosi berlebihan",
    citationExpectation:
      "butuh dokumen resmi, data lembaga, dan pernyataan pejabat terverifikasi",
    recommendedChannels: ["PRESS_RELEASE", "ARTICLE", "EXECUTIVE_BRIEF"],
    writingGuidance:
      "Gunakan komunikasi publik yang formal, transparan, dan berbasis bukti tanpa bias politik.",
  },
  [AUDIENCE_IDS.EXECUTIVE]: {
    id: AUDIENCE_IDS.EXECUTIVE,
    label: "Executive",
    description:
      "Pengambil keputusan yang membutuhkan ringkasan cepat dan implikasi.",
    tone: "ringkas, strategis, keputusan",
    vocabulary: "bahasa eksekutif dan indikator prioritas",
    detailLevel: "ringkas-menengah",
    contextDepth: "implikasi, risiko utama, pilihan keputusan",
    riskSensitivity: "tinggi pada risiko operasional, reputasi, dan timing",
    citationExpectation: "sumber utama dan confidence harus jelas",
    recommendedChannels: ["EXECUTIVE_BRIEF", "EDITOR_BRIEF", "ANALYSIS"],
    writingGuidance:
      "Mulai dengan keputusan yang dibutuhkan, implikasi utama, risiko, dan next action.",
  },
  [AUDIENCE_IDS.STRATEGIC]: {
    id: AUDIENCE_IDS.STRATEGIC,
    label: "Strategic",
    description:
      "Analisis strategis untuk implikasi, stakeholder, dan risiko keputusan.",
    tone: "strategis, objektif, evidence-aware",
    vocabulary: "istilah risiko, stakeholder, trade-off, dan skenario",
    detailLevel: "mendalam",
    contextDepth:
      "implikasi lintas stakeholder, risiko, skenario, decision relevance",
    riskSensitivity:
      "sangat tinggi pada asumsi, proyeksi, dan dampak jangka panjang",
    citationExpectation: "butuh pemisahan fakta, asumsi, dan bukti yang hilang",
    recommendedChannels: ["ANALYSIS", "EXECUTIVE_BRIEF", "EDITOR_BRIEF"],
    writingGuidance:
      "Tekankan implikasi, risiko, stakeholder terdampak, opsi keputusan, dan ketidakpastian.",
  },
};

const AUDIENCE_ALIASES = new Map(
  Object.entries({
    akademisi: AUDIENCE_IDS.EDITOR,
    asn: AUDIENCE_IDS.GOVERNMENT,
    bupati: AUDIENCE_IDS.EXECUTIVE,
    editor: AUDIENCE_IDS.EDITOR,
    executive: AUDIENCE_IDS.EXECUTIVE,
    general_public: AUDIENCE_IDS.GENERAL_PUBLIC,
    gubernur: AUDIENCE_IDS.EXECUTIVE,
    government: AUDIENCE_IDS.GOVERNMENT,
    investor: AUDIENCE_IDS.STRATEGIC,
    journalist: AUDIENCE_IDS.JOURNALIST,
    kepala_opd: AUDIENCE_IDS.GOVERNMENT,
    komunitas_lokal: AUDIENCE_IDS.GENERAL_PUBLIC,
    masyarakat: AUDIENCE_IDS.GENERAL_PUBLIC,
    media: AUDIENCE_IDS.JOURNALIST,
    menteri: AUDIENCE_IDS.EXECUTIVE,
    pelajar: AUDIENCE_IDS.GENERAL_PUBLIC,
    pelaku_usaha: AUDIENCE_IDS.GENERAL_PUBLIC,
    strategic: AUDIENCE_IDS.STRATEGIC,
  }),
);

function normalizeRegistryKey(value) {
  return String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function normalizeAudienceId(value) {
  const rawValue = String(value || "").trim();
  const directId = rawValue.toUpperCase().replace(/[\s-]+/g, "_");

  if (AUDIENCE_PROFILES[directId]) return directId;

  return AUDIENCE_ALIASES.get(normalizeRegistryKey(rawValue)) || "";
}

function getAudienceProfile(value) {
  const id = normalizeAudienceId(value);

  return id ? AUDIENCE_PROFILES[id] : null;
}

function listAudienceProfiles() {
  return Object.values(AUDIENCE_PROFILES);
}

module.exports = {
  AUDIENCE_IDS,
  AUDIENCE_PROFILES,
  getAudienceProfile,
  listAudienceProfiles,
  normalizeAudienceId,
};
