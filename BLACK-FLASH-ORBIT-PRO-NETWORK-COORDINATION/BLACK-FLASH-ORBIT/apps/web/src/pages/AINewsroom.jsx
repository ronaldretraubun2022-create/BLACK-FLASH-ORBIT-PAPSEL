import { useEffect, useMemo, useState } from "react";
import { AudienceSelector } from "../components/newsroom/AudienceSelector.jsx";
import { ChannelSelector } from "../components/newsroom/ChannelSelector.jsx";
import { EditorialDecisionPanel } from "../components/newsroom/history/EditorialDecisionPanel.jsx";
import { GenerationHistory } from "../components/newsroom/history/GenerationHistory.jsx";
import { IntelligenceSummary } from "../components/newsroom/IntelligenceSummary.jsx";
import { IntelligenceSummaryPanel } from "../components/newsroom/intelligence/IntelligenceSummaryPanel.jsx";
import { VerificationPanel } from "../components/newsroom/verification/VerificationPanel.jsx";
import {
  deleteNewsroomGeneration,
  exportNewsroomGeneration,
  generateIntelligenceDraft,
  getNewsroomGeneration,
  isNewsroomLocalFallbackEnabled,
  listNewsroomHistory,
  saveNewsroomGeneration,
  submitNewsroomDecision,
} from "../services/newsroomAI.js";

const INTELLIGENCE_LAYERS = {
  "Writing Layer": [
    "Formal",
    "Semi Formal",
    "Netral",
    "Ringkas",
    "Profesional",
    "Inspiratif",
    "Persuasif",
    "Storytelling",
  ],
  "Editorial Layer": [
    "Artikel Berita",
    "Headline",
    "Press Release",
    "Breaking News",
    "Straight News",
    "Feature Story",
    "Editorial",
    "Opini",
    "Fact Check",
    "Explainer",
  ],
  "Government Layer": [
    "Media Pemerintah",
    "Siaran Pers Pemerintah",
    "Bahasa Birokrasi",
    "Pengumuman Publik",
    "Pidato Kepala Daerah",
    "Laporan Kinerja",
    "Humas Pemerintah",
    "Crisis Communication Pemerintah",
  ],
  "Decision Layer": [
    "Executive Brief",
    "Governor Brief",
    "Minister Brief",
    "CEO Brief",
    "Decision Support",
    "Strategic Memo",
    "Leadership Communication",
  ],
  "Analysis Layer": [
    "Impact Analysis",
    "Risk Analysis",
    "Policy Analysis",
    "Economic Analysis",
    "Stakeholder Analysis",
    "Public Service Analysis",
  ],
  "Situational Layer": [
    "Situational Awareness",
    "Monitoring Report",
    "Regional Monitoring",
    "Public Sentiment",
    "Security Monitoring",
    "Command Center Update",
  ],
  "Predictive Layer": [
    "Trend Forecast",
    "Future Projection",
    "Scenario Planning",
    "Early Warning",
    "Strategic Forecast",
    "Black Swan Watch",
  ],
  "Intelligence Layer": [
    "OSINT Report",
    "Threat Intelligence",
    "Cyber Bulletin",
    "Digital Risk Analysis",
    "Intelligence Briefing",
    "Security Advisory",
  ],
  "National Layer": [
    "National Development Analysis",
    "Public Service Intelligence",
    "Infrastructure Intelligence",
    "Economic Intelligence",
    "Digital Transformation Intelligence",
  ],
  "Sovereign Layer": [
    "Sovereign Intelligence",
    "National Resilience",
    "Strategic Foresight",
    "Mega Trend Analysis",
    "Global Risk Monitoring",
    "Civilization Analysis",
  ],
};

const AUDIENCES = [
  {
    id: "GENERAL_PUBLIC",
    label: "General Public",
    description: "Bahasa jelas untuk publik luas.",
  },
  {
    id: "JOURNALIST",
    label: "Journalist",
    description: "Angle, lead, 5W+1H, dan kebutuhan liputan.",
  },
  {
    id: "EDITOR",
    label: "Editor",
    description: "Kelayakan publikasi, risiko, dan gap bukti.",
  },
  {
    id: "GOVERNMENT",
    label: "Government",
    description: "Komunikasi formal kelembagaan, bukan propaganda.",
  },
  {
    id: "EXECUTIVE",
    label: "Executive",
    description: "Implikasi, risiko utama, dan keputusan cepat.",
  },
  {
    id: "STRATEGIC",
    label: "Strategic",
    description: "Stakeholder, skenario, risiko, dan relevansi keputusan.",
  },
];

const CHANNEL_TARGETS = [
  { id: "ARTICLE", label: "Article" },
  { id: "BREAKING_NEWS", label: "Breaking News" },
  { id: "FACEBOOK", label: "Facebook" },
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "X", label: "X" },
  { id: "PRESS_RELEASE", label: "Press Release" },
  { id: "EDITOR_BRIEF", label: "Editor Brief" },
  { id: "EXECUTIVE_BRIEF", label: "Executive Brief" },
  { id: "ANALYSIS", label: "Analysis" },
];

const COMPLEXITY_LEVELS = [
  "Basic",
  "Advanced",
  "Expert",
  "Strategic",
  "Sovereign",
];

const COMPLEXITY_SECTIONS = {
  Basic: ["Summary", "Main Content", "Conclusion"],
  Advanced: [
    "Summary",
    "Analysis",
    "Opportunities",
    "Challenges",
    "Conclusion",
  ],
  Expert: [
    "Executive Summary",
    "Stakeholders",
    "Risks",
    "Opportunities",
    "Recommendations",
  ],
  Strategic: [
    "Strategic Context",
    "Impact Analysis",
    "Risk Matrix",
    "Opportunity Matrix",
    "Priority Actions",
    "Decision Support",
  ],
  Sovereign: [
    "National Context",
    "Mega Trend Analysis",
    "Strategic Risks",
    "Future Projection",
    "Scenario Analysis",
    "Policy Direction",
    "Executive Recommendation",
  ],
};

const AUDIENCE_SECTIONS = {
  GENERAL_PUBLIC: [
    "Apa yang Terjadi",
    "Mengapa Penting",
    "Manfaat Bagi Warga",
    "Potensi Dampak",
    "Informasi Lanjutan",
  ],
  JOURNALIST: [
    "Headline",
    "Lead",
    "5W+1H",
    "News Angle",
    "Quote Recommendation",
  ],
  EDITOR: [
    "Editorial Decision",
    "Evidence Gaps",
    "Publication Risk",
    "Recommended Edits",
  ],
  GOVERNMENT: [
    "Public Communication",
    "Institutional Context",
    "Service Impact",
    "Verification Needs",
  ],
  EXECUTIVE: [
    "Decision Summary",
    "Strategic Implications",
    "Risks",
    "Priority Actions",
  ],
  STRATEGIC: [
    "Strategic Context",
    "Stakeholders",
    "Risk Matrix",
    "Scenario Notes",
    "Decision Relevance",
  ],
  Gubernur: [
    "Strategic Context",
    "Regional Impact",
    "Risk Matrix",
    "Priority Actions",
    "Governor Decision",
  ],
  Investor: [
    "Market Potential",
    "Economic Outlook",
    "Investment Risk",
    "ROI Opportunity",
    "Investment Recommendation",
  ],
  Media: ["Headline", "Lead", "5W+1H", "News Angle", "Quote Recommendation"],
  ASN: [
    "Implementation Plan",
    "SOP Impact",
    "Resource Requirements",
    "Performance Indicators",
    "Monitoring Plan",
  ],
  Akademisi: [
    "Research Context",
    "Findings",
    "Implications",
    "Research Recommendation",
  ],
  Masyarakat: [
    "Apa yang Terjadi",
    "Mengapa Penting",
    "Manfaat Bagi Warga",
    "Potensi Dampak",
    "Informasi Lanjutan",
  ],
};

