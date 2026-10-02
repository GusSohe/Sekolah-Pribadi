// ============================================================
// SEKOLAH PRIBADI GUS SOHE — Google Apps Script
// Versi kurikulum bertahap:
//  - Materi per hari mengikuti kurikulum 8 langkah (Dasar → Menengah → Lanjut)
//  - Setiap materi/kuis dibuat dengan membaca riwayat hari yang sama (tidak diulang)
//  - Soal dibuat DARI teks materi yang baru ditulis, lalu divalidasi dan diacak
//  - Email pengingat, laporan on-demand, dan penjaga tanggal
// ============================================================

const CONFIG = {
  FOLDER_MATERI       : "ISI_ID_FOLDER_MATERI",
  FOLDER_LAPORAN      : "ISI_ID_FOLDER_LAPORAN",
  SPREADSHEET_ID      : "ISI_ID_SPREADSHEET",
  MODEL               : "claude-sonnet-4-6",
  MODEL_SOAL          : "claude-sonnet-4-6",
  MAX_TOKENS          : 2000,
  MAX_TOKENS_SOAL     : 5000,
  TGL_MULAI           : "2026-09-24",   // hari pertama sekolah; minggu ke-1 = minggu yang memuat tanggal ini
  MAKS_PERCOBAAN_SOAL : 2,
  JUMLAH_RIWAYAT      : 6,              // berapa pertemuan lalu (hari yang sama) yang dibaca
  JEDA_LAPORAN_MENIT  : 10              // cegah laporan dibuat berulang-ulang
};

