# Architecture Decision Log — BLACK FLASH ORBIT

Keputusan baru ditambahkan di bagian paling atas. Jangan menghapus keputusan lama; tandai `Superseded` dan tautkan penggantinya.

## ADR-014 - v1.4 expands incrementally from the verified modular monolith

- Status: Accepted
- Date: 2026-08-27

### Context

BLACK FLASH ORBIT v1.4 introduces a ten-phase roadmap across ORBIT Core,
AI Workspace, Intelligence, Web Builder, Newsroom, Workflow, Agent Bridge,
Security Center, Observability, and ORBIT OS integration. The application
already has working domain modules, security tests, AI provider boundaries,
Supabase Auth/RLS, and production gate scripts.

### Decision

v1.4 will extend existing modules in place using the current React/Vite,
Node/Express, Supabase, and OpenRouter/OpenAI architecture. Feature work
must proceed phase by phase, revalidating lint, tests, build, security, and
bundle-secret boundaries before moving forward.

No phase may rewrite the app, replace the framework, bypass backend
authorization, disable RLS, expose service-role/provider secrets, or remove
existing tests to force a pass.

### Consequences

- v1.4 can ship meaningful product upgrades without destabilizing the
  current modular monolith.
- Larger features must be decomposed into route, service, UI, migration, and
  test changes with explicit acceptance criteria.
- Commit, push, tag, merge, and deploy remain explicit approval actions.

## ADR-013 - Intelligence Summary aggregates verification without approving publication

- Status: Accepted
- Date: 2026-08-15

### Context

P3 menghasilkan claim status, citation coverage, source confidence, editorial confidence, review status, dan publication blockers. Editor membutuhkan ringkasan keputusan yang ringkas tanpa membuat klaim bahwa sistem otomatis telah membuktikan kebenaran absolut.

### Decision

Tambahkan Intelligence Summary deterministik dan Editorial Review Report JSON setelah verification layer. Summary hanya mengagregasi hasil P3 menjadi overview, key findings, blockers, source gaps, editor actions, dan publication readiness `BLOCKED`, `NEEDS_REVIEW`, atau `READY_FOR_EDITOR`.

Editorial Review Report memakai whitelist metadata aman: promptVersion, provider, model, fallbackUsed, durationMs, audience, mode, complexity, dan channel. Report tidak menyertakan system prompt, raw prompt, authorization header, API key, service-role key, raw provider payload, atau isi dokumen privat.

### Consequences

- Response Newsroom bertambah field `intelligenceSummary` dan `editorialReviewReport` secara backward-compatible.
- Tidak ada panggilan AI tambahan untuk meringkas data yang sudah terstruktur.
- PDF/Word/download formal dapat dibangun di P5 dari report JSON tanpa mengubah Fact Guard.

## ADR-012 — Fact Guard v2 adds automated editorial review, not approval

- Status: Accepted
- Date: 2026-08-15

### Context

Newsroom output membutuhkan verifikasi quote, tanggal, angka, tuduhan, citation coverage, dan confidence sumber sebelum dinilai layak review editor. Automated checks tidak boleh diposisikan sebagai pengganti fact-checking manusia.

### Decision

Tambahkan verification layer deterministik setelah AI Router v2: claim extraction, Fact Guard, Citation Guard, Source Confidence, Editorial Confidence, Review Status, dan Publication Blockers. AI hanya boleh memberi status `AI_REVIEWED`, `NEEDS_REVIEW`, atau `READY_FOR_EDITOR`; status `APPROVED` tetap reserved untuk aksi manusia.

### Consequences

- Response Newsroom bertambah field `verification` dan `editorial` secara backward-compatible.
- Draft tidak otomatis dihapus saat blocker ditemukan; editor tetap melihat konten dan alasan blocker.
- P4 dapat membangun Intelligence Summary dari hasil verification tanpa membuat klaim kepastian absolut.

## ADR-011 — Newsroom Prompt Engine v2 is audience-aware and versioned

- Status: Accepted
- Date: 2026-08-15

### Context

AI Newsroom membutuhkan output yang berbeda untuk publik, reporter, editor, pemerintah, eksekutif, dan analisis strategis. Sebelumnya audience, mode, dan complexity dikirim sebagai teks langsung ke prompt, sehingga sulit diuji dan rentan drift antar UI/backend.

### Decision

Newsroom memakai registry audience, channel target, complexity level, prompt contract, dan prompt builder v2 dengan versi `newsroom-v2`. Route tetap mempertahankan kontrak response publik, tetapi metadata sekarang memuat promptVersion, audience, mode, complexity, channel, provider, model, fallbackUsed, dan durationMs.

Source text diperlakukan sebagai data tidak tepercaya. Instruksi di dalam source material tidak boleh mengubah system/editorial rules.

### Consequences

- Audience dan channel memengaruhi prompt secara deterministik dan dapat dites.
- Legacy payload audience/complexity lama tetap dinormalisasi bila dikenal.
- P3 Fact Guard dan Citation Guard dapat dibangun di atas contract yang sama.

## ADR-010 — AI Router v2 centralizes generative provider requests

- Status: Accepted
- Date: 2026-08-15

### Context

Audit P1 menemukan AI Newsroom, General AI Chat, dan Knowledge/RAG Chat memiliki logika generative provider yang tersebar. Ini meningkatkan risiko fallback tidak konsisten, error provider bocor, retry tidak terkendali, dan model configuration drift.

### Decision

