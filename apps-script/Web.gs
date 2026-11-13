// Web.gs
// Titik masuk Web App. GET untuk baca, POST (Content-Type text/plain, body JSON) untuk simpan.
// Respons selalu HTTP 200 berbentuk {ok, data | error, perluKode?, kurang?}.

function doGet(e) {
  var p = (e && e.parameter) || {};
  return jsonKeluar_(jalankan_(p.action, p, 'GET'));
}

function doPost(e) {
  var p = {};
  try {
    var isi = e && e.postData && e.postData.contents;
    p = isi ? JSON.parse(isi) : {};
  } catch (err) {
    return jsonKeluar_(gagal_('Body bukan JSON yang sah.'));
  }
  return jsonKeluar_(jalankan_(p.action, p, 'POST'));
}

function jalankan_(action, p, metode) {
  try {
    action = teks_(action);
    if (action === 'ping') return ok_({ aplikasi: CFG.NAMA_APLIKASI, waktu: waktuSekarang_() });
    var kode = kodeAkses_();
    if (kode && teks_(p.kode) !== kode) return gagal_('Kode akses diperlukan.', { perluKode: true });
    if (!idMaster_() || !idHasil_()) return gagal_('ID_MASTER atau ID_HASIL belum diatur di Script Properties.');

    switch (action) {
      case 'getMaster': return ok_(ambilMaster_(false));
      case 'bersihkanCache': cacheHapus_('master'); return ok_({ dibersihkan: true });
      case 'getIsian': return ok_(ambilIsian_(teks_(p.idLokus)));
      case 'getProgress': return ok_(ambilProgres_());
      case 'saveIsian':
        if (metode !== 'POST') return gagal_('saveIsian hanya lewat POST.');
        return simpanIsian_(p);
      default: return gagal_('Aksi tidak dikenal: ' + action);
    }
  } catch (err) {
    console.error(action, err);
    return gagal_(err && err.message ? err.message : String(err));
  }
}
