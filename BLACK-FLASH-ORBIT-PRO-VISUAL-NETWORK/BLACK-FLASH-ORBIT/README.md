# BLACK FLASH ORBIT

BLACK FLASH ORBIT adalah AI Command Center modular untuk newsroom, OSINT defensif, knowledge management, automation, security monitoring, report archive, dan pembuatan website berbantuan AI.

Dokumentasi ini disusun untuk baseline `sprint4-dev` pada milestone v0.8. Paket dapat ditempatkan di root repository `D:\Projects\BLACK-FLASH-ORBIT`.

## Status singkat

| Area | Status |
| --- | --- |
| Milestone pengembangan | v0.8 AI Command Bar |
| Branch aktif | `sprint4-dev` |
| Default branch | `master` |
| Selisih terhadap `master` | 85 commit di depan |
| Build frontend | Lulus pada verifikasi terakhir |
| Test newsroom | Lulus pada verifikasi terakhir |
| Audit dependency production | 0 vulnerability pada verifikasi terakhir |
| Production release | Belum final |
| Kendala utama | Embedding Knowledge Base dan stabilisasi deployment |

## Modul utama

- Realtime Command Center
- Mobile Command Center
- Command Palette dan AI Command Bar
- AI Workspace
- AI Newsroom
- Knowledge Base dan RAG
- Universal Web Builder
- Workflow Automation
- Prompt Library
- Security Center
- Project Health Monitor
- Reports Archive
- OSINT Workspace
- Model Control

## Stack

| Layer | Teknologi |
| --- | --- |
| Frontend | React 19, React Router 7, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Data dan auth | Supabase PostgreSQL, Supabase Auth, RLS |
| AI chat/generation | OpenRouter |
| Knowledge parsing | Multer, PDF Parse, Mammoth |
| Security | Helmet, CORS allowlist, rate limiting, bearer-token auth |
| Deployment target | Vercel dan layanan Node yang kompatibel |

## Struktur repository utama

```text
BLACK-FLASH-ORBIT/
├── api/                         # Serverless API adapters
├── apps/
│   ├── orbit-dashboard/         # Dashboard package tambahan
│   └── web/                     # React frontend
├── server/
│   ├── lib/                     # Runtime, memory, telemetry, knowledge
│   ├── middleware/              # Auth dan error handling
│   ├── routes/                  # Express API routes
│   └── services/                # OpenRouter dan business services
├── supabase/
│   └── migrations/              # Schema dan RLS migrations
├── tests/                       # Guard dan integration-oriented tests
├── scripts/                     # Build utilities
├── .agents/skills/              # Project-specific agent skills
├── AGENTS.md                    # Aturan kerja AI agent
├── PRD.md                       # Product requirements
├── IMPLEMENTATION.md            # Rencana implementasi
└── docs/                        # Dokumentasi teknis
```

## Menjalankan aplikasi

### Prasyarat

- Node.js 20 atau lebih baru
- npm 10 atau lebih baru
- Project Supabase aktif
- OpenRouter API key
- OpenAI API key hanya jika embedding provider yang digunakan memerlukannya

### Instalasi

```powershell
cd D:\Projects\BLACK-FLASH-ORBIT
git checkout sprint4-dev
git pull origin sprint4-dev
Copy-Item .env.example .env
npm install
npm.cmd run dev
```

Frontend tersedia di `http://localhost:5173`. Backend tersedia di `http://localhost:5000`.

Jika port masih digunakan:

```powershell
npx kill-port 5000 5173 5174
npm.cmd run dev
```

### Konfigurasi minimum

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=/api

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=BLACK FLASH ORBIT

OPENAI_API_KEY=your-openai-api-key-if-required-for-embeddings
```

Jangan commit `.env`, service-role key, token, atau kredensial produksi.

## Quality gate

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
git status
```

Release hanya boleh diteruskan jika semua perintah lulus dan smoke test autentikasi, dashboard, newsroom, knowledge, dan web builder berhasil.

## Indeks dokumentasi

| Dokumen | Fungsi |
| --- | --- |
| [PRD.md](PRD.md) | Ruang lingkup dan acceptance criteria produk |
| [AGENTS.md](AGENTS.md) | Aturan kerja agent/Codex |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Urutan implementasi teknis |
| [TASKS.md](TASKS.md) | Backlog operasional |
| [ROADMAP.md](ROADMAP.md) | Tahapan rilis produk |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Snapshot progres terakhir |
| [CHANGELOG.md](CHANGELOG.md) | Riwayat milestone |
| [CODEX_PROMPT.md](CODEX_PROMPT.md) | Perintah siap pakai untuk Codex |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arsitektur sistem |
| [docs/API.md](docs/API.md) | Kontrak API |
| [docs/DATABASE.md](docs/DATABASE.md) | Model data dan RLS |
| [docs/SECURITY.md](docs/SECURITY.md) | Baseline keamanan |
| [docs/TESTING.md](docs/TESTING.md) | Strategi pengujian |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Prosedur deployment |
| [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md) | Standar UI/UX |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Penanganan error umum |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | Checklist rilis |

## Prioritas saat ini

```text
Stabilisasi v0.8
→ aktifkan embedding Knowledge Base
→ full regression test
→ tag v0.8.0-ai-command-bar
→ Pull Request sprint4-dev ke master
→ production deployment
→ AI Workspace v0.9
```

