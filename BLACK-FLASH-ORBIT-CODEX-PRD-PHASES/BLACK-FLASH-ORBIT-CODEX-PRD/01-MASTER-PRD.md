# BLACK FLASH ORBIT --- MASTER PRD

## Production Readiness v1.0

### Mission

Bring BLACK FLASH ORBIT from development-ready to production-ready
without regressing working features.

### Current architecture baseline

-   React + Vite frontend
-   Node.js backend
-   Supabase authentication/data
-   OpenRouter AI
-   OpenAI embeddings
-   Knowledge Base
-   Workflow persistence
-   AI Newsroom
-   Web Builder
-   Intelligence
-   Agent Bridge
-   Command Center telemetry
-   Dark, responsive ORBIT UI

### Current known engineering state

Production builds have succeeded. Runtime starts successfully on the
local frontend and backend. Recent performance work introduced or may
include frontend shared request caching, ProfileProvider,
dashboard-status coordination, Knowledge request deduplication,
server-side request coalescing, user-scoped cache keys, and
visibility-aware polling.

Recent runtime logs still showed repeated HTTP requests to
profile/dashboard and duplicate Newsroom history revalidation. Browser
HTTP count alone is not the final performance metric: expensive
Supabase/provider work must be measured separately.

### Global requirements

1.  Audit existing implementation before editing.
2.  Preserve all existing functionality and UI identity.
3.  Prefer targeted, modular patches over rewrites.
4.  Never expose or commit secrets.
5.  Keep server secrets server-only.
6.  Authenticated cache data must never cross users.
7.  Failed/rejected provider calls must not be cached as successful
    data.
8.  Mutations must invalidate related caches.
9.  Production must use explicit CORS policy and safe error responses.
10. Production authorization must be server-validated.
11. Cache/coalescer structures must be bounded.
12. Preserve Windows local-development compatibility.
13. Avoid dependencies unless justified.
14. Required gate for every phase:

-   `npm run lint`
-   `npm test`
-   `npm run build`

### Execution plan

#### Phase 1 --- Network Performance + Observability

Prove and control request/provider fan-out, polling, cache isolation and
coalescing.

#### Phase 2 --- Production Security + Deployment Hardening

Harden environment handling, CORS, headers, rate limits, authz,
validation, logging, health/readiness, errors and shutdown.

#### Phase 3 --- Final QA + Production Release

Run full product smoke tests, responsive QA, bundle-secret inspection,
security regression, restart/recovery and release gate.

### Final definition of done

BLACK FLASH ORBIT can be marked `PRODUCTION READY` only if:

-   Lint PASS
-   Tests PASS with zero failures
-   Production build PASS
-   Authentication PASS
-   Dashboard PASS
-   AI PASS
-   Knowledge PASS
-   Newsroom PASS
-   Workflow PASS
-   Web Builder PASS
-   Responsive QA PASS
-   Security checks PASS
-   Production environment validation PASS
-   Health/readiness PASS
-   No secret leakage
-   No known cross-user cache leakage
-   No unresolved critical/high security issue

### Codex reporting format

For each changed file:

**FILE:** exact path\
**PROBLEM:** root cause\
**ACTION:** add / modify / remove\
**IMPLEMENTATION:** what changed and why\
**SECURITY:** impact\
**TEST:** verification

At the end of each phase report:

-   Root Causes Found
-   Files Changed
-   Files Added
-   Files Removed
-   Verification Evidence
-   Security Verification
-   Lint
-   Tests
-   Build
-   Remaining Risks
-   Phase Status: PASS / FAIL
