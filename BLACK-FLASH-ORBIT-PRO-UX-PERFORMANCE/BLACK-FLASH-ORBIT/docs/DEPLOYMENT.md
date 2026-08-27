# Deployment Guide — BLACK FLASH ORBIT

## 1. Deployment policy

- Development berlangsung pada `sprint4-dev` atau branch feature/fix turunannya.
- Production hanya mengikuti `master` yang telah direview.
- Jangan deploy working tree kotor.
- Jangan deploy jika test/build/security gate gagal.
- Environment variable disimpan pada secret manager host, bukan repository.

## 2. Local development

```powershell
cd D:\Projects\BLACK-FLASH-ORBIT
git checkout sprint4-dev
git pull --ff-only origin sprint4-dev
Copy-Item .env.example .env
npm install
npm.cmd run dev
```

Services:

- Web: `http://localhost:5173`
- API: `http://localhost:5000`
- Health: `http://localhost:5000/api/v1/health`
- Readiness: `http://localhost:5000/api/v1/readiness`

## 3. Environment inventory

| Variable | Server | Browser | Required |
| --- | ---: | ---: | --- |
| `PORT` | Yes | No | Local/host dependent |
| `HOST` | Yes | No | Local/host dependent |
| `NODE_ENV` | Yes | No | Yes |
| `CORS_ORIGIN` | Yes | No | Local |
| `CORS_ALLOWED_ORIGINS` | Yes | No | Production |
| `SUPABASE_URL` | Yes | No | Yes |
| `SUPABASE_ANON_KEY` | Yes | No | Route dependent |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Never | Server operations |
| `VITE_SUPABASE_URL` | Build | Yes | Yes |
| `VITE_SUPABASE_ANON_KEY` | Build | Yes | Yes |
| `VITE_API_BASE_URL` | Build | Yes | Yes |
| `OPENROUTER_API_KEY` | Yes | Never | AI generation |
| `OPENROUTER_BASE_URL` | Yes | No | Yes |
| `OPENROUTER_SITE_URL` | Yes | No | Recommended |
| `OPENROUTER_APP_NAME` | Yes | No | Recommended |
| `OPENROUTER_MODEL` | Yes | No | Optional |
| `KNOWLEDGE_EMBEDDING_PROVIDER` | Yes | No | Knowledge indexing |
| `KNOWLEDGE_CHAT_PROVIDER` | Yes | No | Knowledge answer generation |
| `KNOWLEDGE_CHAT_MODEL` | Yes | No | Optional |
| `OPENAI_API_KEY` | Yes | Never | Wajib saat provider embedding `openai` |
| `OPENAI_BASE_URL` | Yes | No | Optional |
| `OPENAI_EMBEDDING_MODEL` | Yes | No | Optional |

Vite variable selalu masuk browser bundle. Jangan memberi prefix `VITE_` pada secret.

## 4. Supabase preparation

1. Pastikan project tidak paused.
2. Verifikasi Auth provider aktif.
3. Terapkan migration pada environment non-production terlebih dahulu.
4. Periksa tabel, index, trigger, grant, dan RLS policies.
5. Jalankan cross-user RLS test.
6. Backup sebelum migration berisiko.

Migration tidak boleh diterapkan dua kali dengan cara manual yang tidak tercatat.

## 5. Pre-deployment gate

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
git status
```

Tambahkan manual smoke test lokal untuk auth, dashboard, newsroom, knowledge, dan web builder.

## 6. Branch release flow

```text
feature/fix → sprint4-dev → release review → master → production
```

Untuk v0.8:

```text
PR base: master
PR compare: sprint4-dev
Tag: v0.8.0-ai-command-bar
```

Tag hanya dibuat pada commit yang sudah lulus final quality gate.

## 7. Vercel/host configuration

Periksa:

- Root directory sesuai repository.
- Install command menggunakan `npm install` atau kebijakan lockfile tim.
- Build command `npm run build`.
- Output directory sesuai `scripts/build-web.mjs`/Vite configuration.
- SPA fallback hanya untuk route frontend.
- `/api/*` tidak ditangkap fallback HTML.
- `/api/v1/readiness` mengembalikan 200 saat dependency ready dan 503 saat degraded.
- Environment dipisah untuk Preview dan Production.
- Production branch `master`.

Jika backend Express tidak cocok dengan runtime serverless yang digunakan, deploy backend sebagai Node service terpisah dan set `VITE_API_BASE_URL` ke URL API tersebut.

## 8. Production smoke test

### Public

- Health 200.
- Readiness 200 atau 503 degraded dengan JSON aman, bukan HTML fallback.
- Login page tampil.
- Frontend asset dan favicon termuat.
- Refresh route SPA tidak 404.

### Authenticated

- Login dan session refresh.
- Dashboard telemetry.
- Command Palette.
- AI Workspace request.
- Newsroom draft.
- Knowledge upload/index/search/delete.
- Web Builder project/page.
- Workflow Automation create run, approval gate, persisted history.

### Security

- Private endpoint tanpa token menghasilkan 401.
- Non-admin security access menghasilkan 403.
- Disallowed origin ditolak.
- Error response tidak memuat stack/secret.

## 9. Monitoring after release

Periksa 30–60 menit pertama:

- 5xx rate.
- 401/403 anomaly.
- AI provider timeout/rate limit.
- Supabase connection/auth errors.
- Upload parse/index failures.
- Frontend asset/route 404.
- Cost/usage anomaly.

## 10. Rollback

Rollback aplikasi:

1. Tandai release NO-GO/incident.
2. Kembalikan traffic/deployment ke artifact sebelumnya yang terverifikasi.
3. Jangan menghapus migration atau data produksi secara spontan.
4. Jika schema forward-compatible, rollback hanya application layer.
5. Jika perlu data recovery, gunakan backup dan runbook khusus.
6. Tambahkan regression test sebelum redeploy.

## 11. Release record

Catat:

- Commit SHA.
- Tag.
- PR.
- Migration yang diterapkan.
- Environment yang berubah, tanpa nilai secret.
- Test evidence.
- Deployment ID/link internal.
- Known limitation.
- Rollback target.
