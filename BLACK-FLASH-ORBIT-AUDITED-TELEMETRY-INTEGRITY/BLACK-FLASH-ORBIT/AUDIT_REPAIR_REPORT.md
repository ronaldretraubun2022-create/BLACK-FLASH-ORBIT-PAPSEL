# BLACK FLASH ORBIT — Audit & Repair Report
Date: 2026-08-26

## Scope
Repository structure, dependencies/package scripts, build/runtime baseline, authentication/authorization, CORS/CSP/rate limiting, file upload validation, secret exposure, logging/error leakage, AI/agent execution boundaries, frontend unsafe rendering indicators, tests, and packaging hygiene.

## Findings and repairs

### CRITICAL — Credentials were included in the uploaded archive
The source archive contained real-looking Supabase service-role, OpenRouter, OpenAI and Vercel OIDC credentials in local environment files. The repaired archive removes `.env`, `.env.local`, `.vercel/`, and Supabase CLI temp state.

Action required outside the codebase: revoke/rotate every exposed credential in the corresponding provider consoles, then create a fresh `.env` locally from `.env.example`.

### HIGH — Machine-specific dependencies were shipped
The archive included `node_modules` built for Windows. The Linux audit environment could not load Rolldown's Linux native binding, so the frontend build failed before source compilation.

Repair: the audited package excludes `node_modules` and generated `dist`. Reinstall from the lockfile on the target machine.

### MEDIUM — Request logs retained query strings
`server/index.js` and `server/services/observability/logger.js` logged the full request URL. Query parameters may carry search terms, document identifiers, or accidental tokens.

Repair: request logging now strips query strings and fragments before persistence/output.

### MEDIUM — Knowledge API could expose development stack/cause details
`server/routes/knowledgeRoutes.js` returned stack/cause information to clients whenever NODE_ENV was not production.

Repair: debug details are now disabled by default, enabled only with `DEBUG_KNOWLEDGE_ERRORS=true` in non-production, sanitized, redacted and bounded.

## Existing controls verified
- Helmet with production CSP and frame/object restrictions.
- CORS allowlist; wildcard origins are filtered.
- API rate limiting and dedicated Knowledge ask limiter.
- Supabase bearer-token verification.
- Admin authorization from server-side profile/app metadata.
- Knowledge uploads capped at 10 MB with extension/MIME/signature/content checks.
- Agent process execution uses allowlists/spawn argument arrays and is covered by security tests.
- Intelligence frontend guards against raw HTML rendering.
- Service-role/provider secrets are server-side in application source.
- Error middleware returns safe 5xx messages and request IDs.

## Verification
- `npm run lint`: PASS
- `npm test`: PASS — 173/173 tests
- `npm run build`: source build could not be evaluated from the original packaged dependencies because the archive contained Windows `node_modules` and the audit runtime is Linux. Failure: missing `@rolldown/binding-linux-x64-gnu`.

Run after extracting the repaired archive:
```bash
cp .env.example .env
# Fill only newly rotated credentials
npm ci
npm run lint
npm test
npm run build
npm start
```

## Credential rotation checklist
1. Rotate Supabase service-role credentials.
2. Rotate OpenRouter API key.
3. Rotate OpenAI API key.
4. Revoke/refresh Vercel OIDC/session credentials by re-authenticating/relinking as appropriate.
5. If the original ZIP or these values were ever committed, purge them from Git history and invalidate all old credentials.
6. Never commit `.env`, `.env.local`, `.vercel/`, `supabase/.temp/`, `node_modules/`, or generated `dist/`.
