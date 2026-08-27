const assert = require("assert");
const {
  normalizeNewsroomDraft,
  buildResponseConfidence,
  enforceAnalyticalProvenance,
  hasTemporalReference,
  classifyNewsroomFact,
  splitFactStatements,
  buildAllowedFactualClaims,
  buildEvidenceEngine,
  buildSourceQualityEngine,
  buildConfidenceEngine,
  formatEvidenceMatrix,
  formatFactClassificationTable,
  formatSourceQualityMatrix,
  formatConfidenceAnalysis,
} = require("../server/routes/newsroom.js");
const {
  normalizeOpenRouterModel,
  getOpenRouterModels,
  isValidOpenRouterModel,
} = require("../server/services/openrouter.js");
const { buildNewsroomPrompt } = require("../server/services/promptBuilder.js");
const {
  buildNewsroomPromptV2,
} = require("../server/services/newsroom/prompts/newsroomPrompt.v2.js");
const {
  createPromptContract,
} = require("../server/services/newsroom/promptContract.js");
const {
  verifyNewsroomDraft,
} = require("../server/services/newsroom/verification");

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

runTest(
  "normalizeNewsroomDraft blocks Q1/Q2/Q3/Q4 when no topic time info",
  () => {
    const draft = "Rencana dimulai pada Q1 dan Q2 dengan laporan kuartal.";
    const normalized = normalizeNewsroomDraft(draft, false);
    assert(!/\bQ[1-4]\b/.test(normalized), "Q1/Q2/Q3/Q4 should be removed");
    assert(!/\bkuartal\b/i.test(normalized), "kuartal should be removed");
    assert(!/\btriwulan\b/i.test(normalized), "triwulan should be removed");
    assert(
      !/\b2025\b/.test(normalized),
      "year 2025 should be removed where topic has no time info",
    );
    assert(
      /Catatan: Rincian waktu/.test(normalized),
      "should append timeline validation note",
    );
  },
);

runTest(
  "normalizeNewsroomDraft keeps year/quarter if topic includes time info",
  () => {
    const draft = "Target akan dicapai pada Q3 2025.";
    const normalized = normalizeNewsroomDraft(draft, true);
    assert(
      /\bQ3\b/.test(normalized),
      "Q3 should be kept when user topic includes time info",
    );
    assert(
      /\b2025\b/.test(normalized),
      "year should be kept when user topic includes time info",
    );
    assert(
      !/Catatan: Rincian waktu/.test(normalized),
      "should not append validation note when time info is provided",
    );
  },
);

runTest(
  "normalizeNewsroomDraft rewrites specific citations to generic forms",
  () => {
    const draft = `Analisis didasarkan pada RKPD 2025 Papua Selatan dan RPJMD 2024 Papua Selatan.
  Sumber lain: Diskominfo Papua Selatan, BPS Papua Selatan.`;
    const normalized = normalizeNewsroomDraft(draft, false);
    assert(
      /Dokumen RPJMD\/RKPD/.test(normalized),
      "RKPD/RPJMD citations should normalize to Dokumen RPJMD/RKPD",
    );
    assert(
      /\bDiskominfo\b/.test(normalized),
      "Diskominfo citation should normalize to Diskominfo",
    );
    assert(/\bBPS\b/.test(normalized), "BPS citation should normalize to BPS");
  },
);