// Kurikulum: 8 langkah per hari. f = fokus tema, h = fokus sisipan hukum.
// Langkah 1-3 = Dasar, 4-6 = Menengah, 7-8 = Lanjut. Setelah langkah 8, putaran kedua dimulai
// dengan kedalaman lebih tinggi. Nama "tema" HARUS sama dengan nama di index.html (objek TEMA).
const KURIKULUM = {
  1: { tema: "Memahami Manusia", bidang: "Hukum Pidana", langkah: [
    { f: "Apa yang menggerakkan perilaku manusia: kebutuhan, emosi, dan kebiasaan", h: "Pengertian hukum pidana, asas legalitas, dan fungsi pidana" },
    { f: "Bias kognitif dasar: cara pikiran menyederhanakan dan menyesatkan", h: "Unsur tindak pidana: perbuatan, sifat melawan hukum, dan kesalahan" },
    { f: "Motivasi dan kepribadian: mengapa orang berbeda menanggapi hal yang sama", h: "Bentuk kesalahan: kesengajaan dan kelalaian" },
    { f: "Membaca orang lain: perilaku nonverbal dan batas tafsir kita", h: "Alasan pembenar dan alasan pemaaf" },
    { f: "Pengaruh sosial: konformitas, otoritas, dan tekanan kelompok", h: "Penyertaan: pelaku, turut serta, penganjur, dan pembantu" },
    { f: "Disonansi: ketika tindakan bertentangan dengan keyakinan sendiri", h: "Percobaan, gabungan tindak pidana, dan pengulangan" },
    { f: "Mengambil keputusan di bawah tekanan dan ketidakpastian", h: "Pembuktian dalam perkara pidana: alat bukti dan beban pembuktian" },
    { f: "Perubahan diri: bagaimana kebiasaan dan identitas benar-benar bergeser", h: "Pemidanaan: tujuan pidana, jenis pidana, dan keadilan restoratif" }
  ]},
  2: { tema: "Memahami Uang", bidang: "Hukum Perdata", langkah: [
    { f: "Uang sebagai alat tukar dan penyimpan nilai, serta inflasi", h: "Pengertian hukum perdata, subjek hukum (orang dan badan hukum), dan benda" },
    { f: "Arus kas pribadi: pemasukan, pengeluaran, dan anggaran yang realistis", h: "Perikatan dan sumbernya: perjanjian dan undang-undang" },
    { f: "Dana darurat, tabungan, dan beda kebutuhan dengan keinginan", h: "Syarat sah perjanjian dan akibat bila syaratnya tidak terpenuhi" },
    { f: "Utang: bunga, cicilan, dan cara menilai utang sehat dan utang beracun", h: "Wanprestasi, somasi, dan ganti rugi" },
    { f: "Bunga majemuk dan waktu: mengapa memulai lebih awal itu penting", h: "Jaminan utang-piutang: gadai, fidusia, dan hak tanggungan" },
    { f: "Dasar investasi: risiko, imbal hasil, dan diversifikasi", h: "Keadaan memaksa dan perbuatan melawan hukum" },
    { f: "Psikologi uang: bias belanja, FOMO, dan keputusan finansial emosional", h: "Kepailitan dan penundaan kewajiban pembayaran utang secara garis besar" },
    { f: "Perencanaan jangka panjang: proteksi, pensiun, dan tujuan hidup", h: "Daluwarsa dan pembuktian dalam sengketa perdata" }
  ]},
  3: { tema: "Komunikasi", bidang: "Hukum Acara", langkah: [
    { f: "Dasar komunikasi: pengirim, pesan, penerima, dan mengapa pesan sering salah sampai", h: "Pengertian hukum acara, hukum materiil vs formil, dan asas-asas peradilan" },
    { f: "Mendengar aktif: memahami sebelum menanggapi", h: "Kewenangan pengadilan: kompetensi absolut dan relatif" },
    { f: "Berbicara jelas: struktur pesan (inti dulu, alasan, lalu contoh)", h: "Alur beracara perdata: gugatan, jawaban, replik, dan duplik" },
    { f: "Menulis efektif: pesan dan dokumen yang mudah ditindaklanjuti", h: "Alat bukti perdata dan beban pembuktian" },
    { f: "Bertanya dengan baik: pertanyaan terbuka, tertutup, dan menggali", h: "Alur beracara pidana: penyelidikan, penyidikan, penuntutan, dan persidangan" },
    { f: "Argumentasi: klaim, alasan, bukti, dan mengenali kekeliruan logika", h: "Menyusun argumentasi hukum: silogisme hukum dan penafsiran undang-undang" },
    { f: "Negosiasi: kepentingan vs posisi, dan mencari titik temu", h: "Alternatif penyelesaian sengketa: negosiasi, mediasi, dan arbitrase" },
    { f: "Komunikasi saat konflik dan menyampaikan kabar sulit", h: "Upaya hukum: banding, kasasi, peninjauan kembali, dan eksekusi putusan" }
  ]},
  4: { tema: "Memahami Tubuh", bidang: "Hukum Kesehatan dan Perlindungan Konsumen", langkah: [
    { f: "Tubuh sebagai sistem: tidur, energi, dan ritme dasar", h: "Pengertian hukum kesehatan, hak dan kewajiban pasien, dan sumber hukumnya" },
    { f: "Nutrisi dasar: makronutrien, mikronutrien, dan membaca label", h: "Perlindungan konsumen: hak konsumen dan kewajiban pelaku usaha" },
    { f: "Gerak dan olahraga: kebutuhan minimum dan cara mulai tanpa cedera", h: "Persetujuan tindakan medis dan rekam medis" },
    { f: "Stres dan tubuh: bagaimana tekanan psikologis muncul sebagai gejala fisik", h: "Klausula baku, label, dan iklan yang menyesatkan" },
    { f: "Pemulihan: kualitas tidur, kebiasaan, dan gangguan umum", h: "Tanggung jawab tenaga kesehatan dan fasilitas pelayanan: malapraktik vs risiko medis" },
    { f: "Membaca hasil pemeriksaan dasar (tekanan darah, gula darah, kolesterol) secara awam", h: "Penyelesaian sengketa konsumen: BPSK, pengadilan, dan ganti rugi" },
    { f: "Penyakit tidak menular dan pencegahan: faktor risiko yang bisa diubah", h: "Obat, alat kesehatan, izin edar, dan kewajiban pelaku usaha di bidang kesehatan" },
    { f: "Kebiasaan jangka panjang: membangun pola hidup sehat yang bertahan", h: "Kerahasiaan medis dan pelindungan data pribadi" }
  ]},
  5: { tema: "Personal Branding", bidang: "Hukum Kekayaan Intelektual", langkah: [
    { f: "Apa itu personal branding: identitas, reputasi, dan persepsi", h: "Pengertian kekayaan intelektual, pembagiannya, dan prinsip perlindungannya" },
    { f: "Menemukan nilai dan keunikan diri (positioning)", h: "Hak cipta: ciptaan yang dilindungi, hak moral dan hak ekonomi, dan jangka waktunya" },
    { f: "Konsistensi: bagaimana tampilan, suara, dan perilaku membentuk citra", h: "Merek: syarat pendaftaran, sistem first-to-file, dan itikad baik" },
    { f: "Cerita diri: menyusun narasi yang jujur dan mudah diingat", h: "Paten, desain industri, dan rahasia dagang secara garis besar" },
    { f: "Kehadiran digital: media sosial, jejak digital, dan reputasi daring", h: "Pelanggaran dan sengketa merek: gugatan pembatalan dan penghapusan" },
    { f: "Kredibilitas: membangun kepercayaan lewat bukti, bukan klaim", h: "Pelanggaran hak cipta, lisensi, dan penggunaan wajar" },
    { f: "Mengelola krisis reputasi dan kritik terbuka", h: "Pencemaran nama baik, hak atas citra diri, dan batasnya" },
    { f: "Brand jangka panjang: tumbuh tanpa kehilangan jati diri", h: "Strategi perlindungan KI untuk usaha: pendaftaran, perjanjian, dan penegakan" }
  ]},
  6: { tema: "Kecerdasan Emosional", bidang: "Hukum Keluarga", langkah: [
    { f: "Apa itu kecerdasan emosional: mengenali dan menamai emosi", h: "Pengertian hukum keluarga, perkawinan menurut UU Perkawinan, dan syarat sahnya" },
    { f: "Regulasi emosi: jeda antara pemicu dan reaksi", h: "Hak dan kewajiban suami istri, harta bersama, dan harta bawaan" },
    { f: "Empati: memahami perasaan orang lain tanpa kehilangan diri sendiri", h: "Perjanjian perkawinan dan isinya" },
    { f: "Batasan sehat: berkata tidak tanpa merusak hubungan", h: "Putusnya perkawinan: alasan dan tata caranya" },
    { f: "Mengelola marah, cemas, dan kecewa dalam hubungan dekat", h: "Akibat putusnya perkawinan: hak asuh, nafkah anak, dan pembagian harta bersama" },
    { f: "Pola kelekatan dan cara kita berhubungan dengan orang dekat", h: "Kedudukan anak, kekuasaan orang tua, perwalian, dan pengangkatan anak" },
    { f: "Menyelesaikan konflik secara sehat: mendengar, mengakui, memperbaiki", h: "Kekerasan dalam rumah tangga: bentuk dan perlindungan korban" },
    { f: "Ketahanan emosi: pulih dari kegagalan dan kehilangan", h: "Hukum waris: pewaris, ahli waris, dan sistem pewarisan yang berlaku di Indonesia" }
  ]},
  0: null
};

const PETUNJUK_JENJANG =
  "Makna jenjang: DASAR = fondasi, definisi, istilah kunci, contoh sederhana; anggap pembaca baru di topik ini. " +
  "MENENGAH = hubungan antar konsep, situasi yang lebih rumit, dan kesalahan umum. " +
  "LANJUT = nuansa, pengecualian, dilema, dan penerapan di situasi sulit; anggap pembaca sudah menguasai dasarnya.";

const SOAL_MARKER_START = "=== SOAL_JSON_START ===";
const SOAL_MARKER_END   = "=== SOAL_JSON_END ===";

const BULAN_INDO = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

// ============================================================
// TANGGAL & JADWAL KURIKULUM
// ============================================================

function parseTgl(tgl) {
  const p = tgl.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
}

function hariDariTgl(tgl) {
  return parseTgl(tgl).getDay();
}

function hitungMinggu(tgl) {
  const senin = function(t) {
    const d = parseTgl(t);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  };
  const selisih = senin(tgl).getTime() - senin(CONFIG.TGL_MULAI).getTime();
  return Math.max(1, Math.round(selisih / 604800000) + 1);
}

