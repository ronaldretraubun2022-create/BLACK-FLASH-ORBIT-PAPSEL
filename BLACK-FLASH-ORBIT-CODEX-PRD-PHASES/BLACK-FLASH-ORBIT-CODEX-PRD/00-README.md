# BLACK FLASH ORBIT --- CODEX PRODUCTION READINESS PACK

Project: `BLACK-FLASH-ORBIT`\
Release baseline: `Developer Agent Bridge v1.3`

## Purpose

This package is the execution contract for taking BLACK FLASH ORBIT from
the current development-ready baseline to a production-ready release.

Execute strictly in this order:

1.  `01-MASTER-PRD.md`
2.  `02-PHASE-1-NETWORK-PERFORMANCE-OBSERVABILITY.md`
3.  STOP and produce Phase 1 report.
4.  Only after approval:
    `03-PHASE-2-PRODUCTION-SECURITY-DEPLOYMENT-HARDENING.md`
5.  STOP and produce Phase 2 report.
6.  Only after approval: `04-PHASE-3-FINAL-QA-PRODUCTION-RELEASE.md`
7.  Produce final Production Readiness Report.

## Non-negotiable rules

-   Audit actual repository state before modifying code.
-   Source code is the source of truth when it differs from assumptions
    in this PRD.
-   Do not rewrite the project from scratch.
-   Preserve existing features, routes, UI identity, Supabase, AI,
    Knowledge, Newsroom, Workflow, Web Builder, Intelligence and Agent
    Bridge.
-   Never modify, delete, print, or package the developer's real `.env`.
-   Never expose service-role keys, OpenRouter/OpenAI keys, JWTs, bearer
    tokens, passwords, or other secrets.
-   Authenticated caches must be user/session scoped.
-   Do not delete tests merely to make a build pass.
-   Each phase must end with `npm run lint`, `npm test`, and
    `npm run build`.
-   Do not begin the next phase until the previous phase is PASS and
    explicitly approved.
