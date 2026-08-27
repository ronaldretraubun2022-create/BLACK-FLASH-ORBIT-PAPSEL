# Codex Prompts — BLACK FLASH ORBIT

Gunakan prompt berikut dari folder `D:\Projects\BLACK-FLASH-ORBIT`. Jalankan satu phase per sesi agar scope terjaga.

## 1. Master stabilization prompt

```text
Kamu bekerja pada repository BLACK FLASH ORBIT.

PROJECT:
D:\Projects\BLACK-FLASH-ORBIT

BRANCH:
sprint4-dev

MISSION:
Stabilkan milestone v0.8 tanpa menambah fitur besar baru.

READ FIRST:
- AGENTS.md
- PRD.md
- IMPLEMENTATION.md
- TASKS.md
- PROJECT_STATUS.md
- docs/ARCHITECTURE.md
- docs/SECURITY.md
- docs/TESTING.md

SCOPE:
1. Periksa git status dan jangan menimpa perubahan existing.
2. Audit environment variables yang benar-benar digunakan code.
3. Verifikasi Supabase auth, RLS, dan backend health.
4. Perbaiki Knowledge Base sampai upload, parse, chunk, embedding,
   persistence, preview, search, retry, dan delete bekerja end-to-end.
5. Jalankan full regression untuk Auth, Command Center, AI Workspace,
   AI Newsroom, Knowledge Base, Web Builder, Automation, dan Security Center.
6. Perbarui test dan dokumentasi yang terdampak.

CONSTRAINTS:
- Jangan merge ke master.
- Jangan deploy.
- Jangan menghapus data atau migration existing.
- Jangan mengganti stack.
- Jangan menonaktifkan auth, RLS, CORS, Helmet, rate limit, atau validation.
- Jangan commit secret atau mencetak nilai secret.
- Jangan menambah dependency tanpa kebutuhan jelas.

QUALITY GATE:
- npm.cmd run test
- npm.cmd run build
- npm.cmd audit --omit=dev
- git diff --check
- git status

OUTPUT:
- Outcome
- Root cause
- Files changed
- Validation dengan PASS/FAIL aktual
- Risks remaining
- Next safe step
```

## 2. Knowledge Base repair prompt

```text
Fokus hanya pada Knowledge Base BLACK FLASH ORBIT di branch sprint4-dev.

Masalah terakhir:
Upload mencapai tahap indexing lalu gagal karena embedding provider tidak
memiliki API key yang diperlukan. OpenRouter key digunakan untuk chat dan
tidak boleh diasumsikan sebagai OpenAI embedding key.

Kerjakan:
1. Telusuri alur apps/web -> knowledgeService -> knowledge route ->
   orbitKnowledge -> embedding provider -> Supabase/storage.
2. Identifikasi root cause aktual dari code dan runtime, jangan menebak.
3. Buat abstraction/validation provider yang jelas.
4. Pastikan missing configuration menghasilkan error code aman dan tidak
   menandai dokumen indexed.
5. Pastikan PDF, DOCX, dan TXT tervalidasi, diparsing, di-chunk, di-index,
   dapat dipreview/dicari, dan dapat dihapus tanpa orphan.
6. Pastikan user A tidak dapat membaca/menghapus dokumen user B.
7. Tambahkan regression tests.
8. Update .env.example dan dokumentasi.

Jangan deploy, merge, menghapus data produksi, atau menambah fitur lain.

Jalankan test, build, audit production dependency, git diff --check, git status.
```

## 3. Security review prompt

```text
Audit Security Patch BLACK FLASH ORBIT pada branch sprint4-dev.

Periksa:
- middleware order
- public health route
- bearer token validation
- protected newsroom/dashboard/knowledge/web-builder routes
- role authorization
- CORS allowlist
- Helmet
- rate limit
- error response
- upload validation
- Supabase service-role usage
- RLS ownership
- secret leakage pada source, logs, dan frontend bundle
- dependency audit

Jangan mengubah behavior yang tidak terkait. Jika menemukan masalah,
perbaiki root cause dan tambahkan regression test.

Output tabel PASS/FAIL per kontrol, files changed, commands executed,
risiko tersisa, dan rekomendasi release GO/NO-GO.
```

## 4. Full regression prompt

```text
Jalankan full regression BLACK FLASH ORBIT sprint4-dev tanpa deploy dan tanpa
menambah fitur.

Automated:
- npm.cmd run test
- npm.cmd run build
- npm.cmd audit --omit=dev
- git diff --check

Review/test matrix:
- login, logout, refresh, expired session
- ProtectedRoute dan PublicOnlyRoute
- dashboard loading/live/degraded/empty
- Command Palette via button dan Ctrl+K
- Security Center admin/non-admin
- AI Workspace session/message/model persistence
- Newsroom output structure dan duplicate guard
- Knowledge upload/index/preview/search/delete/ownership
- Web Builder CRUD/generate/preview/export
- Workflow Automation states
- responsive 360/768/1024/1440

Perbaiki hanya regression yang terbukti. Laporkan PASS/FAIL aktual dan jangan
mengklaim test yang tidak dijalankan.
```

## 5. Release preparation prompt

```text
Persiapkan BLACK FLASH ORBIT v0.8 release candidate pada sprint4-dev.

PRECONDITION:
Semua P0 TASKS selesai dan regression terakhir lulus.

Kerjakan:
1. Review diff sprint4-dev terhadap master.
2. Verifikasi migration dan env documentation.
3. Verifikasi tidak ada secret atau debug artifact.
4. Update PROJECT_STATUS.md dan CHANGELOG.md.
5. Jalankan final quality gate.
6. Susun draft PR sprint4-dev -> master berisi summary, security impact,
   migration/env changes, testing, deployment steps, known limitations.

Jangan membuat tag, push, PR, merge, atau deploy kecuali saya memerintahkannya
secara eksplisit setelah hasil review ditampilkan.
```

## 6. AI Workspace v0.9 prompt

```text
Implementasikan AI Workspace v0.9 setelah release v0.8 stabil.

Scope:
- model selector tersimpan per session
- session search dan rename
- autosave tanpa message duplikat
- copy dengan toast
- export Markdown dan JSON
- abort generation
- retry dan regenerate
- provider/model fallback
- usage/token/cost dari data nyata
- memory control per session

Gunakan public.orbit_chat_sessions dan public.orbit_chat_messages. Pertahankan
default model openrouter/auto. Backend wajib memvalidasi ownership dan auth.

Tambahkan loading, empty, error, offline/degraded, validation, dan mobile state.
Tambahkan test untuk long session, expired token, provider timeout, duplicate
message, restore session, dan cross-user denial.

Jangan deploy atau merge. Jalankan seluruh quality gate dan laporkan evidence.
```

## 7. Quick fix format

```text
Gunakan AGENTS.md. Fokus hanya pada error berikut:

[TEMPEL ERROR DI SINI]

Temukan root cause aktual, perbaiki patch paling kecil yang lengkap, tambahkan
regression test, dan jalankan test/build terkait. Jangan refactor area lain,
jangan deploy, jangan merge, dan jangan menampilkan secret.

Laporan akhir: root cause, files changed, validation, risks, next.
```