function ambilJadwal(tgl) {
  const hari = hariDariTgl(tgl);
  const k = KURIKULUM[hari];
  if (!k) return null;
  const minggu  = hitungMinggu(tgl);
  const jumlah  = k.langkah.length;
  const idx     = (minggu - 1) % jumlah;
  const putaran = Math.floor((minggu - 1) / jumlah) + 1;
  const level   = putaran > 1 ? "Lanjut" : (idx < 3 ? "Dasar" : (idx < 6 ? "Menengah" : "Lanjut"));
  return {
    hari: hari, tema: k.tema, bidang: k.bidang,
    fokus: k.langkah[idx].f, fokusHukum: k.langkah[idx].h,
    minggu: minggu, putaran: putaran, level: level
  };
}

function labelPosisi(j) {
  return "minggu ke-" + j.minggu + ", jenjang " + j.level +
    (j.putaran > 1 ? ", putaran ke-" + j.putaran + " (bahas lebih dalam daripada putaran sebelumnya)" : "");
}

// ============================================================
// FUNGSI UTAMA HARIAN (trigger pagi — menyiapkan materi hari ini)
// ============================================================

function jalankanHarian() {
  const tgl = todayStr();
  if (hariDariTgl(tgl) === 0) {
    Logger.log("Hari Minggu — sistem istirahat.");
    return;
  }
  if (tgl < CONFIG.TGL_MULAI) {
    Logger.log("Sekolah belum dimulai.");
    return;
  }
  const r = pastikanMateri(tgl);
  if (r.sibuk) { Logger.log("Proses lain sedang menyiapkan materi."); return; }
  Logger.log(r.baru ? "Materi dibuat: " + r.baru.tema + " — " + r.baru.fokus : "Materi hari ini sudah ada — dilewati.");
}

// ============================================================
// EMAIL PENGINGAT (trigger jam 21:00)
// ============================================================

function kirimPengingat() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('notifAktif') !== 'true') { Logger.log("Pengingat email nonaktif."); return; }
  const tgl = todayStr();
  if (hariDariTgl(tgl) === 0) return;
  if (props.getProperty('lastSubmitDate') === tgl) { Logger.log("Sudah belajar hari ini — email tidak dikirim."); return; }
  kirimEmailPengingat(tgl);
}

function kirimEmailPengingat(tgl) {
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: "Sekolah Pribadi — belum belajar hari ini",
    body: "Halo,\n\nSudah jam 21:00 dan kamu belum menyelesaikan sesi belajar hari ini (" + tgl + ").\n\n" +
          "Buka sekarang: https://gussohe.github.io/Sekolah-Pribadi/\n\n— Sekolah Pribadi"
  });
  Logger.log("Email pengingat terkirim.");
}

// Jalankan sekali dari editor: memberi izin kirim email dan mengirim email uji.
function tesEmail() {
  kirimEmailPengingat(todayStr() + " (UJI COBA)");
}

// ============================================================
// ANALISIS MINGGUAN
// ============================================================

function analisisMingguan() {
  const apiKey  = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  const tanggal = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMMM yyyy");
  const sheet   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getActiveSheet();
  const data    = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    Logger.log("Belum ada jawaban untuk dianalisis.");
    return null;
  }

  const prompt  = buildPromptAnalisis(data);
  const laporan = panggilClaude(prompt, apiKey);
  if (!laporan || laporan === "ERROR") throw new Error("Gagal membuat laporan dari Claude");

  const folder   = DriveApp.getFolderById(CONFIG.FOLDER_LAPORAN);
  const namaFile = "Laporan Mingguan — " + tanggal;
  const doc      = DocumentApp.create(namaFile);
  doc.getBody().setText(laporan);
  DriveApp.getFileById(doc.getId()).moveTo(folder);

  Logger.log("Laporan mingguan tersimpan: " + namaFile);
  return { judul: namaFile, isi: laporan };
}

// ============================================================
// RIWAYAT — baca pertemuan sebelumnya pada hari yang sama
// ============================================================

function parseTanggalDariNama(nama) {
  const m = nama.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})/);
  if (!m) return null;
  const b = BULAN_INDO.indexOf(m[2]);
  if (b < 0) return null;
  return new Date(Number(m[3]), b, Number(m[1]), 12, 0, 0);
}

function ringkas(teks, maks) {
  return String(teks || '').replace(/\s+/g, ' ').trim().substring(0, maks);
}

function pisahDokumen(teks) {
  const fokus = (teks.match(/^FOKUS: (.*)$/m) || [])[1] || '';
  const level = (teks.match(/^LEVEL: (.*)$/m) || [])[1] || '';
  const soal  = extractSoalFromDoc(teks);
  const parts = teks.split('SISIPAN HUKUM');
  const materi = (parts[0] || teks)
    .replace(/^SEKOLAH PRIBADI.*\n?/m, '')
    .replace(/^TEMA:.*\n?/m, '')
    .replace(/^FOKUS:.*\n?/m, '')
    .replace(/^LEVEL:.*\n?/m, '')
    .replace(/─{3,}/g, '')
    .trim();
  let hukum = '';
  if (parts[1]) {
    hukum = parts[1].split(SOAL_MARKER_START)[0]
      .split('LANGKAH SETELAH MEMBACA')[0]
      .split('────')[0]
      .trim();
  }
  return { fokus: fokus.trim(), level: level.trim(), materi: materi, hukum: hukum, soal: soal };
}

function ambilRiwayat(tema, tglSekarang, batas) {
  const hasil = [];
  try {
    const sekarang = parseTgl(tglSekarang);
    const files = DriveApp.getFolderById(CONFIG.FOLDER_MATERI).searchFiles('title contains "' + tema + '"');
    const unik = {};
    while (files.hasNext()) {
      const f = files.next();
      const nama = f.getName();
      const bagian = nama.split('—');
      if (!bagian[1] || bagian[1].trim() !== tema) continue;
      const tgl = parseTanggalDariNama(nama);
      if (!tgl || tgl.getTime() >= sekarang.getTime()) continue;
      const dibuat = f.getDateCreated().getTime();
      if (unik[nama] && unik[nama].dibuat >= dibuat) continue;
      unik[nama] = { file: f, tgl: tgl, dibuat: dibuat };
    }
    const daftar = Object.keys(unik).map(function(k) { return unik[k]; })
      .sort(function(a, b) { return b.tgl.getTime() - a.tgl.getTime(); })
      .slice(0, batas);
    daftar.forEach(function(e) {
      try {
        const teks = DocumentApp.openById(e.file.getId()).getBody().getText();
        const p = pisahDokumen(teks);
        hasil.push({
          tanggal   : formatTanggalIndo(e.tgl),
          fokus     : p.fokus,
          materi    : ringkas(p.materi, 400),
          hukum     : ringkas(p.hukum, 250),
          pertanyaan: (p.soal && p.soal.soal_pg ? p.soal.soal_pg : []).map(function(q) { return ringkas(q.pertanyaan, 140); }),
          reflektif : ringkas(p.soal ? p.soal.soal_reflektif : '', 160)
        });
      } catch (e2) { Logger.log("Riwayat: gagal membaca satu dokumen: " + e2); }
    });
  } catch (err) {
    Logger.log("Riwayat: gagal: " + err);
  }
  return hasil;   // terbaru lebih dulu
}

