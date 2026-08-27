# Product Requirements Document — BLACK FLASH ORBIT

## 1. Informasi dokumen

| Field | Nilai |
| --- | --- |
| Produk | BLACK FLASH ORBIT |
| Versi PRD | 1.0 |
| Baseline produk | v0.8 |
| Branch referensi | `sprint4-dev` |
| Status | Development / internal MVP |
| Pemilik produk | Ronald Retraubun |
| Tanggal baseline | 16 Juli 2026 |

## 2. Ringkasan produk

BLACK FLASH ORBIT adalah AI Command Center yang menyatukan pekerjaan media, OSINT defensif, pengelolaan pengetahuan, automation, monitoring keamanan, arsip laporan, dan pembuatan website dalam satu workspace modular.

Produk dirancang untuk mengurangi perpindahan antar-aplikasi, menjaga histori kerja, mengamankan akses berbasis peran, dan menghasilkan output yang dapat dilacak kembali ke sesi, sumber, pengguna, serta proyeknya.

## 3. Masalah yang diselesaikan

1. Workflow media dan OSINT tersebar di banyak alat tanpa satu pusat kendali.
2. Prompt, percakapan, dokumen, laporan, dan hasil AI sulit dilacak kembali.
3. Penggunaan AI tidak memiliki kontrol model, histori, audit, dan guardrail yang konsisten.
4. Proses pembuatan berita, laporan, automation, dan website terlalu manual.
5. Akses administratif dan data sensitif memerlukan RBAC, RLS, dan audit trail.
6. Status sistem, keamanan, dan pekerjaan aktif tidak terlihat dalam satu dashboard.

## 4. Visi

Menjadi AI Engineering dan Intelligence Operating System yang modular, aman, cepat, mobile-first, serta dapat berkembang dari alat internal menjadi SaaS profesional.

## 5. Sasaran produk

### Sasaran utama

- Menyatukan AI Workspace, Newsroom, Knowledge Base, Web Builder, Automation, OSINT, dan Security Center.
- Menyediakan authentication, authorization, dan isolasi data pengguna.
- Menyimpan session, messages, prompt, dokumen, proyek, dan output secara persisten.
- Memberikan status operasional dan keamanan secara realtime atau deployment-aware.
- Menghasilkan output yang dapat disalin, diekspor, diaudit, dan digunakan kembali.
- Menjamin pengalaman mobile dan desktop yang konsisten.

### Non-sasaran v0.8–v0.9

- Autonomous offensive security.
- Scraping ilegal atau pengumpulan data tanpa dasar hukum.
- Infrastruktur multi-region enterprise.
- Marketplace plugin publik.
- Native Android/iOS application.
- Billing kompleks sebelum core workflow stabil.

## 6. Pengguna dan peran

| Peran | Kebutuhan | Hak utama |
| --- | --- | --- |
| Owner/Super Admin | Mengelola seluruh sistem | Semua modul, security, user, configuration |
| Admin | Operasional dan pengawasan | Modul operasional, security, reports, pengguna terbatas |
| Editor/Operator | Produksi konten dan workflow | Newsroom, AI Workspace, Knowledge, reports |
| Analyst | Riset dan OSINT defensif | OSINT, Knowledge, reports, AI assistant |
| User | Pekerjaan personal | Data dan proyek milik sendiri |

Semua endpoint privat harus memvalidasi bearer token. Data multi-user harus dibatasi dengan RLS atau pemeriksaan kepemilikan yang ekuivalen.

## 7. Ruang lingkup modul

### P0 — Wajib untuk beta internal

| ID | Modul | Kebutuhan |
| --- | --- | --- |
| ORB-001 | Authentication | Login, register, session recovery, logout, protected routes |
| ORB-002 | RBAC dan RLS | Akses berdasarkan role dan kepemilikan data |
| ORB-003 | Command Center | Telemetry, metrics, activity, health, project status |
| ORB-004 | AI Workspace | Chat, model, session, history, memory, copy/export dasar |
| ORB-005 | AI Newsroom | Prompt berita, draft, validasi struktur, history |
| ORB-006 | Knowledge Base | Upload, parsing, indexing, preview, search, delete |
| ORB-007 | Security Center | Status header, rate limit, auth, security score, audit signal |
| ORB-008 | Error handling | Loading, empty, degraded, timeout, validation, toast |

### P1 — Wajib untuk beta publik

