# AGENTS.md — BLACK FLASH ORBIT

Dokumen ini adalah instruksi kerja untuk Codex dan agent AI lain yang mengubah repository BLACK FLASH ORBIT. Berlaku untuk seluruh repository kecuali ada `AGENTS.md` yang lebih dekat dengan file target.

## 1. Misi agent

Mengembangkan BLACK FLASH ORBIT sebagai AI Command Center yang aman, modular, mobile-first, stabil, dan dapat dirilis. Prioritaskan penyelesaian fitur yang sudah ada sebelum menambah area produk baru.

## 2. Sumber kebenaran

Gunakan urutan berikut ketika terjadi konflik:

1. Permintaan pengguna saat ini.
2. `AGENTS.md` terdekat dengan file target.
3. `PRD.md` dan acceptance criteria.
4. `IMPLEMENTATION.md` dan `TASKS.md`.
5. Kontrak yang sudah digunakan oleh code dan test.
6. Dokumentasi teknis dalam `docs/`.

Jangan mengubah requirement diam-diam. Catat keputusan penting di `docs/DECISIONS.md`.

## 3. Konteks aktif

- Repository: `ronaldretraubun2022-create/BLACK-FLASH-ORBIT`
- Branch pengembangan: `sprint4-dev`
- Default branch: `master`
- Milestone: v0.8 AI Command Bar
- Target berikut: stabilisasi v0.8, release, lalu AI Workspace v0.9
- Frontend: React 19, Vite, Tailwind CSS 4
- Backend: Node.js, Express 5
- Database/auth: Supabase PostgreSQL, Supabase Auth, RLS
- AI provider utama: OpenRouter

## 4. Aturan scope

### Wajib

- Kerjakan hanya scope yang diminta.
- Inspeksi code existing sebelum mengubah.
- Pertahankan struktur modular dan kontrak API existing.
- Perbaiki root cause, bukan menutup gejala.
- Tambahkan atau perbarui test untuk perubahan perilaku.
- Perbarui dokumentasi jika kontrak, env, schema, atau alur berubah.
- Pertahankan kompatibilitas mobile.

### Dilarang tanpa instruksi eksplisit

- Merge ke `master`.
- Deploy ke production.
- Menghapus migration atau data produksi.
- Mengganti framework utama.
- Menambah dependency jika solusi native/existing cukup.
- Menonaktifkan auth, RLS, rate limit, CORS, Helmet, atau validation.
- Memindahkan service-role key ke frontend.
- Memasukkan secret ke source, log, test fixture, screenshot, atau dokumentasi.
- Melebarkan scope ke native APK, Laravel, atau fitur besar baru.

## 5. Workflow wajib

### Sebelum mengubah

1. Baca file target dan dependensi langsungnya.
2. Periksa `git status` dan jangan menimpa perubahan pengguna.
3. Identifikasi route, service, schema, dan test yang terdampak.
4. Tetapkan acceptance criteria yang dapat diverifikasi.

### Saat mengubah

1. Buat patch sekecil mungkin tetapi lengkap.
2. Gunakan nama yang konsisten dengan domain `orbit_*`.
3. Hindari duplikasi request, normalization, auth, dan error handling.
4. Pastikan operasi async memiliki loading, timeout, error, dan cleanup.
5. Pastikan mutation aman dari double-submit.
6. Pastikan backend memvalidasi input dan authorization.

### Setelah mengubah

Jalankan minimal:

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
git status
```

Tambahkan test spesifik bila mengubah auth, RLS, upload, AI output, deletion, export, atau workflow execution.

## 6. Standar frontend

- Gunakan komponen kecil dan domain-focused.
- Jangan menambah seluruh fitur baru ke `App.jsx` jika dapat dipisahkan.
- Gunakan service layer untuk API; jangan menyebar raw `fetch` baru.
- Pertahankan `ProtectedRoute` dan `PublicOnlyRoute`.
- Semua form wajib memiliki validation dan disabled state saat submit.
- Semua request wajib memiliki loading, empty, error, unauthorized, dan retry behavior yang sesuai.
- Gunakan toast untuk hasil mutation; jangan hanya `alert()`.
- Fokus keyboard harus terlihat.
- Modal harus dapat ditutup dengan Escape dan mengelola focus.
- Layout harus berfungsi pada lebar 360 px.
- Gunakan dark cyber visual BLACK FLASH ORBIT secara konsisten; jangan membuat desain generik yang terpisah dari design language existing.

## 7. Standar backend

- Route privat wajib memakai middleware auth.
- Authorization harus dilakukan di server walaupun tombol disembunyikan di UI.
- Validasi body, params, query, MIME type, dan ukuran file.
- Gunakan response JSON konsisten:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed"
}
```