function formatRiwayatMateri(r) {
  if (!r.length) return "(belum ada — ini pertemuan pertama untuk hari ini)";
  return r.map(function(x) {
    return "- " + x.tanggal + (x.fokus ? " [fokus: " + x.fokus + "]" : "") + ": " + x.materi;
  }).join("\n");
}

function formatRiwayatHukum(r) {
  const ada = r.filter(function(x) { return x.hukum; });
  if (!ada.length) return "(belum ada)";
  return ada.map(function(x) { return "- " + x.tanggal + ": " + x.hukum; }).join("\n");
}

function kumpulkanPertanyaanLama(r) {
  const daftar = [];
  r.slice(0, 4).forEach(function(x) {
    x.pertanyaan.forEach(function(q) { if (q) daftar.push(q); });
    if (x.reflektif) daftar.push("(reflektif) " + x.reflektif);
  });
  return daftar;
}

// ============================================================
// GENERATE MATERI
// ============================================================

function generateMateri(j, tanggal, riwayat, apiKey) {
  const prompt = `Kamu adalah fasilitator "Sekolah Pribadi": sekolah mandiri untuk satu orang dewasa yang belajar bertahap, seperti kurikulum sungguhan.

Tanggal: ${tanggal}
Tema hari ini: "${j.tema}"
Posisi di kurikulum: ${labelPosisi(j)}
FOKUS PERTEMUAN INI: ${j.fokus}

${PETUNJUK_JENJANG}

PERTEMUAN SEBELUMNYA PADA HARI YANG SAMA (sudah dibahas — jangan ulangi isi, contoh, atau analoginya):
${formatRiwayatMateri(riwayat)}

Tulis materi dengan format berikut:
1. KONSEP INTI (200 kata) — jelaskan konsep utama dari FOKUS di atas secara praktis, bukan teori akademis
2. CONTOH NYATA (150 kata) — dua situasi kehidupan sehari-hari yang relevan dan BERBEDA dari contoh pertemuan sebelumnya
3. SATU HAL YANG BISA DIPRAKTIKKAN HARI INI (100 kata) — satu langkah konkret untuk 24 jam ke depan

Aturan:
- Bahas FOKUS di atas, jangan melebar ke subtopik lain.
- Jika ada pertemuan sebelumnya, buka dengan SATU kalimat jembatan yang mengaitkannya, lalu naikkan: jangan mengulang dasar yang sudah dibahas.
- Jangan mengarang data, angka, hasil studi, atau kutipan. Jika tidak yakin, jangan ditulis.
- Bahasa Indonesia. Gaya: langsung, tidak menggurui, tidak motivasional.`;
  return panggilClaude(prompt, apiKey);
}

// ============================================================
// GENERATE SISIPAN HUKUM
// ============================================================

function generateHukum(j, tanggal, riwayat, apiKey) {
  const prompt = `Kamu adalah pengajar hukum praktis untuk mahasiswa hukum Indonesia Semester IV.

Tanggal: ${tanggal}
Bidang: ${j.bidang}
Posisi di kurikulum: ${labelPosisi(j)}
FOKUS HUKUM PERTEMUAN INI: ${j.fokusHukum}

${PETUNJUK_JENJANG}

SISIPAN HUKUM PERTEMUAN SEBELUMNYA (sudah dibahas — jangan ulangi isi, kasus, atau pasalnya):
${formatRiwayatHukum(riwayat)}

Tulis sisipan belajar hukum dengan format:
1. APA INI? (80 kata) — definisi praktis, bukan definisi kamus
2. CONTOH KASUS (100 kata) — lihat aturan akurasi di bawah
3. PASAL KUNCI (50 kata) — 1-2 pasal paling relevan dengan nomor dan nama UU-nya

ATURAN AKURASI (wajib):
- Sebut kasus nyata HANYA jika kamu yakin akan pihak-pihaknya, amar putusannya, dan dasar pertimbangannya. Jika ragu pada salah satunya, tulis "ILUSTRASI HIPOTETIS:" lalu buat contoh bernama fiktif. Jangan mengarang nomor putusan, tahun, atau nama pihak.
- "Pelajaran hukumnya" harus bisa diturunkan langsung dari fakta dan amar yang kamu tulis. Sebelum menulis kesimpulan, periksa: siapa yang menang, dan atas dasar apa.
- Sebut nomor pasal hanya jika yakin. Jika tidak yakin, sebut nama asas atau lembaga hukumnya tanpa nomor.
- Untuk pidana: KUHP Nasional (UU No. 1 Tahun 2023) mulai berlaku 2 Januari 2026. Jika merujuk pasal KUHP atau KUHAP, nyatakan itu KUHP lama atau KUHP Nasional, dan jangan mencampur nomor pasal keduanya.
- Bahasa Indonesia. Fokus pada pemahaman, bukan hafalan.`;
  return panggilClaude(prompt, apiKey);
}

// ============================================================
// GENERATE SOAL — dari teks materi, divalidasi, lalu diacak
// ============================================================

