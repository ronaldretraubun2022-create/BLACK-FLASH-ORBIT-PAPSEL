# BLACK FLASH ORBIT — PRO UX + Performance Patch

## Scope

This patch continues from the audited PRO baseline and does not include `.env` or secrets.

### UX polish
- Formats telemetry provenance for humans (`Supabase record`, `Stored measurement`, etc.).
- Removes raw underscore-style provenance labels from Command Center surfaces.
- Makes System Report statuses evidence-aware.
- Adds evidence-source labels so runtime evidence is distinguished from release metadata.
- Keeps project telemetry honest when historical timestamps are unavailable.

### Performance
- Deduplicates concurrent `/api/v1/profile` requests across App, UserMenu, Knowledge, Web Builder, Intelligence, and Agent Bridge.
- Adds a short 15-second in-memory profile cache to avoid redundant re-fetches during route/component mounts.
- Manual `refreshProfile()` bypasses the cache.
- Cache is keyed per authenticated user and never persists to disk.

### Compatibility
- Preserves the PRO telemetry contract string: `Backend runtime telemetry connected.`
- No database schema or `.env` changes.
- No API contract changes.

## Verification performed in audit environment

- `node scripts/lint-project.mjs` → PASS (313 files scanned)

Full dependency-backed tests/build should be run on the local machine where `node_modules` and `.env` are already configured:

```powershell
npm run lint
npm test
npm run build
npm run dev
```

Expected regression target: 173/173 tests PASS.
