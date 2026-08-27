# PHASE 2 --- PRODUCTION SECURITY + DEPLOYMENT HARDENING

## Prerequisite

Start only after Phase 1 is PASS and explicitly approved.

## Objective

Make BLACK FLASH ORBIT safe, predictable and observable for production
deployment without regressing working application behavior.

## 1. Environment validation and separation

Create/verify centralized environment validation. Classify configuration
into server secrets, server config, public client config and optional
config.

Production startup must fail clearly when mandatory configuration is
missing, but must never print secret values.

Provide/update `.env.example` with placeholders only. Never overwrite or
package the real `.env`.

Inspect the frontend bundle boundary: only intentionally public `VITE_*`
values may reach the client.

## 2. CORS

Production must use an explicit origin allowlist. No wildcard origin
when credentials are used. Localhost may remain available in
development. Handle OPTIONS correctly and reject unknown production
origins safely.

## 3. Security headers

Audit/add appropriate:

-   Content-Security-Policy
-   X-Content-Type-Options
-   Referrer-Policy
-   Permissions-Policy
-   clickjacking/frame protection
-   HSTS only for confirmed HTTPS production deployment

CSP must be derived from actual ORBIT requirements and must not
arbitrarily break Supabase or required resources.

## 4. Rate limiting

Implement route-aware limits, especially for expensive/sensitive
operations:

-   AI endpoints
-   Knowledge upload/chat
-   Newsroom generation
-   Web Builder generation/publish
-   auth-sensitive operations where backend routes exist

Return clean HTTP 429. Health/readiness must not share aggressive AI
limits.

If deployment can run across multiple server instances, document whether
the limiter is process-local and whether a distributed store is
required.

## 5. Health and readiness

Separate:

`GET /health` --- fast process-liveness check, no expensive provider
work.

`GET /ready` --- verifies critical configuration/dependencies safely and
uses appropriate status codes.

Neither endpoint may expose secrets.

## 6. Production error handling

Production responses must not expose stack traces, filesystem paths, SQL
internals, secret-bearing provider errors or raw sensitive Supabase
details.

Use normalized safe errors. Development can retain richer diagnostics.

## 7. Structured logging

Standardize fields such as:

-   timestamp
-   requestId
-   method
-   path
-   status
-   durationMs

Where safe:

-   user fingerprint
-   cache source
-   provider
-   operation

Never log Authorization headers. Generate/propagate request IDs.

## 8. Authorization audit

Audit privileged and user-owned operations. Authentication alone is not
sufficient.

Verify server-side authorization for admin operations, profiles,
Knowledge resources, workflows, project resources and publish
operations. Never trust a client-supplied role.

## 9. Input and upload validation

Validate body, params, query strings, IDs, URLs, prompt sizes, JSON
payloads, file type/MIME and file size.

Defensively address XSS, injection, path traversal, oversized payloads,
malformed input and unsafe external URLs.

## 10. Cache security

Re-audit authenticated profile, dashboard, Knowledge, Newsroom and
workflow caches. No cross-user data. Mutations must invalidate
correctly. Sensitive authenticated responses must use appropriate
cache-control behavior.

## 11. Graceful shutdown

Handle SIGINT/SIGTERM. Stop accepting new work, close HTTP resources
safely and enforce a bounded shutdown timeout.

## 12. Security regression tests

Add tests for at least:

-   production CORS allow/reject
-   required env validation
-   sanitized production errors
-   rate-limit behavior
-   health semantics
-   readiness semantics
-   unauthorized privileged route rejection
-   cross-user cache isolation
-   invalid/malformed input
-   file-size/type rejection where applicable
-   no secret values in diagnostic output where testable

## 13. Verification

Run:

``` powershell
npm run lint
npm test
npm run build
```

Also run production-mode startup/config verification using safe test
configuration.

## Acceptance criteria

-   Env validation PASS.
-   `.env.example` safe.
-   CORS allowlist PASS.
-   Security headers PASS.
-   Rate limiting PASS.
-   Health/readiness separation PASS.
-   Production errors sanitized.
-   Structured logging PASS.
-   Authorization audit PASS.
-   Input validation PASS.
-   Cache isolation PASS.
-   Graceful shutdown PASS.
-   No known secret leakage.
-   Lint PASS.
-   Tests PASS.
-   Build PASS.

## STOP CONDITION

Do not start Phase 3. Produce a `PHASE 2 FINAL REPORT`, mark PASS or
FAIL, list remaining risks, and wait for explicit approval.
