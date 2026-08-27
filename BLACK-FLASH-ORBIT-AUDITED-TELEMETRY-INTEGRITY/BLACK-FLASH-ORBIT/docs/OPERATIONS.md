# Operations Runbook — BLACK FLASH ORBIT

## 1. Daily check

- Production health.
- Supabase availability.
- Recent 5xx.
- AI provider errors/rate limits.
- Knowledge indexing failures.
- Deployment status.
- Unexpected cost/usage.

## 2. Weekly check

- Dependency audit.
- Auth/permission anomaly review.
- Failed workflow review.
- Backup status.
- Storage growth.
- P0/P1 backlog.
- Documentation drift.

## 3. Service degradation

### Supabase unavailable

- Tampilkan degraded state.
- Jangan bypass auth.
- Tunda mutation yang tidak aman.
- Pantau recovery lalu smoke test.

### AI provider unavailable

- Pertahankan draft input.
- Return safe error.
- Izinkan retry terbatas/fallback jika dikonfigurasi.
- Pantau rate limit dan cost.

### Knowledge indexing unavailable

- Jangan tandai indexed.
- Simpan failure code yang aman.
- Izinkan retry setelah provider pulih.
- Bersihkan partial/orphan data.

## 4. Incident severity

| Severity | Contoh | Respons |
| --- | --- | --- |
| SEV-1 | Secret leak, cross-user data exposure | Stop/contain segera, rotate, incident response |
| SEV-2 | Login/critical module down | Mitigate/rollback, update status |
| SEV-3 | Satu fitur gagal dengan workaround | Patch terarah dan regression test |
| SEV-4 | Cosmetic/minor issue | Backlog terjadwal |

## 5. Incident record

```text
Incident ID:
Started:
Detected:
Severity:
Environment:
Affected users/modules:
Symptoms:
Containment:
Root cause:
Fix:
Validation:
Credential rotation:
Data impact:
Follow-up tests/tasks:
Closed:
```

## 6. Backup/restore drill

1. Pilih environment non-production.
2. Catat schema/version.
3. Buat sample records lintas domain.
4. Jalankan backup.
5. Restore ke target terisolasi.
6. Verifikasi row count, relationships, RLS, dan critical queries.
7. Catat duration, failure, dan recovery point.

### Personal-use Supabase backup

Gunakan export database Supabase untuk data durable ORBIT sebelum migration atau release personal.

```powershell
supabase db dump --linked --file backups/orbit-$(Get-Date -Format yyyyMMdd-HHmmss).sql
```

Jika CLI Supabase belum ter-link, jalankan dari project Supabase yang benar dan jangan commit folder `backups/`.

Data yang wajib ter-cover:

- `newsroom_generations`
- `newsroom_editorial_decisions`
- `orbit_knowledge`
- `orbit_chat_sessions`
- `orbit_chat_messages`
- `orbit_workflow_runs`
- `orbit_workflow_run_steps`
- `orbit_workflow_approvals`
- `orbit_workflow_audit_events`

Restore hanya ke target terisolasi lebih dulu:

```powershell
supabase db reset --linked
psql "<target-database-url>" -f backups/orbit-YYYYMMDD-HHMMSS.sql
```

Setelah restore, jalankan smoke test login, `/api/v1/readiness`, workflow history, AI chat, Newsroom history, Knowledge query, dan cross-user RLS denial.

## 7. Maintenance rule

- Hindari migration/dependency update besar bersamaan dengan feature release.
- Pastikan rollback target tersedia.
- Beritahu pengguna internal untuk downtime terencana.
- Jalankan smoke test setelah maintenance.
