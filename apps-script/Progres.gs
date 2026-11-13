// Progres.gs
// Rekap status pengisian per lokus untuk tab Progres di aplikasi.

function ambilProgres_() {
  var m = ambilMaster_(false), ss = bukaHasil_();
  var peta = {};
  for (var jenis in CFG.SHEET.ISIAN) {
    var sh = ss.getSheetByName(CFG.SHEET.ISIAN[jenis]);
    if (!sh || sh.getLastRow() < 2) continue;
    var h = indeksHeader_(sh);
    var kA = h.peta['Kode Referensi'], kS = h.peta['Status'], kT = h.peta['Butir Terisi'], kN = h.peta['Total Butir'],
      kTg = h.peta['Tanggal Pelaksanaan'], kU = h.peta['Diperbarui'], kP = h.peta['Petugas Hadir'];
    var lebar = Math.max(kA, kS, kT, kN, kTg, kU, kP) + 1;
    var nilai = sh.getRange(2, 1, sh.getLastRow() - 1, lebar).getValues();
    for (var i = 0; i < nilai.length; i++) {
      var kode = teks_(nilai[i][kA]);
      if (!kode) continue;
      peta[kode] = {
        status: teks_(nilai[i][kS]).toLowerCase() === 'selesai' ? 'selesai' : 'draft',
        butirTerisi: Number(nilai[i][kT]) || 0, totalButir: Number(nilai[i][kN]) || 0,
        tanggal: normalTanggal_(nilai[i][kTg]), diperbarui: teks_(nilai[i][kU]), petugas: teks_(nilai[i][kP])
      };
    }
  }
  var lokus = m.lokus.map(function (l) {
    var s = peta[kodeRef_(l.idLokus)] || { status: 'belum', butirTerisi: 0, totalButir: 0, tanggal: '', diperbarui: '', petugas: '' };
    return {
      kode: l.kode, jenis: l.jenis, tahap: l.tahap, idTim: l.idTim, provinsi: l.provinsi, kabKota: l.kabKota,
      idLokus: l.idLokus, npsn: l.npsn, nama: l.nama, kategori: l.kategori,
      status: s.status, butirTerisi: s.butirTerisi, totalButir: s.totalButir, tanggal: s.tanggal, diperbarui: s.diperbarui, petugas: s.petugas
    };
  });
  var r = { target: lokus.length, selesai: 0, draft: 0, belum: 0 };
  lokus.forEach(function (l) { r[l.status]++; });
  return { lokus: lokus, ringkas: r, diambil: waktuSekarang_() };
}