runTest(
  "normalizeNewsroomDraft blocks province suffixes and planning document titles",
  () => {
    const draft = `Sumber: Diskominfo Provinsi, Dokumen perencanaan daerah (RPJMD, Renstra OPD), RPJMD, Renstra OPD.
  Referensi tambahan: Pemerintah Provinsi Papua Selatan dan Laporan Statistik 2025.`;
    const normalized = normalizeNewsroomDraft(draft, false);

    assert(
      !/Diskominfo\s+Provinsi/i.test(normalized),
      "Diskominfo province suffix should be removed",
    );
    assert(
      !/Dokumen perencanaan daerah/i.test(normalized),
      "planning document title should be removed",
    );
    assert(
      !/\bRPJMD,\s*Renstra OPD\b/i.test(normalized),
      "RPJMD/Renstra list should be replaced",
    );
    assert(
      !/Papua\s+Selatan/i.test(normalized),
      "region suffix should be removed from citation labels",
    );
    assert(
      /Dokumen RPJMD\/RKPD/.test(normalized),
      "RPJMD/RKPD should map to the allowed generic label",
    );
    assert(
      /Dokumen Resmi OPD/.test(normalized),
      "Renstra OPD should map to the allowed generic OPD label",
    );
    assert(/\bDiskominfo\b/.test(normalized), "Diskominfo should remain");
    assert(
      /Pemerintah Provinsi/.test(normalized),
      "government province source should be generic",
    );
    assert(
      /Laporan Statistik Resmi/.test(normalized),
      "statistics source should be generic",
    );
  },
);

runTest(
  "enforceAnalyticalProvenance labels every analytical paragraph and list item",
  () => {
    const draft = `### Executive Summary
Pemerintah melakukan simulasi portal.

### Analisis
Simulasi ini menunjukkan peningkatan akses digital.
AI_INFERENCE: Kalimat ini sudah memiliki label.

### Risiko
1. **Keamanan Data:** Portal berisiko terhadap pelanggaran data.
2. Kesiapan masyarakat dapat memengaruhi penggunaan portal.

### Rekomendasi
- Pemerintah perlu melakukan sosialisasi.

### Action Plan
1. Koordinasi dengan OPD terkait.

### Verification Status
Informasi masih memerlukan verifikasi resmi.`;

    const normalized = enforceAnalyticalProvenance(draft);

    assert(
      normalized.includes(
        "AI_INFERENCE: Simulasi ini menunjukkan peningkatan akses digital.",
      ),
    );
    assert.strictEqual(
      (normalized.match(/AI_INFERENCE: Kalimat ini sudah memiliki label\./g) || [])
        .length,
      1,
      "existing inference label must not be duplicated",
    );
    assert(
      normalized.includes(
        "1. ASSUMPTION: **Keamanan Data:** Portal berisiko terhadap pelanggaran data.",
      ),
    );
    assert(
      normalized.includes(
        "2. ASSUMPTION: Kesiapan masyarakat dapat memengaruhi penggunaan portal.",
      ),
    );
    assert(
      normalized.includes(
        "- AI_INFERENCE: Pemerintah perlu melakukan sosialisasi.",
      ),
    );
    assert(
      normalized.includes("1. AI_INFERENCE: Koordinasi dengan OPD terkait."),
    );
    assert(
      normalized.includes(
        "### Verification Status\nInformasi masih memerlukan verifikasi resmi.",
      ),
      "non-analytical verification section must remain unlabeled",
    );
  },
);

runTest(
  "enforceAnalyticalProvenance supports plain output section headings",
  () => {
    const draft = `Executive Summary
Fakta input tetap tanpa label.

Analisis
Kalimat analitis tanpa sumber.

Risiko
1. Risiko keamanan data.

Rekomendasi
Lakukan verifikasi lanjutan.

Action Plan
1. Koordinasi dengan OPD.

Verification Status
Data memerlukan verifikasi resmi.`;

    const normalized = enforceAnalyticalProvenance(draft);

    assert(
      normalized.includes("AI_INFERENCE: Kalimat analitis tanpa sumber."),
    );
    assert(
      normalized.includes("1. ASSUMPTION: Risiko keamanan data."),
    );
    assert(
      normalized.includes("AI_INFERENCE: Lakukan verifikasi lanjutan."),
    );
    assert(
      normalized.includes("1. AI_INFERENCE: Koordinasi dengan OPD."),
    );
    assert(
      normalized.includes(
        "Verification Status\nData memerlukan verifikasi resmi.",
      ),
      "plain non-analytical section must reset provenance",
    );
    assert(
      !normalized.includes(
        "AI_INFERENCE: Data memerlukan verifikasi resmi.",
      ),
      "verification text must not inherit Action Plan provenance",
    );
  },
);

