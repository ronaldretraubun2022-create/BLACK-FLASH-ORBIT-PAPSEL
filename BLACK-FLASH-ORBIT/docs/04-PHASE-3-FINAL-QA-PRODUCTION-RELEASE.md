# PHASE 3 --- FINAL QA + PRODUCTION RELEASE

## Prerequisite

Start only after Phase 2 is PASS and explicitly approved.

## Objective

Prove BLACK FLASH ORBIT is ready for real use through automated release
gates, product smoke tests, responsive QA, security regression and
recovery verification.

## 1. Automated release gate

Create `npm run verify` if practical. It must run the required quality
gates:

``` powershell
npm run lint
npm test
npm run build
```

Any failure must fail the release gate.

## 2. Authentication smoke test

Verify:

-   register
-   login
-   session restore
-   protected routes
-   invalid credentials
-   logout
-   expired/invalid session
-   user isolation

## 3. Command Center

Verify dashboard load, runtime telemetry, projects, activity, AI
readiness, system report and session guardrail. No fatal console errors.

## 4. AI

Verify successful request, provider failure, timeout behavior, rate
limit handling, server-only secrets and sanitized logging.

## 5. Knowledge Base

Verify list, supported upload, processing/indexing, ask/retrieve,
delete, cache invalidation and unauthorized access denial.

## 6. AI Newsroom

Verify history, generation, saved history, duplicate-fetch behavior,
loading/error/empty states and provider failure handling.

## 7. Workflow

Verify create, save, reload, execute where supported, failure state and
persistence across restart.

## 8. Web Builder

Preserve and verify existing preview, export, ZIP and publish
capabilities.

## 9. Intelligence and Agent Bridge

Verify routes load, protected access works and existing functionality
has not regressed.

## 10. Responsive QA

Test at minimum:

-   360px
-   390px
-   768px
-   1024px
-   1440px

Inspect navigation, cards, tables, forms, modals, long text, badges,
timestamps, overflow and touch targets.

Preserve current dark-glass ORBIT identity.

## 11. Final visual polish

Fix remaining metadata spacing/wrapping without redesigning the
dashboard. Examples include visually separating:

-   `Stored measurement` from `Timestamp unavailable`
-   `Supabase record` from its date/time

Use semantic wrappers/gaps rather than inserting fragile literal spaces.

## 12. Loading, empty and error states

Every major module should avoid blank screens and provide appropriate
loading, empty, recoverable error and retry behavior where useful.

## 13. Production bundle secret inspection

Inspect generated client artifacts for accidental inclusion of:

-   OPENROUTER_API_KEY
-   OPENAI_API_KEY
-   SUPABASE_SERVICE_ROLE_KEY
-   bearer/JWT values
-   other server-only secrets

Intentionally public Supabase anon/client configuration is allowed.

## 14. Final defensive security check

Review:

-   XSS
-   injection risks
-   auth bypass
-   IDOR
-   privilege escalation
-   CORS
-   rate limits
-   secret leakage
-   unsafe file upload
-   path traversal
-   open redirects
-   unsafe external URL handling
-   cache cross-user leakage
-   verbose production errors

Testing is defensive and limited to this application.

## 15. Restart and recovery

Verify server restart, session behavior, workflow persistence,
database-backed state, cold caches, health and readiness. Application
must recover cleanly.

## 16. Final verification

Run:

``` powershell
npm run verify
```

or, if verify is not added:

``` powershell
npm run lint
npm test
npm run build
```

Zero failures are required.

## Final release acceptance

Mark `PRODUCTION READY` only if all required modules and
security/release gates pass.

If a critical/high issue remains, status must be `NOT READY`.

## Required final report

Return:

# BLACK FLASH ORBIT --- FINAL PRODUCTION READINESS REPORT

## Release Summary

## Files Changed

## Automated Verification

## Authentication

## Dashboard

## AI

## Knowledge

## Newsroom

## Workflow

## Web Builder

## Intelligence / Agent Bridge

## Responsive QA

## Security Verification

## Bundle Secret Inspection

## Restart / Recovery

## Remaining Risks

## Deployment Notes

## FINAL STATUS

Final status must be exactly one of:

`PRODUCTION READY`

or

`NOT READY`
