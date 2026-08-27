# Security Baseline — BLACK FLASH ORBIT

## 1. Tujuan

Melindungi identity, session, data pengguna, dokumen, prompt, hasil AI, project website, credential provider, dan integritas operasional BLACK FLASH ORBIT.

## 2. Security principles

- Deny by default.
- Least privilege.
- Backend authorization.
- RLS defense-in-depth.
- No secret in browser.
- Safe failure dan sanitized error.
- Input is untrusted.
- Human review untuk output berisiko.
- Audit critical mutations.

## 3. Asset classification

| Asset                     | Sensitivitas | Kontrol minimum                                   |
| ------------------------- | ------------ | ------------------------------------------------- |
| Supabase service-role key | Critical     | Server-only, rotation, restricted environment     |
| AI provider API keys      | Critical     | Server-only, no logs, quota monitoring            |
| Access/refresh token      | High         | Secure session handling, no persistent debug logs |
| Knowledge documents       | High         | Auth, ownership, RLS, retention                   |
| OSINT evidence            | High         | Case authorization, audit, chain of custody       |
| Draft newsroom            | Medium/High  | User/workspace isolation                          |
| Web Builder assets        | Medium       | Ownership, type validation, safe preview          |
| Health status             | Low          | Minimal public response                           |

## 4. Authentication controls

- Supabase Auth menjadi identity provider.
- Frontend mengambil access token dari session tervalidasi.
- Backend memvalidasi bearer format, token, dan user.
- Missing/invalid token: 401.
- Authenticated tetapi tidak berizin: 403.
- Endpoint Security Center memvalidasi role `admin`, `owner`, atau `super_admin` pada backend.
- Expired/stale refresh token harus memicu recovery/logout yang aman.
- Auth provider unavailable tidak boleh membuka bypass.

### Middleware auth P0 review

Status P0.1-P0.8: `requireAuth` dan `requireSupabaseAuth` tetap dipertahankan untuk backward compatibility sampai AI Router v2.

Route yang memakai `requireAuth`:

- `/api/ai/newsroom`
- `/api/chat`
- `/api/v1/audit`
- `/api/v1/web-builder`
- `/api/v1/activity`, `/api/v1/automation`, `/api/v1/dashboard`, `/api/v1/metrics`, `/api/v1/monitoring`, `/api/v1/osint`, `/api/v1/projects`, `/api/v1/reports`, `/api/v1/security`, `/api/v1/settings`, `/api/v1/system`, `/api/v1/workspace`
- `/api/v1/prompts`, `/api/v1/profile`

Route yang memakai `requireSupabaseAuth`:

- `/api/knowledge`
- `/api/v1/knowledge`

Route AI chat `/api/ai/chat` memakai auth internal khusus di `server/routes/ai.js` untuk validasi token dan rate-limit per user.

Perbedaan perilaku:

- `requireSupabaseAuth` memiliki timeout Supabase auth 5 detik, response error selalu menyertakan `code`, dan config auth yang hilang menjadi 503.
- `requireAuth` sudah mendeteksi network/auth-provider failure dan mengembalikan `AUTH_PROVIDER_UNAVAILABLE`, tetapi sebagian error legacy tidak memiliki `code`.
- Keduanya menulis `req.user`, `req.userId`, dan `req.userEmail`, serta tidak membuka bypass saat provider auth gagal.
- `/api/v1/health` tetap public melalui route health sebelum middleware auth.

## 5. Authorization controls

### Role controls

- `owner`/`super_admin`: akses administratif penuh sesuai policy.
- `admin`: akses operasional/security yang diizinkan.
- `editor`/`operator`/`analyst`/`user`: scope domain masing-masing.

Role dari client tidak dipercaya. Backend mengambil role dari sumber server/database yang tervalidasi.

### Ownership controls

- Web Builder: `auth.uid() = user_id` melalui RLS.
- Prompt Library: policy user/creator/email compatibility.
- Knowledge RAG: `owner_id = auth.uid()`; tabel legacy tetap memakai email JWT sampai backfill selesai.
- Chat: session dan message wajib diverifikasi terhadap authenticated user.

## 6. API security

- Gunakan Helmet.
- CORS production menggunakan exact allowlist.
- Jangan gunakan `*` untuk credentialed request.
- Tetapkan JSON/body size limits.
- Gunakan rate limit pada auth, AI, upload, export, dan mutation.
- Reject content type yang tidak sesuai.
- Timeout external provider.
- Error production tidak boleh berisi stack, SQL, filesystem path, atau secret.
- Request ID dapat ditampilkan untuk dukungan tanpa membocorkan detail.
- Request log menetralkan control character dan tidak memakai header identity yang tidak dipercaya.

## 7. Secrets management

### Dilarang berada di frontend

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- Database password/URL bercredential
- Webhook secret

### Aman untuk frontend bila memang public client credential

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Anon key tetap harus dilindungi RLS; nama anon bukan berarti authorization boleh dilewati.

### Rotation triggers

