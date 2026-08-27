BLACK FLASH ORBIT - Production Observability Stage 1

TARGET BRANCH
feature/production-observability

FILES
server/services/observability/logger.js
server/services/observability/healthService.js
server/middleware/errorHandler.js
api/v1/health.js

WHAT THIS PATCH DOES
- Adds structured JSON logging.
- Adds request/correlation IDs to handled backend errors.
- Redacts authorization, cookies, passwords, tokens, API keys and service-role secrets.
- Keeps production stack traces out of structured logs.
- Expands /api/v1/health with environment, runtime and dependency readiness.
- Does NOT make live outbound health probes to Supabase/OpenRouter, so health checks remain fast and do not consume provider quota.

INSTALL
Copy the folders from this ZIP into the BLACK-FLASH-ORBIT repository root and allow the listed files to replace the existing files.

VALIDATE
npm test
npm run build
npm audit

LOCAL HEALTH TEST
npm start

Then in another terminal:
curl http://localhost:5000/api/v1/health

EXPECTED STATUS
- healthy: Supabase, AI and Knowledge readiness are configured.
- degraded: at least one required dependency is not configured.
- HTTP status remains 200 for readiness visibility in Stage 1.

AFTER PASS
git status
git add server/services/observability server/middleware/errorHandler.js api/v1/health.js
git commit -m "feat: add production observability foundation"
git push -u origin feature/production-observability
