export const knowledgeReleaseState = [
  { label: "Module", value: "knowledge-base", tone: "text-amber-300" },
  { label: "Version", value: "v3.0", tone: "text-white" },
  { label: "Mode", value: "rag-api", tone: "text-emerald-300" },
];

export const knowledgeCollections = [
  { id: "all", label: "All Knowledge", countLabel: "5 docs" },
  { id: "papua-selatan", label: "Papua Selatan", countLabel: "1 doc" },
  { id: "interview", label: "Interview Bank", countLabel: "1 doc" },
  { id: "verification", label: "Fact Check", countLabel: "1 doc" },
  { id: "multimedia", label: "Multimedia", countLabel: "1 doc" },
  { id: "newsroom", label: "Newsroom SOP", countLabel: "1 doc" },
];

export const knowledgeDocuments = [
  {
    id: "doc-papua-development",
    collectionId: "papua-selatan",
    title: "Profil Pembangunan Papua Selatan 2026",
    source: "Editorial Research Desk",
    type: "Policy Brief",
    status: "Verified",
    confidence: 94,
    updatedAt: "05 Jul 2026, 10:12 WIT",
    pages: 18,
    tokens: "8.2K",
    owner: "Papua Selatan Desk",
    favorite: true,
    tags: ["infrastruktur", "pemerintahan", "regional"],
    summary:
      "Ringkasan program pembangunan, agenda pelayanan publik, dan peta isu prioritas untuk paket berita daerah.",
    excerpt:
      "Dokumen ini memetakan prioritas pembangunan Papua Selatan dengan fokus layanan dasar, infrastruktur penghubung, dan kesiapan data lapangan untuk kebutuhan liputan redaksi.",
    contextChunks: [
      "Prioritas liputan: layanan dasar, akses distrik, dampak ekonomi warga.",
      "Gunakan framing jurnalistik berbasis data dan kutipan pejabat terverifikasi.",
      "Hindari klaim angka tanpa sumber primer atau dokumen pendukung.",
    ],
    citations: [
      {
        id: "cit-bps",
        label: "BPS Papua Selatan",
        locator: "Tabel ringkas wilayah, p. 4",
        quote:
          "Data wilayah menjadi dasar pembanding untuk konteks pembangunan lintas kabupaten.",
        reliability: "High",
      },
      {
        id: "cit-agenda",
        label: "Agenda Pemprov",
        locator: "Catatan rapat redaksi, p. 11",
        quote:
          "Agenda pelayanan publik diprioritaskan untuk berita dampak warga.",
        reliability: "Medium",
      },
    ],
  },
  {
    id: "doc-interview-merauke",
    collectionId: "interview",
    title: "Transkrip Wawancara Bupati Merauke",
    source: "Audio Intake Lapangan",
    type: "Transcript",
    status: "Needs Review",
    confidence: 88,
    updatedAt: "05 Jul 2026, 09:40 WIT",
    pages: 9,
    tokens: "5.4K",
    owner: "Interview Producer",
    favorite: false,
    tags: ["transkrip", "kutipan", "narasumber"],
    summary:
      "Transkrip wawancara tentang agenda pelayanan publik dan prioritas komunikasi pemerintah daerah.",
    excerpt:
      "Materi transkrip siap menjadi bank kutipan, namun beberapa bagian audio perlu diverifikasi ulang sebelum masuk naskah utama.",
    contextChunks: [
      "Kutipan prioritas: pelayanan publik, koordinasi distrik, respons warga.",
      "Tandai segmen menit 07:12 sampai 09:08 sebagai perlu validasi audio.",
      "Gunakan atribusi lengkap saat mengutip narasumber.",
    ],
    citations: [
      {
        id: "cit-audio",
        label: "Audio wawancara",
        locator: "00:07:12-00:09:08",
        quote:
          "Bagian audio ini menjadi kandidat kutipan, tetapi perlu pemeriksaan ulang.",
        reliability: "Medium",
      },
      {
        id: "cit-notes",
        label: "Catatan produser",
        locator: "Field note, p. 2",
        quote:
          "Produser menandai konteks pertanyaan lanjutan untuk menjaga akurasi.",
        reliability: "High",
      },
    ],
  },
  {
    id: "doc-election-factcheck",
    collectionId: "verification",
    title: "Pedoman Fact Check Isu Pemilu Daerah",
    source: "Verification Desk",
    type: "Checklist",
    status: "Verified",
    confidence: 97,
    updatedAt: "04 Jul 2026, 17:35 WIT",
    pages: 12,
    tokens: "6.1K",
    owner: "Fact Check Lead",
    favorite: true,
    tags: ["verifikasi", "pemilu", "klaim publik"],
    summary:
      "Panduan validasi klaim, sumber pembanding, dan struktur catatan bukti untuk isu pemilu daerah.",
    excerpt:
      "Setiap klaim publik harus dipisah dari opini, diberi sumber pembanding, dan dicatat status verifikasinya sebelum dipakai dalam artikel.",
    contextChunks: [
      "Klasifikasi klaim: benar, keliru, belum terbukti, butuh konteks.",
      "Minimal dua sumber pembanding sebelum publikasi klaim sensitif.",
      "Simpan tautan bukti dan tanggal akses di kartu sitasi.",
    ],
    citations: [
      {
        id: "cit-kpu",
        label: "Dokumen KPU",
        locator: "Pedoman verifikasi, p. 6",
        quote:
          "Rujukan prosedural dipakai sebagai baseline pemeriksaan klaim.",
        reliability: "High",
      },
      {
        id: "cit-redaksi",
        label: "SOP Redaksi",
        locator: "Bagian etika, p. 3",
        quote:
          "Klaim sensitif wajib melewati pemeriksaan berlapis sebelum tayang.",
        reliability: "High",
      },
    ],
  },
  {
    id: "doc-infra-photo",
    collectionId: "multimedia",
    title: "Arsip Foto Infrastruktur Distrik",
    source: "Multimedia Desk",
    type: "Asset Notes",
    status: "Indexed",
    confidence: 91,
    updatedAt: "04 Jul 2026, 15:02 WIT",
    pages: 7,
    tokens: "3.8K",
    owner: "Photo Editor",
    favorite: false,
    tags: ["foto", "metadata", "aset visual"],
    summary:
      "Catatan metadata foto lapangan untuk paket visual infrastruktur dan pelayanan publik.",
    excerpt:
      "Arsip ini membantu redaksi memilih visual yang relevan, memeriksa lokasi, dan menjaga konsistensi kredit foto.",
    contextChunks: [
      "Prioritaskan foto dengan lokasi, tanggal, dan kredit lengkap.",
      "Hindari memakai visual tanpa metadata sumber.",
      "Kelompokkan aset berdasarkan kabupaten dan tema liputan.",
    ],
    citations: [
      {
        id: "cit-gallery",
        label: "Metadata galeri",
        locator: "Batch IMG-PS-07",
        quote:
          "Metadata lokasi menjadi bukti pendukung sebelum visual diterbitkan.",
        reliability: "Medium",
      },
    ],
  },
  {
    id: "doc-breaking-sop",
    collectionId: "newsroom",
    title: "SOP Redaksi Breaking News",
    source: "Managing Editor",
    type: "SOP",
    status: "Verified",
    confidence: 96,
    updatedAt: "03 Jul 2026, 21:18 WIT",
    pages: 14,
    tokens: "7.5K",
    owner: "Newsroom Ops",
    favorite: false,
    tags: ["sop", "breaking", "workflow"],
    summary:
      "Standar kerja untuk intake cepat, validasi awal, update berkelanjutan, dan arsip perubahan berita.",
    excerpt:
      "Breaking news wajib memisahkan informasi terkonfirmasi, informasi berkembang, dan catatan koreksi agar pembaruan tetap transparan.",
    contextChunks: [
      "Rilis cepat harus tetap membawa atribusi sumber dan status verifikasi.",
      "Setiap pembaruan mencatat waktu, editor, dan perubahan substansi.",
      "Gunakan format live update hanya saat sumber primer masih berkembang.",
    ],
    citations: [
      {
        id: "cit-sop-live",
        label: "SOP Breaking",
        locator: "Alur update, p. 8",
        quote:
          "Update substansial harus dicatat agar riwayat editorial tetap jelas.",
        reliability: "High",
      },
      {
        id: "cit-ethics",
        label: "Kode Etik Internal",
        locator: "Akurasi, p. 5",
        quote:
          "Kecepatan publikasi tidak menggantikan kewajiban verifikasi.",
        reliability: "High",
      },
    ],
  },
];