runTest(
  "labeled analytical allegation does not create serious-allegation blocker",
  () => {
    const result = verifyNewsroomDraft({
      draft:
        "### Risiko\nASSUMPTION: Tanpa sistem keamanan yang kuat, portal berisiko terhadap pelanggaran data dan privasi pengguna.",
      sourceText: "",
      sources: [],
    });

    const allegation = result.claims.find(
      (claim) => claim.type === "ALLEGATION",
    );

    assert(allegation, "allegation-like analytical sentence should be detected");
    assert.strictEqual(allegation.provenance, "ASSUMPTION");
    assert.strictEqual(allegation.status, "NOT_VERIFIABLE");
    assert(
      !result.publicationBlockers.some(
        (blocker) => blocker.code === "UNSUPPORTED_SERIOUS_ALLEGATION",
      ),
      "labeled analytical hypothesis must not create serious allegation blocker",
    );
    assert(
      !result.publicationBlockers.some(
        (blocker) => blocker.code === "CRITICAL_CITATION_MISSING",
      ),
      "labeled analytical hypothesis must not create critical citation blocker",
    );
  },
);

runTest(
  "unlabeled serious allegation still requires evidence",
  () => {
    const result = verifyNewsroomDraft({
      draft:
        "Portal pemerintah mengalami pelanggaran data yang merugikan pengguna.",
      sourceText: "",
      sources: [],
    });

    assert(
      result.publicationBlockers.some(
        (blocker) => blocker.code === "UNSUPPORTED_SERIOUS_ALLEGATION",
      ),
      "unlabeled serious allegation must remain blocked",
    );
  },
);

runTest(
  "buildResponseConfidence separates input readiness from source confidence",
  () => {
    const result = buildResponseConfidence({
      legacyConfidenceScore: 65,
      verification: {
        sourceConfidence: { score: 0, level: "INSUFFICIENT" },
      },
      confidenceAnalysis: {
        confidence_score: 22,
        confidence_level: "VERY LOW",
        confidence_breakdown: { evidence_score: 0 },
        confidence_explanation: "Evidence-aware confidence.",
      },
      editorial: {
        confidence: { score: 8, level: "INSUFFICIENT" },
      },
      intelligenceSummary: { publicationReadiness: "BLOCKED" },
    });

    assert.strictEqual(result.score, 65);
    assert.strictEqual(result.input_readiness_score, 65);
    assert.strictEqual(result.source_confidence_score, 0);
    assert.strictEqual(result.source_confidence_level, "INSUFFICIENT");
    assert.strictEqual(result.confidence_score, 22);
    assert.strictEqual(result.publication_readiness, "BLOCKED");
  },
);

runTest(
  "AI Newsroom dashboard uses evidence-aware source confidence fields",
  () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../apps/web/src/pages/AINewsroom.jsx"),
      "utf8",
    );

    assert(source.includes('label: "Input Readiness"'));
    assert(source.includes("source_confidence_score"));
    assert(source.includes("source_confidence_level"));
    assert(source.includes('label: "Publication Readiness"'));
    assert(
      !source.includes("score: Number(response.confidence?.score) || 0"),
      "dashboard must not map legacy assessment score to Source Confidence",
    );
  },
);

runTest("classifyNewsroomFact marks user-provided topic as USER_INPUT", () => {
  const statement = "Papua Selatan menyiapkan program layanan publik terpadu";
  const result = classifyNewsroomFact(statement, {
    topic: statement,
    userInput: true,
  });

  assert.strictEqual(result.classification, "USER_INPUT");
  assert.strictEqual(result.verification_needed, true);
  assert(Array.isArray(result.recommended_sources));
});