function generateSoal(j, materi, hukum, riwayat, apiKey, umpanBalik) {
  const lama = kumpulkanPertanyaanLama(riwayat);
  const prompt = `Buat kuis harian "Sekolah Pribadi" dari teks di bawah. Kuis ini menguji apakah pembaca benar-benar memahami teks yang baru dibacanya.

Tema: "${j.tema}"
Posisi di kurikulum: ${labelPosisi(j)}

=== MATERI ===
${materi}

=== SISIPAN HUKUM ===
${hukum}
=== AKHIR TEKS ===

ATURAN ISI:
1. Buat 10 soal pilihan ganda: soal 1-7 dari MATERI, soal 8-10 dari SISIPAN HUKUM.
2. Setiap soal HARUS bisa dijawab hanya dari isi teks di atas. Dilarang menanyakan hal yang tidak dibahas teks.
3. Kesulitan mengikuti jenjang ${j.level}. Minimal separuh soal berupa skenario 1-3 kalimat yang menuntut penerapan konsep, bukan hafalan istilah.

ATURAN PILIHAN JAWABAN (paling penting):
4. Empat pilihan harus hampir sama panjang, struktur kalimat, dan nadanya. Jawaban benar TIDAK boleh lebih panjang, lebih rinci, atau lebih hati-hati daripada pengecoh.
5. Tiga pengecoh harus masuk akal bagi pembaca yang hanya membaca sekilas: setengah benar, membalik sebab-akibat, menukar subjek atau syarat, atau salah kaprah yang umum. Hanya SATU pilihan yang benar menurut teks.
6. Dilarang: "semua benar", "semua salah", "A dan B benar", pilihan yang menunjuk pilihan lain, dan kata mutlak (selalu, tidak pernah, hanya) yang sengaja ditaruh hanya di pengecoh.

ATURAN ANTI-PENGULANGAN:
7. Jangan menyalin atau memparafrasekan pertanyaan lama berikut:
${lama.length ? lama.map(function(q) { return "- " + q; }).join("\n") : "(belum ada)"}
8. Soal reflektif: satu pertanyaan yang menghubungkan materi hari ini dengan pengalaman pribadi pembaca, berbeda dari reflektif lama.
${umpanBalik ? "\nPERBAIKAN WAJIB: " + umpanBalik + "\n" : ""}
OUTPUT: JSON saja, tanpa teks lain, dengan format persis:
{
  "soal_pg": [
    { "nomor": 1, "pertanyaan": "...", "pilihan": {"A": "...", "B": "...", "C": "...", "D": "..."}, "jawaban_benar": "A" }
  ],
  "soal_reflektif": "..."
}
Semua dalam Bahasa Indonesia.`;
  return panggilClaudeModel(prompt, apiKey, CONFIG.MODEL_SOAL, CONFIG.MAX_TOKENS_SOAL);
}

function normalisasiTeks(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function kemiripan(a, b) {
  const A = {}, B = {};
  normalisasiTeks(a).split(' ').forEach(function(w) { if (w.length > 2) A[w] = 1; });
  normalisasiTeks(b).split(' ').forEach(function(w) { if (w.length > 2) B[w] = 1; });
  const ka = Object.keys(A), kb = Object.keys(B);
  if (!ka.length || !kb.length) return 0;
  let irisan = 0;
  ka.forEach(function(w) { if (B[w]) irisan++; });
  return irisan / (ka.length + kb.length - irisan);
}

// Mengembalikan { soal, masalah[] }. soal = null bila struktur rusak.
function validasiSoal(s, pertanyaanLama) {
  const huruf = ['A', 'B', 'C', 'D'];
  if (!s || !Array.isArray(s.soal_pg) || s.soal_pg.length < 10 ||
      typeof s.soal_reflektif !== 'string' || !s.soal_reflektif.trim()) {
    return { soal: null, masalah: ['struktur JSON tidak lengkap (butuh 10 soal_pg dan soal_reflektif)'] };
  }
  const hasil = { soal_pg: [], soal_reflektif: s.soal_reflektif.trim() };
  const masalah = [];
  let benarTerpanjang = 0, timpang = 0;

  for (let i = 0; i < 10; i++) {
    const q = s.soal_pg[i];
    const kunci = q && String(q.jawaban_benar || '').trim().toUpperCase();
    if (!q || typeof q.pertanyaan !== 'string' || !q.pertanyaan.trim() || !q.pilihan || huruf.indexOf(kunci) < 0) {
      return { soal: null, masalah: ['soal ' + (i + 1) + ' rusak (pertanyaan, pilihan, atau jawaban_benar)'] };
    }
    const pilihan = {};
    for (let k = 0; k < 4; k++) {
      const t = String(q.pilihan[huruf[k]] || '').replace(/^[A-D][\.\)]\s+/, '').trim();
      if (!t) return { soal: null, masalah: ['soal ' + (i + 1) + ' kehilangan pilihan ' + huruf[k]] };
      pilihan[huruf[k]] = t;
    }
    const teks = huruf.map(function(h) { return pilihan[h]; });
    const unik = {};
    teks.forEach(function(t) { unik[normalisasiTeks(t)] = 1; });
    if (Object.keys(unik).length < 4) masalah.push('soal ' + (i + 1) + ' punya pilihan yang kembar');
    teks.forEach(function(t) {
      if (/^\s*(semua|seluruh)\s+(jawaban|pilihan)?\s*(di atas\s+)?(benar|salah)/i.test(t) ||
          /^\s*[a-d]\s*(dan|&|,)\s*[a-d]\b/i.test(t) ||
          /^\s*(jawaban|pilihan)\s+[a-d]\b/i.test(t)) {
        masalah.push('soal ' + (i + 1) + ' memakai pilihan semacam "semua benar" atau menunjuk pilihan lain');
      }
    });

    const panjang = huruf.map(function(h) { return pilihan[h].length; });
    const benarIdx = huruf.indexOf(kunci);
    const lainMaks = Math.max.apply(null, panjang.filter(function(_, n) { return n !== benarIdx; }));
    if (panjang[benarIdx] > lainMaks * 1.15) benarTerpanjang++;
    if (Math.max.apply(null, panjang) > Math.min.apply(null, panjang) * 2) timpang++;

    pertanyaanLama.forEach(function(lama) {
      if (kemiripan(q.pertanyaan, lama) >= 0.7) masalah.push('soal ' + (i + 1) + ' terlalu mirip dengan pertanyaan lama');
    });
    hasil.soal_pg.push({ nomor: i + 1, pertanyaan: q.pertanyaan.trim(), pilihan: pilihan, jawaban_benar: kunci });
  }
  if (benarTerpanjang >= 4) masalah.push('jawaban benar terlalu sering menjadi pilihan terpanjang (' + benarTerpanjang + ' dari 10 soal); samakan panjang semua pilihan');
  if (timpang >= 5) masalah.push('panjang pilihan terlalu timpang pada ' + timpang + ' soal; buat keempat pilihan setara panjangnya');
  return { soal: hasil, masalah: masalah };
}

