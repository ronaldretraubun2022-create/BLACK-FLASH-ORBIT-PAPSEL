# Release Checklist — BLACK FLASH ORBIT

## Release identity

- [ ] Version ditentukan.
- [ ] Commit SHA dicatat.
- [ ] Branch kandidat dicatat.
- [ ] Release owner ditentukan.
- [ ] Known limitations ditulis.

## Repository

- [ ] Branch benar.
- [ ] Working tree bersih atau seluruh perubahan dipahami.
- [ ] Tidak ada file rahasia/untracked yang ikut release.
- [ ] Diff terhadap `master` direview.
- [ ] Commit message jelas.

## Documentation

- [ ] `README.md` sesuai.
- [ ] `PRD.md` tidak bertentangan dengan behavior.
- [ ] `PROJECT_STATUS.md` diperbarui.
- [ ] `CHANGELOG.md` diperbarui.
- [ ] `docs/API.md` diperbarui.
- [ ] `docs/DATABASE.md` mencatat migration.
- [ ] `docs/DEPLOYMENT.md` mencatat env/routing.
- [ ] `docs/SECURITY.md` mencatat perubahan kontrol.

## Environment

- [ ] Supabase aktif.
- [ ] Preview env lengkap.
- [ ] Production env lengkap.
- [ ] Tidak ada secret berprefix `VITE_`.
- [ ] OpenRouter dikonfigurasi.
- [ ] Embedding provider dikonfigurasi.
- [ ] CORS allowlist benar.
- [ ] API base URL benar.

## Database

- [ ] Backup tersedia untuk perubahan berisiko.
- [ ] Migration diuji non-production.
- [ ] Migration diterapkan sesuai urutan.
- [ ] Constraints dan indexes terverifikasi.
- [ ] RLS aktif.
- [ ] Cross-user tests lulus.
- [ ] Recovery strategy terdokumentasi.

## Automated quality gate

- [ ] `npm.cmd run test` PASS.
- [ ] `npm.cmd run build` PASS.
- [ ] `npm.cmd audit --omit=dev` PASS/accepted.
- [ ] `git diff --check` PASS.
- [ ] Tidak ada flaky test yang diabaikan.

## Functional smoke test

- [ ] Register/login/logout.
- [ ] Session refresh/expiry.
- [ ] Protected/PublicOnly routes.
- [ ] Dashboard loading/live/degraded.
- [ ] Command Palette button/shortcut.
- [ ] Security Center permission.
- [ ] AI Workspace session/message.
- [ ] AI Newsroom generation.
- [ ] Knowledge upload/index/search/delete.
- [ ] Web Builder project/page.
- [ ] Workflow Automation states.

## Responsive/accessibility

- [ ] 360 px.
- [ ] 390 px.
- [ ] 768 px.
- [ ] 1024 px.
- [ ] 1440 px.
- [ ] Keyboard navigation.
- [ ] Focus visible.
- [ ] Modal/dialog behavior.
- [ ] No page horizontal overflow.

## Security gate

- [ ] Private API 401 tanpa token.
- [ ] Restricted API 403 untuk role salah.
- [ ] CORS menolak origin ilegal.
- [ ] Helmet headers aktif.
- [ ] Rate limiting aktif.
- [ ] Upload abuse ditolak.
- [ ] Error disanitasi.
- [ ] Frontend bundle bebas server secret.
- [ ] Dependency high/critical ditangani.

## Pull Request

- [ ] Base/compare benar.
- [ ] Summary lengkap.
- [ ] Migration/env changes disebutkan.
- [ ] Security impact disebutkan.
- [ ] Test evidence dilampirkan.
- [ ] Deployment dan rollback steps tersedia.
- [ ] Blocking review diselesaikan.

## Deployment

- [ ] Production mengambil commit yang benar.
- [ ] Build/deployment ready.
- [ ] SPA route refresh berhasil.
- [ ] API route JSON berhasil.
- [ ] Production smoke test lulus.
- [ ] Monitoring 5xx/provider/auth dijalankan.
- [ ] Rollback target tersedia.

## Final decision

```text
Release:
Commit:
Tag:
Environment:
Decision: GO / NO-GO
Approved by:
Known limitations:
Rollback target:
```

