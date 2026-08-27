# Tasks — BLACK FLASH ORBIT

## Cara menggunakan

- `[ ]` belum dikerjakan.
- `[-]` sedang dikerjakan.
- `[x]` selesai dan memiliki evidence.
- Prioritas: P0 blocker, P1 release-critical, P2 improvement.
- Jangan menandai selesai hanya karena code terlihat benar; jalankan acceptance check.

## Completed baseline

- [x] Security Patch v1.0.5 review lulus.
- [x] Newsroom guard test lulus pada verifikasi terakhir.
- [x] Production build lulus pada verifikasi terakhir.
- [x] Production dependency audit menunjukkan 0 vulnerability pada verifikasi terakhir.
- [x] Duplicate section Newsroom diperbaiki.
- [x] Private API guard diterapkan.
- [x] Health endpoint tetap publik.
- [x] Security Center v0.6 tersedia.
- [x] Project Health Monitor v0.7 tersedia.
- [x] AI Command Bar v0.8 masuk `sprint4-dev`.
- [x] Command Palette tersedia.
- [x] Knowledge Base UI/API baseline tersedia.
- [x] Universal Web Builder baseline tersedia.
- [x] Workflow Automation baseline tersedia.

Semua evidence completed wajib diulang sebelum release.

## P0 — Release blockers

### ORB-P0-001 — Sinkronisasi branch

- [ ] Pastikan branch aktif `sprint4-dev`.
- [ ] Pull dengan `--ff-only`.
- [ ] Catat working tree awal.
- [ ] Pastikan tidak ada perubahan user yang tertimpa.

Acceptance:

- Local dan remote `sprint4-dev` sinkron.
- `git status` dipahami dan terdokumentasi.

### ORB-P0-002 — Supabase availability

- [ ] Buka project Supabase BLACK FLASH ORBIT.
- [ ] Unpause jika diperlukan.
- [ ] Verifikasi Auth dan database dapat diakses.
- [ ] Verifikasi migration history.

Acceptance:

- Login dan query authenticated berhasil.
- Tidak ada migration penting yang tertinggal.

### ORB-P0-003 — Embedding configuration

- [ ] Identifikasi provider embedding yang benar-benar digunakan backend.
- [ ] Tambahkan env validation.
- [ ] Perbarui `.env.example`.
- [ ] Tambahkan error code configuration yang aman.
- [ ] Jangan log API key.

Acceptance:

- Provider aktif saat key valid.
- Missing key menghasilkan failure terstruktur.

### ORB-P0-004 — Knowledge Base end-to-end

- [ ] Test upload PDF.
- [ ] Test upload DOCX.
- [ ] Test upload TXT.
- [ ] Test parse dan chunk.
- [ ] Test embedding dan persistence.
- [ ] Test preview dan search.
- [ ] Test retry failure.
- [ ] Test delete cleanup.
- [ ] Test cross-user denial.

Acceptance:

- Dokumen valid menjadi `indexed`.
- Dokumen invalid gagal aman.
- Tidak ada data lintas-user.

### ORB-P0-005 — Full regression

- [ ] `npm.cmd run test`.
- [ ] `npm.cmd run build`.
- [ ] `npm.cmd audit --omit=dev`.
- [ ] `git diff --check`.
- [ ] Auth smoke test.
- [ ] Dashboard smoke test.
- [ ] Command Palette smoke test.
- [ ] Newsroom smoke test.
- [ ] Knowledge smoke test.
- [ ] Web Builder smoke test.
- [ ] Mobile responsive test.

Acceptance:

- Seluruh automated gate lulus.
- Tidak ada P0/P1 regression.

### ORB-P0-006 — Release branch

- [ ] Update status dan changelog.
- [ ] Buat tag `v0.8.0-ai-command-bar`.
- [ ] Push tag.
- [ ] Buat PR `sprint4-dev` → `master`.
- [ ] Review diff, env, migration, security, test evidence.
- [ ] Selesaikan blocking comments.

Acceptance:

- `master` berisi baseline v0.8 yang telah direview.

### ORB-P0-007 — Production deployment

- [ ] Konfigurasi env Vercel/host.
- [ ] Verifikasi SPA fallback.
- [ ] Verifikasi API routing.
- [ ] Deploy dari `master`.
- [ ] Jalankan production smoke test.
- [ ] Verifikasi tidak ada secret di bundle/log.

Acceptance:

- Deployment ready dan critical flows berhasil.

