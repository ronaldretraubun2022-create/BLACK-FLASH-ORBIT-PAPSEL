# API Contract — BLACK FLASH ORBIT

## 1. Conventions

### Base URLs

| Environment | Base |
| --- | --- |
| Local backend | `http://localhost:5000/api` |
| Local frontend calls | `/api` dengan dev resolution ke port 5000 |
| Production | `/api` pada host yang dikonfigurasi |

### Authentication

Route privat membutuhkan:

```http
Authorization: Bearer <supabase-access-token>
Accept: application/json
```

### Success response

```json
{
  "success": true,
  "data": {}
}
```

### Error response

```json
{
  "success": false,
  "code": "machine_readable_code",
  "message": "Pesan aman untuk pengguna"
}
```

### Status codes

| Code | Makna |
| ---: | --- |
| 200 | Request berhasil |
| 201 | Resource dibuat |
| 204 | Mutation berhasil tanpa body |
| 400 | Input tidak valid |
| 401 | Authentication tidak valid |
| 403 | Role/ownership tidak mengizinkan |
| 404 | Resource tidak ditemukan |
| 409 | Conflict atau duplicate state |
| 413 | Payload/file terlalu besar |
| 415 | Media type tidak didukung |
| 429 | Rate limited |
| 500 | Internal failure yang sudah disanitasi |
| 503 | Dependency/provider unavailable |

## 2. Health dan runtime

| Method | Path | Auth | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Compatibility health |
| GET | `/api/v1/health` | Public | Versioned health |
| GET | `/api/v1/system` | Required | Runtime/system info aman |
| GET | `/api/v1/metrics` | Required | Metrics summary |
| GET | `/api/v1/activity` | Required | Recent activity |
| GET | `/api/v1/projects` | Required | Project telemetry |
| GET | `/api/v1/dashboard/status` | Required | Aggregated dashboard telemetry |

Health response tidak boleh memuat secret, connection string, atau internal stack.

## 3. AI Newsroom

### Generate intelligence draft

```http
POST /api/ai/newsroom
```

Auth: required.

Request baseline:

```json
{
  "topic": "Fakta dan konteks yang diberikan pengguna",
  "layer": "decision",
  "mode": "news",
  "audience": "public",
  "complexity": "standard",
  "factGuard": true,
  "citationEngine": true,
  "sourceConfidence": true,
  "verifiedFactsCount": 0,
  "verificationItemsCount": 0,
  "assessment": {},
  "priority": null
}
```

Validation:

- `topic`, `layer`, `mode`, `audience`, dan `complexity` wajib string non-empty.
- Topic harus mengikuti batas panjang server.
- Boolean guard dinormalisasi.

Response utama:

```json
{
  "success": true,
  "draft": "Markdown draft",
  "evidence": {},
  "factClassifications": [],
  "sourceQuality": {},
  "confidenceAnalysis": {},
  "confidence": {
    "score": 0,
    "publicationReadiness": "REVIEW"
  },
  "metadata": {
    "promptVersion": "2.8.0",
    "createdAt": "ISO-8601"
  }
}
```

Output tetap draft dan membutuhkan human review.

## 4. Knowledge Base

Knowledge router tersedia melalui compatibility prefix `/api/knowledge` dan prefix utama `/api/v1/knowledge`. Client menggunakan prefix versioned.

### Contract suffixes

| Method | Suffix | Fungsi |
| --- | --- | --- |
| GET | `/documents` | List dokumen milik user |
| GET | `/documents/:id` | Preview metadata dan chunk milik user |
| POST | `/documents` | Buat dokumen manual |
| POST | `/documents/upload` | Upload dan ekstrak file |
| PUT | `/documents/:id` | Replace/update dokumen |
| PATCH | `/documents/:id` | Partial update/toggle context |
| DELETE | `/documents/:id` | Hapus dokumen milik user |
| GET | `/search` | Full-text/scoped search |

Semua route membutuhkan auth.

### Upload

```http
POST /api/knowledge/documents/upload
Content-Type: multipart/form-data
```

Form fields:

| Field | Type | Aturan |
| --- | --- | --- |
| `file` | File | Satu file; `.txt`, `.md`, `.pdf`, `.docx`; maksimum 10 MB |
| `title` | String | Opsional; fallback ke filename |
| `use_in_ai_context` | Boolean string | Default `true` |

