// Master.gs
// Membaca spreadsheet Data Master, menyusun JSON master (lokus, tim, petugas, opsi, tabel, bank),
// menyimpannya di cache 10 menit, dan menyinkronkan acuan ke spreadsheet Hasil bila master berubah.

function bukaMaster_() { return SpreadsheetApp.openById(idMaster_()); }
function bukaHasil_() { return SpreadsheetApp.openById(idHasil_()); }

function ambilMaster_(paksa) {
  if (!paksa) {
    var c = cacheBaca_('master');
    if (c && c.lokus) return c;
  }
  var m = bacaMaster_();
  cacheSimpan_('master', m, CFG.TTL_CACHE_DETIK);
  try { sinkronKeHasil_(m, false); } catch (e) { console.error('sinkronKeHasil', e); }
  return m;
}

function bacaMaster_() {
  var ss = bukaMaster_();
  var S = CFG.SHEET;

  var lokus = bacaObjek_(ss.getSheetByName(S.LOKUS), CFG.KOLOM_LOKUS).map(function (l) {
    var o = {};
    for (var judul in CFG.KOLOM_LOKUS) {
      var k = CFG.KOLOM_LOKUS[judul], v = l[k];
      if (k === 'tanggalMulai' || k === 'tanggalSelesai') o[k] = normalTanggal_(v);
      else if (/^(jumlahSiswa|silpa2025|anggaran|realisasi|total)/.test(k)) o[k] = angkaAtauKosong_(v);
      else o[k] = teks_(v);
    }
    o.idLokus = teks_(l.idLokus);
    o.npsn = teks_(l.npsn);
    if (!o.jenis) o.jenis = o.npsn ? 'Satdik' : 'UPT';
    return o;
  }).filter(function (l) { return l.idLokus; });

  var timMentah = ss.getSheetByName(S.TIM) ? ss.getSheetByName(S.TIM).getDataRange().getValues() : [];
  var tim = [];
  if (timMentah.length > 1) {
    var h = timMentah[0].map(function (x) { return teks_(x); });
    for (var r = 1; r < timMentah.length; r++) {
      var baris = timMentah[r], t = { petugas: [] };
      for (var c = 0; c < h.length; c++) {
        var k = CFG.KOLOM_TIM[h[c]];
        if (k) t[k] = /^tanggal/.test(k) ? normalTanggal_(baris[c]) : teks_(baris[c]);
        else if (/^Petugas\s*\d+$/i.test(h[c]) && !kosong_(baris[c])) t.petugas.push(teks_(baris[c]));
      }
      if (t.idTim) tim.push(t);
    }
  }

  var petugas = bacaObjek_(ss.getSheetByName(S.PETUGAS), CFG.KOLOM_PETUGAS)
    .map(function (p) { return { nama: teks_(p.nama), instansi: teks_(p.instansi) }; })
    .filter(function (p) { return p.nama; });

  var opsi = {};
  bacaObjek_(ss.getSheetByName(S.OPSI), { 'Daftar': 'daftar', 'Nilai': 'nilai', 'Keterangan': 'keterangan', 'Urutan': 'urutan' })
    .forEach(function (o) {
      var d = teks_(o.daftar), n = teks_(o.nilai);
      if (!d || !n) return;
      (opsi[d] = opsi[d] || []).push({ nilai: n, keterangan: teks_(o.keterangan), urutan: Number(o.urutan) || 0 });
    });
  for (var d in opsi) opsi[d].sort(function (a, b) { return a.urutan - b.urutan; });

  var tabel = bacaObjek_(ss.getSheetByName(S.TABEL), CFG.KOLOM_TABEL).map(function (t) {
    return { id: teks_(t.id), instrumen: teks_(t.instrumen), judul: teks_(t.judul), susunPer: teks_(t.susunPer) || 'Baris',
      wajib: /^ya$/i.test(teks_(t.wajib)), tampilJika: teks_(t.tampilJika), keterangan: teks_(t.keterangan) };
  }).filter(function (t) { return t.id; });

  var bank = bacaObjek_(ss.getSheetByName(S.BANK), CFG.KOLOM_BANK).map(function (b) {
    return {
      idButir: teks_(b.idButir), instrumen: teks_(b.instrumen) || 'Satdik', bagian: teks_(b.bagian), urutan: Number(b.urutan) || 0,
      label: teks_(b.label), teks: teks_(b.teks), tipe: teks_(b.tipe) || 'Teks Panjang', opsi: teks_(b.opsi),
      wajib: /^ya$/i.test(teks_(b.wajib)), tampilJika: teks_(b.tampilJika), isiOtomatis: teks_(b.isiOtomatis),
      pembanding: teks_(b.pembanding), tabel: teks_(b.tabel), baris: teks_(b.baris), kolom: teks_(b.kolom),
      pendalaman: teks_(b.pendalaman).split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x; }),
      keterangan: teks_(b.keterangan)
    };
  }).filter(function (b) { return b.idButir; });
  bank.sort(function (a, b) { return a.instrumen === b.instrumen ? a.urutan - b.urutan : a.instrumen.localeCompare(b.instrumen); });

  return { lokus: lokus, tim: tim, petugas: petugas, opsi: opsi, tabel: tabel, bank: bank, dibaca: waktuSekarang_() };
}

