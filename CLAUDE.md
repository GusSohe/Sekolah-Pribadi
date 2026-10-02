# Sekolah Pribadi — Catatan Proyek

## Stack
- Frontend: single-file `index.html` → GitHub Pages `gussohe.github.io/Sekolah-Pribadi`
- Backend: Google Apps Script. Sumber utuhnya di `apps-script/Code.gs` (user menempelnya manual ke editor Apps Script; tidak ada deploy otomatis). Repo ini publik, jadi ID Drive/Spreadsheet di sana berupa placeholder `ISI_ID_...`.
- Service Worker: `sw.js`, halaman HTML network-first (update langsung sampai, cache hanya untuk offline), aset statis cache-first. Cache version saat ini: `sp-v1.6`
- Storage: `localStorage` key `sekolahPribadi_v1` (berisi `sesiList` = progres user; JANGAN sarankan "clear site data" atau reset)

## Aturan Wajib
- Perubahan `index.html` tidak perlu bump `CACHE` (HTML network-first). Bump `CACHE` di `sw.js` hanya bila aset statis di `SHELL` berubah atau logika `sw.js` diubah.
- Setiap push langsung PR + squash-merge ke main tanpa konfirmasi. Branch kerja: `claude/lucid-cerf-fkg3rz`. Karena squash, awali tiap pekerjaan dengan `git fetch origin main && git checkout -B claude/lucid-cerf-fkg3rz origin/main` agar tidak konflik.
- Kalau user harus mengerjakan sesuatu manual (mis. di Apps Script), berikan langkah bernomor dan lokasi persisnya.
- Jangan menaruh URL Apps Script, API key, atau ID Drive/Spreadsheet milik user di repo (publik). Minta user bila perlu.
- Lingkungan sesi ini tidak bisa akses GitHub Pages/Google. Verifikasi: `python3 -m http.server 8090` + Playwright (`/opt/node22/lib/node_modules/playwright`, chromium `/opt/pw-browsers/chromium`, arg `--no-sandbox`), inject localStorage `sekolahPribadi_v1`, backend palsu lewat `page.route`. ID nav: `#nav-dashboard`, `#nav-materi`, `#nav-progres`, `#nav-setting`. Logika `Code.gs` diuji di Node dengan tiruan Drive/Docs/Forms/Lock (`vm` + stub).

## Desain konten (apps-script/Code.gs)
- `KURIKULUM`: per hari (Sen–Sab) 8 langkah {f: fokus tema, h: fokus hukum}; langkah 1-3 Dasar, 4-6 Menengah, 7-8 Lanjut; setelah langkah 8 putaran ke-2 (kedalaman lebih tinggi). Minggu ke-1 = minggu yang memuat `CONFIG.TGL_MULAI` (24 Sep 2026). Nama `tema` harus sama persis dengan objek `TEMA` di index.html (grafik skor mencocokkan nama).
- Anti-pengulangan: materi, hukum, dan soal dibuat dengan membaca sampai 6 dokumen sebelumnya pada hari yang sama (`ambilRiwayat`), dan soal baru yang mirip pertanyaan lama (Jaccard >= 0.7) ditolak lalu diulang.
- Soal dibuat DARI teks materi+hukum yang baru ditulis, divalidasi (10 soal, panjang pilihan setara, tanpa "semua benar"), lalu posisi jawaban benar diacak merata di kode.
- Prompt hukum: kasus nyata hanya bila yakin, selain itu "ILUSTRASI HIPOTETIS"; pelajaran harus sesuai fakta; KUHP lama vs KUHP Nasional (UU 1/2023, berlaku 2 Jan 2026) tidak boleh dicampur.
- Dokumen Drive memuat baris `FOKUS:` dan `LEVEL:`; `getMateri` mengembalikan `fokus` dan `level`, ditampilkan sebagai tag di halaman Materi.
- Frontend menampilkan cache lalu `segarkanMateri()` mengambil ulang diam-diam dan menimpa cache bila isi di server berubah (jadi edit/buat ulang di Drive sampai ke HP). Timeout memuat materi 240 dtk karena pembuatan di server bisa 2-3 menit.
- Penjaga: `getMateri` hanya untuk tanggal antara `TGL_MULAI` dan hari ini; `generateLaporan` dijeda 10 menit.

## [PENDING] Pasang apps-script/Code.gs ke Apps Script (belum dikonfirmasi user)
Menggabungkan semua perubahan backend yang tertunda: kurikulum, soal dari materi, anti-ulang, email pengingat 21:00 (`kirimPengingat`, `setNotifPreference`, `lastSubmitDate`), tombol laporan (`generateLaporan`), perbaikan prompt hukum, penjaga tanggal, kunci anti-ganda.
Langkah user: salin 3 ID dari CONFIG lama; tempel seluruh isi file; isi 3 placeholder; Save; jalankan `tesEmail` (beri izin kirim email); jalankan `setupTrigger` (jadwal baru: jalankanHarian 04:00, kirimPengingat 21:00, analisisMingguan Minggu 14:00); Deploy → Manage deployments → pensil → New version → Deploy.
Opsional: `buatUlangMateriHariIni()` untuk membuang dokumen hari ini yang salah (mis. kasus Geprek Bensu 2 Okt 2026) dan membuatnya ulang.

## Catatan risiko yang belum ditangani
- `submitHasilResponse` dan `analisisMingguan` memakai `getActiveSheet()`. `buatForm` menautkan tiap Form ke spreadsheet yang sama sehingga muncul tab "Form Responses N"; tab aktif bisa bukan tab hasil kuis. Belum diverifikasi; bila laporan terasa salah, periksa spreadsheet.
- URL Web App pernah ter-commit ke CLAUDE.md (riwayat git publik). Bila ingin, buat New deployment (URL baru) dan perbarui di Pengaturan app.

## TEMA Mapping
1 Memahami Manusia · 2 Memahami Uang · 3 Komunikasi · 4 Memahami Tubuh · 5 Personal Branding · 6 Kecerdasan Emosional · 0 libur
