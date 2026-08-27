# UI/UX Guidelines — BLACK FLASH ORBIT

## 1. Design direction

BLACK FLASH ORBIT menggunakan bahasa visual modern SaaS command center:

- Dark, focused, technical.
- Glass/cyber surfaces secara terukur.
- Informasi operasional mudah dipindai.
- Warna status memiliki makna konsisten.
- Mobile-first tanpa menghilangkan kepadatan informasi desktop.
- Animasi halus dan tidak menghambat pekerjaan.

## 2. Visual foundations

### Color roles

| Role | Baseline |
| --- | --- |
| App background | Near-black `#050506` |
| Primary text | White/zinc-100 |
| Secondary text | Zinc/slate muted |
| Accent | Cyan/blue cyber |
| Release/highlight | Amber/gold |
| Success | Emerald |
| Warning | Amber |
| Danger | Red/rose |

Gunakan warna berdasarkan semantic role, bukan hanya dekorasi.

### Typography

- Heading: tegas, ringkas, hierarchy jelas.
- Body: readable pada 14–16 px.
- Label/metadata: tidak lebih kecil dari yang masih terbaca pada mobile.
- Angka operasional menggunakan tabular numerals bila tersedia.
- Hindari semua huruf kapital untuk paragraf panjang.

### Spacing

- Gunakan scale konsisten 4/8/12/16/24/32.
- Card tidak terlalu padat pada mobile.
- Section desktop dapat dense, tetapi grouping harus jelas.

## 3. Layout

### Desktop

- Sidebar persistent.
- Topbar untuk title, command, notification, dan user menu.
- Main grid responsif.
- Detail sekunder dapat menggunakan right rail.

### Mobile

- Sidebar menjadi drawer.
- Satu kolom sebagai default.
- Primary action tetap mudah dijangkau.
- Tabel memakai scroll container atau card transformation.
- Command Palette tetap dapat dibuka lewat tombol, bukan hanya keyboard.

### Breakpoints test

- 360 px.
- 390 px.
- 768 px.
- 1024 px.
- 1440 px.
- 1920 px.

## 4. Component behavior

### Buttons

- Primary: satu aksi utama per context.
- Secondary: aksi non-destruktif.
- Ghost: toolbar/navigation.
- Danger: delete/revoke; confirmation wajib jika berdampak material.
- Loading button mempertahankan width dan disabled.

### Forms

- Label terlihat; placeholder bukan pengganti label.
- Validation dekat dengan field.
- Error menjelaskan perbaikan.
- Submit tidak aktif saat invalid/loading.
- Draft input dipertahankan pada failure bila aman.

### Toasts

- Success untuk mutation berhasil.
- Error untuk failure yang membutuhkan perhatian.
- Warning untuk degraded state.
- Jangan gunakan toast sebagai satu-satunya tempat error form.
- Toast dapat ditutup dan tidak menutupi primary action.

### Modal/dialog

- Title dan purpose jelas.
- Focus trap.
- Escape menutup kecuali operasi kritis sedang commit.
- Focus kembali ke trigger.
- Destructive action menunjukkan objek yang akan dihapus.

### Tables

- Header jelas dan sticky bila data panjang.
- Search realtime memiliki debounce.
- Filter state terlihat.
- Empty state membedakan tidak ada data dan tidak ada hasil pencarian.
- Action menu keyboard accessible.

## 5. Application states

Setiap modul wajib merancang:

| State | Tampilan |
| --- | --- |
| Initial | Konten/empty state yang jelas |
| Loading | Skeleton/progress tanpa layout jump besar |
| Success | Data dan timestamp/status relevan |
| Empty | Penjelasan dan aksi pertama |
| Filter empty | Clear-filter action |
| Validation | Error per field |
| Unauthorized | Pesan izin, bukan data kosong palsu |
| Degraded | Dependency unavailable + retry |
| Error | Pesan aman + retry/support ID |
| Offline | Draft/local behavior bila tersedia |

## 6. Command Palette

- Dibuka dengan tombol dan `Ctrl + K`/`Cmd + K`.
- Search berdasarkan label, keyword, dan deskripsi.
- Command restricted tidak boleh dieksekusi tanpa izin.
- Arrow keys, Enter, Escape berfungsi.
- Hasil command terlihat dan tidak menghilang terlalu cepat.
- Slash command mock harus diberi label jika belum menjalankan backend nyata.

## 7. AI experience

- Prompt builder membedakan instruction dan source/facts.
- Tampilkan model aktif.
- Loading menyatakan proses sedang berlangsung.
- Abort tersedia untuk request panjang.
- Retry tidak menggandakan message.
- Copy menghasilkan toast.
- Export mempertahankan format.
- Output AI diberi status draft/human review.
- Fact/evidence/confidence tidak dipresentasikan sebagai kepastian palsu.

## 8. Accessibility

- Semantic HTML.
- Semua control dapat diakses keyboard.
- Focus visible.
- Icon-only button memiliki accessible label.
- Contrast memadai.
- Status tidak disampaikan melalui warna saja.
- `prefers-reduced-motion` dihormati.
- Error dihubungkan ke field.
- Loading penting menggunakan live region secara terukur.

## 9. Motion

- Durasi umum 150–250 ms.
- Gunakan opacity/transform untuk performa.
- Hindari motion berulang pada dashboard kerja.
- Loading tidak boleh membuat layout bergeser berlebihan.
- Reduced-motion mematikan animasi non-esensial.

## 10. UI Definition of Done

- Responsive matrix lulus.
- Keyboard flow lulus.
- Loading/empty/error/unauthorized tersedia.
- Form validation tersedia.
- Toast mutation tersedia.
- Tidak ada horizontal overflow halaman.
- Tidak ada hardcoded fake metric yang terlihat sebagai live data tanpa label fallback.
- Screenshot/mobile QA disertakan untuk perubahan besar.