runTest(
  "splitFactStatements excludes writing instructions and list numbering",
  () => {
    const input = `SIMULASI INTERNAL — JANGAN DIPUBLIKASIKAN.

Pemerintah Provinsi Papua Selatan pada 16 Agustus 2026 melakukan simulasi peluncuran Portal Layanan Publik Digital Papua Selatan.

Dalam skenario uji ini, portal dirancang untuk membantu masyarakat:
- memperoleh informasi layanan pemerintahan;
- memantau status pelayanan;
- menemukan kontak OPD terkait dalam satu platform.

Buat artikel berita uji internal dengan gaya jurnalistik yang jelas.
Ketentuan:
1. Jangan menambahkan angka yang tidak diberikan.
2. Jangan membuat kutipan pejabat.
3. Bedakan fakta input, asumsi, dan rekomendasi.
4. Tandai informasi yang masih membutuhkan verifikasi.
5. Gunakan struktur berita yang jelas.
6. Jika sumber resmi belum tersedia, tuliskan bahwa informasi masih memerlukan konfirmasi.`;

    const statements = splitFactStatements(input);

    assert(
      statements.some((item) =>
        item.includes("Pemerintah Provinsi Papua Selatan pada 16 Agustus 2026"),
      ),
      "main user-supplied claim must remain",
    );
    assert(
      statements.includes("memperoleh informasi layanan pemerintahan"),
      "factual portal capability must remain",
    );
    assert(
      statements.includes("memantau status pelayanan"),
      "factual portal capability must remain",
    );
    assert(
      statements.includes("menemukan kontak OPD terkait dalam satu platform"),
      "factual portal capability must remain",
    );

    const joined = statements.join("\n");
    assert(!/Buat artikel/i.test(joined));
    assert(!/Ketentuan/i.test(joined));
    assert(!/Jangan menambahkan/i.test(joined));
    assert(!/Jangan membuat/i.test(joined));
    assert(!/Bedakan fakta/i.test(joined));
    assert(!/Tandai informasi/i.test(joined));
    assert(!/Gunakan struktur/i.test(joined));
    assert(!/Jika sumber resmi/i.test(joined));
    assert(!/^\d+$/m.test(joined));
    assert(!/JANGAN DIPUBLIKASIKAN/i.test(joined));
  },
);

runTest(
  "buildAllowedFactualClaims excludes inference and assumption classifications",
  () => {
    const facts = [
      {
        statement:
          "Pemerintah Provinsi melakukan simulasi portal layanan publik",
        classification: "USER_INPUT",
      },
      {
        statement: "Portal ini akan meningkatkan transparansi",
        classification: "ASSUMPTION",
      },
      {
        statement: "Pemerintah sebaiknya menambah fitur real-time",
        classification: "INFERENCE",
      },
      {
        statement: "Anggaran program Rp3 miliar",
        classification: "UNVERIFIED",
      },
    ];

    const allowed = buildAllowedFactualClaims(facts);

    assert(
      allowed.includes(
        "Pemerintah Provinsi melakukan simulasi portal layanan publik",
      ),
    );
    assert(allowed.includes("Anggaran program Rp3 miliar"));
    assert(!allowed.includes("Portal ini akan meningkatkan transparansi"));
    assert(!allowed.includes("Pemerintah sebaiknya menambah fitur real-time"));
  },
);

runTest("classifyNewsroomFact marks unsourced numbers as UNVERIFIED", () => {
  const result = classifyNewsroomFact(
    "Papua Selatan memperoleh penghargaan Rp3 miliar",
    { userInput: true },
  );

  assert.strictEqual(result.classification, "UNVERIFIED");
  assert.strictEqual(result.verification_needed, true);
  assert(result.confidence < 60);
});

runTest("classifyNewsroomFact marks recommendations as INFERENCE", () => {
  const result = classifyNewsroomFact(
    "Pemerintah perlu memperkuat kanal layanan publik digital",
  );

  assert.strictEqual(result.classification, "INFERENCE");
  assert.strictEqual(result.verification_needed, true);
});