function acakUrutan(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[k]; a[k] = t;
  }
  return a;
}

// Letakkan jawaban benar di posisi yang tersebar rata (A-D), pengecoh diacak.
function acakPilihan(soal) {
  const huruf = ['A', 'B', 'C', 'D'];
  const target = acakUrutan(['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B']);
  soal.soal_pg.forEach(function(q, i) {
    const benarTeks = q.pilihan[q.jawaban_benar];
    const pengecoh = acakUrutan(huruf.filter(function(h) { return h !== q.jawaban_benar; }).map(function(h) { return q.pilihan[h]; }));
    const baru = {};
    let n = 0;
    huruf.forEach(function(h) { baru[h] = (h === target[i]) ? benarTeks : pengecoh[n++]; });
    q.pilihan = baru;
    q.jawaban_benar = target[i];
  });
  return soal;
}

function generateSoalTervalidasi(j, materi, hukum, riwayat, apiKey) {
  const lama = kumpulkanPertanyaanLama(riwayat);
  let umpan = '';
  let terbaik = null;
  for (let i = 0; i < CONFIG.MAKS_PERCOBAAN_SOAL; i++) {
    const raw = generateSoal(j, materi, hukum, riwayat, apiKey, umpan);
    const v = validasiSoal(extractJsonFromString(raw), lama);
    Logger.log("Soal percobaan " + (i + 1) + ": " + (v.soal ? "struktur OK" : "struktur rusak") +
               (v.masalah.length ? " | masalah: " + v.masalah.join("; ") : " | bersih"));
    if (v.soal && (!terbaik || v.masalah.length < terbaik.masalah.length)) terbaik = v;
    if (v.soal && v.masalah.length === 0) break;
    umpan = "Percobaan sebelumnya ditolak karena: " + v.masalah.join("; ") + ". Perbaiki semuanya.";
  }
  return (terbaik && terbaik.soal) ? acakPilihan(terbaik.soal) : null;
}

// ============================================================
// SIMPAN MATERI — soal JSON disimpan di akhir dokumen
// ============================================================

function simpanMateri(tanggal, j, materi, hukum, formUrl, soalStr) {
  const folder   = DriveApp.getFolderById(CONFIG.FOLDER_MATERI);
  const namaFile = tanggal + " — " + j.tema;
  const doc      = DocumentApp.create(namaFile);
  const body     = doc.getBody();

  body.appendParagraph("SEKOLAH PRIBADI — " + tanggal)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("TEMA: " + j.tema.toUpperCase())
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("FOKUS: " + j.fokus);
  body.appendParagraph("LEVEL: " + j.level + " · Minggu " + j.minggu);

  body.appendParagraph(materi);
  body.appendParagraph("────────────────────────────────────");
  body.appendParagraph("SISIPAN HUKUM")
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(hukum);
  body.appendParagraph("────────────────────────────────────");
  body.appendParagraph("LANGKAH SETELAH MEMBACA")
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("1. Tulis jurnal pribadimu — apa yang paling kamu kenali dari materi hari ini?");
  body.appendParagraph("2. Isi kuis harian melalui link berikut:");

  if (formUrl && formUrl !== "ERROR") {
    const para = body.appendParagraph("");
    const text = para.appendText(formUrl);
    text.setLinkUrl(formUrl);
  } else {
    body.appendParagraph("(Form tidak tersedia — jalankan ulang dari Apps Script)");
  }

  if (soalStr) {
    body.appendParagraph(SOAL_MARKER_START);
    body.appendParagraph(soalStr);
    body.appendParagraph(SOAL_MARKER_END);
  }

  doc.saveAndClose();
  const id = doc.getId();
  DriveApp.getFileById(id).moveTo(folder);
  Logger.log("Materi tersimpan: " + namaFile);
  return id;
}

function extractSoalFromDoc(docText) {
  try {
    const start = docText.indexOf(SOAL_MARKER_START);
    const end   = docText.indexOf(SOAL_MARKER_END);
    if (start === -1 || end === -1) return null;
    return extractJsonFromString(docText.substring(start + SOAL_MARKER_START.length, end).trim());
  } catch (e) { return null; }
}

// ============================================================
// BUAT FORM
// ============================================================

function buatForm(tanggal, tema, soalData) {
  if (!soalData || !soalData.soal_pg) return "ERROR";

  const form = FormApp.create("Kuis Harian — " + tema + " — " + tanggal);
  form.setDescription("Isi kuis ini setelah membaca materi dan menulis jurnal pribadi.");
  form.setCollectEmail(false);

  soalData.soal_pg.forEach(function(s) {
    const item = form.addMultipleChoiceItem();
    item.setTitle(s.nomor + ". " + s.pertanyaan);
    item.setChoices([
      item.createChoice("A. " + s.pilihan.A),
      item.createChoice("B. " + s.pilihan.B),
      item.createChoice("C. " + s.pilihan.C),
      item.createChoice("D. " + s.pilihan.D)
    ]);
    item.setRequired(true);
  });

  const reflektif = form.addParagraphTextItem();
  reflektif.setTitle("11. " + soalData.soal_reflektif);
  reflektif.setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SPREADSHEET_ID);
  const publishedUrl = form.getPublishedUrl();
  Logger.log("Form URL responden: " + publishedUrl);
  return publishedUrl;
}

// ============================================================
// SIAPKAN MATERI — satu jalur untuk trigger pagi dan permintaan aplikasi
// ============================================================

function cariDokumenMateri(tgl) {
  const target = formatTanggalIndo(parseTgl(tgl));
  const files  = DriveApp.getFolderById(CONFIG.FOLDER_MATERI).searchFiles('title contains "' + target + '"');
  let terbaik = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!f.getName().startsWith(target + ' ')) continue;
    if (!terbaik || f.getDateCreated().getTime() > terbaik.getDateCreated().getTime()) terbaik = f;
  }
  return terbaik;
}

