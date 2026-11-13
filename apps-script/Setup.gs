// Setup.gs
// Fungsi yang dijalankan manual dari editor Apps Script (pilih fungsi, lalu Run). Lihat log di Execution log.
//
// Urutan pemasangan:
// 1. Buat proyek Apps Script baru (script.google.com > New project). Salin ketujuh file: Config, Util, Web, Master, Isian, Progres, Setup.
// 2. Project Settings > Script properties: tambah ID_MASTER dan ID_HASIL (ID spreadsheet dari URL). KODE_AKSES opsional.
// 3. Jalankan setupPeriksa() sekali. Setujui izin akses Spreadsheet. Pastikan log tidak ada baris "GAGAL".
// 4. Jalankan sinkronManual() sekali agar acuan dan kolom di Hasil terbentuk.
// 5. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Salin URL /exec ke js/config.js di frontend.
// 6. Setelah uji coba, jalankan hapusDataUji() lalu bersihkanCacheManual().

function setupPeriksa() {
  var log = function (s) { console.log(s); };
  log('ID_MASTER: ' + (idMaster_() ? 'ada' : 'GAGAL, belum diisi'));
  log('ID_HASIL: ' + (idHasil_() ? 'ada' : 'GAGAL, belum diisi'));
  log('KODE_AKSES: ' + (kodeAkses_() ? 'dipakai' : 'tidak dipakai'));
  if (!idMaster_() || !idHasil_()) return;
  var ss = bukaMaster_(), S = CFG.SHEET;
  [S.LOKUS, S.TIM, S.PETUGAS, S.OPSI, S.TABEL, S.BANK].forEach(function (n) {
    log('Master sheet ' + n + ': ' + (ss.getSheetByName(n) ? 'ada' : 'GAGAL, tidak ditemukan'));
  });
  var h = bukaHasil_();
  [S.ISIAN.Satdik, S.ISIAN.UPT, S.RESPONDEN, S.ACUAN_LOKUS, S.ACUAN_INSTRUMEN, S.REKAP_RINGKAS, 'Rekap Pengisian'].forEach(function (n) {
    log('Hasil sheet ' + n + ': ' + (h.getSheetByName(n) ? 'ada' : 'GAGAL, tidak ditemukan'));
  });
  var m = bacaMaster_();
  log('Lokus: ' + m.lokus.length + ' (Satdik ' + m.lokus.filter(function (l) { return l.jenis === 'Satdik'; }).length +
    ', UPT ' + m.lokus.filter(function (l) { return l.jenis === 'UPT'; }).length + ')');
  log('Tim: ' + m.tim.length + ', Petugas: ' + m.petugas.length + ', Tabel: ' + m.tabel.length + ', Butir: ' + m.bank.length);
  var ganda = {}, idGanda = [];
  m.lokus.forEach(function (l) { if (ganda[l.idLokus]) idGanda.push(l.idLokus); ganda[l.idLokus] = true; });
  log('ID Lokus ganda: ' + (idGanda.length ? 'GAGAL ' + idGanda.join(', ') : 'tidak ada'));
  var gb = {}, bGanda = [];
  m.bank.forEach(function (b) { if (gb[b.idButir]) bGanda.push(b.idButir); gb[b.idButir] = true; });
  log('ID Butir ganda: ' + (bGanda.length ? 'GAGAL ' + bGanda.join(', ') : 'tidak ada'));
  var tanpaTim = m.lokus.filter(function (l) { return !m.tim.some(function (t) { return t.idTim === l.idTim; }); });
  log('Lokus tanpa tim di sheet Tim: ' + (tanpaTim.length ? tanpaTim.map(function (l) { return l.kode; }).join(', ') : 'tidak ada'));
  var namaPetugas = {};
  m.petugas.forEach(function (p) { namaPetugas[p.nama] = true; });
  var tidakBaku = [];
  m.tim.forEach(function (t) { t.petugas.forEach(function (n) { if (!namaPetugas[n]) tidakBaku.push(t.idTim + ': ' + n); }); });
  log('Petugas tim yang tidak ada di sheet Petugas: ' + (tidakBaku.length ? tidakBaku.join('; ') : 'tidak ada'));
  var cacheOk = cacheSimpan_('uji_cache', m, 60);
  log('Cache master (gzip): ' + (cacheOk ? 'muat' : 'GAGAL, terlalu besar; aplikasi tetap jalan tanpa cache'));
  cacheHapus_('uji_cache');
  log('Selesai. Lanjutkan dengan sinkronManual().');
}

function sinkronManual() {
  var m = bacaMaster_();
  cacheSimpan_('master', m, CFG.TTL_CACHE_DETIK);
  var hasil = sinkronKeHasil_(m, true);
  console.log('Sinkron ke Hasil: ' + (hasil ? 'selesai' : 'dilewati (kunci sibuk)'));
}

function bersihkanCacheManual() {
  cacheHapus_('master');
  console.log('Cache master dibersihkan.');
}

// Hapus semua baris isian dan responden (baris 2 ke bawah). Jalankan sebelum kegiatan dimulai.
function hapusDataUji() {
  var ss = bukaHasil_(), S = CFG.SHEET;
  [S.ISIAN.Satdik, S.ISIAN.UPT, S.RESPONDEN].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh) return;
    var akhir = sh.getLastRow();
    if (akhir >= 2) sh.getRange(2, 1, akhir - 1, sh.getMaxColumns()).clearContent();
    console.log(n + ': ' + Math.max(0, akhir - 1) + ' baris dihapus.');
  });
}

// Uji cepat tanpa browser: simpan draft contoh ke lokus pertama, lalu baca kembali.
function ujiSimpanContoh() {
  var m = bacaMaster_(), l = m.lokus[0];
  var r = simpanIsian_({ idLokus: l.idLokus, status: 'draft', tanggalPelaksanaan: tanggalIso_(new Date()),
    petugasHadir: ['Petugas Uji'], pendampingNama: 'Uji', pendampingInstansi: 'Uji',
    jawaban: { 'S-01': 'Ya', 'S-01A': 'Contoh isian uji. Hapus dengan hapusDataUji().' },
    responden: [{ nama: 'Responden Uji', peran: 'Kepala Sekolah', manual: false }] });
  console.log(JSON.stringify(r));
  console.log(JSON.stringify(ambilIsian_(l.idLokus)).slice(0, 400));
  console.log(JSON.stringify(ambilProgres_().ringkas));
}
