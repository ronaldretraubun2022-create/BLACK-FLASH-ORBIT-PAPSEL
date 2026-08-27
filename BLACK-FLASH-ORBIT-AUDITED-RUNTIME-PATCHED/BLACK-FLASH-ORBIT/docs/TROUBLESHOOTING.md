# Troubleshooting — BLACK FLASH ORBIT

## 1. Folder project tidak ditemukan

Jika prompt sudah menunjukkan:

```text
PS D:\Projects\BLACK-FLASH-ORBIT>
```

Jangan menjalankan `cd BLACK-FLASH-ORBIT` lagi karena akan mencari folder bersarang.

Gunakan:

```powershell
Get-Location
Get-ChildItem
```

## 2. Port 5000/5173/5174 digunakan

Error:

```text
EADDRINUSE
```

Solusi:

```powershell
npx kill-port 5000 5173 5174
npm.cmd run dev
```

Pastikan proses lain yang menggunakan port aman dihentikan.

## 3. Module not found

```powershell
cd D:\Projects\BLACK-FLASH-ORBIT
npm install
npm.cmd run dev
```

Jika hanya satu script yang tidak ditemukan, periksa `package.json` sebelum membuat file baru.

## 4. Frontend memanggil `/api/api/...`

Penyebab umum:

- `VITE_API_BASE_URL=/api` digabungkan dengan path yang sudah memiliki `/api`.

Periksa `resolveApiUrl()` dan normalization pada `apps/web/src/services/api.js`. Jangan memperbaiki dengan hardcode berbeda di setiap page.

## 5. API mengembalikan HTML/non-JSON

Kemungkinan:

- SPA fallback menangkap `/api/*`.
- API route tidak tersedia pada host.
- Base URL salah.
- Backend tidak berjalan.

Periksa:

```powershell
Invoke-WebRequest http://localhost:5000/api/v1/health
```

Perbaiki routing host; jangan menganggap HTML sebagai response sukses.

## 6. Supabase project paused

Gejala:

- Login gagal.
- Auth provider unavailable.
- Query database timeout/unavailable.

Tindakan:

1. Aktifkan kembali project Supabase.
2. Tunggu service siap.
3. Verifikasi URL/key environment.
4. Restart local server.
5. Login ulang.

## 7. Session login tidak aktif

Gejala:

```text
Session login tidak aktif. Silakan login ulang.
```

Tindakan:

- Logout lalu login.
- Periksa jam perangkat.
- Periksa Supabase availability.
- Hapus stale auth state hanya melalui recovery flow aplikasi.
- Jangan menonaktifkan `requireAuth`.

## 8. Knowledge upload gagal pada indexing

Gejala:

```text
OpenAI API key is required for indexing.
```

Penyebab:

- Embedding provider membutuhkan `OPENAI_API_KEY`.
- OpenRouter key hanya digunakan untuk chat/generation pada konfigurasi existing.

Tindakan:

1. Identifikasi provider dari backend code.
2. Tambahkan key pada `.env`, bukan source.
3. Restart backend.
4. Upload file test non-sensitive.
5. Verifikasi status tidak sukses palsu.

Jangan menempelkan API key pada chat, screenshot, atau log.

## 9. Knowledge file ditolak

Baseline:

- Format: `.txt`, `.md`, `.pdf`, `.docx`.
- Maksimum: 8 MB.
- Extension dan MIME harus cocok.
- Fake/binary/script-like content ditolak.

Gunakan file valid dan jangan mengganti extension file secara manual.

## 10. CORS error

Periksa:

- `CORS_ORIGIN` local.
- `CORS_ALLOWED_ORIGINS` production.
- Origin termasuk protocol dan port yang benar.
- Tidak ada trailing path.

Jangan mengubah ke wildcard pada request bercredential.

## 11. Vercel deployment gagal

Periksa urutan:

1. Branch deployment.
2. Root directory.
3. Install/build command.
4. Output directory.
5. Environment variables.
6. SPA/API rewrite order.
7. Build logs pertama yang gagal, bukan error lanjutan.

Jalankan lokal:

```powershell
npm.cmd run build
```

Jika lokal gagal, perbaiki lokal sebelum redeploy.

## 12. Build lulus tetapi fitur production gagal

Kemungkinan:

- Environment missing.
- Production mengikuti `master` lama.
- API host/base URL salah.
- Migration belum diterapkan.
- CORS belum memasukkan production origin.
- Supabase paused.

Bandingkan commit deployment dengan release commit.

## 13. Test newsroom gagal

```powershell
npm.cmd run test:newsroom
```

Periksa perubahan pada:

- `server/routes/newsroom.js`
- prompt builder/normalizer
- response headings
- fact/evidence/confidence section
- auth guard

Jangan memperbarui expected test untuk menyembunyikan regression.

## 14. Git mengatakan nothing to commit

Makna:

- Perubahan sudah committed, atau
- File tidak berubah, atau
- Berada pada repository/branch berbeda.

Periksa:

```powershell
git status
git branch --show-current
git log -5 --oneline
```

## 15. Safe diagnostic bundle

Bagikan hanya output aman:

```powershell
git status
git branch --show-current
node --version
npm --version
npm.cmd run test
npm.cmd run build
```

Sebelum membagikan log, hapus token, email sensitif, key, cookie, URL bercredential, dan isi dokumen privat.

