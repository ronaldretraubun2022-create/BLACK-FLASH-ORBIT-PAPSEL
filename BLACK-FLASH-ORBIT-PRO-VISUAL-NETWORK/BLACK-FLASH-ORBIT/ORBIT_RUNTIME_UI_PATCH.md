# ORBIT Runtime UI Patch

## Scope

This patch continues from the audited BLACK FLASH ORBIT baseline and fixes misleading dashboard metadata found during runtime inspection.

## Changes

- Replaced hard-coded `Role Admin` with the authenticated profile role.
- Replaced obsolete `Firestore Reads` dashboard label with `Supabase Data Layer`.
- Changed the security summary from `Admin guardrail` to role-aware `Session guardrail`.
- Removed fabricated fallback project percentages and fake “last scan” timestamps.
- Removed hard-coded fallback `securityScore: 94`.
- Release readiness cards now use backend health/dependency/auth evidence where available.
- Release/branch/UI labels remain metadata and are explicitly separated from live deployment verification.
- Existing routes, auth guards, newsroom, knowledge, workflow, web builder, and Agent Bridge behavior were preserved.

## About `svg...` text seen in copied page output

No literal `svgCommand`, `svgAI Newsroom`, or similar text exists in the React source. Navigation icons are Lucide React SVG components. The `svg...` tokens seen in copied/extracted page text are consistent with a text/HTML extraction representation rather than a literal UI string, so the patch does not replace working icon components with brittle markup.

## Verification

- `npm run lint`: PASS (310 files scanned).
- Full tests/build could not run in the audit container because dependency installation was incomplete (`express`/`vite` unavailable after network-restricted `npm ci`).
- Run on the local machine with dependencies installed:
  - `npm ci`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run dev`

## Environment safety

This package intentionally excludes `.env`. Keep the already-configured local `.env`; do not overwrite it with an older copy.
