# PHASE 1 --- NETWORK PERFORMANCE + OBSERVABILITY

## Objective

Close the remaining performance investigation with measurable evidence.
Do not define success as exactly one browser HTTP request. Hard reload,
HMR, and multiple tabs can create separate runtimes. Success means
equivalent short-window requests do not unnecessarily repeat expensive
Supabase/provider work.

## 1. Request-source audit

Search the repository for all callers and indirect triggers of:

-   `/api/v1/profile`
-   `/api/v1/dashboard/status`
-   `/api/v1/knowledge/documents`
-   `/api/ai/newsroom/history`

Also inspect `getProfile`, `getDashboardStatus`, Knowledge loaders,
Newsroom history loaders, `fetch`, API wrappers, `useEffect`, auth
listeners, `setInterval`, `setTimeout`, `visibilitychange`, retry logic
and route mounts.

Document whether duplication originates from multiple consumers,
providers, auth lifecycle, remount/HMR, polling, browser revalidation,
multiple tabs or server-side duplicate provider work.

## 2. Coalescer observability

Instrument the existing server coalescer so development can distinguish:

-   `source=miss`
-   `source=inflight`
-   `source=cache`

Example:

`[ORBIT COALESCE] resource=profile source=cache user=<safe-fingerprint>`

Never log raw bearer tokens, JWTs, authorization headers, passwords or
API/service keys. Production verbosity must be configurable.

## 3. Profile coordination

Verify equivalent profile requests for the same authenticated user do
not repeatedly execute expensive provider/Supabase work inside the
coalescing window.

Requirements:

-   user/session scoped
-   bounded TTL
-   bounded size
-   rejected calls not cached
-   safe logout/user switch
-   mutation invalidation where needed
-   no cross-user leakage

## 4. Dashboard coordination

Audit all dashboard-status consumers and polling owners. Equivalent
short-window requests must reuse inflight/cache work when safe.

Do not hide architectural problems by blindly increasing TTL.

## 5. Newsroom history dedup

Audit duplicate `/api/ai/newsroom/history` requests. HTTP 304 is valid
and must not be treated as an error. If duplicate consumers in one
runtime cause redundant work, use shared in-flight coordination while
preserving useful HTTP cache semantics.

## 6. Knowledge regression

Verify existing Knowledge dedup remains correct:

-   user/session scoped
-   parallel list calls deduplicated
-   upload invalidates list cache
-   delete invalidates list cache
-   rejected calls not cached
-   no cross-user leakage

## 7. Polling audit

Audit all intervals/timeouts. Require cleanup on unmount, no timer
accumulation, reasonable intervals, and pause unnecessary telemetry
polling while `document.hidden`.

## 8. Memory safety

Server coalescer/cache must be bounded. Verify maximum entries, TTL
expiry/cleanup and no unlimited Map growth.

## 9. Required regression tests

At minimum:

1.  Six parallel profile operations, same user -\> one provider
    execution within coalescing window.
2.  Six parallel dashboard operations, same user -\> one provider
    execution where applicable.
3.  User A cache != User B cache.
4.  Rejected provider call is not cached; next call can retry.
5.  Knowledge mutation invalidates list cache.
6.  Parallel Knowledge list consumers share one underlying loader.
7.  Parallel Newsroom history consumers avoid unnecessary duplicate
    work.
8.  Expired cache executes provider again.
9.  Cache maximum-size/cleanup behavior is bounded.

Do not remove existing tests to pass these tests.

## 10. Verification

Run:

``` powershell
npm run lint
npm test
npm run build
npm run dev
```

Manually inspect profile, dashboard status, Knowledge documents and
Newsroom history.

## Acceptance criteria

-   Request sources documented.
-   Profile provider fan-out controlled.
-   Dashboard provider fan-out controlled.
-   Knowledge dedup preserved.
-   Newsroom redundant work controlled.
-   Polling ownership controlled.
-   Coalescer observable.
-   Authenticated cache isolation verified.
-   Cache bounded.
-   Rejected work not cached.
-   Regression tests added.
-   Lint PASS.
-   Tests PASS.
-   Build PASS.
-   Runtime starts.

## STOP CONDITION

Do not start Phase 2. Produce a `PHASE 1 FINAL REPORT`, mark PASS or
FAIL, and wait for explicit approval.