| ID | Modul | Kebutuhan |
| --- | --- | --- |
| ORB-101 | Universal Web Builder | Project, page, AI generation, preview, export |
| ORB-102 | Workflow Automation | Workflow, trigger, execution, retry, log |
| ORB-103 | Prompt Library | Kategori, favorite, reuse, search, versioning |
| ORB-104 | Reports Archive | Arsip, filter, detail, export, retention |
| ORB-105 | Model Control | Provider, model, fallback, quota, usage |
| ORB-106 | OSINT Workspace | Case workspace, sources, evidence, report builder |

### P2 — SaaS readiness

| ID | Modul | Kebutuhan |
| --- | --- | --- |
| ORB-201 | Subscription | Plan, quota, invoice status, entitlement |
| ORB-202 | Multi-workspace | Organization, membership, invitation, role |
| ORB-203 | Audit Console | Event search, actor, entity, timestamp, result |
| ORB-204 | Backup/Restore | Backup terjadwal dan restore terverifikasi |
| ORB-205 | Integrations | Webhook dan connector terkontrol |

## 8. Functional requirements

### 8.1 Authentication dan authorization

- FR-AUTH-01: Sistem harus menampilkan halaman privat hanya setelah session tervalidasi.
- FR-AUTH-02: Backend harus menolak token kosong, format bearer salah, token invalid, dan user invalid.
- FR-AUTH-03: Session kedaluwarsa harus diarahkan ke login tanpa loop redirect.
- FR-AUTH-04: Role admin harus divalidasi pada backend untuk aksi administratif.
- FR-AUTH-05: Service-role key tidak boleh dikirim ke browser.
- FR-AUTH-06: Degraded auth provider harus menghasilkan status dan pesan yang aman.

### 8.2 Command Center

- FR-CMD-01: Dashboard harus menampilkan health, metrics, activity, projects, automation, dan security signal.
- FR-CMD-02: Dashboard harus memiliki loading, empty, degraded, dan fallback state.
- FR-CMD-03: Command Palette harus dapat dibuka melalui tombol dan `Ctrl + K`.
- FR-CMD-04: Command harus memiliki label, deskripsi, keyword, izin, dan hasil eksekusi.
- FR-CMD-05: Tampilan harus dapat digunakan pada mobile tanpa horizontal overflow.

### 8.3 AI Workspace

- FR-AI-01: Pengguna dapat membuat dan melanjutkan session chat.
- FR-AI-02: Setiap message terkait dengan session dan user yang benar.
- FR-AI-03: Model aktif disimpan dengan session; default adalah `openrouter/auto`.
- FR-AI-04: Request AI harus memiliki timeout, validasi, error mapping, dan retry terbatas.
- FR-AI-05: Pengguna dapat menyalin dan mengekspor hasil.
- FR-AI-06: Autosave tidak boleh menduplikasi message.

### 8.4 AI Newsroom

- FR-NEWS-01: Pengguna dapat memasukkan fakta, 5W1H, kutipan, gaya, dan panjang output.
- FR-NEWS-02: Output berita harus dimulai pada struktur yang dipilih tanpa section duplikat.
- FR-NEWS-03: Sistem tidak boleh mengarang narasumber, kutipan, lokasi, tanggal, atau angka.
- FR-NEWS-04: Draft harus dapat disimpan, disalin, dan diekspor.
- FR-NEWS-05: Konten harus melewati validation guard sebelum ditandai siap publikasi.

### 8.5 Knowledge Base

- FR-KB-01: Pengguna dapat mengunggah PDF, DOCX, dan TXT yang didukung.
- FR-KB-02: Sistem harus memvalidasi MIME type, ukuran, nama, dan kepemilikan file.
- FR-KB-03: Dokumen harus diparsing, dipecah menjadi chunk, dan diindeks.
- FR-KB-04: Kegagalan indexing tidak boleh meninggalkan status sukses palsu.
- FR-KB-05: Pengguna dapat melihat status, preview, metadata, dan menghapus dokumennya.
- FR-KB-06: Pencarian harus hanya menggunakan dokumen yang dapat diakses pengguna.

### 8.6 Universal Web Builder

- FR-WEB-01: Pengguna dapat membuat, mengubah, melihat, dan menghapus project.
- FR-WEB-02: Project dapat memiliki banyak page dan asset.
- FR-WEB-03: AI generation harus mengikuti schema yang tervalidasi.
- FR-WEB-04: Preview harus terisolasi dari dashboard utama.
- FR-WEB-05: Export harus menghasilkan paket yang dapat dijalankan.
- FR-WEB-06: RLS harus membatasi project, page, dan asset ke pemiliknya.

### 8.7 Workflow Automation

