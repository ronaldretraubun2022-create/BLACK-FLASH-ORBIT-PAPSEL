# CODEX EXECUTION PROMPT

Use this repository's actual source code as the source of truth.

Read `01-MASTER-PRD.md`, then execute ONLY the phase explicitly
authorized by the user.

For the first run, execute only:

`02-PHASE-1-NETWORK-PERFORMANCE-OBSERVABILITY.md`

Rules:

-   Audit before editing.
-   Implement fixes; do not stop at recommendations.
-   Preserve working features and UI.
-   Do not delete or modify the real `.env`.
-   Do not expose secrets.
-   Do not start the next phase automatically.
-   Run lint, the complete test suite, and production build.
-   Fix failures caused by the changes.
-   Report exact files changed and evidence.
-   At the end, STOP and return the requested phase report.
