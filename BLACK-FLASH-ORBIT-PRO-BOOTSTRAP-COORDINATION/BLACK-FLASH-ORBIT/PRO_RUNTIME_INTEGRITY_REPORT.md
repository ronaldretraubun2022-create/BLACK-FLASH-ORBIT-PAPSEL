# BLACK FLASH ORBIT — PRO Runtime Integrity Patch

## Scope

This patch continues from the audited telemetry-integrity baseline and focuses on production-grade truthfulness, provenance, readiness semantics, and command-center UX.

## Changes

- Dashboard metric labels now match their actual data sources:
  - Workflow Events
  - Projects
  - Activity Signals
  - Ops Health
- Activity records expose provenance and a full stored timestamp instead of looking implicitly live.
- Supabase activity rows are marked `supabase_record`.
- Dashboard project/activity/report providers use strict mode for `/api/v1/dashboard/status`; provider failures no longer silently fabricate “backend online” activity.
- Dashboard response includes a `provenance` block.
- Dashboard response includes the asynchronous readiness snapshot.
- Workflow persistence is only presented as ready when the readiness probe returns `ready`; `configured` alone is no longer treated as ready.
- Header wording changed from generic `Telemetry: live` to `Backend Runtime: connected`.
- Command Center status text changed to `Backend runtime telemetry connected.`
- Static module fallback states are labeled as configured metadata rather than runtime-ready.
- “Start Editorial Pulse” now opens `/ai-newsroom`.
- “View System Report” now scrolls to the system report section.
- Telemetry auth logs strip query strings/fragments from paths.
- Dashboard telemetry test expectation updated for the new truthful status wording.

## Security / Secret Handling

This package intentionally excludes `.env`. Keep the existing local `.env` on your machine. Never copy `SUPABASE_SERVICE_ROLE_KEY` into a `VITE_*` variable.

## Verification Performed

- `node --check server/routes/index.js` — PASS
- `node --check server/lib/orbitDashboardTelemetry.js` — PASS
- `node --check server/services/observability/healthService.js` — PASS
- `npm run lint` — PASS (312 files scanned)

Full automated tests could not run in the audit container because the sanitized baseline intentionally has no `node_modules` and this environment cannot install dependencies. The failure was `Cannot find module 'express'`, not a source-code assertion failure.

## Local Verification

Run on the machine where dependencies are installed:

```powershell
npm ci
npm run lint
npm test
npm run build
npm start
```

In a second terminal:

```powershell
npm run dev
```

Expected Command Center behavior:
- Backend Runtime shows `connected`, not a generic `live`.
- Workflow Persistence shows `ready` only after persistence readiness is actually verified.
- Live/Activity Brief items display source and timestamp.
- No fabricated “backend online” event appears when the Supabase activity query fails.
- Metric card labels match the values they display.
- Editorial Pulse and System Report buttons perform real actions.
