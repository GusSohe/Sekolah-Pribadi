# Sekolah Pribadi — Catatan Proyek

## Stack
- Frontend: single-file `index.html` → GitHub Pages `gussohe.github.io/Sekolah-Pribadi`
- Backend: Google Apps Script (TIDAK di repo ini)
- Service Worker: `sw.js`, cache version saat ini: `sp-v1.3`
- Storage: `localStorage` key `sekolahPribadi_v1`

## Apps Script URL
`https://script.google.com/macros/s/AKfycbw-anCDgiRG-ziSXjU-oHz33NMk29vmtR53vNsMZR8r0kz1ANcdyJFZ6YJ3uLcBHkJviQ/exec`

## Pekerjaan Manual yang Tertunda di Apps Script

### [PENDING] Fitur Email Pengingat Jam 21:00

Frontend sudah selesai (PR #11, merged). Apps Script belum diupdate.

#### 1. Tambah handler `setNotifPreference` di doGet() — dalam blok switch(action):
```javascript
case 'setNotifPreference':
  PropertiesService.getScriptProperties()
    .setProperty('notifAktif', params.aktif === '1' ? 'true' : 'false');
  return ContentService.createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
```

#### 2. Di case 'submitHasil' — tambah setelah menyimpan hasil:
```javascript
PropertiesService.getScriptProperties()
  .setProperty('lastSubmitDate', params.tgl || '');
```

#### 3. Di fungsi jalankanHarian() — tambah blok email di akhir:
```javascript
const props = PropertiesService.getScriptProperties();
const notifAktif = props.getProperty('notifAktif') === 'true';
if (notifAktif) {
  const tglHariIni = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const lastSubmit = props.getProperty('lastSubmitDate') || '';
  if (lastSubmit !== tglHariIni) {
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: '📚 Sekolah Pribadi — Belum belajar hari ini',
      body: 'Halo,\n\nSudah jam 21:00 dan kamu belum menyelesaikan sesi belajar hari ini.\n\nBuka sekarang: https://gussohe.github.io/Sekolah-Pribadi/\n\n— Sekolah Pribadi'
    });
  }
}
```

#### 4. Ubah trigger jalankanHarian() dari jam 20:00 ke jam 21:00
Di Apps Script Editor: Triggers (ikon jam) → edit trigger jalankanHarian → pilih 21:00–22:00

## TEMA Mapping (hari → tema, harus cocok persis dengan nama di Apps Script)
```
1 (Sen): Memahami Manusia
2 (Sel): Memahami Uang
3 (Rab): Komunikasi
4 (Kam): Memahami Tubuh
5 (Jum): Personal Branding
6 (Sab): Kecerdasan Emosional
```

## Git
- Branch pengembangan: `claude/lucid-cerf-fkg3rz`
- Setiap push langsung merge ke main tanpa konfirmasi
