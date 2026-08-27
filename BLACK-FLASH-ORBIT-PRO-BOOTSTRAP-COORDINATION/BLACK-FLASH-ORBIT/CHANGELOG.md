## Runtime UI Evidence Patch — 2026-08-26

- Replaced hard-coded admin/Firestore security labels with session role and Supabase runtime status.
- Removed fabricated fallback project scores, stale scan timestamps, and hard-coded security score.
- Release readiness now derives from backend health/auth/dependency telemetry where available.
- Preserved existing routes and feature behavior.
- `npm run lint` passes after the patch.

# Changelog

Semua perubahan penting BLACK FLASH ORBIT dicatat pada dokumen ini. Format mengikuti prinsip Keep a Changelog dengan versi semantic bila release resmi tersedia.

## [Unreleased]

### Planned

- Knowledge embedding provider validation.
- Knowledge end-to-end regression.
- Stabilization dan release `sprint4-dev` ke `master`.
- AI Workspace v0.9.

### Known limitations

- Knowledge indexing membutuhkan provider embedding yang dikonfigurasi.
- Production deployment belum menjadi baseline terverifikasi untuk v0.8.
- `master` belum memuat seluruh perubahan `sprint4-dev`.

## [0.8.0] — Development milestone

### Added

- AI Command Bar.
- Command Palette dengan shortcut `Ctrl + K`.
- Mobile Command Center improvements.
- Command Center release and operations panels.
- Workflow Automation page.

### Changed

- AI Workspace diperbarui untuk command-oriented workflow.
- Command Center sidebar dan release panel diperkuat.
- Security Center diintegrasikan dengan akses berbasis role.

### Pending release

- Final regression.
- Release tag.
- Pull Request ke `master`.
- Production deployment verification.

## [0.7.0] — Project Health Monitor

### Added

- Project Health Monitor.
- Deployment-aware health information.
- Dashboard telemetry integration.
- Health, metrics, projects, activity, automation, dan security signals.

### Changed

- Dashboard mendukung loading, degraded, empty, dan fallback state.

## [0.6.0] — Security Center

### Added

- Security Center page.
- Role-gated security access.
- Security indicators pada Command Center.
- Project-specific security and test agent skills.

### Security

- Private route protection diperkuat.
- CORS allowlist dan middleware order ditinjau.
- Secret exposure dan `.env` tracking diperiksa.

## [0.5.5] — RBAC baseline

### Added

- Supabase authentication.
- Protected and public-only route behavior.
- Role-based access baseline.
- Session validation dan recovery.

## Foundation milestones

### Added

- React/Vite frontend.
- Node/Express backend.
- Realtime Command Center.
- AI Workspace.
- AI Newsroom.
- Prompt Library.
- Knowledge Base foundation.
- Universal Web Builder foundation.
- Supabase migrations dan RLS policies.
- OpenRouter AI integration.

