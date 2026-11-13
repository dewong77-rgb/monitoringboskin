// Config.gs
// Monitoring Implementasi BOS Kinerja Kategori Kinerja Terbaik Jenjang SMA Tahun 2026 (Jawa Barat dan Banten).
// Proyek Apps Script mandiri (tidak terikat spreadsheet). Deploy sebagai Web App: Execute as Me, Who has access: Anyone.
// Setiap perubahan kode harus di-deploy sebagai Versi baru (Deploy > Manage deployments > Edit > Version: New version).
//
// Pengaturan lewat Script Properties (Project Settings > Script properties), atau isi nilai bawaan di bawah:
//   ID_MASTER   : ID spreadsheet Data Master (wajib)
//   ID_HASIL    : ID spreadsheet Hasil Isian (wajib)
//   KODE_AKSES  : kode akses opsional. Bila diisi, aplikasi meminta kode sekali per perangkat.

var CFG = {
  NAMA_APLIKASI: 'Monitoring BOS Kinerja Terbaik SMA 2026',
  PREFIX: 'BOSKIN-',
  ID_MASTER: '1Fj3VC2OQyxQMA-M3-UlsPHkUNZNZA9IqIkQyKFPZ1oE',
  ID_HASIL: '15zh-QDfBhqUDx0NkNgOVPIrv93rLK1LN_idtqqOvfw0',
  TTL_CACHE_DETIK: 600,
  ZONA: 'Asia/Jakarta',
  SHEET: {
    LOKUS: 'Lokus', TIM: 'Tim', PETUGAS: 'Petugas', OPSI: 'Opsi', TABEL: 'Tabel', BANK: 'Bank Soal',
    ISIAN: { Satdik: 'Isian Satdik', UPT: 'Isian UPT' },
    RESPONDEN: 'Responden', ACUAN_LOKUS: 'Acuan Lokus', ACUAN_INSTRUMEN: 'Acuan Instrumen', REKAP_RINGKAS: 'Rekap Ringkas'
  },
  META_ISIAN: [
    'Kode Referensi', 'Status', 'Butir Terisi', 'Total Butir', 'Persen', 'Jenis', 'Tahap', 'ID Tim',
    'Provinsi', 'Kab/Kota', 'ID Lokus', 'NPSN', 'Nama Lokus', 'Tanggal Pelaksanaan', 'Petugas Hadir',
    'Pendamping Cabang Dinas', 'Instansi Pendamping', 'Jumlah Responden', 'Dibuat', 'Diperbarui'
  ],
  KOLOM_RESPONDEN: ['Kode Referensi', 'Jenis', 'ID Lokus', 'Nama Lokus', 'No', 'Nama', 'Peran', 'Ditambah Manual'],
  KOLOM_ACUAN_INSTRUMEN: ['ID Butir', 'Instrumen', 'Bagian', 'Urutan', 'Label Kolom', 'Tipe Jawaban', 'Wajib', 'Tampil Jika', 'Tabel', 'Baris', 'Kolom'],
  // Peta judul kolom sheet Lokus -> kunci JSON. Kolom lain di kanan diabaikan.
  KOLOM_LOKUS: {
    'Kode': 'kode', 'Jenis': 'jenis', 'Tahap': 'tahap', 'ID Tim': 'idTim', 'Provinsi': 'provinsi', 'Kab/Kota': 'kabKota',
    'ID Lokus': 'idLokus', 'NPSN': 'npsn', 'Nama Lokus': 'nama', 'Tanggal Mulai': 'tanggalMulai', 'Tanggal Selesai': 'tanggalSelesai',
    'Jumlah Siswa': 'jumlahSiswa', 'Kategori Sekolah': 'kategori', 'Penerima BOSKIN 2025': 'penerima2025', 'SiLPA 2025': 'silpa2025',
    'Kode Gugus': 'gugus', 'Status RKAS': 'statusRkas', 'Status BKU': 'statusBku',
    'Anggaran Literasi Numerasi': 'anggaranLitNum', 'Realisasi Literasi Numerasi': 'realisasiLitNum',
    'Anggaran Digitalisasi': 'anggaranDig', 'Realisasi Digitalisasi': 'realisasiDig',
    'Anggaran Tata Kelola': 'anggaranTk', 'Realisasi Tata Kelola': 'realisasiTk',
    'Total Anggaran': 'totalAnggaran', 'Total Realisasi': 'totalRealisasi',
    'Mengisi Supervisi BOSKIN': 'supervisi', 'Responden Supervisi': 'respondenSupervisi'
  },
  KOLOM_BANK: {
    'ID Butir': 'idButir', 'Instrumen': 'instrumen', 'Bagian': 'bagian', 'Urutan': 'urutan', 'Label Kolom': 'label',
    'Teks Pertanyaan': 'teks', 'Tipe Jawaban': 'tipe', 'Opsi': 'opsi', 'Wajib': 'wajib', 'Tampil Jika': 'tampilJika',
    'Isi Otomatis': 'isiOtomatis', 'Pembanding': 'pembanding', 'Tabel': 'tabel', 'Baris': 'baris', 'Kolom': 'kolom',
    'Pendalaman': 'pendalaman', 'Keterangan': 'keterangan'
  },
  KOLOM_TABEL: { 'ID Tabel': 'id', 'Instrumen': 'instrumen', 'Judul': 'judul', 'Susun Per': 'susunPer', 'Wajib': 'wajib', 'Tampil Jika': 'tampilJika', 'Keterangan': 'keterangan' },
  KOLOM_TIM: { 'ID Tim': 'idTim', 'Tahap': 'tahap', 'Provinsi': 'provinsi', 'Kab/Kota': 'kabKota', 'Tanggal Mulai': 'tanggalMulai', 'Tanggal Selesai': 'tanggalSelesai' },
  KOLOM_PETUGAS: { 'Nama': 'nama', 'Instansi': 'instansi' }
};

function prop_(nama, bawaan) {
  var v = PropertiesService.getScriptProperties().getProperty(nama);
  return v !== null && v !== '' ? v : bawaan;
}
function idMaster_() { return prop_('ID_MASTER', CFG.ID_MASTER); }
function idHasil_() { return prop_('ID_HASIL', CFG.ID_HASIL); }
function kodeAkses_() { return prop_('KODE_AKSES', ''); }