runTest(
  "classifyNewsroomFact marks predicted impacts as ASSUMPTION or INFERENCE",
  () => {
    const result = classifyNewsroomFact(
      "Program ini diprediksi akan meningkatkan ekonomi daerah",
    );

    assert(
      ["ASSUMPTION", "INFERENCE"].includes(result.classification),
      "predicted impact should not be FACT",
    );
    assert.strictEqual(result.verification_needed, true);
  },
);

runTest("classifyNewsroomFact marks official institution claims as OFFICIAL_CLAIM", () => {
  const result = classifyNewsroomFact(
    "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
  );

  assert.strictEqual(result.classification, "OFFICIAL_CLAIM");
  assert.strictEqual(result.verification_needed, true);
  assert(result.recommended_sources.includes("Kemendagri"));
});

runTest("formatFactClassificationTable renders required output section", () => {
  const result = classifyNewsroomFact(
    "Papua Selatan memperoleh penghargaan Rp3 miliar",
  );
  const table = formatFactClassificationTable([result]);

  assert(table.includes("## Fact Classification Table"));
  assert(table.includes("| Statement | Type | Confidence | Verification | Sources |"));
  assert(table.includes("| Papua Selatan memperoleh penghargaan Rp3 miliar |"));
});

runTest("formatEvidenceMatrix renders Evidence Matrix", () => {
  const fact = classifyNewsroomFact(
    "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
  );
  const evidence = buildEvidenceEngine([fact], {
    sources: [{ label: "Kemendagri", type: "official_statement" }],
  });
  const matrix = formatEvidenceMatrix(evidence);

  assert(matrix.includes("## Evidence Matrix"));
  assert(
    matrix.includes(
      "| Statement | evidence_found | evidence_missing | evidence_strength | Evidence Score |",
    ),
  );
  assert(matrix.includes("Official Statement"));
});

runTest("formatEvidenceMatrix renders Evidence Score", () => {
  const fact = classifyNewsroomFact(
    "Menurut BPS, angka kemiskinan turun 2 persen berdasarkan data statistik",
  );
  const evidence = buildEvidenceEngine([fact]);
  const matrix = formatEvidenceMatrix(evidence);

  assert(matrix.includes("## Evidence Score"));
  assert(/Overall Evidence Score: \d+%/.test(matrix));
});

runTest("formatEvidenceMatrix renders Missing Evidence recommendations", () => {
  const fact = classifyNewsroomFact(
    "Papua Selatan memperoleh penghargaan Rp3 miliar",
  );
  const evidence = buildEvidenceEngine([fact]);
  const matrix = formatEvidenceMatrix(evidence);

  assert(matrix.includes("## Missing Evidence Recommendations"));
  assert(evidence.evidence_missing.includes("Official Document"));
  assert(evidence.evidence_missing.includes("Statistical Data"));
  assert(matrix.includes("Tambahkan dokumen resmi"));
});

runTest(
  "buildNewsroomPrompt starts AI output at Executive Summary only",
  () => {
    const prompt = buildNewsroomPrompt({
      topic: "Papua Selatan memperoleh penghargaan Rp3 miliar",
      layer: "Strategic",
      mode: "Analysis",
      audience: "Editor",
      complexity: "High",
      evidenceMatrix: "## Evidence Matrix\nbackend-rendered",
      factClassificationTable: "## Fact Classification Table\nbackend-rendered",
    });

    assert(
      prompt.includes("1. Executive Summary"),
      "prompt output format must start from Executive Summary",
    );
    assert(
      !prompt.includes("1. Evidence Matrix"),
      "prompt must not ask AI to regenerate Evidence Matrix",
    );
    assert(
      !prompt.includes("Evidence Matrix awal:"),
      "prompt must not include backend Evidence Matrix for regeneration",
    );
    assert(
      !prompt.includes("Fact Classification Table awal:"),
      "prompt must not include backend Fact Classification Table for regeneration",
    );
    assert(
      prompt.includes("Jangan tulis ulang section Source Quality Matrix."),
      "prompt must forbid duplicated Source Quality Matrix output",
    );
    assert(
      prompt.includes("Jangan tulis ulang section Confidence Analysis."),
      "prompt must forbid duplicated Confidence Analysis output",
    );
  },
);