function lokusDariId_(m, idLokus) {
  for (var i = 0; i < m.lokus.length; i++) if (m.lokus[i].idLokus === idLokus) return m.lokus[i];
  return null;
}

// Sinkronkan Acuan Lokus, Acuan Instrumen, kolom butir di Isian, dan baris Rekap Ringkas ke spreadsheet Hasil.
// Dilewati bila tanda (hash) master sama dengan sinkron terakhir, kecuali paksa.
function sinkronKeHasil_(m, paksa) {
  var tanda = md5_(JSON.stringify({ l: m.lokus, b: m.bank, t: m.tabel }));
  var props = PropertiesService.getScriptProperties();
  if (!paksa && props.getProperty('TANDA_SINKRON') === tanda) return false;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return false;
  try {
    var ss = bukaHasil_(), S = CFG.SHEET;

    // Acuan Lokus: tulis ulang sesuai urutan kolom master
    var judulLokus = Object.keys(CFG.KOLOM_LOKUS);
    var barisLokus = m.lokus.map(function (l) { return judulLokus.map(function (j) { return aman_(l[CFG.KOLOM_LOKUS[j]]); }); });
    tulisUlangSheet_(ss, S.ACUAN_LOKUS, judulLokus, barisLokus);

    // Acuan Instrumen
    var barisInstrumen = m.bank.map(function (b) {
      return [b.idButir, b.instrumen, b.bagian, b.urutan, b.label, b.tipe, b.wajib ? 'Ya' : 'Tidak', b.tampilJika, b.tabel, b.baris, b.kolom];
    });
    tulisUlangSheet_(ss, S.ACUAN_INSTRUMEN, CFG.KOLOM_ACUAN_INSTRUMEN, barisInstrumen);

    // Kolom butir di Isian Satdik dan Isian UPT (kolom lama tidak pernah dihapus)
    for (var jenis in S.ISIAN) {
      var sh = pastikanSheet_(ss, S.ISIAN[jenis], CFG.META_ISIAN);
      var ids = m.bank.filter(function (b) { return b.instrumen === jenis; }).map(function (b) { return b.idButir; });
      pastikanKolom_(sh, ids);
    }
    pastikanSheet_(ss, S.RESPONDEN, CFG.KOLOM_RESPONDEN);

    // Rekap Ringkas: baris kombinasi tahap, provinsi, jenis
    perbaruiRekapRingkas_(ss, m);

    props.setProperty('TANDA_SINKRON', tanda);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function pastikanSheet_(ss, nama, header) {
  var sh = ss.getSheetByName(nama);
  if (!sh) { sh = ss.insertSheet(nama); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function tulisUlangSheet_(ss, nama, header, baris) {
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  var lebar = header.length, tinggi = baris.length + 1;
  if (sh.getMaxColumns() < lebar) sh.insertColumnsAfter(sh.getMaxColumns(), lebar - sh.getMaxColumns());
  if (sh.getMaxRows() < tinggi) sh.insertRowsAfter(sh.getMaxRows(), tinggi - sh.getMaxRows());
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearContent();
  sh.getRange(1, 1, 1, lebar).setValues([header]).setFontWeight('bold');
  if (baris.length) sh.getRange(2, 1, baris.length, lebar).setNumberFormat('@').setValues(baris);
  sh.setFrozenRows(1);
}

// Tambahkan kolom untuk ID yang belum ada di baris header. Mengembalikan indeks header terbaru.
function pastikanKolom_(sh, ids) {
  var h = indeksHeader_(sh), baru = [];
  for (var i = 0; i < ids.length; i++) if (h.peta[ids[i]] === undefined) { baru.push(ids[i]); h.peta[ids[i]] = h.daftar.length; h.daftar.push(ids[i]); }
  if (baru.length) {
    var mulai = sh.getLastColumn() + 1, perlu = mulai + baru.length - 1;
    if (sh.getMaxColumns() < perlu) sh.insertColumnsAfter(sh.getMaxColumns(), perlu - sh.getMaxColumns());
    sh.getRange(1, mulai, 1, baru.length).setValues([baru]).setFontWeight('bold');
    sh.getRange(1, mulai, Math.max(sh.getMaxRows(), 2), baru.length).setNumberFormat('@');
  }
  return h;
}

function perbaruiRekapRingkas_(ss, m) {
  var sh = ss.getSheetByName(CFG.SHEET.REKAP_RINGKAS);
  if (!sh) return;
  var kombinasi = {}, daftar = [];
  m.lokus.forEach(function (l) {
    var k = l.tahap + '|' + l.provinsi + '|' + l.jenis;
    if (!kombinasi[k]) { kombinasi[k] = true; daftar.push([l.tahap, l.provinsi, l.jenis]); }
  });
  daftar.sort(function (a, b) { return a.join('|').localeCompare(b.join('|')); });
  var rp = "'Rekap Pengisian'!", N = 201, baris = [];
  for (var i = 0; i < daftar.length; i++) {
    var r = i + 2;
    var dasar = rp + '$C$2:$C$' + N + ',A' + r + ',' + rp + '$E$2:$E$' + N + ',B' + r + ',' + rp + '$B$2:$B$' + N + ',C' + r;
    baris.push([daftar[i][0], daftar[i][1], daftar[i][2],
      '=COUNTIFS(' + dasar + ')',
      '=COUNTIFS(' + dasar + ',' + rp + '$J$2:$J$' + N + ',"Selesai")',
      '=COUNTIFS(' + dasar + ',' + rp + '$J$2:$J$' + N + ',"Draft")',
      '=D' + r + '-E' + r + '-F' + r, '=IFERROR(E' + r + '/D' + r + ',0)']);
  }
  var n = daftar.length + 1;
  baris.push(['Total', '', '', '=SUM(D2:D' + n + ')', '=SUM(E2:E' + n + ')', '=SUM(F2:F' + n + ')', '=SUM(G2:G' + n + ')', '=IFERROR(E' + (n + 1) + '/D' + (n + 1) + ',0)']);
  if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, 8).clearContent();
  if (sh.getMaxRows() < baris.length + 1) sh.insertRowsAfter(sh.getMaxRows(), baris.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, baris.length, 8).setValues(baris);
  sh.getRange(2, 8, baris.length, 1).setNumberFormat('0%');
}
