// Util.gs
// Fungsi bantu umum. Bagian akhir file ini adalah salinan identik js/aturan.js dari frontend (jangan diubah terpisah).

function jsonKeluar_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ok_(data) { return { ok: true, data: data }; }
function gagal_(pesan, tambahan) {
  var r = { ok: false, error: String(pesan) };
  if (tambahan) for (var k in tambahan) r[k] = tambahan[k];
  return r;
}

function kosong_(v) { return v === undefined || v === null || String(v).trim() === ''; }
function teks_(v) { return kosong_(v) ? '' : String(v).trim(); }

// Nilai yang berawalan = + - @ diberi awalan spasi agar tidak dibaca sebagai rumus.
function aman_(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return tanggalIso_(v);
  var s = String(v);
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function tanggalIso_(d) { return Utilities.formatDate(d, CFG.ZONA, 'yyyy-MM-dd'); }
function waktuSekarang_() { return Utilities.formatDate(new Date(), CFG.ZONA, 'dd/MM/yyyy HH:mm'); }

// Normalkan tanggal dari Date, dd/MM/yyyy, yyyy-MM-dd, atau d/M/yyyy menjadi yyyy-MM-dd. Lainnya dikembalikan apa adanya.
function normalTanggal_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : tanggalIso_(v);
  var s = teks_(v), m;
  if (!s) return '';
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[3]));
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s))) return m[3] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[1]));
  return s;
}

function angkaAtauKosong_(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number') return v;
  var n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? teks_(v) : n;
}

// Baca sheet menjadi array objek. peta: {JudulKolom: kunci}. Kolom yang tidak ada di peta diabaikan.
function bacaObjek_(sheet, peta) {
  if (!sheet) return [];
  var nilai = sheet.getDataRange().getValues();
  if (nilai.length < 2) return [];
  var header = nilai[0].map(function (h) { return teks_(h); }), kolom = [];
  for (var c = 0; c < header.length; c++) if (peta[header[c]]) kolom.push({ c: c, k: peta[header[c]] });
  var hasil = [];
  for (var r = 1; r < nilai.length; r++) {
    var baris = nilai[r], semuaKosong = true, o = {};
    for (var i = 0; i < kolom.length; i++) {
      var v = baris[kolom[i].c];
      if (!kosong_(v)) semuaKosong = false;
      o[kolom[i].k] = v;
    }
    if (!semuaKosong) hasil.push(o);
  }
  return hasil;
}

function indeksHeader_(sheet) {
  var lebar = sheet.getLastColumn();
  if (lebar < 1) return { daftar: [], peta: {} };
  var h = sheet.getRange(1, 1, 1, lebar).getValues()[0].map(function (x) { return teks_(x); }), peta = {};
  for (var i = 0; i < h.length; i++) if (h[i] && peta[h[i]] === undefined) peta[h[i]] = i;
  return { daftar: h, peta: peta };
}

// Cache dengan gzip agar muat di batas 100 KB CacheService.
function cacheSimpan_(kunci, obj, detik) {
  try {
    var teks = JSON.stringify(obj);
    var blob = Utilities.gzip(Utilities.newBlob(teks, 'application/json'));
    var b64 = Utilities.base64Encode(blob.getBytes());
    if (b64.length > 95000) return false;
    CacheService.getScriptCache().put(kunci, b64, detik);
    return true;
  } catch (e) { console.error('cacheSimpan', e); return false; }
}
function cacheBaca_(kunci) {
  try {
    var b64 = CacheService.getScriptCache().get(kunci);
    if (!b64) return null;
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
  } catch (e) { console.error('cacheBaca', e); return null; }
}
function cacheHapus_(kunci) { try { CacheService.getScriptCache().remove(kunci); } catch (e) { /* abaikan */ } }

function md5_(teks) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, teks, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