runTest(
  "buildNewsroomPrompt forbids unsupported detail expansion",
  () => {
    const prompt = buildNewsroomPrompt({
      topic:
        "Pemerintah Provinsi Papua Selatan pada 16 Agustus 2026 melakukan simulasi portal layanan publik.",
      layer: "Editorial Layer",
      mode: "Artikel Berita",
      audience: "GENERAL_PUBLIC",
      complexity: "Strategic",
      factGuard: true,
    });

    assert(
      prompt.includes("Writing instructions guide format only"),
      "prompt must separate writing instructions from factual claims",
    );
    assert(
      prompt.includes("USER_SUPPLIED_CLAIM"),
      "prompt must preserve provenance of unverified user claims",
    );
    assert(
      prompt.includes("do not add specific examples"),
      "prompt must forbid unsupported detail expansion",
    );
    assert(
      prompt.includes("do not silently turn \"melakukan\" into \"merencanakan\""),
      "prompt must preserve claim status and tense",
    );
    assert(
      prompt.includes("AI_INFERENCE or ASSUMPTION"),
      "unsupported analysis must be explicitly labeled",
    );
  },
);

runTest(
  "buildNewsroomPromptV2 injects backend strict factual whitelist",
  () => {
    const contract = createPromptContract({
      topic:
        "Pemerintah Provinsi Papua Selatan melakukan simulasi portal layanan publik.",
      layer: "Editorial Layer",
      mode: "Artikel Berita",
      audience: "GENERAL_PUBLIC",
      complexity: "Strategic",
      channel: "ARTICLE",
      factGuard: true,
    });
    const allowedFactualClaims = [
      "Pemerintah Provinsi Papua Selatan melakukan simulasi portal layanan publik",
      "Portal dirancang untuk membantu masyarakat memantau status pelayanan",
    ];

    const prompt = buildNewsroomPromptV2(contract, {
      allowedFactualClaims,
    });

    assert(
      prompt.systemPrompt.includes("STRICT FACTUAL WHITELIST POLICY"),
      "system prompt must define strict whitelist behavior",
    );
    assert(
      prompt.userPrompt.includes("<<<ALLOWED_FACTUAL_CLAIMS_BEGIN"),
      "user prompt must contain a delimited whitelist data block",
    );
    assert(
      prompt.userPrompt.includes(allowedFactualClaims[0]),
      "first allowed claim must be present",
    );
    assert(
      prompt.userPrompt.includes(allowedFactualClaims[1]),
      "second allowed claim must be present",
    );
    assert(
      prompt.systemPrompt.includes('prefix the sentence with exactly "AI_INFERENCE:" or "ASSUMPTION:"'),
      "unsupported analysis must require explicit provenance labels",
    );
    assert(
      prompt.systemPrompt.includes("real-time capability"),
      "known unsupported detail expansions must be explicitly guarded",
    );
  },
);

runTest("formatSourceQualityMatrix renders Source Quality Matrix", () => {
  const fact = classifyNewsroomFact(
    "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
  );
  const evidence = buildEvidenceEngine([fact]);
  const sourceQuality = buildSourceQualityEngine([fact], evidence);
  const matrix = formatSourceQualityMatrix(sourceQuality);

  assert(matrix.includes("## Source Quality Matrix"));
  assert(matrix.includes("| Source | Trust Level | Source Quality Score |"));
  assert(/Overall Source Quality Score: \d+%/.test(matrix));
});