function siapkanMateri(tgl) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  if (!apiKey) throw new Error("CLAUDE_API_KEY belum diset");
  const j = ambilJadwal(tgl);
  if (!j) throw new Error("Tidak ada jadwal untuk tanggal " + tgl);

  const tanggal = formatTanggalIndo(parseTgl(tgl));
  const riwayat = ambilRiwayat(j.tema, tgl, CONFIG.JUMLAH_RIWAYAT);

  const materi = generateMateri(j, tanggal, riwayat, apiKey);
  if (!materi || materi === "ERROR") throw new Error("Gagal membuat materi dari Claude");
  const hukum = generateHukum(j, tanggal, riwayat, apiKey);
  if (!hukum || hukum === "ERROR") throw new Error("Gagal membuat sisipan hukum dari Claude");

  const soal    = generateSoalTervalidasi(j, materi, hukum, riwayat, apiKey);
  const formUrl = soal ? buatForm(tanggal, j.tema, soal) : "ERROR";
  const id      = simpanMateri(tanggal, j, materi, hukum, formUrl, soal ? JSON.stringify(soal) : "");

  return bacaDokumenMateri(id, tanggal + " — " + j.tema, tgl);
}

function pastikanMateri(tgl) {
  const ada = cariDokumenMateri(tgl);
  if (ada) return { file: ada };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(150000)) return { sibuk: true };
  try {
    const lagi = cariDokumenMateri(tgl);
    if (lagi) return { file: lagi };
    return { baru: siapkanMateri(tgl) };
  } finally {
    lock.releaseLock();
  }
}

function bacaDokumenMateri(id, nama, tgl) {
  const teks = DocumentApp.openById(id).getBody().getText();
  const p    = pisahDokumen(teks);
  const j    = ambilJadwal(tgl);
  const bagian = nama.split('—');
  let soal = p.soal;
  if (!soal && j) soal = lengkapiSoalDokumen(id, j, p, tgl);
  return {
    tema   : bagian[1] ? bagian[1].trim() : (j ? j.tema : ''),
    tanggal: bagian[0].trim(),
    materi : p.materi,
    hukum  : p.hukum,
    soal   : soal,
    fokus  : p.fokus,
    level  : p.level
  };
}

// Dokumen lama tanpa soal: buat soal dari teks dokumen itu, simpan ke dokumen.
function lengkapiSoalDokumen(id, j, p, tgl) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(150000)) return null;
  try {
    const doc = DocumentApp.openById(id);
    const sudah = extractSoalFromDoc(doc.getBody().getText());
    if (sudah) return sudah;
    const apiKey  = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
    const riwayat = ambilRiwayat(j.tema, tgl, 4);
    const soal    = generateSoalTervalidasi(j, p.materi, p.hukum, riwayat, apiKey);
    if (soal) {
      const body = doc.getBody();
      body.appendParagraph(SOAL_MARKER_START);
      body.appendParagraph(JSON.stringify(soal));
      body.appendParagraph(SOAL_MARKER_END);
      doc.saveAndClose();
    }
    return soal;
  } catch (e) {
    Logger.log("lengkapiSoalDokumen gagal: " + e);
    return null;
  } finally {
    lock.releaseLock();
  }
}

// Pemeliharaan manual dari editor: buang materi satu tanggal ke tempat sampah lalu buat ulang.
function buatUlangMateri(tgl) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(150000)) { Logger.log("Proses lain sedang berjalan."); return; }
  try {
    const target = formatTanggalIndo(parseTgl(tgl));
    const files  = DriveApp.getFolderById(CONFIG.FOLDER_MATERI).searchFiles('title contains "' + target + '"');
    while (files.hasNext()) {
      const f = files.next();
      if (f.getName().startsWith(target + ' ')) f.setTrashed(true);
    }
    const data = siapkanMateri(tgl);
    Logger.log("Dibuat ulang: " + data.tema + " — " + data.fokus);
  } finally {
    lock.releaseLock();
  }
}

function buatUlangMateriHariIni() {
  buatUlangMateri(todayStr());
}

// ============================================================
// WEB APP ENDPOINT
// ============================================================

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'getMateri';
  const tgl    = params.tgl || todayStr();

  try {
    if (action === 'getMateri')          return getMateriResponse(tgl);
    if (action === 'submitHasil')        return submitHasilResponse(params);
    if (action === 'getLaporan')         return getLaporanResponse();
    if (action === 'generateLaporan')    return generateLaporanResponse();
    if (action === 'setNotifPreference') return setNotifPreferenceResponse(params);
    return jsonResponse({ status: 'error', pesan: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', pesan: err.toString() });
  }
}

function getMateriResponse(tgl) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
    return jsonResponse({ status: 'error', pesan: 'Format tanggal tidak valid.' });
  }
  if (hariDariTgl(tgl) === 0) {
    return jsonResponse({ status: 'libur', pesan: 'Hari Minggu — tidak ada materi.' });
  }
  if (tgl > todayStr()) {
    return jsonResponse({ status: 'error', pesan: 'Materi untuk tanggal ini belum dibuka.' });
  }
  if (tgl < CONFIG.TGL_MULAI) {
    return jsonResponse({ status: 'error', pesan: 'Sekolah belum dimulai pada tanggal ini.' });
  }

  const r = pastikanMateri(tgl);
  if (r.sibuk) {
    return jsonResponse({ status: 'error', pesan: 'Materi sedang disiapkan. Coba lagi sebentar lagi.' });
  }
  if (r.baru) {
    return jsonResponse({ status: 'ok', data: r.baru });
  }
  return jsonResponse({ status: 'ok', data: bacaDokumenMateri(r.file.getId(), r.file.getName(), tgl) });
}

// ============================================================
// PROMPT ANALISIS MINGGUAN
// ============================================================

function buildPromptAnalisis(data) {
  const header = data[0].join(", ");
  const baris  = data.slice(1).map(function(row) { return row.join(" | "); }).join("\n");
  return `Kamu adalah mentor "Sekolah Pribadi" yang menganalisis perkembangan belajar seseorang.

Data jawaban kuis seminggu:
Header: ${header}
Data:
${baris}

Buat laporan analisis mingguan:
1. RINGKASAN MINGGU INI (100 kata)
2. TOPIK YANG SUDAH DIPAHAMI DENGAN BAIK
3. TOPIK YANG PERLU PENDALAMAN ULANG (+ alasan singkat)
4. POLA DARI JAWABAN REFLEKTIF (100 kata)
5. SATU REKOMENDASI UNTUK MINGGU DEPAN (50 kata, spesifik dan actionable)

Bahasa Indonesia. Jujur, tidak menggurui.`;
}

// ============================================================
// SUBMIT HASIL KUIS — tulis ke Spreadsheet
// ============================================================