const COMPLEXITY_SCORE_WEIGHTS = {
  Basic: 0,
  Advanced: 5,
  Expert: 10,
  Strategic: 15,
  Sovereign: 20,
};

const LAYER_SCORE_WEIGHTS = {
  "Decision Layer": 15,
  "Predictive Layer": 10,
  "Intelligence Layer": 15,
  "Sovereign Layer": 20,
};

const AUDIENCE_SCORE_WEIGHTS = {
  EDITOR: { decisionSupport: 8 },
  EXECUTIVE: { decisionSupport: 10 },
  GENERAL_PUBLIC: { publicImpact: 10 },
  GOVERNMENT: { decisionSupport: 6, publicImpact: 6 },
  JOURNALIST: { publicImpact: 6 },
  STRATEGIC: { strategicValue: 10 },
  Gubernur: { decisionSupport: 10 },
  Menteri: { decisionSupport: 10 },
  Investor: { strategicValue: 10 },
  Masyarakat: { publicImpact: 10 },
};

const DEFAULT_LAYER = "Editorial Layer";
const DEFAULT_MODE = "Artikel Berita";
const DEFAULT_AUDIENCE = "GENERAL_PUBLIC";
const DEFAULT_CHANNEL = "ARTICLE";

function getAudienceLabel(audience) {
  return (
    AUDIENCES.find((item) => item.id === audience)?.label ||
    String(audience || "General Public")
  );
}

function getChannelLabel(channel) {
  return (
    CHANNEL_TARGETS.find((item) => item.id === channel)?.label ||
    String(channel || "Article")
  );
}