export const initialKnowledgeActivityLog = [
  {
    id: "act-1",
    action: "AI Knowledge Copilot prepared",
    detail: "Production RAG API route ready for authenticated requests.",
    time: "10:24 WIT",
    tone: "green",
  },
  {
    id: "act-2",
    action: "Citation review completed",
    detail: "High reliability sources pinned to fact check collection.",
    time: "09:58 WIT",
    tone: "gold",
  },
  {
    id: "act-3",
    action: "Upload queue staged",
    detail: "Upload panel targets the protected Knowledge RAG API.",
    time: "09:35 WIT",
    tone: "maroon",
  },
];

export const mockUploadQueue = [
  {
    id: "upload-policy",
    name: "laporan-pembangunan-papua-selatan.pdf",
    size: "4.8 MB",
    status: "Ready",
  },
  {
    id: "upload-transcript",
    name: "wawancara-merauke-clean.txt",
    size: "820 KB",
    status: "Queued",
  },
];

export const copilotQuickPrompts = [
  {
    id: "qp-summary",
    label: "Summarize active source",
    prompt: "Summarize the active newsroom document and list the strongest source context.",
  },
  {
    id: "qp-security",
    label: "Find risks",
    prompt: "Find security risks, verification gaps, and sensitive claims in the available knowledge sources.",
  },
  {
    id: "qp-actions",
    label: "Action items",
    prompt: "Generate action items for the editor based on the retrieved knowledge context.",
  },
  {
    id: "qp-compare",
    label: "Compare sources",
    prompt: "Compare the strongest knowledge sources and explain which one should lead the article.",
  },
];

export const knowledgeCommandActions = [
  {
    id: "summarize-document",
    label: "Summarize document",
    description: "Create a concise editorial summary from local context.",
    prompt: "Summarize document",
    tone: "gold",
  },
  {
    id: "explain-selected-source",
    label: "Explain selected source",
    description: "Explain why the active source matters for newsroom use.",
    prompt: "Explain selected source",
    tone: "green",
  },
  {
    id: "generate-action-items",
    label: "Generate action items",
    description: "Turn retrieved context into editor-ready next steps.",
    prompt: "Generate action items",
    tone: "gold",
  },
  {
    id: "compare-sources",
    label: "Compare sources",
    description: "Compare matching documents and rank source strength.",
    prompt: "Compare sources",
    tone: "green",
  },
  {
    id: "find-security-risks",
    label: "Find security risks",
    description: "Surface verification, privacy, and publication risks.",
    prompt: "Find security risks",
    tone: "maroon",
  },
];
