// Isian.gs
// Membaca dan menyimpan isian per lokus (upsert, kunci Kode Referensi = PREFIX + ID Lokus) serta responden.

function kodeRef_(idLokus) { return CFG.PREFIX + idLokus; }

function sheetIsian_(ss, jenis) {
  var nama = CFG.SHEET.ISIAN[jenis];
  if (!nama) throw new Error('Jenis lokus tidak dikenal: ' + jenis);
  return pastikanSheet_(ss, nama, CFG.META_ISIAN);
}

function cariBaris_(sh, kode) {
  var n = sh.getLastRow();
  if (n < 2) return -1;
  var kolomA = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < kolomA.length; i++) if (teks_(kolomA[i][0]) === kode) return i + 2;
  return -1;
}

function ambilIsian_(idLokus) {
  if (!idLokus) throw new Error('idLokus kosong.');
  var m = ambilMaster_(false), l = lokusDariId_(m, idLokus);
  if (!l) throw new Error('Lokus ' + idLokus + ' tidak ada di data master.');
  var ss = bukaHasil_(), sh = sheetIsian_(ss, l.jenis), kode = kodeRef_(idLokus);
  var r = cariBaris_(sh, kode);
  if (r < 0) return null;
  var h = indeksHeader_(sh), baris = sh.getRange(r, 1, 1, h.daftar.length).getValues()[0];
  var meta = {}, jawaban = {};
  for (var i = 0; i < h.daftar.length; i++) {
    var judul = h.daftar[i];
    if (!judul) continue;
    var v = baris[i];
    if (CFG.META_ISIAN.indexOf(judul) >= 0) meta[judul] = v instanceof Date ? normalTanggal_(v) : v;
    else jawaban[judul] = v instanceof Date ? normalTanggal_(v) : (kosong_(v) ? '' : String(v));
  }
  return {
    idLokus: idLokus, kodeReferensi: kode, jenis: l.jenis,
    status: teks_(meta['Status']).toLowerCase() === 'selesai' ? 'selesai' : 'draft',
    butirTerisi: Number(meta['Butir Terisi']) || 0, totalButir: Number(meta['Total Butir']) || 0,
    tanggalPelaksanaan: normalTanggal_(meta['Tanggal Pelaksanaan']),
    petugasHadir: teks_(meta['Petugas Hadir']).split(';').map(function (x) { return x.trim(); }).filter(function (x) { return x; }),
    pendampingNama: teks_(meta['Pendamping Cabang Dinas']), pendampingInstansi: teks_(meta['Instansi Pendamping']),
    jawaban: jawaban, responden: bacaResponden_(ss, kode),
    dibuat: teks_(meta['Dibuat']), diperbarui: teks_(meta['Diperbarui'])
  };
}

function bacaResponden_(ss, kode) {
  var sh = ss.getSheetByName(CFG.SHEET.RESPONDEN);
  if (!sh || sh.getLastRow() < 2) return [];
  var nilai = sh.getRange(2, 1, sh.getLastRow() - 1, CFG.KOLOM_RESPONDEN.length).getValues(), hasil = [];
  for (var i = 0; i < nilai.length; i++) {
    if (teks_(nilai[i][0]) !== kode) continue;
    hasil.push({ no: Number(nilai[i][4]) || hasil.length + 1, nama: teks_(nilai[i][5]), peran: teks_(nilai[i][6]), manual: /^ya$/i.test(teks_(nilai[i][7])) });
  }
  hasil.sort(function (a, b) { return a.no - b.no; });
  return hasil;
}

