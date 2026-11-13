var KUNCI_KODE = 'boskin_kode';

function kodeTersimpan() { try { return localStorage.getItem(KUNCI_KODE) || ''; } catch (e) { return ''; } }

// URL Web App diambil dari js/config.js. Bila kosong (misalnya saat uji coba sebelum deploy ulang),
// koordinator bisa menyimpan URL sementara di perangkat ini lewat halaman galat.
function urlDasar() {
  var u = (window.BOSKIN_CONFIG || {}).BASE_URL || '';
  if (!u) { try { u = localStorage.getItem('boskin_base_url') || ''; } catch (e) { /* abaikan */ } }
  if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(u)) {
    var err = new Error('Alamat server belum diatur. Isi BASE_URL di js/config.js dengan URL Web App Apps Script (berakhiran /exec).');
    err.perluUrl = true;
    throw err;
  }
  return u;
}

async function bacaJson(res) {
  var teks = await res.text();
  try { return JSON.parse(teks); } catch (e) {
    var err = new Error('Respons server bukan JSON (kemungkinan halaman error Apps Script): ' + teks.slice(0, 100).replace(/\s+/g, ' '));
    err.bukanJson = true;
    throw err;
  }
}

function tunggu(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Bila server minta kode akses, tanyakan sekali, simpan, ulangi.
async function denganKode(jalankan) {
  var json = await jalankan(kodeTersimpan());
  if (!json.ok && json.perluKode) {
    var kode = window.prompt('Masukkan kode akses dari koordinator:');
    if (kode === null) throw new Error('Kode akses dibutuhkan.');
    try { localStorage.setItem(KUNCI_KODE, kode.trim()); } catch (e) { /* abaikan */ }
    json = await jalankan(kode.trim());
    if (!json.ok && json.perluKode) {
      try { localStorage.removeItem(KUNCI_KODE); } catch (e) { /* abaikan */ }
    }
  }
  if (!json.ok) {
    var err = new Error(json.error || 'Permintaan gagal.');
    if (json.kurang) err.kurang = json.kurang;
    throw err;
  }
  return json.data;
}

async function apiGet(action, params) {
  var dasar = urlDasar();
  return denganKode(async function (kode) {
    var qs = new URLSearchParams(Object.assign({ action: action }, params || {}, kode ? { kode: kode } : {}));
    for (var i = 1; i <= 3; i++) {
      try {
        var res = await fetch(dasar + '?' + qs.toString());
        return await bacaJson(res);
      } catch (e) {
        if (e.bukanJson && i < 3) { await tunggu(1200 * i); continue; }
        if (e.bukanJson) throw e;
        throw new Error('Tidak bisa menghubungi server. Periksa sinyal, lalu coba lagi.');
      }
    }
  });
}

// POST memakai text/plain agar tidak memicu preflight CORS pada Apps Script.
async function apiPost(action, body) {
  var dasar = urlDasar();
  return denganKode(async function (kode) {
    var payload = JSON.stringify(Object.assign({ action: action }, body || {}, kode ? { kode: kode } : {}));
    for (var i = 1; i <= 3; i++) {
      try {
        var res = await fetch(dasar, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload });
        return await bacaJson(res);
      } catch (e) {
        if (e.bukanJson && i < 3) { await tunggu(1500 * i); continue; }
        if (e.bukanJson) throw new Error(e.message + ' Sudah dicoba 3 kali. Isian di layar tidak hilang, coba kirim lagi.');
        throw new Error('Tidak bisa menghubungi server. Isian tetap tersimpan di perangkat ini, coba lagi saat sinyal baik.');
      }
    }
  });
}

var AppCache = { master: null };
var TTL_MASTER = 3 * 60 * 60 * 1000;

async function ambilMaster(paksa) {
  if (!paksa && AppCache.master) return AppCache.master;
  if (!paksa) {
    var c = bacaLokal('boskin_master');
    if (c && c.at && Date.now() - c.at < TTL_MASTER && c.value && c.value.lokus && c.value.bank) {
      AppCache.master = c.value;
      return c.value;
    }
  }
  var data = await apiGet('getMaster');
  AppCache.master = data;
  simpanLokal('boskin_master', { at: Date.now(), value: data });
  return data;
}

function apiGetIsian(idLokus) { return apiGet('getIsian', { idLokus: idLokus }); }
function apiGetProgress() { return apiGet('getProgress'); }
function apiSimpanIsian(body) { return apiPost('saveIsian', body); }