function submitHasilResponse(params) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Tanggal', 'Tema', 'Skor', 'Total', 'Persen', 'Reflektif']);
    }

    const skor  = parseInt(params.skor  || '0');
    const total = parseInt(params.total || '10');
    const pct   = total > 0 ? Math.round(skor / total * 100) + '%' : '0%';
    const tgl   = params.tgl || todayStr();

    sheet.appendRow([
      new Date().toISOString(),
      tgl,
      params.tema      || '—',
      skor,
      total,
      pct,
      params.reflektif || ''
    ]);

    if (tgl === todayStr()) {
      PropertiesService.getScriptProperties().setProperty('lastSubmitDate', tgl);
    }

    return jsonResponse({ status: 'ok' });
  } catch (e) {
    return jsonResponse({ status: 'error', pesan: e.toString() });
  }
}

// ============================================================
// PREFERENSI EMAIL PENGINGAT
// ============================================================

function setNotifPreferenceResponse(params) {
  PropertiesService.getScriptProperties()
    .setProperty('notifAktif', params.aktif === '1' ? 'true' : 'false');
  return jsonResponse({ status: 'ok' });
}

// ============================================================
// LAPORAN MINGGUAN — baca terakhir / buat baru
// ============================================================

function ambilLaporanTerbaru() {
  const files = DriveApp.getFolderById(CONFIG.FOLDER_LAPORAN).getFiles();
  let terbaru = null, waktu = 0;
  while (files.hasNext()) {
    const f = files.next();
    const t = f.getLastUpdated().getTime();
    if (t > waktu) { waktu = t; terbaru = f; }
  }
  if (!terbaru) return null;
  return { judul: terbaru.getName(), isi: DocumentApp.openById(terbaru.getId()).getBody().getText() };
}

function getLaporanResponse() {
  try {
    const ada = ambilLaporanTerbaru();
    if (!ada) {
      return jsonResponse({ status: 'kosong', pesan: 'Laporan mingguan belum dibuat.' });
    }
    return jsonResponse({ status: 'ok', judul: ada.judul, isi: ada.isi });
  } catch (e) {
    return jsonResponse({ status: 'error', pesan: e.toString() });
  }
}

function generateLaporanResponse() {
  try {
    const props    = PropertiesService.getScriptProperties();
    const terakhir = Number(props.getProperty('lastLaporanAt') || 0);
    if (Date.now() - terakhir < CONFIG.JEDA_LAPORAN_MENIT * 60000) {
      const ada = ambilLaporanTerbaru();
      if (ada) return jsonResponse({ status: 'ok', judul: ada.judul, isi: ada.isi });
    }
    const hasil = analisisMingguan();
    if (!hasil) return jsonResponse({ status: 'kosong', pesan: 'Belum ada jawaban kuis.' });
    props.setProperty('lastLaporanAt', String(Date.now()));
    return jsonResponse({ status: 'ok', judul: hasil.judul, isi: hasil.isi });
  } catch (e) {
    return jsonResponse({ status: 'error', pesan: e.toString() });
  }
}

// ============================================================
// PANGGIL CLAUDE API
// ============================================================

function panggilClaude(prompt, apiKey) {
  return panggilClaudeModel(prompt, apiKey, CONFIG.MODEL, CONFIG.MAX_TOKENS);
}

function panggilClaudeModel(prompt, apiKey, model, maxTokens) {
  const url     = "https://api.anthropic.com/v1/messages";
  const payload = {
    model      : model,
    max_tokens : maxTokens,
    messages   : [{ role: "user", content: prompt }]
  };
  const options = {
    method             : "post",
    contentType        : "application/json",
    headers            : {
      "x-api-key"         : apiKey,
      "anthropic-version" : "2023-06-01"
    },
    payload            : JSON.stringify(payload),
    muteHttpExceptions : true
  };

  for (let percobaan = 1; percobaan <= 2; percobaan++) {
    const response = UrlFetchApp.fetch(url, options);
    const kode     = response.getResponseCode();
    if ((kode === 429 || kode >= 500) && percobaan < 2) {
      Logger.log("API [" + model + "] kode " + kode + " — coba lagi.");
      Utilities.sleep(4000);
      continue;
    }
    let result;
    try { result = JSON.parse(response.getContentText()); } catch (e) { return "ERROR"; }
    if (result.content && result.content[0] && result.content[0].text) {
      if (result.stop_reason === "max_tokens") Logger.log("PERINGATAN [" + model + "]: keluaran terpotong (max_tokens).");
      return result.content[0].text;
    }
    Logger.log("Error API [" + model + "]: " + JSON.stringify(result));
    return "ERROR";
  }
  return "ERROR";
}

function panggilClaudeExt(prompt, apiKey, maxTokens) {
  return panggilClaudeModel(prompt, apiKey, CONFIG.MODEL, maxTokens);
}

// ============================================================
// SETUP TRIGGER
// ============================================================

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Materi hari ini disiapkan pagi hari, supaya langsung siap saat aplikasi dibuka
  ScriptApp.newTrigger("jalankanHarian")
    .timeBased().everyDays(1).atHour(4).create();

  // Email pengingat jam 21:00 (hanya terkirim bila toggle aktif dan belum belajar)
  ScriptApp.newTrigger("kirimPengingat")
    .timeBased().everyDays(1).atHour(21).create();

  ScriptApp.newTrigger("analisisMingguan")
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(14).create();

  Logger.log("Trigger berhasil didaftarkan.");
}

// ============================================================
// TES SISTEM
// ============================================================

function tesSistem() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  if (!apiKey) { Logger.log("ERROR: API key belum diset."); return; }
  Logger.log("API key ditemukan. Menguji koneksi ke Claude...");
  const hasil = panggilClaude("Balas hanya dengan kata: BERHASIL", apiKey);
  Logger.log("Respons Claude: " + hasil);
  Logger.log(hasil.includes("BERHASIL") ? "✓ Sistem siap." : "✗ Ada masalah. Cek API key.");
}

// ============================================================
// HELPERS
// ============================================================

function formatTanggalIndo(date) {
  return date.getDate() + ' ' + BULAN_INDO[date.getMonth()] + ' ' + date.getFullYear();
}

function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function extractJsonFromString(str) {
  if (!str || str === 'ERROR') return null;
  const cleaned = str.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) {}
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.substring(start, end + 1)); } catch (e) {}
  }
  return null;
}