// payload: {idLokus, status: 'draft'|'selesai', tanggalPelaksanaan, petugasHadir[], pendampingNama, pendampingInstansi, jawaban{}, responden[]}
function simpanIsian_(p) {
  var idLokus = teks_(p.idLokus);
  if (!idLokus) return gagal_('idLokus kosong.');
  var m = ambilMaster_(false), l = lokusDariId_(m, idLokus);
  if (!l) return gagal_('Lokus ' + idLokus + ' tidak ada di data master. Muat ulang data lokus di beranda.');
  var status = teks_(p.status).toLowerCase() === 'selesai' ? 'selesai' : 'draft';

  var jawaban = {};
  var bankJenis = m.bank.filter(function (b) { return b.instrumen === l.jenis; });
  var asal = p.jawaban || {};
  bankJenis.forEach(function (b) { jawaban[b.idButir] = kosong_(asal[b.idButir]) ? '' : String(asal[b.idButir]); });
  bankJenis.forEach(function (b) { if (b.tipe === 'Tanggal' && jawaban[b.idButir]) jawaban[b.idButir] = normalTanggal_(jawaban[b.idButir]); });
  Aturan.hitungOtomatis(bankJenis, jawaban);
  var hit = Aturan.bersihkanTersembunyi(bankJenis, m.tabel, l.jenis, jawaban);

  var responden = (p.responden || []).map(function (r, i) {
    return { no: i + 1, nama: teks_(r.nama), peran: teks_(r.peran), manual: !!r.manual };
  }).filter(function (r) { return r.nama || r.peran; });
  var petugas = (p.petugasHadir || []).map(function (x) { return teks_(x); }).filter(function (x) { return x; });
  var tanggal = normalTanggal_(p.tanggalPelaksanaan);

  if (status === 'selesai') {
    var kurang = hit.kurang.map(function (k) { return { kunci: k.id, label: k.label, bagian: k.bagian }; });
    if (!tanggal) kurang.unshift({ kunci: 'tanggal', label: 'Tanggal pelaksanaan', bagian: 'Kehadiran' });
    if (!petugas.length) kurang.unshift({ kunci: 'petugas', label: 'Petugas yang hadir', bagian: 'Kehadiran' });
    if (!responden.length) kurang.unshift({ kunci: 'responden', label: 'Minimal satu responden', bagian: 'Kehadiran' });
    responden.forEach(function (r, i) { if (!r.nama || !r.peran) kurang.push({ kunci: 'responden' + i, label: 'Responden ke-' + (i + 1) + ': nama dan peran', bagian: 'Kehadiran' }); });
    if (kurang.length) return gagal_('Masih ada ' + kurang.length + ' bagian yang belum lengkap.', { kurang: kurang });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return gagal_('Server sedang sibuk, coba lagi beberapa detik.');
  try {
    var ss = bukaHasil_(), sh = sheetIsian_(ss, l.jenis), kode = kodeRef_(idLokus);
    var h = pastikanKolom_(sh, bankJenis.map(function (b) { return b.idButir; }));
    var r = cariBaris_(sh, kode), sekarang = waktuSekarang_(), dibuat = sekarang;
    if (r > 0) {
      var lama = sh.getRange(r, CFG.META_ISIAN.indexOf('Dibuat') + 1).getValue();
      if (!kosong_(lama)) dibuat = teks_(lama);
    } else {
      r = Math.max(sh.getLastRow(), 1) + 1;
      if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    }
    var persen = hit.total ? Math.round(hit.terisi / hit.total * 100) : 0;
    var meta = {
      'Kode Referensi': kode, 'Status': status === 'selesai' ? 'Selesai' : 'Draft', 'Butir Terisi': String(hit.terisi), 'Total Butir': String(hit.total),
      'Persen': String(persen), 'Jenis': l.jenis, 'Tahap': l.tahap, 'ID Tim': l.idTim, 'Provinsi': l.provinsi, 'Kab/Kota': l.kabKota,
      'ID Lokus': l.idLokus, 'NPSN': l.npsn, 'Nama Lokus': l.nama, 'Tanggal Pelaksanaan': tanggal, 'Petugas Hadir': petugas.join('; '),
      'Pendamping Cabang Dinas': teks_(p.pendampingNama), 'Instansi Pendamping': teks_(p.pendampingInstansi),
      'Jumlah Responden': String(responden.length), 'Dibuat': dibuat, 'Diperbarui': sekarang
    };
    var baris = [];
    for (var i = 0; i < h.daftar.length; i++) {
      var judul = h.daftar[i];
      if (meta[judul] !== undefined) baris.push(aman_(meta[judul]));
      else if (jawaban[judul] !== undefined) baris.push(aman_(jawaban[judul]));
      else baris.push(null);
    }
    var rentang = sh.getRange(r, 1, 1, h.daftar.length);
    rentang.setNumberFormat('@');
    var lama2 = rentang.getValues()[0];
    for (var j = 0; j < baris.length; j++) if (baris[j] === null) baris[j] = lama2[j]; // kolom tak dikenal dibiarkan
    rentang.setValues([baris]);

    tulisResponden_(ss, kode, l, responden);
    SpreadsheetApp.flush();
    return ok_({ kodeReferensi: kode, status: status, butirTerisi: hit.terisi, totalButir: hit.total, diperbarui: sekarang });
  } finally {
    lock.releaseLock();
  }
}

function tulisResponden_(ss, kode, l, responden) {
  var sh = pastikanSheet_(ss, CFG.SHEET.RESPONDEN, CFG.KOLOM_RESPONDEN);
  var n = sh.getLastRow();
  if (n >= 2) {
    var kolomA = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = kolomA.length - 1; i >= 0; i--) if (teks_(kolomA[i][0]) === kode) sh.deleteRow(i + 2);
  }
  if (!responden.length) return;
  var baris = responden.map(function (r) {
    return [kode, l.jenis, l.idLokus, l.nama, String(r.no), aman_(r.nama), aman_(r.peran), r.manual ? 'Ya' : 'Tidak'];
  });
  var mulai = sh.getLastRow() + 1;
  if (mulai + baris.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), baris.length + 50);
  sh.getRange(mulai, 1, baris.length, baris[0].length).setNumberFormat('@').setValues(baris);
}
