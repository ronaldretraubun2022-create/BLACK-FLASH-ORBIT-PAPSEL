# Contributing — BLACK FLASH ORBIT

## 1. Branching

- Base pengembangan saat ini: `sprint4-dev`.
- Gunakan `feat/<scope>`, `fix/<scope>`, `test/<scope>`, atau `docs/<scope>` bila perlu.
- Production branch: `master`.
- Jangan push langsung ke `master` untuk perubahan fitur.

## 2. Setup

```powershell
cd D:\Projects\BLACK-FLASH-ORBIT
git checkout sprint4-dev
git pull --ff-only origin sprint4-dev
npm install
Copy-Item .env.example .env
npm.cmd run dev
```

## 3. Coding standards

- Ikuti struktur dan naming existing.
- Hindari duplikasi API/auth/error logic.
- Pisahkan page, feature, service, route, dan domain library.
- Backend memvalidasi semua input dan permission.
- Semua async UI memiliki complete state handling.
- Jangan menambah dependency tanpa justifikasi.
- Jangan memasukkan secret atau data privat.

## 4. Commit messages

```text
feat(scope): description
fix(scope): description
test(scope): description
docs(scope): description
refactor(scope): description
chore(scope): description
```

Contoh:

```text
fix(knowledge): fail safely when embedding provider is missing
test(auth): cover expired Supabase session recovery
docs(api): standardize knowledge route contract
```

## 5. Pull Request requirements

PR wajib memiliki:

- Problem/root cause.
- Solution summary.
- Files/modules affected.
- API/schema/env changes.
- Security impact.
- Test evidence.
- Screenshots untuk UI material.
- Known risks.
- Deployment/rollback notes.

## 6. Quality gate

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
git status
```

## 7. Review checklist

- Scope sesuai.
- Authorization server-side.
- RLS/ownership aman.
- Error tidak membocorkan detail.
- UI lengkap state-nya.
- Mobile/keyboard bekerja.
- Test menguji behavior, bukan implementation detail rapuh.
- Dokumentasi diperbarui.
- Tidak ada secret atau debug artifact.

## 8. Definition of mergeable

- Checks lulus.
- Blocking comments selesai.
- Migration/env documented.
- Security impact diterima.
- Reviewer dapat menjalankan perubahan.
- Branch target benar.

