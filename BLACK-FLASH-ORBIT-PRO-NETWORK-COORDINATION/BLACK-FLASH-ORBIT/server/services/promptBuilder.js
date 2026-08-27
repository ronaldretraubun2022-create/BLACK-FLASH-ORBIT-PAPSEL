const { createPromptContract } = require("./newsroom/promptContract");
const { buildNewsroomPromptV2 } = require("./newsroom/prompts");

function sanitizeText(value) {
  return String(value || "")
    .replace(/[\x00-\x1f\x7f<>]/g, " ")
    .trim();
}

function buildNewsroomPrompt({
  topic,
  layer,
  mode,
  audience,
  complexity,
  factGuard = true,
  citationEngine = true,
  sourceConfidence = true,
}) {
  const contract = createPromptContract({
    audience,
    citationEngine,
    complexity,
    factGuard,
    layer,
    mode,
    sourceConfidence,
    topic,
  });
  const prompt = buildNewsroomPromptV2(contract);

  return `${prompt.systemPrompt}

${prompt.userPrompt}`;
}

function buildLegacyNewsroomPrompt({
  topic,
  layer,
  mode,
  audience,
  complexity,
  factGuard = true,
  citationEngine = true,
  sourceConfidence = true,
}) {
  const safeTopic = sanitizeText(topic);
  const safeLayer = sanitizeText(layer);
  const safeMode = sanitizeText(mode);
  const safeAudience = sanitizeText(audience);
  const safeComplexity = sanitizeText(complexity);
  const enableFactGuard = Boolean(factGuard);
  const enableCitationEngine = Boolean(citationEngine);

  const factGuardInstructions = enableFactGuard
    ? `
FACT GUARD RULES:
- Never invent statistics.
- Never invent percentages.
- Never invent population numbers.
- Never invent budgets.
- Never invent infrastructure metrics.
- Never invent personnel counts.
- Never invent dates unless provided.
- Never invent years, quarters, or schedule milestones unless explicitly given.
- Never invent government decisions.
- Never invent quotes.
- Do not present assumptions as facts.
- If information is unavailable, write: "Data memerlukan verifikasi resmi."
- When uncertain, state uncertainty explicitly.
- If confidence is low, automatically add the warning: "Informasi berikut memerlukan verifikasi tambahan sebelum dipublikasikan."
`
    : "";

  const timelineGuardInstructions = enableFactGuard
    ? `
TIMELINE GUARD RULES:
- Do not invent specific dates, years, quarters, or fiscal periods.
- Do not create timeline terms such as Q1, Q2, Q3, Q4, triwulan, kuartal, or semester unless the user explicitly provides them.
- Do not mention a particular year unless it is directly provided by the user.
- If the topic requires time framing, use only high-level phrases like "periode mendatang" or "di masa depan yang dekat."
- If no verified schedule exists, write: "Jadwal rinci belum tersedia dan memerlukan verifikasi resmi."
`
    : "";

  const enableSourceConfidence = Boolean(sourceConfidence);

  const citationEngineInstructions = enableCitationEngine
    ? `
CITATION ENGINE RULES:
- Never fabricate citations.
- Do not invent source titles.
- Do not invent publication years.
- Do not invent document names.
- Do not invent URLs.
- Do not claim a source was reviewed if it was not provided.
- Do not write "Siaran Pers X tahun Y" unless the exact source is provided by the user.
- Do not write "RKPD 2024" unless the exact source is provided by the user.
- Avoid overly specific, location-bound, or year-bound citations; use only generic source categories.
- If a citation would require a province, region, document year, or report number, replace it with a generic descriptive source phrase instead of fabricating details.
- Recommended Sources must be source categories only. Do not include years, document titles, URLs, or claims of review.
- If exact source was not provided by the user, write: "Sumber spesifik belum diberikan dan memerlukan verifikasi resmi."
- Allowed examples: Pemerintah Provinsi, Diskominfo, BPS, Kemendagri, Bappenas, Dokumen Resmi OPD, Portal Data Pemerintah, Siaran Pers Resmi, Peraturan Daerah, Laporan Statistik Resmi.
`
    : "";

  const sourceConfidenceInstructions = enableSourceConfidence
    ? `
SOURCE CONFIDENCE RULES:
- Do not invent evidence.
- Confidence score must be based only on available content.
- If many unknowns exist, the score should decrease.
- If verification items exceed verified facts, publication status = Verification Required.
- Clearly separate fact, analysis, and assumption.
- Never claim information is verified if it is not.
- Never fabricate evidence.
- Never generate fake references.
- Never generate fake confidence justification.
`
    : "";

  const verificationSection =
    enableFactGuard || enableCitationEngine || enableSourceConfidence
      ? `
## Verification Status
### Verified Facts
- 
### Items Requiring Verification
- 
### Recommended Sources
- 
`
      : "";

  return `Anda adalah sistem kecerdasan editorial BLACK FLASH ORBIT.

Instruksi:
- Gunakan bahasa Indonesia.
- Buat draf profesional sesuai layer, mode, audiens, dan kompleksitas.
- Sertakan ringkasan eksekutif, analisis strategis, penilaian risiko, rekomendasi, dan rencana aksi.
- Jangan membuat klaim fakta tanpa peringatan verifikasi.
- Tandai bila informasi membutuhkan validasi tambahan.
- Utamakan nada profesional, netral, dan jelas.
${enableFactGuard ? "- Saat tidak yakin, nyatakan ketidakpastian secara eksplisit." : ""}
${factGuardInstructions}
${timelineGuardInstructions}
${citationEngineInstructions}
${sourceConfidenceInstructions}
Layer: ${safeLayer}
Mode: ${safeMode}
Audiens: ${safeAudience}
Kompleksitas: ${safeComplexity}
Topik: ${safeTopic}

Tulis hasil dalam format berikut:
1. Executive Summary
2. Analisis
3. Risiko
4. Rekomendasi
5. Action Plan
${verificationSection}
${
  enableSourceConfidence
    ? `## Source Confidence Assessment
### High Confidence Areas
- 
### Medium Confidence Areas
- 
### Low Confidence Areas
- 
`
    : ""
}
${
  enableCitationEngine
    ? `## Citation Guidance
### Recommended Sources
- 
### Official Documents
- 
### Additional Verification
- 
`
    : ""
}
Catatan tambahan:
- Jaga keakuratan judul dan konteks.
- Hindari asumsi faktual tanpa verifikasi.
- Sertakan peringatan verifikasi apabila terdapat fakta yang perlu dikonfirmasi.
- Backend sudah merender Evidence Matrix, Evidence Score, Missing Evidence Recommendations, Fact Classification Table, Source Quality Matrix, dan Confidence Analysis sebelum output AI.
- Jangan tulis ulang section Evidence Matrix.
- Jangan tulis ulang section Evidence Score.
- Jangan tulis ulang section Missing Evidence Recommendations.
- Jangan tulis ulang section Fact Classification Table.
- Jangan tulis ulang section Source Quality Matrix.
- Jangan tulis ulang section Confidence Analysis.
- Mulai output AI langsung dari "Executive Summary".
- Setiap kesimpulan harus didukung evidence_found, evidence_missing, dan evidence_strength.
- Jika evidence_missing masih ada, tulis kesimpulan sebagai indikasi yang memerlukan verifikasi.
${enableFactGuard ? "- Jangan tampilkan asumsi sebagai fakta. Tandai semua asumsi secara jelas." : ""}
`;
}

module.exports = {
  buildNewsroomPrompt,
  buildLegacyNewsroomPrompt,
};
