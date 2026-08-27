# Environment Configuration — BLACK FLASH ORBIT

## 1. Aturan

- `.env.example` hanya berisi nama variable dan nilai contoh aman.
- `.env` tidak boleh di-commit.
- Secret server tidak memakai prefix `VITE_`.
- Validation tidak boleh mencetak nilai variable.
- Preview dan Production menggunakan credential berbeda bila memungkinkan.

## 2. Template development

```env
PORT=5000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=/api
VITE_ENABLE_AUTH_DEBUG=false
VITE_ENABLE_API_DEBUG=false
VITE_ENABLE_KNOWLEDGE_API_DEBUG=false
VITE_ENABLE_KNOWLEDGE_MOCK_FALLBACK=false
VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK=false

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=BLACK FLASH ORBIT
OPENROUTER_MODEL=deepseek/deepseek-chat-v3
OPENROUTER_FALLBACK_MODELS=
NEWSROOM_AI_MODEL=deepseek/deepseek-chat-v3
NEWSROOM_AI_FALLBACK_MODELS=
AI_CHAT_FALLBACK_MODELS=
AI_ROUTER_MAX_ATTEMPTS=1
DEBUG_AI_ROUTER=false
DEBUG_OPENROUTER=false
DEBUG_NEWSROOM_AI=false
DEBUG_AI_AUTH=false

KNOWLEDGE_EMBEDDING_PROVIDER=openai
KNOWLEDGE_CHAT_PROVIDER=openrouter
KNOWLEDGE_CHAT_MODEL=openrouter/auto
KNOWLEDGE_CHAT_FALLBACK_MODELS=
OPENAI_API_KEY=your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## 3. Validation behavior

| Feature            | Missing configuration behavior                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend Supabase  | Login tidak tersedia dengan pesan konfigurasi                                                                                                |
| Backend Supabase   | Route terkait gagal aman                                                                                                                     |
| OpenRouter         | AI generation 503/config error                                                                                                               |
| Embedding provider | `EMBEDDING_PROVIDER_NOT_CONFIGURED`, `EMBEDDING_PROVIDER_AUTH_FAILED`, atau `EMBEDDING_PROVIDER_UNSUPPORTED`; dokumen tidak ditandai indexed |
| CORS production    | Startup fail-safe atau deny unlisted origins                                                                                                 |

## 4. AI Router v2 model configuration

AI Router v2 memakai satu registry model untuk generative AI.

- General AI Chat: `OPENROUTER_MODEL`, fallback opsional `AI_CHAT_FALLBACK_MODELS`.
- AI Newsroom: `NEWSROOM_AI_MODEL`, fallback opsional `NEWSROOM_AI_FALLBACK_MODELS`, lalu default kompatibel `deepseek/deepseek-chat-v3`.
- Knowledge Chat: `KNOWLEDGE_CHAT_MODEL`, fallback opsional `KNOWLEDGE_CHAT_FALLBACK_MODELS`.
- Fallback global opsional: `OPENROUTER_FALLBACK_MODELS`.
- Retry per model dibatasi oleh `AI_ROUTER_MAX_ATTEMPTS` dan default `1`.

Fallback list dipisahkan koma dan hanya digunakan untuk error provider/model yang aman untuk dicoba ulang. Auth failure, credential invalid, dan rate limit tidak memicu fallback.

## 5. Debug flags

Debug flag hanya diaktifkan lokal. Debug output tetap tidak boleh mencetak token.

Contoh existing behavior:

- `VITE_ENABLE_AUTH_DEBUG=true`
- `VITE_ENABLE_API_DEBUG=true`
- `VITE_ENABLE_KNOWLEDGE_API_DEBUG=true`
- `VITE_ENABLE_KNOWLEDGE_MOCK_FALLBACK=true` hanya untuk development mock Knowledge eksplisit.
- `VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK=true` hanya untuk development local draft fallback eksplisit.
- `DEBUG_AI_ROUTER=true` menampilkan metadata aman: requestId, provider, requestedModel, resolvedModel, attempt, fallbackUsed, durationMs, status.

Pastikan seluruh debug flag tidak aktif pada production kecuali ada kebutuhan insiden terbatas.

## 6. Rotation checklist

- [ ] Buat credential baru di provider.
- [ ] Update secret manager environment.
- [ ] Redeploy/restart service yang membutuhkan.
- [ ] Jalankan smoke test.
- [ ] Revoke credential lama.
- [ ] Monitor error dan abuse.
- [ ] Jangan menyimpan nilai credential pada issue/changelog.
