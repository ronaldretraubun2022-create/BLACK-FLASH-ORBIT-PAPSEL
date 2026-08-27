# Implementation Plan — BLACK FLASH ORBIT

## Tujuan

Menyelesaikan baseline v0.8 secara aman, mengaktifkan Knowledge Base end-to-end, merilis `sprint4-dev` ke `master`, lalu mengembangkan AI Workspace v0.9 tanpa memperluas scope sebelum quality gate lulus.

## Prinsip implementasi

- Pertahankan React/Vite dan Node/Express existing.
- Gunakan Supabase Auth, PostgreSQL, dan RLS sebagai baseline data layer.
- Gunakan service layer untuk provider AI dan embedding.
- Semua fitur wajib memiliki loading, empty, error, validation, unauthorized, dan retry state.
- Tidak ada deploy atau merge otomatis tanpa instruksi eksplisit.
- Setiap phase harus selesai dan diverifikasi sebelum phase berikutnya.

## Phase 0 — Repository baseline

### Tujuan

Memastikan pekerjaan dimulai dari source terbaru tanpa menimpa perubahan lokal.

### Langkah

```powershell
cd D:\Projects\BLACK-FLASH-ORBIT
git status
git branch --show-current
git fetch origin --prune
git checkout sprint4-dev
git pull --ff-only origin sprint4-dev
git log -5 --oneline
```

### Acceptance criteria

- Branch aktif `sprint4-dev`.
- Working tree dipahami; perubahan pengguna tidak dihapus.
- Local branch sinkron dengan remote.
- Node dan npm tersedia.

## Phase 1 — Environment dan runtime stabilization

### Scope

- Periksa `.env.example` terhadap semua env yang benar-benar dibaca code.
- Tambahkan startup validation tanpa mencetak nilai secret.
- Verifikasi Supabase project aktif.
- Verifikasi CORS, API base URL, dan local ports.
- Verifikasi fallback frontend hanya berlaku untuk local development.

### Env groups

| Group | Variable |
| --- | --- |
| Runtime | `PORT`, `NODE_ENV` |
| CORS | `CORS_ORIGIN`, `CORS_ALLOWED_ORIGINS` |
| Supabase server | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| API client | `VITE_API_BASE_URL` |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` |
| Embedding | `OPENAI_API_KEY` atau env provider yang dipilih |

### Implementasi

1. Buat fungsi env validation per service.
2. Validasi hanya saat fitur/provider digunakan agar fitur yang tidak relevan tidak mematikan seluruh aplikasi.
3. Return error code terstruktur, misalnya `EMBEDDING_PROVIDER_NOT_CONFIGURED`.
4. Jangan mengirim nama variable sensitif beserta nilai ke client.
5. Update `.env.example` dan `docs/DEPLOYMENT.md`.

### Acceptance criteria

- Server dan web berjalan melalui `npm.cmd run dev`.
- `/api/v1/health` merespons sukses.
- Missing env menghasilkan pesan aman dan actionable.
- Tidak ada secret di browser console atau response.

## Phase 2 — Knowledge Base end-to-end

### Scope

- Upload dan validation.
- Parsing PDF, DOCX, TXT.
- Chunking.
- Embedding provider.
- Persistence dan status lifecycle.
- Preview, search, delete.
- Ownership dan cleanup.

### Lifecycle dokumen

```text
pending → uploaded → parsing → chunking → indexing → indexed
                                                ↘ failed
```

### Implementasi backend

1. Validasi token sebelum memproses file.
2. Validasi MIME, extension, ukuran, dan file count.
3. Buat record `pending` dengan `user_id`.
4. Parse berdasarkan format yang diizinkan.
5. Normalisasi text dan tolak dokumen kosong.
6. Buat chunk deterministik dengan metadata posisi.
7. Panggil embedding provider melalui abstraction.
8. Simpan chunk/embedding secara transaction-aware.
9. Set `indexed` hanya setelah seluruh proses berhasil.
10. Pada failure, simpan code aman dan bersihkan file/chunk parsial.

### Implementasi frontend

1. Validasi sebelum upload.
2. Disable submit ketika proses aktif.
3. Tampilkan progress berdasarkan lifecycle yang nyata.
4. Tampilkan error dan tombol retry.
5. Refresh list tanpa duplikasi.
6. Preview dan delete harus mengikuti ownership.

### Test matrix

| Skenario | Hasil |
| --- | --- |
| Tanpa token | 401 |
| Token valid, PDF valid | Indexed |
| DOCX valid | Indexed |
| TXT valid | Indexed |
| Format ditolak | 400/415 |
| File terlalu besar | 413 |
| Dokumen kosong | Failure terstruktur |
| Provider key kosong | Failure terstruktur, tidak ada sukses palsu |
| User B membaca dokumen user A | Ditolak |
| Delete dokumen sendiri | Record, chunks, dan storage dibersihkan |

### Acceptance criteria

- Minimum tiga format valid melewati end-to-end.
- Search mengembalikan konteks relevan dari dokumen sendiri.
- Failure dapat dipahami dan di-retry.
- Tidak ada orphan record/file pada skenario test.

## Phase 3 — Full regression dan security hardening

### Automated gate

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
```