- Secret terlihat di commit, screenshot, log, chat publik, atau frontend bundle.
- Pengguna/perangkat kehilangan akses yang aman.
- Provider mendeteksi abuse.
- Anggota tim dengan akses keluar.

## 8. File upload security

Baseline knowledge upload:

- Satu file per request.
- Maksimum 10 MB.
- Allowlist `.txt`, `.md`, `.pdf`, `.docx`.
- Cocokkan extension dan MIME type.
- Periksa PDF/DOCX signatures.
- Tolak executable headers, null byte, dan script-like text.
- Memory upload harus mempertimbangkan concurrency limit.
- Nama file tidak digunakan sebagai path tanpa sanitasi.
- Extracted text dibatasi.

Target tambahan:

- Malware scan jika storage/volume meningkat.
- Per-user quota.
- Filename normalization.
- Archive files tetap ditolak kecuali ada sandbox extraction.
- File processing terpisah dari web process untuk skala besar.

## 9. AI security dan safety

- System instruction tidak boleh menerima override langsung dari dokumen.
- Tandai knowledge content sebagai untrusted context.
- Newsroom Prompt Engine v2 wajib memperlakukan source text sebagai data tidak tepercaya; instruksi di dalam source material tidak boleh mengubah system/editorial rules.
- Newsroom audience/channel/complexity harus lewat prompt contract terverifikasi, bukan konfigurasi bebas dari client.
- Newsroom Fact Guard v2 dan Source Confidence adalah automated review aid, bukan approval manusia atau verifikasi absolut.
- Direct quote, tanggal spesifik, angka/statistik, dan allegation yang tidak didukung sumber harus menjadi blocker review editorial.
- Batasi retrieved chunks dan ukuran prompt.
- Jangan mengirim secret atau data lain milik user ke prompt.
- Catat provider/model dan status tanpa full sensitive prompt.
- Newsroom tidak boleh mengarang fakta atau citation.
- OSINT hanya defensive, legal, dan authorized.
- Tool/action execution membutuhkan explicit permission dan validation.
- Respons provider AI wajib melewati normalisasi konten terpusat dan menolak content kosong, whitespace-only, choices/message/content yang hilang, serta payload null/undefined.
- AI Router v2 menjadi satu abstraksi backend untuk request generative provider. Route tidak boleh membuat request HTTP langsung ke OpenRouter.
- Diagnostics AI Router hanya boleh memuat metadata aman: requestId, provider, requestedModel, resolvedModel, attempt, fallbackUsed, durationMs, dan status.
- Fallback lokal Newsroom hanya boleh aktif di development dengan `VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK=true`; produksi harus menampilkan error bersih dan retry, bukan draf fabricated.
- Mock Knowledge hanya boleh aktif di development dengan `VITE_ENABLE_KNOWLEDGE_MOCK_FALLBACK=true`; produksi harus gagal jelas jika RAG API/provider tidak tersedia.

## 10. Web Builder security

- Schema allowlist untuk sections/components.
- Preview diisolasi; jangan menjalankan arbitrary script pada origin dashboard.
- Sanitize HTML/URL.
- Tolak `javascript:` URLs dan unsafe inline event handlers.
- Asset ownership dan MIME type wajib diperiksa.
- Export tidak boleh memasukkan `.env`, keys, atau internal metadata.

## 11. Logging dan privacy

### Boleh dicatat

- Request ID.
- Route/method/status/duration.
- Error code.
- Provider/model identifier.
- File type dan size.
- Opaque user ID bila diperlukan.

### Tidak boleh dicatat

- Authorization header.
- Cookies/session token.
- API key.
- Service-role key.
- Full document content.
- Password.
- Full prompt yang mengandung data privat.

## 12. Security verification checklist

- [ ] Private route 401 tanpa token.
- [ ] Restricted route 403 untuk role salah.
- [ ] User A tidak dapat akses data user B.
- [ ] CORS menolak origin yang tidak terdaftar.
- [ ] Helmet headers hadir.
- [ ] Rate limit menghasilkan 429.
- [ ] Oversized upload ditolak.
- [ ] MIME spoof ditolak.
- [ ] Error 500 disanitasi.
- [ ] `.env` tidak tracked.
- [ ] Frontend bundle bebas secret server.
- [ ] Dependency audit bebas high/critical tanpa mitigasi.

## 13. Incident response minimum

1. Hentikan exposure atau nonaktifkan fitur terdampak.
2. Rotate credential yang mungkin bocor.
3. Simpan log/evidence secara aman.
4. Identifikasi actor, data, waktu, dan scope.
5. Perbaiki root cause dan tambahkan regression test.
6. Verifikasi recovery dan monitor abuse.
7. Catat incident dan keputusan tanpa menyimpan secret.

## 14. Release security decision

Release adalah NO-GO bila:

- Secret terdeteksi.
- Auth/RLS test gagal.
- High/critical vulnerability tanpa mitigasi.
- Upload bypass tersedia.
- Production error membocorkan internal detail.
- Deployment menjalankan branch yang tidak direview.
