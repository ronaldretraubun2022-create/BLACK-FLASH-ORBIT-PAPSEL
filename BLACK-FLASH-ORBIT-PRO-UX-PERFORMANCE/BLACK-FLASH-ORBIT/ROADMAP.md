# Product Roadmap — BLACK FLASH ORBIT

Roadmap menggunakan quality gate, bukan tanggal kaku. Phase berikutnya dimulai setelah exit criteria phase aktif terpenuhi.

## Ringkasan

| Milestone | Fokus | Status |
| --- | --- | --- |
| v0.5.5 | Auth dan RBAC baseline | Selesai |
| v0.6 | Security Center | Selesai |
| v0.7 | Project Health Monitor | Selesai |
| v0.8 | AI Command Bar dan Command Center | Development complete, release pending |
| v0.8.1 | Stabilization dan Knowledge Base | Berikutnya |
| v0.9 | AI Workspace Pro | Direncanakan |
| v1.0 | Internal Production Release | Direncanakan |
| v1.1 | OSINT Defensive Workspace | Backlog |
| v1.2 | Automation dan Reports | Backlog |
| v2.0 | SaaS Platform | Future |

## v0.8 — AI Command Bar

### Deliverables

- Mobile Command Center.
- Command Palette.
- AI Command Bar.
- Security Center integration.
- Project Health Monitor integration.
- Dashboard telemetry dan degraded state.

### Exit criteria

- Full regression lulus.
- Tag `v0.8.0-ai-command-bar` dibuat.
- PR `sprint4-dev` → `master` direview.
- Production deployment lulus smoke test.

## v0.8.1 — Stabilization dan Knowledge Base

### Deliverables

- Embedding provider validation.
- PDF/DOCX/TXT indexing.
- Index lifecycle yang dapat dipantau.
- Preview, search, retry, dan delete cleanup.
- Cross-user ownership test.
- Deployment hardening.

### Exit criteria

- Knowledge indexing success ≥ 95% untuk file valid pada test set.
- Tidak ada sukses palsu saat provider gagal.
- RLS/ownership suite lulus.

## v0.9 — AI Workspace Pro

### Deliverables

- Model selector final.
- Session search dan rename.
- Copy/export.
- Autosave idempotent.
- Abort, retry, regenerate.
- Provider fallback.
- Usage/token/cost visibility.
- Memory control.

### Exit criteria

- Long-session regression lulus.
- Tidak ada duplicate messages.
- Provider outage dapat ditangani tanpa kehilangan draft.

## v1.0 — Internal Production Release

### Deliverables

- Stabil Command Center.
- AI Workspace dan Newsroom production-ready.
- Knowledge Base operational.
- Web Builder export-ready.
- Workflow Automation baseline.
- Audit log dan backup minimum.
- Deployment dan incident runbook.

### Exit criteria

- P0 dan P1 release issues selesai.
- Security review lulus.
- Backup/restore drill lulus.
- Production monitoring aktif.

## v1.1 — Defensive OSINT Workspace

### Deliverables

- OSINT Case.
- Source Registry.
- Evidence management.
- Chain of Custody.
- Digital footprint workflow yang legal.
- Report Builder.
- AI assistant dengan source/citation guard.

### Batasan

- Defensive dan legal use only.
- Tidak ada credential theft, exploitation, stalking, atau unauthorized access.
- Data pribadi dibatasi dan diaudit.

## v1.2 — Automation dan Reports

### Deliverables

- Visual workflow editor.
- Schedule dan webhook triggers.
- Retry/idempotency.
- Execution logs.
- Reports archive dan export.
- Notification rules.

## v2.0 — SaaS Platform

### Deliverables

- Organization dan multi-workspace.
- Subscription dan quota.
- Central admin.
- Usage analytics.
- Integration catalog.
- Data retention controls.
- Tenant isolation test suite.

## Deferred ideas

Item berikut sengaja ditunda agar core tidak melebar:

- Native mobile app.
- Marketplace publik.
- Autonomous agent deployment.
- Multi-region infrastructure.
- Advanced billing.
- Offensive security tooling.