## P1 — AI Workspace v0.9

- [ ] ORB-P1-001 Model selector tersimpan per session.
- [ ] ORB-P1-002 Rename dan search session.
- [ ] ORB-P1-003 Copy response dengan toast.
- [ ] ORB-P1-004 Export Markdown/JSON.
- [ ] ORB-P1-005 Abort generation.
- [ ] ORB-P1-006 Retry/regenerate tanpa duplikasi.
- [ ] ORB-P1-007 Provider/model fallback.
- [ ] ORB-P1-008 Token/cost display berbasis data nyata.
- [ ] ORB-P1-009 Memory enable/disable per session.
- [ ] ORB-P1-010 Long-conversation regression.

Exit criteria:

- Session restore konsisten.
- Tidak ada message duplikat.
- Failure provider dapat ditangani pengguna.

## P1 — Newsroom production readiness

- [ ] ORB-P1-101 Autosave draft.
- [ ] ORB-P1-102 Draft history dan revision.
- [ ] ORB-P1-103 Export Markdown/DOCX/PDF.
- [ ] ORB-P1-104 Editorial checklist.
- [ ] ORB-P1-105 Fact/source fields wajib untuk publish-ready.
- [ ] ORB-P1-106 Role editor/reviewer/publisher.
- [ ] ORB-P1-107 Long article test.
- [ ] ORB-P1-108 Provider timeout/retry test.

## P1 — Web Builder hardening

- [ ] ORB-P1-201 Project CRUD regression.
- [ ] ORB-P1-202 Page CRUD regression.
- [ ] ORB-P1-203 Schema validation.
- [ ] ORB-P1-204 Preview isolation.
- [ ] ORB-P1-205 Export ZIP yang dapat dijalankan.
- [ ] ORB-P1-206 Asset validation dan cleanup.
- [ ] ORB-P1-207 Cross-user RLS test.
- [ ] ORB-P1-208 Empty/error/retry UI.

## P1 — Automation hardening

- [ ] ORB-P1-301 Workflow editor.
- [ ] ORB-P1-302 Trigger validation.
- [ ] ORB-P1-303 Execution history.
- [ ] ORB-P1-304 Retry policy.
- [ ] ORB-P1-305 Idempotency guard.
- [ ] ORB-P1-306 Webhook signature validation.
- [ ] ORB-P1-307 Secret storage.
- [ ] ORB-P1-308 Failure notification.

## P1 — Security and operations

- [ ] ORB-P1-401 Test 401/403 matrix.
- [ ] ORB-P1-402 Test CORS production allowlist.
- [ ] ORB-P1-403 Test rate limits.
- [ ] ORB-P1-404 Scan frontend bundle untuk secret.
- [ ] ORB-P1-405 Structured request/error logging.
- [ ] ORB-P1-406 Audit event coverage.
- [ ] ORB-P1-407 Backup dan restore drill.
- [ ] ORB-P1-408 Dependency update policy.

## P2 — OSINT Workspace

- [ ] ORB-P2-001 Case management.
- [ ] ORB-P2-002 Source registry.
- [ ] ORB-P2-003 Evidence item dan hash.
- [ ] ORB-P2-004 Chain of custody log.
- [ ] ORB-P2-005 Legal/ethical collection checklist.
- [ ] ORB-P2-006 Report builder.
- [ ] ORB-P2-007 OSINT tools master list.
- [ ] ORB-P2-008 AI OSINT assistant dengan citation guard.

## P2 — SaaS readiness

- [ ] ORB-P2-101 Organization/workspace.
- [ ] ORB-P2-102 Membership dan invitation.
- [ ] ORB-P2-103 Subscription plan.
- [ ] ORB-P2-104 Usage quota.
- [ ] ORB-P2-105 Central admin console.
- [ ] ORB-P2-106 Retention policy.
- [ ] ORB-P2-107 Terms/privacy/acceptable use.
- [ ] ORB-P2-108 Monitoring dan incident runbook.

## Documentation maintenance

- [ ] Update `PROJECT_STATUS.md` setiap akhir milestone.
- [ ] Update `CHANGELOG.md` setiap release candidate.
- [ ] Update `docs/API.md` saat kontrak berubah.
- [ ] Update `docs/DATABASE.md` saat migration ditambah.
- [ ] Update `docs/SECURITY.md` saat auth/permission berubah.
- [ ] Catat keputusan penting di `docs/DECISIONS.md`.