function getExpectedOutput(layer, mode, audience, complexity) {
  const expectedOutputs = {
    "Decision Layer": [
      "Executive Brief",
      "Strategic Assessment",
      "Risk Analysis",
      "Action Plan",
    ],
    "Analysis Layer": [
      "Impact Analysis",
      "Risk Mapping",
      "Stakeholder Analysis",
    ],
    "Predictive Layer": [
      "Future Projection",
      "Best Case",
      "Worst Case",
      "Early Warning",
    ],
    "Intelligence Layer": ["OSINT Brief", "Threat Assessment", "Risk Matrix"],
    "Government Layer": [
      "Public Communication",
      "Policy Message",
      "Verified Statement",
    ],
    "Sovereign Layer": [
      "Strategic Foresight",
      "Mega Trend Analysis",
      "National Risk Assessment",
    ],
  };

  const fallbackOutputs = ["Draft", "Editorial Output", "Review Notes"];
  const outputs = expectedOutputs[layer] || fallbackOutputs;

  return outputs.join(", ");
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRiskLevel(score) {
  if (score <= 40) return "Low";
  if (score <= 70) return "Medium";
  return "High";
}

function getRiskProgress(riskLevel) {
  if (riskLevel === "High") return 100;
  if (riskLevel === "Medium") return 70;
  return 40;
}

function getIntelligenceAssessment({
  layer,
  mode,
  audience,
  complexity,
  topic,
}) {
  const layerWeight = LAYER_SCORE_WEIGHTS[layer] || 0;
  const complexityWeight = COMPLEXITY_SCORE_WEIGHTS[complexity] || 0;
  const audienceWeight = AUDIENCE_SCORE_WEIGHTS[audience] || {};
  const safeTopic = topic.trim();
  const topicReadiness =
    safeTopic.length >= 120
      ? 12
      : safeTopic.length >= 40
        ? 8
        : safeTopic
          ? 4
          : 0;
  const decisionModes = [
    "Executive Brief",
    "Governor Brief",
    "Minister Brief",
    "CEO Brief",
    "Decision Support",
    "Strategic Memo",
  ];
  const analysisModes = [
    "Impact Analysis",
    "Risk Analysis",
    "Policy Analysis",
    "Trend Forecast",
    "Future Projection",
    "Scenario Planning",
    "OSINT Report",
    "Threat Intelligence",
  ];
  const modeWeight = decisionModes.includes(mode)
    ? 8
    : analysisModes.includes(mode)
      ? 6
      : 3;

  const strategicValue = clampScore(
    42 +
      layerWeight +
      complexityWeight +
      (audienceWeight.strategicValue || 0) +
      modeWeight,
  );
  const decisionSupport = clampScore(
    38 +
      (layer === "Decision Layer"
        ? layerWeight
        : Math.round(layerWeight * 0.45)) +
      Math.round(complexityWeight * 0.7) +
      (audienceWeight.decisionSupport || 0) +
      modeWeight,
  );
  const publicImpact = clampScore(
    44 +
      (layer === "Government Layer" ? 8 : 0) +
      Math.round(complexityWeight * 0.55) +
      (audienceWeight.publicImpact || 0) +
      (audience === "Media" || audience === "JOURNALIST" ? 6 : 0) +
      topicReadiness,
  );
  const readiness = clampScore(
    46 +
      Math.round(complexityWeight * 0.6) +
      topicReadiness +
      (safeTopic ? 6 : 0),
  );
  const overallScore = clampScore(
    (strategicValue + decisionSupport + publicImpact + readiness) / 4,
  );
  const riskLevel = getRiskLevel(overallScore);

  const confidenceBase = clampScore(
    Math.round(
      (strategicValue + decisionSupport + publicImpact + readiness) / 4,
    ),
  );
  const unknownPenalty = safeTopic.length === 0 ? 15 : 0;
  const confidenceScore = clampScore(confidenceBase - unknownPenalty);
  const publicationReadiness =
    confidenceScore >= 80
      ? "Ready"
      : confidenceScore >= 60
        ? "Review Required"
        : "Verification Required";

  return {
    strategicValue,
    decisionSupport,
    publicImpact,
    readiness,
    riskLevel,
    overallScore,
    sourceConfidence: confidenceScore,
    publicationReadiness,
  };
}

function getPriorityEngine(assessment) {
  const score = assessment.overallScore;
  const priority =
    score <= 39
      ? "Low"
      : score <= 64
        ? "Medium"
        : score <= 84
          ? "High"
          : "Critical";
  const actionSpeed = {
    Low: "Routine",
    Medium: "Fast",
    High: "Immediate",
    Critical: "Command Response",
  }[priority];
  const escalationLevel = {
    Low: "Monitor",
    Medium: "Department Review",
    High: "Leadership Review",
    Critical: "Command Center",
  }[priority];
  const decisionType =
    assessment.decisionSupport >= 85
      ? "Executive"
      : assessment.strategicValue >= 80
        ? "Strategic"
        : assessment.publicImpact >= 80
          ? "Public Impact"
          : "Informational";

  return {
    priority,
    actionSpeed,
    decisionType,
    escalationLevel,
  };
}

function getAudiencePerspective(audience) {
  switch (audience) {
    case "GENERAL_PUBLIC":
      return "Fokus pada manfaat langsung bagi masyarakat, kemudahan akses, transparansi, dan dampak layanan publik.";
    case "JOURNALIST":
      return "Fokus pada nilai berita, lead kuat, 5W+1H, angle liputan, kebutuhan narasumber, dan verifikasi kutipan.";
    case "EDITOR":
      return "Fokus pada kelayakan publikasi, gap bukti, risiko editorial, struktur naskah, dan keputusan review.";
    case "GOVERNMENT":
      return "Fokus pada komunikasi kelembagaan yang formal, transparan, akuntabel, dan tidak bersifat propaganda.";
    case "EXECUTIVE":
      return "Fokus pada implikasi keputusan, risiko utama, prioritas tindakan, dan ringkasan yang cepat dibaca.";
    case "STRATEGIC":
      return "Fokus pada stakeholder, risiko, skenario, implikasi strategis, dan relevansi pengambilan keputusan.";
    case "Media":
      return "Fokus pada nilai berita, fakta utama, lead yang kuat, kutipan layak publikasi, dan kepentingan publik.";
    case "ASN":
      return "Fokus pada implementasi program, SOP, koordinasi lintas unit, disiplin layanan, dan akuntabilitas kerja.";
    case "Kepala OPD":
      return "Fokus pada eksekusi teknis, indikator kinerja, pembagian peran, risiko operasional, dan pelaporan progres.";
    case "Bupati":
      return "Fokus pada dampak kabupaten, pelayanan langsung ke warga, prioritas daerah, dan koordinasi perangkat daerah.";
    case "Gubernur":
      return "Fokus pada kebijakan strategis provinsi, dampak lintas kabupaten, risiko daerah, dan prioritas keputusan.";
    case "Menteri":
      return "Fokus pada dampak nasional, sinkronisasi kebijakan pusat-daerah, indikator kinerja, dan skalabilitas program.";
    case "Investor":
      return "Fokus pada peluang investasi, prospek pertumbuhan, risiko pasar, kepastian regulasi, dan dampak ekonomi.";
    case "Akademisi":
      return "Fokus pada analisis berbasis data, metodologi, konteks kebijakan, implikasi penelitian, dan rekomendasi objektif.";
    case "Pelajar":
      return "Fokus pada bahasa sederhana, edukatif, mudah dipahami, dan menjelaskan manfaat utama secara jelas.";
    case "Pelaku Usaha":
      return "Fokus pada kemudahan layanan, peluang ekonomi, perizinan, efisiensi proses, dan dampak bagi kegiatan usaha.";
    case "Komunitas Lokal":
      return "Fokus pada manfaat langsung, partisipasi masyarakat, konteks budaya lokal, dan kepercayaan publik.";
    default:
      return "Fokus pada manfaat langsung bagi masyarakat, kemudahan akses, transparansi, dan dampak layanan publik.";
  }
}

function getAudienceRecommendation(audience) {
  switch (audience) {
    case "GENERAL_PUBLIC":
      return "Pastikan layanan mudah diakses, informasi jelas, dan manfaatnya dirasakan langsung oleh warga.";
    case "JOURNALIST":
      return "Siapkan rilis ringkas, data pendukung, kutipan resmi, foto kegiatan, dan narahubung redaksi.";
    case "EDITOR":
      return "Tandai gap bukti, klaim berisiko, kebutuhan narasumber, dan rekomendasi keputusan publikasi.";
    case "GOVERNMENT":
      return "Gunakan bahasa formal, sumber resmi, konteks layanan publik, dan hindari klaim promosi tanpa data.";
    case "EXECUTIVE":
      return "Mulai dari keputusan yang dibutuhkan, risiko utama, opsi tindakan, dan konsekuensi operasional.";
    case "STRATEGIC":
      return "Petakan implikasi, stakeholder, skenario, risiko keputusan, dan sinyal yang perlu dipantau.";
    case "Media":
      return "Siapkan rilis ringkas, data pendukung, kutipan resmi, foto kegiatan, dan narahubung redaksi.";
    case "ASN":
      return "Susun SOP, jadwal pelatihan, alur eskalasi masalah, dan indikator layanan harian.";
    case "Kepala OPD":
      return "Tetapkan PIC, target mingguan, dashboard kinerja, dan mekanisme evaluasi lintas unit.";
    case "Bupati":
      return "Prioritaskan layanan paling berdampak bagi warga dan gunakan indikator kepuasan publik.";
    case "Gubernur":
      return "Bangun peta jalan lintas kabupaten, risk register, dan command dashboard untuk monitoring keputusan.";
    case "Menteri":
      return "Selaraskan program dengan prioritas nasional, standar interoperabilitas, dan indikator kinerja kementerian.";
    case "Investor":
      return "Tampilkan kepastian regulasi, peluang ekonomi, infrastruktur pendukung, dan skema kolaborasi.";
    case "Akademisi":
      return "Lengkapi dengan data baseline, metode evaluasi, dan ruang kolaborasi riset kebijakan.";
    case "Pelajar":
      return "Gunakan bahasa visual, contoh sehari-hari, dan penjelasan bertahap agar mudah dipahami.";
    case "Pelaku Usaha":
      return "Perjelas alur layanan, waktu proses, biaya resmi, kanal bantuan, dan kepastian perizinan.";
    case "Komunitas Lokal":
      return "Libatkan tokoh lokal, gunakan bahasa yang dekat dengan warga, dan buka kanal umpan balik.";
    default:
      return "Pastikan layanan mudah diakses, informasi jelas, dan manfaatnya dirasakan langsung oleh warga.";
  }
}

function buildHeader({ layer, mode, audience, safeTopic }) {
  return `Layer:
${layer}

Mode:
${mode}

Target Audience:
${getAudienceLabel(audience)}

Audience Perspective:
${getAudiencePerspective(audience)}

Topik:
${safeTopic}`;
}

function getLayerTitle(layer, mode) {
  if (layer === "Decision Layer") return "EXECUTIVE DECISION BRIEF";
  if (layer === "Predictive Layer") return "PREDICTIVE INTELLIGENCE REPORT";
  if (layer === "Intelligence Layer") return "INTELLIGENCE BRIEFING";
  if (layer === "Sovereign Layer") return "SOVEREIGN INTELLIGENCE ASSESSMENT";
  if (layer === "Government Layer") return "KOMUNIKASI PEMERINTAH";
  if (layer === "Analysis Layer") return "ANALYSIS REPORT";
  if (mode === "Headline") return "HEADLINE UTAMA";
  if (mode === "Press Release") return "PRESS RELEASE";

  return "ARTIKEL BERITA";
}

function getLayerFocus(layer) {
  switch (layer) {
    case "Decision Layer":
      return "Fokus pada keputusan eksekutif, risiko strategis, dan tindakan prioritas.";
    case "Analysis Layer":
      return "Fokus pada dampak, pemetaan risiko, peluang, dan implikasi kebijakan.";
    case "Predictive Layer":
      return "Fokus pada proyeksi masa depan, sinyal awal, skenario, dan peringatan dini.";
    case "Intelligence Layer":
      return "Fokus pada OSINT, threat assessment, risk matrix, dan tindakan mitigasi.";
    case "Government Layer":
      return "Fokus pada komunikasi publik, pesan kebijakan, dan pernyataan resmi yang terverifikasi.";
    case "Sovereign Layer":
      return "Fokus pada foresight strategis, mega trend, risiko nasional, dan arah kebijakan.";
    default:
      return "Fokus pada kualitas editorial, kejelasan pesan, dan kebutuhan audiens.";
  }
}

function getSectionContent({
  section,
  topic,
  layer,
  mode,
  audience,
  audienceAction,
}) {
  const perspective = getAudiencePerspective(audience);
  const layerFocus = getLayerFocus(layer);

  switch (section) {
    case "Summary":
      return `Topik "${topic}" disusun dalam format ${mode} untuk ${audience}. ${layerFocus}`;
    case "Main Content":
      return `${topic}

Materi utama perlu menjelaskan konteks, fakta kunci, dampak langsung, dan manfaat bagi audiens. Perspektif audiens:
${perspective}`;
    case "Conclusion":
      return `Kesimpulan utama harus menegaskan manfaat, arah tindak lanjut, dan pesan yang paling mudah dipahami oleh ${audience}.`;
    case "Analysis":
      return `Analisis diarahkan pada hubungan antara isu, aktor terkait, dampak layanan, serta perubahan yang perlu diantisipasi. ${layerFocus}`;
    case "Opportunities":
      return `- Peningkatan kualitas layanan dan kepercayaan publik.
- Penguatan koordinasi lintas pihak.
- Pemanfaatan data untuk pengambilan keputusan.
- Komunikasi yang lebih relevan untuk ${audience}.`;
    case "Challenges":
      return `- Kesiapan sumber daya dan infrastruktur.
- Konsistensi data, narasi, dan pelaksanaan.
- Literasi publik terhadap isu yang dibahas.
- Risiko miskomunikasi jika pesan tidak disesuaikan dengan audiens.`;
    case "Executive Summary":
      return `Isu ini perlu dipahami sebagai agenda penting yang berkaitan dengan tata kelola, komunikasi publik, dan dampak strategis bagi ${audience}.`;
    case "Stakeholders":
      return `- Pengambil kebijakan.
- Pelaksana teknis.
- Masyarakat terdampak.
- Media dan kanal komunikasi publik.
- ${audience} sebagai target utama pesan.`;
    case "Risks":
      return `- Risiko operasional jika eksekusi tidak terkoordinasi.
- Risiko reputasi jika informasi tidak akurat.
- Risiko sosial jika kebutuhan audiens tidak dipahami.
- Risiko keputusan jika data pendukung belum lengkap.`;
    case "Recommendations":
      return `${audienceAction}

Pastikan setiap rekomendasi memiliki penanggung jawab, batas waktu, indikator keberhasilan, dan kanal komunikasi resmi.`;
    case "Strategic Context":
      return `${topic}

Konteks strategis menunjukkan kebutuhan untuk menghubungkan agenda editorial dengan arah kebijakan, kesiapan institusi, dan ekspektasi ${audience}. ${layerFocus}`;
    case "Impact Analysis":
      return "Dampak utama perlu dibaca dari sisi layanan, tata kelola, kepercayaan publik, efektivitas komunikasi, dan kemampuan organisasi merespons perubahan.";
    case "Risk Matrix":
      return `High:
- Krisis kepercayaan, data tidak sinkron, atau gangguan layanan penting.

Medium:
- Keterlambatan koordinasi, pesan publik tidak konsisten, atau literasi digital rendah.

Low:
- Penyesuaian teknis, kebutuhan sosialisasi tambahan, atau revisi narasi komunikasi.`;
    case "Opportunity Matrix":
      return `High:
- Peningkatan kepercayaan publik dan percepatan layanan.

Medium:
- Kolaborasi lintas sektor dan peningkatan kualitas data.

Emerging:
- Inovasi komunikasi, pemetaan kebutuhan audiens, dan penguatan brand institusi.`;
    case "Priority Actions":
      return `${audienceAction}

Prioritaskan aksi yang paling cepat memberi dampak, mudah diukur, dan dapat dikomunikasikan secara terbuka.`;
    case "Decision Support":
      return "Keputusan yang disarankan: lanjutkan dengan pendekatan bertahap, berbasis data, terukur, dan disertai mekanisme evaluasi. Gunakan indikator dampak, risiko, biaya, dan kesiapan pelaksana sebelum eskalasi.";
    case "National Context":
      return `Topik "${topic}" dibaca sebagai bagian dari ketahanan tata kelola, kualitas layanan publik, dan kapasitas institusi dalam menjaga kepercayaan masyarakat.`;
    case "Mega Trend Analysis":
      return "Mega trend yang relevan mencakup transformasi digital, tuntutan transparansi, keamanan data, literasi publik, dan kebutuhan layanan yang semakin cepat serta personal.";
    case "Strategic Risks":
      return `- Ketimpangan akses dan literasi.
- Ketergantungan pada sistem yang belum matang.
- Lemahnya integrasi data dan koordinasi lintas unit.
- Potensi gangguan reputasi jika komunikasi publik tidak terkendali.`;
    case "Future Projection":
      return "Dalam jangka pendek, isu ini membutuhkan konsolidasi pesan dan tindakan cepat. Dalam jangka menengah, keberhasilan ditentukan oleh konsistensi eksekusi. Dalam jangka panjang, dampaknya bergantung pada tata kelola data, kepercayaan publik, dan adaptasi institusi.";
    case "Scenario Analysis":
      return `Best Case:
- Program berjalan konsisten, publik memahami manfaat, dan indikator layanan membaik.

Baseline:
- Implementasi berjalan bertahap dengan kebutuhan sosialisasi dan penguatan kapasitas.

Worst Case:
- Koordinasi lemah, narasi publik tidak terkendali, dan kepercayaan audiens menurun.`;
    case "Policy Direction":
      return "Arah kebijakan perlu menekankan keamanan data, akuntabilitas, interoperabilitas, literasi publik, serta layanan yang inklusif dan mudah diakses.";
    case "Executive Recommendation":
      return `${audienceAction}

Rekomendasi eksekutif: tetapkan prioritas, ukur dampak, komunikasikan perkembangan secara berkala, dan siapkan jalur eskalasi jika muncul risiko strategis.`;
    default:
      return `${topic}

Susun output dengan fakta yang jelas, narasi yang relevan, dan rekomendasi yang dapat ditindaklanjuti.`;
  }
}

function getAudienceSectionContent({
  section,
  topic,
  layer,
  mode,
  audience,
  audienceAction,
}) {
  const perspective = getAudiencePerspective(audience);
  const layerFocus = getLayerFocus(layer);

  switch (section) {
    case "Regional Impact":
      return "Uraikan dampak lintas kabupaten, prioritas provinsi, kebutuhan koordinasi OPD, dan manfaat langsung bagi wilayah terdampak.";
    case "Governor Decision":
      return "Keputusan gubernur perlu diarahkan pada prioritas wilayah, pembagian mandat, batas waktu eksekusi, indikator keberhasilan, dan kanal monitoring resmi.";
    case "Market Potential":
      return `Topik "${topic}" perlu dibaca dari sisi ukuran peluang, kebutuhan pasar, kesiapan infrastruktur, dan potensi pertumbuhan ekonomi daerah.`;
    case "Economic Outlook":
      return "Prospek ekonomi ditentukan oleh stabilitas regulasi, daya beli, akses layanan, kesiapan rantai pasok, serta dukungan pemerintah daerah.";
    case "Investment Risk":
      return "Risiko investasi meliputi kepastian regulasi, kesiapan lahan atau infrastruktur, risiko operasional, penerimaan publik, dan kesinambungan kebijakan.";
    case "ROI Opportunity":
      return "Peluang ROI dapat dibangun melalui efisiensi proses, pembukaan pasar baru, kemitraan lokal, insentif kebijakan, dan penggunaan data untuk mengurangi risiko.";
    case "Investment Recommendation":
      return `${audienceAction}

Rekomendasi investasi harus disertai due diligence, pemetaan risiko, estimasi manfaat ekonomi, dan rencana kolaborasi dengan pemangku kepentingan lokal.`;
    case "Headline":
      return `Pemerintah Perkuat Agenda Strategis Terkait ${topic}`;
    case "Lead":
      return `Isu ${topic} menjadi perhatian karena berkaitan dengan kepentingan publik, arah kebijakan, dan dampak langsung bagi ${audience}.`;
    case "5W+1H":
      return `What: ${topic}
Who: Pemerintah, pemangku kepentingan, dan masyarakat terdampak.
When: Sesuaikan dengan tanggal atau momentum resmi.
Where: Sesuaikan dengan lokasi kegiatan atau wilayah kebijakan.
Why: Untuk menjawab kebutuhan publik dan memperkuat tata kelola.
How: Melalui koordinasi, komunikasi resmi, dan pelaksanaan bertahap.`;
    case "News Angle":
      return "Angle berita dapat diarahkan pada dampak publik, kebaruan kebijakan, data pendukung, respons pemangku kepentingan, dan manfaat nyata.";
    case "Quote Recommendation":
      return "Siapkan kutipan resmi yang ringkas, faktual, tidak hiperbolis, dan menjelaskan manfaat kebijakan dengan bahasa publik.";
    case "Implementation Plan":
      return "Rencana implementasi perlu memuat tahapan kerja, PIC, jadwal pelaksanaan, kanal koordinasi, dan mekanisme eskalasi masalah.";
    case "SOP Impact":
      return "Dampak SOP mencakup perubahan alur layanan, standar waktu kerja, pembagian tugas, validasi data, dan dokumentasi proses.";
    case "Resource Requirements":
      return "Kebutuhan sumber daya meliputi SDM pelaksana, perangkat kerja, data pendukung, anggaran operasional, dan pelatihan teknis.";
    case "Performance Indicators":
      return "Indikator kinerja dapat mencakup waktu layanan, jumlah pekerjaan selesai, tingkat kepatuhan SOP, jumlah kendala, dan kepuasan pengguna.";
    case "Monitoring Plan":
      return "Monitoring dilakukan melalui laporan berkala, dashboard kinerja, rapat evaluasi, validasi data, dan tindak lanjut terhadap kendala lapangan.";
    case "Research Context":
      return `Topik "${topic}" dapat diteliti sebagai fenomena kebijakan, layanan publik, komunikasi institusi, atau transformasi sosial berbasis data.`;
    case "Findings":
      return "Temuan awal perlu disusun dari data faktual, pola dampak, respons pemangku kepentingan, serta kesenjangan antara kebijakan dan implementasi.";
    case "Implications":
      return "Implikasi mencakup dampak terhadap tata kelola, kualitas layanan, partisipasi publik, efektivitas kebijakan, dan arah riset lanjutan.";
    case "Research Recommendation":
      return "Rekomendasi riset: gunakan data baseline, metode evaluasi yang jelas, indikator terukur, dan ruang verifikasi bersama pemangku kepentingan.";
    case "Apa yang Terjadi":
      return `${topic}

Jelaskan peristiwa atau kebijakan utama dengan bahasa sederhana, jelas, dan tidak terlalu teknis.`;
    case "Mengapa Penting":
      return "Hal ini penting karena berkaitan dengan kebutuhan warga, kualitas layanan, keterbukaan informasi, dan kepercayaan publik.";
    case "Manfaat Bagi Warga":
      return "Manfaat bagi warga perlu dijelaskan dari sisi kemudahan akses, kecepatan layanan, kejelasan informasi, dan dampak langsung sehari-hari.";
    case "Potensi Dampak":
      return "Potensi dampak mencakup perubahan cara warga mengakses layanan, kebutuhan adaptasi, peluang partisipasi, dan risiko jika informasi tidak jelas.";
    case "Informasi Lanjutan":
      return "Sediakan kanal resmi, jadwal tindak lanjut, kontak layanan, lokasi informasi, dan imbauan agar warga memantau pengumuman resmi.";
    case "Strategic Context":
      return `${topic}

Untuk ${audience}, konteks strategis perlu menghubungkan isu dengan mandat kepemimpinan, arah kebijakan, dan prioritas keputusan. ${layerFocus}`;
    case "Risk Matrix":
      return `High:
- Risiko reputasi, koordinasi lemah, atau dampak publik meluas.

Medium:
- Keterlambatan implementasi, pesan tidak konsisten, atau data belum lengkap.

Low:
- Revisi teknis, kebutuhan sosialisasi, atau penyesuaian jadwal.`;
    case "Priority Actions":
      return `${audienceAction}

Susun aksi prioritas berdasarkan urgensi, dampak, kesiapan sumber daya, dan kemampuan monitoring.`;
    default:
      return `${perspective}

Susun bagian ini agar relevan dengan ${audience}, tetap selaras dengan ${mode}, dan mendukung fokus ${layer}.`;
  }
}

function buildAudienceSections({
  topic,
  layer,
  mode,
  audience,
  audienceAction,
}) {
  const sections = AUDIENCE_SECTIONS[audience] || [
    "Audience Context",
    "Key Message",
    "Recommended Action",
  ];

  return sections
    .map((section, index) => {
      return `${index + 1}. ${section}
${getAudienceSectionContent({
  section,
  topic,
  layer,
  mode,
  audience,
  audienceAction,
})}`;
    })
    .join("\n\n");
}

function buildComplexitySections({
  topic,
  layer,
  mode,
  audience,
  complexity,
  audienceAction,
}) {
  const sections = COMPLEXITY_SECTIONS[complexity] || COMPLEXITY_SECTIONS.Basic;

  return sections
    .map((section, index) => {
      return `${index + 1}. ${section}
${getSectionContent({
  section,
  topic,
  layer,
  mode,
  audience,
  audienceAction,
})}`;
    })
    .join("\n\n");
}

function buildEditorialDraft({ topic, layer, mode, audience, complexity }) {
  const safeTopic = topic.trim();

  if (!safeTopic) {
    return "Masukkan topik terlebih dahulu untuk membuat draft editorial.";
  }

  const header = buildHeader({ layer, mode, audience, safeTopic });
  const audienceAction = getAudienceRecommendation(audience);
  const safeComplexity = COMPLEXITY_SECTIONS[complexity] ? complexity : "Basic";

  return `${getLayerTitle(layer, mode)}

${header}

Complexity Level:
${safeComplexity}

Expected Output:
${getExpectedOutput(layer, mode, audience, safeComplexity)}

Complexity Engine Structure:
${buildComplexitySections({
  topic: safeTopic,
  layer,
  mode,
  audience,
  complexity: safeComplexity,
  audienceAction,
})}

Audience Intelligence Matrix:
${buildAudienceSections({
  topic: safeTopic,
  layer,
  mode,
  audience,
  audienceAction,
})}

Catatan Editor:
Periksa kembali nama pejabat, data angka, lokasi, tanggal, dan kutipan resmi sebelum publikasi.`;
}

function buildPlainTextExport({ confidence, draft }) {
  return `Source Confidence Assessment
Source Confidence Score: ${confidence.score}/100
Source Confidence Level: ${confidence.level}
Publication Readiness: ${confidence.publicationReadiness}

${draft}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createClientIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `newsroom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");

    if (!copied) throw new Error("Copy command failed.");
  } finally {
    textarea.remove();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export function AINewsroom() {
  const [topic, setTopic] = useState("");
  const [layer, setLayer] = useState(DEFAULT_LAYER);
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [audience, setAudience] = useState(DEFAULT_AUDIENCE);
  const [complexity, setComplexity] = useState("Strategic");
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);
  const [factGuardEnabled, setFactGuardEnabled] = useState(true);
  const [citationEngineEnabled, setCitationEngineEnabled] = useState(true);
  const [sourceConfidenceEnabled, setSourceConfidenceEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [confidence, setConfidence] = useState({
    score: 0,
    level: "INSUFFICIENT",
    publicationReadiness: "Verification Required",
  });
  const [verification, setVerification] = useState(null);
  const [editorial, setEditorial] = useState(null);
  const [generatedIntelligenceSummary, setGeneratedIntelligenceSummary] =
    useState(null);
  const [editorialReviewReport, setEditorialReviewReport] = useState(null);
  const [savedGeneration, setSavedGeneration] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    reviewStatus: "",
    search: "",
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [decisionStatus, setDecisionStatus] = useState("");
  const [isDecisionSubmitting, setIsDecisionSubmitting] = useState(false);
  const [editorNotes, setEditorNotes] = useState("");
  const [overrideBlockers, setOverrideBlockers] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const modes = INTELLIGENCE_LAYERS[layer] || [];
  const expectedOutput = useMemo(
    () => getExpectedOutput(layer, mode, audience, complexity),
    [layer, mode, audience, complexity],
  );
  const intelligenceSummaryItems = [
    { label: "Audience", value: getAudienceLabel(audience) },
    { label: "Mode", value: mode },
    { label: "Complexity", value: complexity },
    { label: "Target", value: getChannelLabel(channel) },
    { label: "Fact Guard", value: factGuardEnabled ? "Enabled" : "Disabled" },
    {
      label: "Citation Engine",
      value: citationEngineEnabled ? "Enabled" : "Disabled",
    },
    {
      label: "Source Confidence",
      value: sourceConfidenceEnabled ? "Enabled" : "Disabled",
    },
    { label: "Expected Output", value: expectedOutput },
  ];
  const intelligenceAssessment = useMemo(
    () =>
      getIntelligenceAssessment({
        layer,
        mode,
        audience,
        complexity,
        topic,
      }),
    [layer, mode, audience, complexity, topic],
  );
  const priorityEngine = useMemo(
    () => getPriorityEngine(intelligenceAssessment),
    [intelligenceAssessment],
  );
  const assessmentMetrics = [
    {
      label: "Strategic Value",
      value: intelligenceAssessment.strategicValue,
      barValue: intelligenceAssessment.strategicValue,
    },
    {
      label: "Decision Support",
      value: intelligenceAssessment.decisionSupport,
      barValue: intelligenceAssessment.decisionSupport,
    },
    {
      label: "Public Impact",
      value: intelligenceAssessment.publicImpact,
      barValue: intelligenceAssessment.publicImpact,
    },
    {
      label: "Input Readiness",
      value: intelligenceAssessment.readiness,
      barValue: intelligenceAssessment.readiness,
    },
    {
      label: "Risk Level",
      value: intelligenceAssessment.riskLevel,
      barValue: getRiskProgress(intelligenceAssessment.riskLevel),
    },
  ];
  const priorityItems = [
    {
      label: "Priority",
      value: priorityEngine.priority,
    },
    {
      label: "Action Speed",
      value: priorityEngine.actionSpeed,
    },
    {
      label: "Decision Type",
      value: priorityEngine.decisionType,
    },
    {
      label: "Escalation Level",
      value: priorityEngine.escalationLevel,
    },
  ];
  const executiveDashboardItems = [
    {
      label: "Strategic Value",
      value: intelligenceAssessment.strategicValue,
    },
    {
      label: "Decision Support",
      value: intelligenceAssessment.decisionSupport,
    },
    {
      label: "Public Impact",
      value: intelligenceAssessment.publicImpact,
    },
    {
      label: "Input Readiness",
      value: intelligenceAssessment.readiness,
    },
    {
      label: "Risk Level",
      value: intelligenceAssessment.riskLevel,
    },
    {
      label: "Source Confidence",
      value: sourceConfidenceEnabled
        ? `${confidence.score}% / ${confidence.level}`
        : "Disabled",
    },
    {
      label: "Publication Readiness",
      value: confidence.publicationReadiness,
    },
    {
      label: "Priority",
      value: priorityEngine.priority,
    },
    {
      label: "Action Speed",
      value: priorityEngine.actionSpeed,
    },
    {
      label: "Decision Type",
      value: priorityEngine.decisionType,
    },
    {
      label: "Escalation Level",
      value: priorityEngine.escalationLevel,
    },
  ];

  const wordCount = useMemo(() => {
    return draft.trim() ? draft.trim().split(/\s+/).length : 0;
  }, [draft]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory(nextFilters = historyFilters) {
    setHistoryLoading(true);

    try {
      const response = await listNewsroomHistory({
        ...nextFilters,
        limit: 12,
      });

      setHistoryItems(response.items || response.data?.items || []);
    } catch {
      setGenerationError("Gagal membaca generation history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function buildGenerationPayload({
    response,
    safeTopic,
    savedDraft = draft,
  } = {}) {
    return {
      audience,
      channel,
      complexity,
      draft: savedDraft,
      editorial: response?.editorial || editorial,
      editorialReviewReport:
        response?.editorialReviewReport || editorialReviewReport,
      intelligenceSummary:
        response?.intelligenceSummary || generatedIntelligenceSummary,
      metadata: response?.metadata || {
        audience,
        channel,
        complexity,
        mode,
        promptVersion: editorialReviewReport?.safeMetadata?.promptVersion,
      },
      mode,
      publicationReadiness:
        response?.intelligenceSummary?.publicationReadiness ||
        generatedIntelligenceSummary?.publicationReadiness ||
        confidence.publicationReadiness,
      reviewStatus:
        response?.editorial?.reviewStatus ||
        generatedIntelligenceSummary?.editorialStatus ||
        editorial?.reviewStatus,
      sourceInputSummary: safeTopic || topic,
      topic: safeTopic || topic,
      verification: response?.verification || verification,
    };
  }

  async function saveGeneratedResponse({ response, safeTopic }) {
    const nextDraft = String(response.draft || "").trim();
    const payload = buildGenerationPayload({
      response,
      safeTopic,
      savedDraft: nextDraft,
    });
    const idempotencyKey = createClientIdempotencyKey();

    setSaveStatus("Saving...");

    try {
      const saved = await saveNewsroomGeneration(payload, idempotencyKey);
      const generation = saved.generation || saved.data?.generation;

      setSavedGeneration(generation || null);
      setEditorNotes(generation?.editorNotes || "");
      setSaveStatus("Saved");
      await loadHistory();
    } catch (error) {
      setSaveStatus(error?.message || "Auto-save failed");
    }
  }

  async function handleManualSave() {
    if (!draft.trim()) return;

    setSaveStatus("Saving...");

    try {
      const saved = await saveNewsroomGeneration(
        buildGenerationPayload({ savedDraft: draft }),
        createClientIdempotencyKey(),
      );
      const generation = saved.generation || saved.data?.generation;

      setSavedGeneration(generation || null);
      setEditorNotes(generation?.editorNotes || "");
      setSaveStatus("Saved");
      await loadHistory();
    } catch (error) {
      setSaveStatus(error?.message || "Save failed");
    }
  }

  async function handleOpenHistory(item) {
    try {
      const response = await getNewsroomGeneration(item.id);
      const generation = response.generation || response.data?.generation;

      if (!generation) return;

      setSavedGeneration(generation);
      setTopic(generation.topic || "");
      setMode(generation.mode || DEFAULT_MODE);
      setAudience(generation.audience || DEFAULT_AUDIENCE);
      setComplexity(generation.complexity || "Strategic");
      setChannel(generation.channel || DEFAULT_CHANNEL);
      setDraft(generation.draft || "");
      setVerification(generation.verification || null);
      setGeneratedIntelligenceSummary(generation.intelligenceSummary || null);
      setEditorialReviewReport(generation.editorialReviewReport || null);
      setEditorial({
        reviewStatus: generation.reviewStatus,
        requiresHumanApproval: true,
      });
      setConfidence({
        score: Number(generation.verification?.sourceConfidence?.score) || 0,
        level:
          generation.verification?.sourceConfidence?.level || "INSUFFICIENT",
        publicationReadiness:
          generation.publicationReadiness ||
          generation.intelligenceSummary?.publicationReadiness ||
          "Verification Required",
      });
      setEditorNotes(generation.editorNotes || "");
      setGenerationError("");
    } catch (error) {
      setGenerationError(error?.message || "Gagal membuka history.");
    }
  }

  async function handleDeleteHistory(item) {
    if (!window.confirm("Hapus generation history ini?")) return;

    try {
      await deleteNewsroomGeneration(item.id);
      if (savedGeneration?.id === item.id) setSavedGeneration(null);
      await loadHistory();
    } catch (error) {
      setGenerationError(error?.message || "Gagal menghapus history.");
    }
  }

  async function handleDecision(decision) {
    if (!savedGeneration?.id) return;

    setIsDecisionSubmitting(true);
    setDecisionStatus("");

    try {
      const response = await submitNewsroomDecision(savedGeneration.id, {
        decision,
        notes: editorNotes,
        overrideBlockers,
        overrideReason,
      });
      const generation = response.generation || response.data?.generation;

      setSavedGeneration(generation || savedGeneration);
      setEditorial({
        reviewStatus: generation?.reviewStatus || savedGeneration.reviewStatus,
        requiresHumanApproval: true,
      });
      setDecisionStatus("Decision saved");
      setOverrideBlockers(false);
      setOverrideReason("");
      await loadHistory();
    } catch (error) {
      setDecisionStatus(error?.message || "Decision failed");
    } finally {
      setIsDecisionSubmitting(false);
    }
  }

  async function handleServerExport(type, format) {
    if (!savedGeneration?.id) {
      setExportStatus("Save generation before export.");
      return;
    }

    setExportStatus("Exporting...");

    try {
      const artifact = await exportNewsroomGeneration(savedGeneration.id, {
        format,
        type,
      });

      downloadBlob(artifact.blob, artifact.filename);
      setExportStatus("Export ready");
    } catch (error) {
      setExportStatus(error?.message || "Export failed");
    }
  }

  function handleLayerChange(event) {
    const nextLayer = event.target.value;
    const nextModes = INTELLIGENCE_LAYERS[nextLayer] || [];

    setLayer(nextLayer);
    setMode(nextModes[0] || "");
  }

  async function handleGenerate() {
    const safeTopic = String(topic || "").trim();

    if (!safeTopic) {
      setGenerationError("");
      setDraft(
        "Topik tidak boleh kosong. Silakan isi topik untuk menghasilkan draft.",
      );
      return;
    }

    if (safeTopic.length > 3000) {
      setGenerationError("");
      setDraft("Topik terlalu panjang. Batasi maksimal 3000 karakter.");
      return;
    }

    const payload = {
      input: safeTopic,
      topic: safeTopic,
      layer,
      mode,
      audience,
      complexity,
      channel,
      language: "id-ID",
      factGuard: factGuardEnabled,
      citationEngine: citationEngineEnabled,
      sourceConfidence: sourceConfidenceEnabled,
      assessment: intelligenceAssessment,
      priority: priorityEngine,
      verifiedFactsCount: 0,
      verificationItemsCount: 0,
    };

    setIsGenerating(true);
    setGenerationError("");
    setSavedGeneration(null);
    setSaveStatus("");
    setExportStatus("");
    setDecisionStatus("");

    try {
      const response = await generateIntelligenceDraft(payload);

      if (response?.success && response?.draft) {
        setDraft(String(response.draft).trim());
        setConfidence({
          score:
            Number(
              response.confidence?.source_confidence_score ??
                response.verification?.sourceConfidence?.score,
            ) || 0,
          level:
            response.confidence?.source_confidence_level ||
            response.verification?.sourceConfidence?.level ||
            "INSUFFICIENT",
          publicationReadiness:
            response.confidence?.publication_readiness ||
            response.intelligenceSummary?.publicationReadiness ||
            response.confidence?.publicationReadiness ||
            "Verification Required",
        });
        setVerification(response.verification || null);
        setEditorial(response.editorial || null);
        setGeneratedIntelligenceSummary(response.intelligenceSummary || null);
        setEditorialReviewReport(response.editorialReviewReport || null);
        await saveGeneratedResponse({ response, safeTopic });
      } else {
        throw new Error("AI response missing draft");
      }
    } catch (error) {
      if (isNewsroomLocalFallbackEnabled()) {
        const fallback = `[LOCAL DEV FALLBACK MODE]\n\n${buildEditorialDraft({
          topic: safeTopic,
          layer,
          mode,
          audience,
          complexity,
        })}`;
        setDraft(fallback);
      } else {
        setDraft("");
        setGenerationError(
          error?.message ||
            "Gagal menghasilkan draf AI Newsroom. Periksa koneksi/provider lalu coba lagi.",
        );
      }

      setConfidence({
        score: 0,
        level: "INSUFFICIENT",
        publicationReadiness: "Verification Required",
      });
      setVerification(null);
      setEditorial(null);
      setGeneratedIntelligenceSummary(null);
      setEditorialReviewReport(null);
    } finally {
      setIsGenerating(false);
    }
  }

  function getCopyPayload(type = "draft") {
    if (type === "summary") {
      return JSON.stringify(generatedIntelligenceSummary || {}, null, 2);
    }

    if (type === "review") {
      return JSON.stringify(editorialReviewReport || {}, null, 2);
    }

    if (type === "headline") {
      return draft
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean);
    }

    return draft;
  }

  async function handleCopy(type = "draft") {
    const text = getCopyPayload(type);

    if (!String(text || "").trim()) return;

    try {
      await writeClipboardText(text);
      setCopyStatus("Copied");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  }

  function handleExportTxt() {
    if (!draft.trim()) return;

    const exportText = buildPlainTextExport({ confidence, draft });

    const blob = new Blob([exportText], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `orbit-intelligence-${Date.now()}.txt`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    if (!draft.trim()) return;

    const payload = {
      generatedAt: new Date().toISOString(),
      layer,
      mode,
      audience,
      complexity,
      channel,
      assessment: intelligenceAssessment,
      priority: priorityEngine,
      confidence: {
        score: confidence.score,
        level: confidence.level,
        publicationReadiness: confidence.publicationReadiness,
      },
      editorial,
      editorialReviewReport,
      intelligenceSummary: generatedIntelligenceSummary,
      verification,
      draft,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `orbit-intelligence-${Date.now()}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!draft.trim()) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    const safeReport = escapeHtml(buildPlainTextExport({ confidence, draft }));

    printWindow.document.write(`
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <title>BLACK FLASH ORBIT Intelligence Report</title>
      </head>
      <body>
        <pre>${safeReport}</pre>
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.print();
  }

  return (
    <main className="min-h-screen bg-[#050814] px-4 py-6 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-white/[0.03] p-6 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-xl">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
            AI Newsroom
          </p>

          <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
            Cognitive News Intelligence
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            Sistem editorial tingkat lanjut untuk membuat berita, siaran pers,
            briefing eksekutif, analisis risiko, OSINT report, dan strategic
            intelligence dalam satu workflow.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[430px_1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Generator
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Cognitive Prompt Engine
                </h2>
              </div>

              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Stage 2.4 AI Guard
              </span>
            </div>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Intelligence Layer
            </label>

            <select
              value={layer}
              onChange={handleLayerChange}
              className="mb-5 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              {Object.keys(INTELLIGENCE_LAYERS).map((item) => (
                <option key={item} value={item} className="bg-[#070d1a]">
                  {item}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Cognitive Intelligence Mode
            </label>

            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="mb-5 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              {modes.map((item) => (
                <option key={item} value={item} className="bg-[#070d1a]">
                  {item}
                </option>
              ))}
            </select>

            <ChannelSelector
              options={CHANNEL_TARGETS}
              value={channel}
              onChange={setChannel}
              disabled={isGenerating}
            />

            <AudienceSelector
              options={AUDIENCES}
              value={audience}
              onChange={setAudience}
              disabled={isGenerating}
            />

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Complexity Level
            </label>

            <select
              value={complexity}
              onChange={(event) => setComplexity(event.target.value)}
              className="mb-5 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              {COMPLEXITY_LEVELS.map((item) => (
                <option key={item} value={item} className="bg-[#070d1a]">
                  {item}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Fact Guard
            </label>

            <select
              value={factGuardEnabled ? "enabled" : "disabled"}
              onChange={(event) =>
                setFactGuardEnabled(event.target.value === "enabled")
              }
              className="mb-2 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <p className="mb-5 text-xs leading-5 text-slate-500">
              Fact Guard membantu mencegah angka, kutipan, tanggal, dan klaim
              faktual palsu. Data yang belum tersedia akan ditandai perlu
              verifikasi resmi.
            </p>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Citation Engine
            </label>

            <select
              value={citationEngineEnabled ? "enabled" : "disabled"}
              onChange={(event) =>
                setCitationEngineEnabled(event.target.value === "enabled")
              }
              className="mb-2 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <p className="mb-5 text-xs leading-5 text-slate-500">
              Membantu AI mengidentifikasi sumber resmi yang perlu digunakan
              untuk verifikasi sebelum publikasi.
            </p>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Source Confidence
            </label>

            <select
              value={sourceConfidenceEnabled ? "enabled" : "disabled"}
              onChange={(event) =>
                setSourceConfidenceEnabled(event.target.value === "enabled")
              }
              className="mb-2 w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <p className="mb-5 text-xs leading-5 text-slate-500">
              Membantu menilai tingkat kepercayaan informasi berdasarkan fakta
              yang tersedia, kebutuhan verifikasi, dan kualitas sumber yang
              direkomendasikan.
            </p>

            <IntelligenceSummary items={intelligenceSummaryItems} />

            <div className="mb-5 rounded-3xl border border-white/10 bg-[#070d1a]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Intelligence Assessment
                </p>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                  Score Engine
                </span>
              </div>

              <div className="grid gap-4">
                {assessmentMetrics.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-slate-400">
                        {item.label}
                      </span>
                      <span className="font-black text-white">
                        {item.value}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.35)]"
                        style={{ width: `${item.barValue}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Overall Score
                  </span>
                  <span className="text-2xl font-black text-cyan-200">
                    {intelligenceAssessment.overallScore}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(165,243,252,0.4)]"
                    style={{
                      width: `${intelligenceAssessment.overallScore}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.08] via-[#070d1a] to-[#050814] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Intelligence Priority
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                  Priority Engine
                </span>
              </div>

              <div className="grid gap-3">
                {priorityItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <span className="text-xs font-bold text-slate-400">
                      {item.label}
                    </span>
                    <span className="text-right text-sm font-black text-cyan-100">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Topik
            </label>

            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              rows={8}
              placeholder="Contoh: Pemkab Papua Selatan memperkuat layanan publik berbasis digital..."
              className="w-full resize-none rounded-3xl border border-white/10 bg-[#070d1a] px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_30px_rgba(103,232,249,0.25)] transition hover:bg-cyan-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate Intelligence Draft"}
            </button>

            {saveStatus && (
              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-slate-300">
                {saveStatus}
              </p>
            )}

            <GenerationHistory
              activeId={savedGeneration?.id}
              filters={historyFilters}
              isLoading={historyLoading}
              items={historyItems}
              onDelete={handleDeleteHistory}
              onFiltersChange={(nextFilters) => {
                setHistoryFilters(nextFilters);
                loadHistory(nextFilters);
              }}
              onOpen={handleOpenHistory}
              onRefresh={() => loadHistory()}
            />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 rounded-3xl border border-cyan-300/20 bg-[#070d1a]/95 p-4 shadow-[0_0_36px_rgba(34,211,238,0.09)]">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                    Executive Dashboard Preview
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    This intelligence draft is classified as{" "}
                    <span className="font-black text-cyan-200">
                      {priorityEngine.priority}
                    </span>{" "}
                    priority with{" "}
                    <span className="font-black text-cyan-200">
                      {priorityEngine.actionSpeed}
                    </span>{" "}
                    response.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                  Executive View
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {executiveDashboardItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-cyan-300/15 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Output
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Intelligence Preview
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
                  {wordCount} kata
                </span>

                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={!draft.trim()}
                  className="rounded-full border border-[#f1c36f]/40 bg-[#f1c36f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1c36f] transition hover:bg-[#f1c36f] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy("draft")}
                  disabled={!draft.trim()}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy("headline")}
                  disabled={!draft.trim()}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Headline
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy("summary")}
                  disabled={!generatedIntelligenceSummary}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy Summary
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy("review")}
                  disabled={!editorialReviewReport}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy Review
                </button>

                <button
                  type="button"
                  onClick={handleExportTxt}
                  disabled={!draft.trim()}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  TXT
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={!draft.trim()}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  JSON
                </button>

                <button
                  type="button"
                  onClick={() => handleServerExport("draft", "pdf")}
                  disabled={!savedGeneration?.id}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Draft PDF
                </button>

                <button
                  type="button"
                  onClick={() => handleServerExport("draft", "docx")}
                  disabled={!savedGeneration?.id}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Draft DOCX
                </button>

                <button
                  type="button"
                  onClick={() => handleServerExport("review", "pdf")}
                  disabled={!savedGeneration?.id}
                  className="rounded-full border border-[#f1c36f]/40 bg-[#f1c36f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1c36f] transition hover:bg-[#f1c36f] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review PDF
                </button>

                <button
                  type="button"
                  onClick={() => handleServerExport("review", "docx")}
                  disabled={!savedGeneration?.id}
                  className="rounded-full border border-[#f1c36f]/40 bg-[#f1c36f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1c36f] transition hover:bg-[#f1c36f] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review DOCX
                </button>

                <button
                  type="button"
                  onClick={() => handleServerExport("review", "json")}
                  disabled={!savedGeneration?.id}
                  className="rounded-full border border-[#f1c36f]/40 bg-[#f1c36f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1c36f] transition hover:bg-[#f1c36f] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review JSON
                </button>
              </div>
            </div>

            {(copyStatus || exportStatus || decisionStatus) && (
              <p className="mb-3 text-sm font-bold text-cyan-200">
                {[copyStatus, exportStatus, decisionStatus]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            )}

            {generationError && (
              <div className="mb-3 rounded-2xl border border-[#7d1f2f]/50 bg-[#7d1f2f]/15 px-4 py-3 text-sm font-bold text-[#f1c36f]">
                {generationError}
              </div>
            )}

            <EditorialDecisionPanel
              generation={savedGeneration}
              isSubmitting={isDecisionSubmitting}
              notes={editorNotes}
              onDecision={handleDecision}
              onNotesChange={setEditorNotes}
              onOverrideBlockersChange={setOverrideBlockers}
              onOverrideReasonChange={setOverrideReason}
              overrideBlockers={overrideBlockers}
              overrideReason={overrideReason}
              summary={generatedIntelligenceSummary}
              verification={verification}
            />

            <VerificationPanel
              editorial={editorial}
              verification={verification}
            />

            <IntelligenceSummaryPanel summary={generatedIntelligenceSummary} />

            <div className="min-h-[500px] rounded-3xl border border-white/10 bg-[#070d1a] p-5">
              {draft ? (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-200">
                  {draft}
                </pre>
              ) : (
                <div className="flex min-h-[460px] items-center justify-center text-center">
                  <p className="max-w-sm text-sm leading-7 text-slate-500">
                    Hasil intelligence draft akan tampil di sini.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default AINewsroom;