### Manual smoke matrix

| Area | Skenario wajib |
| --- | --- |
| Auth | Register/login/logout/session refresh/expired token |
| Routes | Protected route, public-only route, unauthorized redirect |
| Dashboard | Loading/live/degraded/empty/fallback |
| Command Palette | Button, `Ctrl + K`, keyboard navigation, permission |
| Security Center | Admin success, non-admin denial |
| AI Workspace | Session create, send, save, reopen, error, retry |
| Newsroom | Valid input, structure, duplicate guard, AI error |
| Knowledge | Upload, index, preview, search, delete, ownership |
| Web Builder | Project/page CRUD, generate, preview, export error |
| Automation | List/status/action failure |
| Responsive | 360, 768, 1024, 1440 px |

### Security checks

- Private API returns 401 without bearer token.
- Restricted role returns 403.
- Health route stays public.
- CORS production only allows configured origins.
- Helmet headers aktif.
- Rate limiter aktif pada route berisiko.
- `.env` tidak tracked.
- Frontend bundle tidak mengandung service-role key.
- Upload path tidak menerima traversal.
- Error response tidak mengandung stack/path internal.

### Acceptance criteria

- Semua gate lulus.
- Temuan P0/P1 selesai.
- Temuan P2 terdokumentasi dengan alasan dan owner.

## Phase 4 — Release v0.8

### Persiapan

1. Update `PROJECT_STATUS.md`.
2. Update `CHANGELOG.md`.
3. Pastikan version dan release label konsisten.
4. Buat release candidate commit.
5. Jalankan quality gate terakhir pada commit yang akan ditag.

### Tag

```powershell
git tag -a v0.8.0-ai-command-bar -m "BLACK FLASH ORBIT v0.8.0 AI Command Bar"
git push origin v0.8.0-ai-command-bar
```

### Pull Request

```text
Base: master
Compare: sprint4-dev
Title: release: BLACK FLASH ORBIT v0.8.0
```

PR harus menjelaskan:

- Modul yang ditambahkan/diubah.
- Migration dan env change.
- Security impact.
- Test evidence.
- Deployment steps.
- Known limitations.

### Acceptance criteria

- PR direview dan checks lulus.
- Tidak ada unresolved blocking comment.
- Merge menghasilkan commit yang dapat dilacak ke tag/release.

## Phase 5 — Production deployment

### Langkah

1. Pastikan production mengikuti `master`.
2. Atur env production tanpa menyalin secret ke repo.
3. Terapkan migration yang belum ada.
4. Deploy frontend/API.
5. Periksa logs tanpa mempublikasikan secret.
6. Jalankan production smoke test.

### Production smoke test

- `/api/v1/health` sukses.
- SPA route tidak 404 saat refresh.
- Login berhasil.
- Dashboard memuat telemetry.
- Newsroom menghasilkan draft.
- Knowledge upload/index/search berhasil.
- Web Builder project dapat dibuat.
- Unauthorized route ditolak.

### Rollback

- Gunakan deployment sebelumnya yang terverifikasi.
- Jangan rollback database destruktif secara otomatis.
- Nonaktifkan fitur bermasalah dengan safe flag bila tersedia.
- Catat incident dan keputusan di `docs/DECISIONS.md`.

## Phase 6 — AI Workspace v0.9

### Scope

- Model selector final.
- Provider/model fallback.
- Token dan cost visibility.
- Copy/export.
- Autosave yang idempotent.
- Search dan rename session.
- Memory controls.
- Retry dan regenerate.
- Abort generation.

### Acceptance criteria

- Session dapat dipulihkan tanpa message duplikat.
- Model tersimpan per session.
- Request dapat dibatalkan.
- Provider failure menghasilkan retry/fallback yang jelas.
- Usage tidak menampilkan estimasi palsu.
- Export berisi metadata minimum tanpa secret.

## Phase 7 — Beta/SaaS readiness

- Workspace/organization.
- Subscription dan quota.
- Central audit console.
- Backup/restore.
- Retention policy.
- Usage analytics.
- Operational alerting.
- Terms, privacy, dan acceptable use.

Phase ini tidak dimulai sebelum v0.9 stabil.

