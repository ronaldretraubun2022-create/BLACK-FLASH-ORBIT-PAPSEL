# BLACK FLASH ORBIT — Runtime Telemetry Integrity Patch

## Scope
This patch removes misleading static/demo telemetry from the Command Center and makes project metrics source-aware.

## Changes
- Removed hard-coded fallback command metrics (248 drafts, 91.8% confidence, 1.7K assets, 99.9 uptime).
- Removed hard-coded newsroom progress percentages (92/88/76/100).
- Removed hard-coded editorial desk timestamps.
- Removed backend `lastScan: "just now"` fabrication when `orbit_projects.last_scan` is null.
- Added `telemetrySource` metadata to mapped project records.
- Project scores are displayed only as recorded measurements when a real `last_scan` exists.
- Stored project rows without a recorded signal now render as configuration metadata.
- Empty synced-project state no longer displays a fake `0%` progress value.

## Verification
- `node --check server/routes/index.js` PASS
- `node --check server/lib/orbitDashboardTelemetry.js` PASS
- `node --check server/index.js` PASS
- Static scan of `apps/web/src/App.jsx`, `server/routes/index.js`, and `server/lib/orbitDashboardTelemetry.js` found no remaining hard-coded percentage/timestamp patterns targeted by this patch.

## Local verification
Run:
```powershell
npm run lint
npm test
npm run build
npm run dev
```

Restart the backend too if it is running separately:
```powershell
npm start
```