- FR-AUTO-01: Pengguna dapat membuat workflow dari trigger dan action yang valid.
- FR-AUTO-02: Setiap execution memiliki status, waktu, error, attempt, dan output aman.
- FR-AUTO-03: Retry harus idempotent untuk operasi yang berisiko duplikasi.
- FR-AUTO-04: Secret integration harus tersimpan di server, bukan di browser.

## 9. Non-functional requirements

| Kategori | Target |
| --- | --- |
| Security | OWASP-aware, least privilege, RLS, no secret leaks |
| Availability | Health endpoint publik; fitur privat gagal secara aman |
| Performance | Initial dashboard usable < 3 detik pada koneksi wajar |
| API latency | p95 endpoint non-AI < 800 ms pada beban internal |
| AI request | Timeout eksplisit; user dapat retry tanpa duplikasi |
| Accessibility | Keyboard navigation, focus visible, contrast layak |
| Responsive | 360 px sampai desktop lebar tanpa broken layout |
| Observability | Request ID, structured log, health, error category |
| Maintainability | Modular, no duplicate API logic, documented contracts |
| Data integrity | Transaction/constraint untuk perubahan berkaitan |

## 10. Model data inti

- User/Profile
- Role/Permission
- Chat Session
- Chat Message
- Prompt/Prompt Category
- Knowledge Document
- Knowledge Chunk/Embedding
- Web Project
- Web Page
- Web Asset
- Workflow
- Workflow Execution
- Report
- Audit Event
- OSINT Case/Evidence

Detail terdapat pada `docs/DATABASE.md`.

## 11. User journey utama

### Journey AI Workspace

```text
Login → buka AI Workspace → buat/pilih session → pilih model
→ susun prompt → kirim → stream/tunggu hasil → autosave → copy/export
```

### Journey Knowledge Base

```text
Login → buka Knowledge Base → pilih dokumen → validasi
→ upload → parse → chunk → embedding → indexed → search/preview
```

### Journey Newsroom

```text
Login → masukkan fakta/5W1H → pilih format → generate
→ validasi fakta dan struktur → edit → simpan → export/publish
```

## 12. Success metrics

| Metrik | Target beta |
| --- | --- |
| Successful authenticated sessions | ≥ 99% di luar outage provider |
| Newsroom generation success | ≥ 95% request valid |
| Duplicate newsroom section | 0 pada regression suite |
| Knowledge indexing success | ≥ 95% file valid |
| Unhandled frontend error | < 1% session |
| Unauthorized private endpoint access | 0 berhasil |
| Mobile critical-flow completion | 100% untuk login, chat, newsroom, knowledge |
| Production build success | 100% pada release candidate |

## 13. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Provider AI tidak tersedia | Generation gagal | Timeout, retry terbatas, fallback provider/model |
| Supabase paused/outage | Auth dan data gagal | Health check, degraded state, operational checklist |
| API key bocor | Biaya dan kompromi | Server-only secret, rotation, secret scanning |
| RLS salah | Kebocoran lintas-user | Policy test dan ownership test |
| Branch produksi tertinggal | Fitur production tidak sesuai | PR, release tag, deployment checklist |
| Embedding tidak terkonfigurasi | Knowledge gagal | Provider abstraction dan env validation |
| Output AI mengarang fakta | Risiko editorial | Source-first prompt, validation guard, human review |

## 14. Release acceptance criteria

Beta internal dapat dirilis jika:

- Build, test, audit, dan `git diff --check` lulus.
- Supabase aktif dan migration diterapkan.
- Login, logout, refresh session, RBAC, dan RLS lulus.
- Dashboard, Command Palette, AI Workspace, Newsroom, dan Knowledge smoke test lulus.
- Knowledge upload menghasilkan status indexed atau failure yang jelas.
- Tidak ada secret di bundle frontend atau Git history terbaru.
- `sprint4-dev` digabungkan melalui Pull Request ter-review.
- Production health dan critical endpoint lulus setelah deployment.

## 15. Definition of Done

Sebuah fitur dianggap selesai apabila:

1. Requirement dan acceptance criteria terpenuhi.
2. Loading, empty, success, validation, unauthorized, error, dan retry state tersedia.
3. Mobile dan desktop telah diuji.
4. Authorization diperiksa di backend.
5. Database migration dan rollback strategy didokumentasikan.
6. Unit/guard/integration test relevan lulus.
7. Tidak ada secret, debug log sensitif, atau dependency vulnerability baru.
8. Dokumentasi API, database, status, dan changelog diperbarui.
9. Reviewer dapat menjalankan fitur dari instruksi yang tersedia.

