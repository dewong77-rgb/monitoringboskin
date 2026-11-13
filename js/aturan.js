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