runTest("buildSourceQualityEngine scores official source high", () => {
  const fact = classifyNewsroomFact(
    "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
  );
  const sources = [{ label: "Kemendagri", type: "official_statement" }];
  const evidence = buildEvidenceEngine([fact], { sources });
  const sourceQuality = buildSourceQualityEngine([fact], evidence, sources);

  assert(sourceQuality.source_quality_score >= 90);
  assert.strictEqual(sourceQuality.source_quality_level, "HIGH");
});

runTest("buildSourceQualityEngine scores user input only low", () => {
  const fact = classifyNewsroomFact("Warga menyebut layanan publik membaik", {
    topic: "Warga menyebut layanan publik membaik",
    userInput: true,
  });
  const evidence = buildEvidenceEngine([fact], { userInput: true });
  const sourceQuality = buildSourceQualityEngine([fact], evidence);

  assert(sourceQuality.source_quality_score <= 20);
  assert.strictEqual(sourceQuality.source_quality_level, "LOW");
});

runTest("buildSourceQualityEngine scores social media low", () => {
  const fact = classifyNewsroomFact("Unggahan Facebook menyebut antrean layanan panjang");
  const evidence = buildEvidenceEngine([fact]);
  const sourceQuality = buildSourceQualityEngine([fact], evidence);

  assert(sourceQuality.source_quality_score <= 35);
  assert.strictEqual(sourceQuality.source_quality_level, "LOW");
});

runTest(
  "buildSourceQualityEngine does not treat recommended sources as supplied evidence",
  () => {
    const fact = classifyNewsroomFact(
      "Pemerintah Provinsi melakukan simulasi layanan digital",
      {
        topic: "Pemerintah Provinsi melakukan simulasi layanan digital",
        userInput: true,
      },
    );
    const evidence = buildEvidenceEngine([fact], { userInput: true });
    const sourceQuality = buildSourceQualityEngine([fact], evidence);
    const sourceNames = sourceQuality.source_quality_items.map(
      (item) => item.source,
    );

    assert(sourceQuality.source_quality_score <= 20);
    assert.strictEqual(sourceQuality.source_quality_level, "LOW");
    assert(!sourceNames.includes("BPS"));
    assert(!sourceNames.includes("Kemendagri"));
    assert(!sourceNames.includes("Pemerintah Provinsi"));
  },
);

runTest(
  "claim wording alone does not count as supplied official evidence",
  () => {
    const fact = classifyNewsroomFact(
      "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
    );
    const evidence = buildEvidenceEngine([fact]);
    const evidenceTypes = evidence.items.flatMap(
      (item) => item.evidence_found || [],
    );

    assert(!evidenceTypes.includes("Official Document"));
    assert(!evidenceTypes.includes("Official Statement"));
    assert(!evidenceTypes.includes("Government Website"));
    assert(!evidenceTypes.includes("Statistical Data"));
  },
);

runTest("formatConfidenceAnalysis renders Confidence Analysis", () => {
  const fact = classifyNewsroomFact(
    "Menurut BPS dan Kemendagri, angka kemiskinan turun 2 persen berdasarkan data statistik pada portal bps.go.id",
  );
  const evidence = buildEvidenceEngine([fact]);
  const sourceQuality = buildSourceQualityEngine([fact], evidence);
  const confidence = buildConfidenceEngine({
    evidence,
    sourceQuality,
    factClassifications: [fact],
  });
  const section = formatConfidenceAnalysis(confidence);

  assert(section.includes("## Confidence Analysis"));
  assert(section.includes("Overall Confidence Score:"));
  assert(section.includes("Confidence Level:"));
  assert(section.includes("### Confidence Explanation"));
});

