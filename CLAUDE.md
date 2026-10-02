# Sekolah Pribadi — Catatan Proyek

## Stack
- Frontend: single-file `index.html` → GitHub Pages `gussohe.github.io/Sekolah-Pribadi`
- Backend: Google Apps Script `Code.gs` (TIDAK di repo ini)
- Service Worker: `sw.js`, halaman HTML network-first (update langsung sampai, cache hanya untuk offline), aset statis cache-first. Cache version saat ini: `sp-v1.6`
- Storage: `localStorage` key `sekolahPribadi_v1`

## Aturan Wajib
- Perubahan `index.html` tidak perlu bump `CACHE` (HTML network-first). Bump `CACHE` di `sw.js` hanya bila aset statis di `SHELL` (ikon, manifest) berubah atau logika `sw.js` diubah.
- Setiap push langsung PR + squash-merge ke main tanpa konfirmasi. Branch kerja: `claude/lucid-cerf-fkg3rz`.
- Kalau user harus mengerjakan sesuatu manual (mis. di Apps Script), berikan langkah bernomor dan lokasi persisnya (cari baris apa, ganti jadi apa).
- Lingkungan sesi ini tidak bisa akses GitHub Pages/Google. Verifikasi visual: `python3 -m http.server 8090` + Playwright (`/opt/node22/lib/node_modules/playwright`, chromium `/opt/pw-browsers/chromium`, arg `--no-sandbox`), inject localStorage `sekolahPribadi_v1`. ID nav: `#nav-dashboard`, `#nav-materi`, `#nav-progres`, `#nav-setting`.

## Apps Script URL
`https://script.google.com/macros/s/AKfycbw-anCDgiRG-ziSXjU-oHz33NMk29vmtR53vNsMZR8r0kz1ANcdyJFZ6YJ3uLcBHkJviQ/exec`

Action yang dipanggil frontend: `getMateri`, `submitHasil`, `getLaporan`, `setNotifPreference` (baru), `generateLaporan` (baru).

## Pekerjaan Manual Tertunda di Apps Script (Code.gs)
Frontend sudah siap; status di bawah = belum dikonfirmasi user sudah dipasang.

### [PENDING] A. Email pengingat jam 21:00
1. `doGet()`: tambah `if (action === 'setNotifPreference') return setNotifPreferenceResponse(params);`
2. Tambah fungsi `setNotifPreferenceResponse(params)` → simpan `notifAktif` ('true'/'false') di `PropertiesService.getScriptProperties()`.
3. `submitHasilResponse()`: sebelum `return jsonResponse({ status: 'ok' })`, simpan `lastSubmitDate` (= `params.tgl || todayStr()`).
4. `jalankanHarian()`: setelah `Logger.log("Selesai...")`, kirim `MailApp.sendEmail` ke `Session.getActiveUser().getEmail()` bila `notifAktif === 'true'` dan `lastSubmitDate !== hari ini`.
5. `setupTrigger()`: `.atHour(20)` → `.atHour(21)`, lalu jalankan `setupTrigger()` sekali.

### [PENDING] B. Tombol "Buat Laporan Sekarang" (action `generateLaporan`)
1. `doGet()`: tambah `if (action === 'generateLaporan') return generateLaporanResponse();`
2. `analisisMingguan()`: `return null` saat data kosong; setelah `panggilClaude`, jika hasil `"ERROR"` lempar error; di akhir `return { judul: namaFile, isi: laporan };`
3. Tambah fungsi `generateLaporanResponse()` yang memanggil `analisisMingguan()` dan mengembalikan `{status:'ok', judul, isi}` atau `{status:'kosong'}`.

### [PENDING] C. Prompt `generateHukum()` — kasus nyata sering salah/terbalik
Temuan 2 Okt 2026: "Geprek Bensu" ditulis seolah pemakai pertama tanpa pendaftaran mengalahkan pendaftar, padahal "pelajaran"-nya menyimpulkan sebaliknya (daftar lebih dulu lebih kuat). Fakta sebenarnya: PT Ayam Geprek Benny Sujono mendaftar "Bensu" lebih dulu (3 Mei 2017), merek Ruben Onsu (7 Jun 2018) dibatalkan, pertimbangan itikad tidak baik. Model tidak punya akses putusan saat generate, jadi detail kasus rawan karangan.
Perbaikan: di `generateHukum()` ganti butir 2 prompt jadi aturan "kasus nyata hanya bila yakin pihak, amar, dan pertimbangannya; jika tidak yakin tulis ILUSTRASI HIPOTETIS bernama fiktif dan beri label" + wajibkan pelajaran diturunkan langsung dari fakta (siapa menang, atas dasar apa). Isi hari yang sudah salah harus diedit manual di Google Doc, dan cache HP (`materiCache`) tidak ikut berubah kecuali frontend diberi revalidasi (belum dibuat).
Jangan sarankan "clear site data" ke user: itu menghapus `sesiList` (progres).

Setelah semua perubahan Code.gs: Deploy → Manage deployments → edit → New version → Deploy.

## TEMA Mapping (harus cocok persis dengan `TEMA_HARIAN` di Apps Script)
1 Memahami Manusia · 2 Memahami Uang · 3 Komunikasi · 4 Memahami Tubuh · 5 Personal Branding · 6 Kecerdasan Emosional · 0 libur