Error:

```json
{
  "success": false,
  "code": "MACHINE_READABLE_CODE",
  "message": "Pesan aman untuk pengguna"
}
```

- Jangan kirim stack trace ke client production.
- AI request wajib memiliki timeout dan error mapping.
- Upload wajib membatasi ukuran, format, nama, dan jumlah.
- Mutation berisiko duplikasi harus idempotent atau memakai guard.
- Log tidak boleh berisi token, authorization header, prompt sensitif penuh, atau isi dokumen privat.

## 8. Database dan Supabase

- Semua perubahan schema dibuat sebagai migration baru.
- Jangan mengubah migration lama yang sudah mungkin diterapkan.
- Gunakan UUID, foreign key, `created_at`, dan `updated_at` secara konsisten.
- Aktifkan RLS pada tabel data pengguna.
- Buat policy select/insert/update/delete secara eksplisit.
- Uji user A tidak dapat membaca atau mengubah data user B.
- Service role hanya untuk operasi server yang benar-benar membutuhkan bypass.
- Tambahkan index untuk foreign key, owner, status, dan kolom filter utama.

## 9. AI dan editorial safety

- Jangan mengarang fakta, narasumber, kutipan, lokasi, tanggal, atau angka.
- Pisahkan fakta input, instruksi, dan output.
- Simpan provider/model yang digunakan jika diperlukan untuk audit.
- Tandai output sebagai draft sampai human review selesai.
- Hindari mengirim secret atau data privat yang tidak diperlukan ke provider.
- Batasi context dan ukuran prompt.
- Knowledge retrieval harus mengikuti ownership dan RLS.

## 10. Security gate

Perubahan ditolak jika:

- Endpoint privat menjadi publik.
- Token atau service-role key masuk browser bundle.
- CORS menjadi wildcard pada credentialed request.
- RLS dinonaktifkan tanpa kontrol ekuivalen.
- Error membocorkan stack, SQL, path internal, atau secret.
- File upload menerima format/ukuran tanpa batas.
- Dependency vulnerability high/critical baru tidak dijelaskan.

## 11. Testing expectations

| Perubahan | Test minimum |
| --- | --- |
| UI state | Render/behavior atau manual matrix terdokumentasi |
| API route | Auth, validation, success, error |
| Database/RLS | Own-data success dan cross-user denial |
| Newsroom | Structure, duplicate guard, invalid input |
| Knowledge | Upload, parse, index failure, ownership, delete |
| Web Builder | CRUD, schema validation, export failure |
| Workflow | Execution status, retry, idempotency |
| Security | 401/403, CORS, header, secret scan |

## 12. Git dan release

- Gunakan branch feature/fix dari `sprint4-dev` jika pekerjaan terpisah diperlukan.
- Commit harus kecil, terarah, dan menggunakan pesan seperti:

```text
feat(knowledge): add embedding provider validation
fix(auth): recover expired Supabase session safely
test(newsroom): cover duplicate section regression
docs(release): update v0.8 checklist
```

- Jangan commit `.env`, build output, upload lokal, atau credential.
- Release v0.8 menggunakan tag `v0.8.0-ai-command-bar` setelah seluruh gate lulus.
- Pull Request target untuk baseline ini adalah `sprint4-dev` → `master`.

## 13. Format laporan agent

Saat menyelesaikan perubahan, laporkan:

```text
Outcome
- hasil utama

Files changed
- path dan fungsi perubahan

Validation
- perintah dan hasil PASS/FAIL

Risks
- risiko yang benar-benar tersisa

Next
- langkah aman berikutnya
```

Jangan mengklaim PASS jika perintah tidak dijalankan. Bedakan fakta hasil test dengan inferensi review code.