Backend memvalidasi extension, MIME type, signature/header, binary/null byte, dan script-like text untuk format text.

### Manual create/update payload

```json
{
  "title": "Judul dokumen",
  "content": "Isi dokumen",
  "source": "manual",
  "use_in_ai_context": true,
  "metadata": {}
}
```

### Search query

Implementasi harus mempertahankan filter ownership dan dapat menerima query teks serta `onlyEnabled` sesuai service route. Parameter final harus dipastikan dari code sebelum client publik dibekukan.

## 5. Universal Web Builder

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/api/v1/web-builder/projects` | List project user |
| POST | `/api/v1/web-builder/projects` | Create project |
| GET | `/api/v1/web-builder/projects/:projectId` | Detail project |
| PATCH | `/api/v1/web-builder/projects/:projectId` | Update project |
| DELETE | `/api/v1/web-builder/projects/:projectId` | Delete project |
| GET | `/api/v1/web-builder/projects/:projectId/pages` | List pages |
| POST | `/api/v1/web-builder/projects/:projectId/pages` | Create page |
| GET | `/api/v1/web-builder/pages/:pageId` | Detail page |
| POST | `/api/v1/web-builder/projects/:projectId/export` | Export project |

Semua route membutuhkan auth dan ownership check.

### Create project baseline

```json
{
  "title": "Project title",
  "slug": "project-slug",
  "description": "Project description",
  "theme": {},
  "settings": {},
  "metadata": {}
}
```

Status yang diizinkan database: `draft`, `exported`, `archived`.

### Create page baseline

```json
{
  "title": "Home",
  "path": "/",
  "sort_order": 0,
  "seo": {},
  "sections": [],
  "metadata": {}
}
```

## 6. AI/chat routes

AI/chat contract harus memenuhi aturan berikut walaupun endpoint internal dapat berkembang:

- Auth required.
- Session ownership required.
- Model berasal dari allowlist/provider resolver.
- Default model: `openrouter/auto`.
- Request memiliki timeout/abort.
- Response/provider error dinormalisasi.
- Message write tidak boleh duplikat pada retry.

## 7. Error codes baseline

| Code | Area |
| --- | --- |
| `missing_authorization` | Header auth kosong |
| `invalid_bearer_format` | Format bearer salah |
| `invalid_supabase_token` | Token tidak valid |
| `invalid_supabase_user` | User tidak valid |
| `AUTH_PROVIDER_UNAVAILABLE` | Supabase/auth dependency unavailable |
| `invalid_payload` | Request newsroom invalid |
| `ai_newsroom_failed` | Newsroom generation failure |
| `knowledge_user_required` | Identity email knowledge tidak tersedia |
| `knowledge_upload_required` | File tidak tersedia |
| `knowledge_upload_invalid` | Upload validation gagal |
| `knowledge_upload_type_unsupported` | Format tidak didukung |
| `knowledge_upload_parse_failed` | Ekstraksi gagal |
| `EMBEDDING_PROVIDER_NOT_CONFIGURED` | Provider embedding belum memiliki konfigurasi server |
| `EMBEDDING_PROVIDER_AUTH_FAILED` | Credential provider embedding ditolak |
| `EMBEDDING_PROVIDER_UNSUPPORTED` | Provider embedding tidak didukung |
| `KNOWLEDGE_CHAT_PROVIDER_NOT_CONFIGURED` | OpenRouter Knowledge Copilot belum dikonfigurasi |
| `KNOWLEDGE_CHAT_PROVIDER_AUTH_FAILED` | Credential OpenRouter Knowledge Copilot ditolak |
| `knowledge_request_failed` | Knowledge failure fallback |

## 8. API design rules

- Jangan membuat `/api/api/...`.
- Gunakan satu versioned prefix untuk kontrak baru.
- Jangan mengembalikan HTML pada API JSON.
- Jangan mengirim stack trace production.
- Mutation baru harus memiliki idempotency strategy jika dapat diulang.
- Pagination wajib untuk collection besar.
- Date/time menggunakan ISO-8601 UTC; UI mengubah ke zona yang sesuai.
- Breaking change memerlukan version baru atau migration compatibility.