// ===== Mulai salinan js/aturan.js (identik dengan frontend) =====
// Aturan instrumen. File ini dipakai persis sama di browser (js/aturan.js) dan di Apps Script (bagian akhir Util.gs),
// supaya hitungan butir terisi, butir wajib, syarat tampil, dan sel otomatis identik di dua sisi.
var Aturan = (function () {
  function kosong(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function nilai(jawaban, id) { var v = jawaban ? jawaban[id] : ''; return kosong(v) ? '' : String(v).trim(); }

  // Syarat tampil: "S-04=Ya", "S-01!=Tidak", beberapa syarat dipisah ";" (semua harus terpenuhi).
  function syaratTerpenuhi(syarat, jawaban) {
    if (kosong(syarat)) return true;
    var bagian = String(syarat).split(';');
    for (var i = 0; i < bagian.length; i++) {
      var s = bagian[i].trim();
      if (!s) continue;
      var m = /^([^=!]+?)\s*(!=|=)\s*(.*)$/.exec(s);
      if (!m) continue;
      var v = nilai(jawaban, m[1].trim()), target = m[3].trim();
      if (m[2] === '=' ? v !== target : v === target) return false;
    }
    return true;
  }

  // Angka rupiah atau bilangan: terima "6.481.500", "Rp 6481500", "12", "-3", "2,5". Selain itu null.
  function angka(v) {
    if (kosong(v)) return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    var s = String(v).replace(/\s|Rp\.?/gi, '').replace(/\./g, '');
    if (!/^-?\d+(,\d+)?$/.test(s)) return null;
    return Number(s.replace(',', '.'));
  }

  // Sel "jumlah:T3:Anggaran": total kolom Anggaran tabel T3. Mengubah jawaban di tempat, mengembalikan daftar ID yang dihitung.
  function hitungOtomatis(bank, jawaban) {
    var diubah = [];
    for (var i = 0; i < bank.length; i++) {
      var b = bank[i], m = /^jumlah:([^:]+):(.+)$/.exec(b.isiOtomatis || '');
      if (!m) continue;
      var total = null;
      for (var j = 0; j < bank.length; j++) {
        var c = bank[j];
        if (c.tabel === m[1] && c.kolom === m[2] && c.idButir !== b.idButir && !/^jumlah:/.test(c.isiOtomatis || '')) {
          var n = angka(jawaban[c.idButir]);
          if (n !== null) total = (total || 0) + n;
        }
      }
      jawaban[b.idButir] = total === null ? '' : String(total);
      diubah.push(b.idButir);
    }
    return diubah;
  }

  // Unit penghitungan: butir biasa, atau satu tabel (semua selnya) sebagai satu unit.
  function susunUnit(bank, tabel, instrumen) {
    var unit = [], petaTabel = {}, i;
    for (i = 0; i < (tabel || []).length; i++) petaTabel[tabel[i].id] = tabel[i];
    var urut = bank.filter(function (b) { return b.instrumen === instrumen; })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var indeksTabel = {};
    for (i = 0; i < urut.length; i++) {
      var b = urut[i];
      if (b.tabel) {
        if (indeksTabel[b.tabel] === undefined) {
          var t = petaTabel[b.tabel] || { id: b.tabel, judul: 'Tabel ' + b.tabel, susunPer: 'Baris', wajib: false, tampilJika: '' };
          indeksTabel[b.tabel] = unit.length;
          unit.push({ jenis: 'tabel', id: 'TABEL:' + b.tabel, tabel: t, bagian: b.bagian, urutan: b.urutan, sel: [], label: t.judul, wajib: !!t.wajib });
        }
        unit[indeksTabel[b.tabel]].sel.push(b);
      } else {
        unit.push({ jenis: 'butir', id: b.idButir, butir: b, bagian: b.bagian, urutan: b.urutan, label: b.label || b.teks, wajib: !!b.wajib });
      }
    }
    return unit;
  }

  function butirTampil(b, jawaban) { return syaratTerpenuhi(b.tampilJika, jawaban); }
  function tabelTampil(u, jawaban) {
    if (!syaratTerpenuhi(u.tabel.tampilJika, jawaban)) return false;
    for (var i = 0; i < u.sel.length; i++) if (butirTampil(u.sel[i], jawaban)) return true;
    return false;
  }

  // Hasil: {unit, terisi, total, kurang, tersembunyi}
  function hitung(bank, tabel, instrumen, jawaban) {
    jawaban = jawaban || {};
    var unit = susunUnit(bank, tabel, instrumen), terisi = 0, total = 0, kurang = [], tersembunyi = [];
    for (var i = 0; i < unit.length; i++) {
      var u = unit[i];
      if (u.jenis === 'butir') {
        u.tampil = butirTampil(u.butir, jawaban);
        if (!u.tampil) { tersembunyi.push(u.id); continue; }
        u.terisi = !kosong(jawaban[u.id]);
      } else {
        u.tampil = tabelTampil(u, jawaban);
        if (!u.tampil) { for (var k = 0; k < u.sel.length; k++) tersembunyi.push(u.sel[k].idButir); continue; }
        u.terisi = false;
        for (var j = 0; j < u.sel.length; j++) {
          var c = u.sel[j];
          if (!butirTampil(c, jawaban)) { tersembunyi.push(c.idButir); continue; }
          if (/^jumlah:/.test(c.isiOtomatis || '')) continue;
          if (!kosong(jawaban[c.idButir])) u.terisi = true;
        }
      }
      total++;
      if (u.terisi) terisi++;
      else if (u.wajib) kurang.push({ id: u.id, label: u.label, bagian: u.bagian });
    }
    return { unit: unit, terisi: terisi, total: total, kurang: kurang, tersembunyi: tersembunyi };
  }

  // Kosongkan jawaban butir yang tersembunyi agar tidak ikut tersimpan.
  function bersihkanTersembunyi(bank, tabel, instrumen, jawaban) {
    var h = hitung(bank, tabel, instrumen, jawaban);
    for (var i = 0; i < h.tersembunyi.length; i++) jawaban[h.tersembunyi[i]] = '';
    return h;
  }

  // Isi awal dari data lokus (hanya bila jawaban masih kosong).
  function isiAwal(bank, instrumen, lokus, jawaban) {
    for (var i = 0; i < bank.length; i++) {
      var b = bank[i];
      if (b.instrumen !== instrumen || !b.isiOtomatis || /^jumlah:/.test(b.isiOtomatis)) continue;
      if (!kosong(jawaban[b.idButir])) continue;
      var v = '';
      if (b.isiOtomatis === 'silpaAda') v = angka(lokus.silpa2025) > 0 ? 'Ya' : (lokus.jenis === 'Satdik' ? 'Tidak' : '');
      else if (b.isiOtomatis === 'silpa2025') v = angka(lokus.silpa2025) > 0 ? String(angka(lokus.silpa2025)) : '';
      else if (lokus[b.isiOtomatis] !== undefined) v = kosong(lokus[b.isiOtomatis]) ? '' : String(lokus[b.isiOtomatis]);
      if (v !== '') jawaban[b.idButir] = v;
    }
    return jawaban;
  }

  return { kosong: kosong, syaratTerpenuhi: syaratTerpenuhi, angka: angka, hitungOtomatis: hitungOtomatis,
    susunUnit: susunUnit, hitung: hitung, bersihkanTersembunyi: bersihkanTersembunyi, isiAwal: isiAwal };
})();
