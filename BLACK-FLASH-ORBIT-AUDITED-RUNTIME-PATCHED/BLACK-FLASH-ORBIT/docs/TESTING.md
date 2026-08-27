# Testing Strategy — BLACK FLASH ORBIT

## 1. Tujuan

Menjamin fitur utama bekerja, tidak membuka akses tidak sah, tidak kehilangan data, dan tetap dapat digunakan pada mobile maupun desktop.

## 2. Test layers

| Layer | Fokus |
| --- | --- |
| Static | Syntax, build, import, type/runtime compatibility |
| Unit | Pure functions, normalization, validation, prompt guards |
| Route/guard | Auth, validation, response, error behavior |
| Integration | API + Supabase/provider boundary dengan controlled environment |
| RLS | Own-data success dan cross-user denial |
| UI behavior | Loading, empty, error, form, modal, keyboard |
| E2E/smoke | Critical user journeys |
| Security | Secret, CORS, header, rate limit, upload abuse |

## 3. Standard commands

```powershell
npm.cmd run test
npm.cmd run test:newsroom
npm.cmd run test:knowledge
npm.cmd run test:security
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
git status
```

Test result harus menyebut command, exit code, dan jumlah test bila tersedia.

`npm.cmd run test` menjalankan Newsroom guard, Knowledge regression, dan role authorization.

## 4. Newsroom regression

Wajib mencakup:

- Auth guard.
- Invalid payload.
- Topic length limit.
- Duplicate section prevention.
- Draft dimulai dari struktur yang benar.
- Fact classification.
- Evidence matrix.
- Source quality.
- Confidence calculation.
- Temporal normalization.
- Provider failure menghasilkan safe error.
- Tidak ada fake citation.

## 5. Authentication matrix

| Scenario | Expected |
| --- | --- |
| No session ke protected page | Redirect login |
| Authenticated ke login | Redirect app |
| No bearer token ke private API | 401 |
| Invalid bearer format | 401 |
| Invalid token | 401 |
| Expired session | Recovery atau logout aman |
| Auth provider unavailable | 503/degraded, bukan bypass |
| Non-admin ke admin route | 403 |

## 6. Knowledge test matrix

### Valid input

- TXT UTF-8.
- Markdown.
- Valid PDF.
- Valid DOCX.
- Title custom dan fallback filename.
- `use_in_ai_context` true/false.

### Invalid input

- Empty file.
- > 10 MB.
- Unsupported extension.
- Extension/MIME mismatch.
- Fake PDF signature.
- Fake DOCX signature.
- Binary/null-byte text.
- Script-like text.
- Provider key missing.
- Provider credential invalid.
- Provider timeout/rate limit.

### Ownership

- User A list/create/update/delete sendiri.
- User B tidak dapat read/update/delete dokumen A.
- Anonymous tidak dapat menggunakan route.

### Integrity

- Failure tidak menandai indexed.
- Retry tidak menduplikasi dokumen/chunk.
- Delete membersihkan children/storage terkait.

## 7. Web Builder test matrix

- Project create dengan title/slug valid.
- Duplicate slug per user ditolak.
- Invalid status ditolak.
- Page path unique per project.
- Sections wajib JSON array.
- Theme/settings/metadata wajib object.
- Asset wajib memiliki storage path atau source URL.
- User B tidak dapat akses project A.
- Delete project cascade ke page/asset record.
- Preview menolak unsafe script/URL.
- Export tidak membawa secret.

## 8. Command Center test matrix

- Telemetry loading.
- Live success.
- No activity/projects/automation empty state.
- Backend failure fallback.
- Auth provider degraded.
- Role admin melihat security panel.
- Non-admin tidak mendapat endpoint admin.
- Command Palette via button.
- Command Palette via `Ctrl + K`.
- Escape menutup palette.
- Keyboard navigation dan focus.

## 9. AI Workspace test matrix

- Create session.
- Reopen session.
- Model default `openrouter/auto`.
- Model persists per session.
- Send message success.
- Provider timeout.
- Abort request.
- Retry/regenerate.
- No duplicate message.
- Long conversation.
- User B cannot access session A.
- Copy/export output.

## 10. Responsive matrix

| Width | Target |
| ---: | --- |
| 360 px | Small Android/mobile |
| 390 px | Standard mobile |
| 768 px | Tablet portrait |
| 1024 px | Tablet landscape/small desktop |
| 1440 px | Desktop |
| 1920 px | Wide desktop |

Periksa:

- No horizontal page overflow.
- Sidebar/drawer usable.
- Table scroll tidak merusak layout.
- Modal tetap dalam viewport.
- Touch target memadai.
- Text tidak terpotong tanpa affordance.
- Focus dan keyboard tetap berfungsi.

## 11. Production smoke test

Urutan setelah deployment:

1. Health.
2. SPA route refresh.
3. Login.
4. Dashboard telemetry.
5. Command Palette.
6. AI Workspace request kecil.
7. Newsroom draft kecil.
8. Knowledge file test non-sensitive.
9. Web Builder project sementara.
10. Unauthorized API probe.
11. Cleanup test records.

## 12. Test data rules

- Gunakan data sintetis/non-sensitive.
- Jangan masukkan API key ke fixture/snapshot.
- Gunakan dua user test untuk RLS.
- Nama file test menyatakan format dan expected result.
- Cleanup record setelah integration test bila tidak transaction-isolated.

## 13. Release evidence template

```text
Commit:
Branch:
Environment:

Automated
- npm.cmd run test: PASS/FAIL
- npm.cmd run build: PASS/FAIL
- npm.cmd audit --omit=dev: PASS/FAIL
- git diff --check: PASS/FAIL

Manual
- Auth: PASS/FAIL
- Dashboard: PASS/FAIL
- AI Workspace: PASS/FAIL
- Newsroom: PASS/FAIL
- Knowledge: PASS/FAIL
- Web Builder: PASS/FAIL
- Mobile: PASS/FAIL
- Security: PASS/FAIL

Known limitations:
Release decision: GO/NO-GO
```

## 14. Definition of test complete

- Semua P0 scenarios lulus.
- Tidak ada flaky failure yang diabaikan.
- Failure yang tidak dapat diuji diberi alasan dan risiko.
- Dokumentasi dan test sesuai behavior aktual.
- Release evidence merujuk commit yang sama dengan kandidat rilis.