runTest("buildConfidenceEngine scores official sources as high confidence", () => {
  const fact = classifyNewsroomFact(
    "Menurut BPS dan Kemendagri, angka kemiskinan turun 2 persen berdasarkan data statistik pada portal bps.go.id",
  );
  const sources = [
    { label: "Dokumen Resmi BPS", type: "official_document" },
    { label: "bps.go.id", type: "government_website" },
    { label: "Kemendagri", type: "official_statement" },
  ];
  const evidence = buildEvidenceEngine([fact], { sources });
  const sourceQuality = buildSourceQualityEngine([fact], evidence, sources);
  const confidence = buildConfidenceEngine({
    evidence,
    sourceQuality,
    factClassifications: [fact],
  });

  assert(confidence.confidence_score >= 75);
  assert(["HIGH", "VERY HIGH"].includes(confidence.confidence_level));
});

runTest("buildConfidenceEngine scores user input only as low confidence", () => {
  const fact = classifyNewsroomFact("Warga menyebut layanan publik membaik", {
    topic: "Warga menyebut layanan publik membaik",
    userInput: true,
  });
  const evidence = buildEvidenceEngine([fact], { userInput: true });
  const sourceQuality = buildSourceQualityEngine([fact], evidence);
  const confidence = buildConfidenceEngine({
    evidence,
    sourceQuality,
    factClassifications: [fact],
  });

  assert(confidence.confidence_score < 60);
  assert(["LOW", "VERY LOW"].includes(confidence.confidence_level));
});

runTest("buildConfidenceEngine calculates mixed source confidence", () => {
  const facts = [
    classifyNewsroomFact(
      "Menurut Kemendagri, Papua Selatan memperoleh penghargaan Rp3 miliar",
    ),
    classifyNewsroomFact(
      "Program ini diprediksi akan meningkatkan ekonomi daerah",
    ),
    classifyNewsroomFact("Unggahan Facebook menyebut antrean layanan panjang"),
  ];
  const evidence = buildEvidenceEngine(facts);
  const sourceQuality = buildSourceQualityEngine(facts, evidence);
  const confidence = buildConfidenceEngine({
    evidence,
    sourceQuality,
    factClassifications: facts,
  });
  const breakdown = confidence.confidence_breakdown;
  const expectedScore = Math.round(
    breakdown.evidence_score * 0.4 +
      breakdown.source_quality_score * 0.3 +
      breakdown.fact_classification_score * 0.2 +
      breakdown.verification_score * 0.1,
  );

  assert.strictEqual(confidence.confidence_score, expectedScore);
  assert(confidence.confidence_score > 0);
  assert(confidence.confidence_score < 100);
});

runTest("normalizeOpenRouterModel skips null and empty values", () => {
  assert.strictEqual(normalizeOpenRouterModel(null), "");
  assert.strictEqual(normalizeOpenRouterModel(undefined), "");
  assert.strictEqual(normalizeOpenRouterModel(""), "");
  assert.strictEqual(normalizeOpenRouterModel("null"), "");
  assert.strictEqual(normalizeOpenRouterModel("undefined"), "");
});

runTest("isValidOpenRouterModel rejects :free variants and duplicates", () => {
  assert.strictEqual(isValidOpenRouterModel("openrouter/auto"), true);
  assert.strictEqual(
    isValidOpenRouterModel("qwen/qwen3-235b-a22b:free"),
    false,
  );
  assert.strictEqual(
    isValidOpenRouterModel(" qwen/qwen3-235b-a22b:free "),
    false,
  );
});

runTest(
  "getOpenRouterModels returns safe default and removes invalid fallback",
  () => {
    const original = process.env.OPENROUTER_MODEL;
    process.env.OPENROUTER_MODEL = "null";
    try {
      const models = getOpenRouterModels();
      assert(Array.isArray(models), "models should be an array");
      assert.strictEqual(
        models[0],
        "deepseek/deepseek-chat",
        "default model should be used when configured model is invalid",
      );
      assert(
        !models.some((m) => /:free\b/.test(m)),
        "no :free variant should remain in the model list",
      );
    } finally {
      process.env.OPENROUTER_MODEL = original;
    }
  },
);

if (process.exitCode === 1) {
  process.exit(1);
}