Semua request generative OpenRouter melewati AI Router v2 di backend. Route tetap bertanggung jawab pada auth, validasi input, context assembly, dan response mapping, sementara transport provider, model registry, retry/fallback policy, response validation, dan error normalization dipusatkan di `server/services/ai/`.

Embedding tetap berada pada service embedding karena API dan semantiknya berbeda dari chat completion.

### Consequences

- Satu jalur provider generative untuk Newsroom, AI Chat, dan Knowledge Chat.
- Fallback model hanya berasal dari konfigurasi dan tidak aktif untuk auth/config/rate-limit failure.
- Debug AI hanya mencatat metadata aman.
- AI Router v2 menjadi fondasi untuk P2 Audience Engine dan Prompt Engine tanpa mengubah kontrak publik route.

## ADR-009 — P0 provider failure must fail clearly in production

- Status: Accepted
- Date: 2026-08-15

### Context

Audit P0 menemukan frontend dapat memuat mock Knowledge dan membuat draf Newsroom lokal setelah backend/provider gagal. Perilaku ini berguna untuk development, tetapi berisiko menyamarkan kegagalan auth/provider pada production.

### Decision

Fallback mock/local hanya aktif di development dengan flag eksplisit. Production harus menampilkan error bersih, mempertahankan input pengguna, dan menyediakan retry tanpa menyajikan konten fabricated sebagai hasil provider AI.

### Consequences

- Kegagalan provider/auth lebih terlihat di production.
- Development workflow tetap tersedia setelah flag dinyalakan.
- AI Router v2 perlu menyediakan fallback provider nyata, bukan fallback konten lokal.

## ADR-008 — Standardize Knowledge API prefix

- Status: Proposed
- Date: 2026-07-16

### Context

Client upload menggunakan `/api/knowledge/documents/upload`, sementara sebagian API domain menggunakan versioned `/api/v1/...`. Prefix yang tidak seragam meningkatkan risiko routing mismatch dan `/api/api` regression.

### Decision

Tentukan satu canonical versioned prefix untuk kontrak baru. Pertahankan compatibility route sementara jika diperlukan, lalu hapus setelah seluruh client dan deployment routing bermigrasi.

### Consequences

- API lebih konsisten.
- Membutuhkan regression test dan compatibility window.

## ADR-007 — Knowledge vector schema is not assumed

- Status: Accepted
- Date: 2026-07-16

### Context

Migration terverifikasi menyimpan dokumen penuh di `public.orbit_knowledge` dan menggunakan trigram/full-text style indexes. Chunk/vector schema belum menjadi baseline terverifikasi.

### Decision

Dokumentasi dan UI tidak boleh mengklaim vector-indexed RAG selesai sebelum migration chunk/embedding diterapkan dan diuji.

### Consequences

- Status produk lebih jujur.
- v0.8.1 memerlukan schema/provider implementation yang eksplisit.

## ADR-006 — OpenRouter for generation, explicit embedding provider

- Status: Accepted
- Date: 2026-07-16

### Context

OpenRouter digunakan untuk chat dan newsroom generation. Knowledge indexing pernah gagal karena backend membutuhkan OpenAI API key untuk embedding.

### Decision

Pisahkan generation provider dan embedding provider. Masing-masing memiliki env validation, adapter, error code, dan health capability sendiri.

### Consequences

- Tidak ada asumsi satu key berlaku untuk semua fungsi.
- Konfigurasi bertambah tetapi failure lebih jelas.

## ADR-005 — Supabase Auth and RLS

- Status: Accepted

### Decision

Gunakan Supabase Auth untuk identity dan RLS untuk isolasi data, dengan backend authorization sebagai kontrol utama tambahan.

### Consequences

- Policy tests wajib.
- Service-role key hanya server-side.

## ADR-004 — React/Vite frontend and Node/Express backend

- Status: Accepted

### Decision

Pertahankan React/Vite dan Node/Express sebagai stack utama BLACK FLASH ORBIT.

### Consequences

- Tidak ada migrasi framework selama stabilisasi.
- Shared JavaScript ecosystem mempercepat pengembangan.

## ADR-003 — Model stored per chat session

- Status: Accepted

### Decision

Tambahkan/pertahankan kolom `model` pada `public.orbit_chat_sessions` dan `public.orbit_chat_messages` sesuai kebutuhan audit, dengan default `openrouter/auto`.

### Consequences

- Session dapat dipulihkan dengan model konsisten.
- Migration dan compatibility code diperlukan.

## ADR-002 — Defensive OSINT only

- Status: Accepted

### Decision

OSINT Workspace hanya mendukung penggunaan defensif, legal, authorized, source-aware, dan audit-friendly.

### Consequences

- Offensive exploitation dan unauthorized access berada di luar scope.
- Evidence, legal checklist, dan chain of custody menjadi requirement.

## ADR-001 — Stabilize before expanding

- Status: Accepted

### Decision

Selesaikan security, core tests, Knowledge Base, branch release, dan deployment sebelum menambah modul besar baru.

### Consequences

- Scope v0.8 lebih terkontrol.
- AI Workspace v0.9 dimulai setelah release gate selesai.

## ADR template

```markdown
## ADR-XXX — Judul

- Status: Proposed / Accepted / Superseded / Rejected
- Date: YYYY-MM-DD

### Context

Masalah dan constraint.

### Decision

Keputusan yang diambil.

### Alternatives

Alternatif yang dipertimbangkan.

### Consequences

Dampak positif, negatif, migration, dan risk.
```
