var $app = document.getElementById('app');
var F = null; // state form yang sedang dibuka
var K = { draft: 'boskin_draft_', last: 'boskin_last', petugas: 'boskin_petugas' };

// ------------------------------------------------------------ router
function rute() {
  var h = location.hash.replace(/^#\/?/, '');
  var p = h.split('/');
  window.scrollTo(0, 0);
  $app.oninput = $app.onchange = $app.onclick = $app.onfocusout = null;
  navAktif(p[0] === 'progres' ? 'progres' : p[0] === 'panduan' ? 'panduan' : 'isi');
  if (p[0] === 'isi' && p[1]) return tampilForm(decodeURIComponent(p[1]));
  if (p[0] === 'selesai' && p[1]) return tampilSelesai(decodeURIComponent(p[1]));
  if (p[0] === 'progres') return tampilProgres();
  if (p[0] === 'panduan') return tampilPanduan();
  return tampilBeranda();
}
function navAktif(k) {
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    a.classList.toggle('aktif', a.getAttribute('data-nav') === k);
  });
}
function muat(teks) { $app.innerHTML = '<div class="muat"><div class="putar"></div><p>' + esc(teks || 'Memuat...') + '</p></div>'; }
function galat(pesan, ulang) {
  var perluUrl = /Alamat server belum diatur/.test(String(pesan));
  $app.innerHTML = '<div class="kartu galat-kotak"><h2>Belum bisa dimuat</h2><p>' + esc(pesan) + '</p>' +
    (perluUrl ? '<label class="lbl">Untuk koordinator: URL Web App Apps Script (sementara, hanya di perangkat ini)</label>' +
      '<input class="input" id="urlSementara" placeholder="https://script.google.com/macros/s/.../exec">' : '') +
    '<button class="btn utama" id="btnUlang">' + (perluUrl ? 'Simpan dan coba lagi' : 'Coba lagi') + '</button></div>';
  document.getElementById('btnUlang').onclick = function () {
    var inp = document.getElementById('urlSementara');
    if (inp && inp.value.trim()) { try { localStorage.setItem('boskin_base_url', inp.value.trim()); } catch (e) { /* abaikan */ } }
    ulang();
  };
}
window.addEventListener('hashchange', rute);

function lokusDari(m, id) { return m.lokus.filter(function (x) { return x.idLokus === id; })[0] || null; }
function timDari(m, idTim) { return m.tim.filter(function (t) { return t.idTim === idTim; })[0] || null; }
function labelJenis(s) { return s.jenis === 'UPT' ? 'Sesi UPT' : 'Satuan pendidikan'; }

// ------------------------------------------------------------ beranda: pilih lokus
var statusLokus = {}; // idLokus -> {status, butirTerisi, totalButir}

async function tampilBeranda() {
  muat('Memuat daftar lokus...');
  var m;
  try { m = await ambilMaster(); } catch (e) { return galat(e.message, tampilBeranda); }
  apiGetProgress().then(function (p) {
    statusLokus = {};
    p.lokus.forEach(function (s) { statusLokus[s.idLokus] = s; });
    perbaruiDaftarLokus(m);
  }).catch(function (e) { console.error('progres beranda', e); });

  var tahapList = Array.from(new Set(m.lokus.map(function (s) { return s.tahap; }))).sort();
  var last = bacaLokal(K.last) || {};
  var tahap = tahapList.indexOf(last.tahap) >= 0 ? last.tahap : tahapList[0];
  var prov = last.prov || '', kab = last.kab || '';

  function simpanPilihan() { simpanLokal(K.last, { tahap: tahap, prov: prov, kab: kab }); }
  function unik(arr) { return Array.from(new Set(arr)).sort(function (x, y) { return x.localeCompare(y); }); }

  function gambar() {
    var lokTahap = m.lokus.filter(function (s) { return s.tahap === tahap; });
    var provList = unik(lokTahap.map(function (s) { return s.provinsi; }));
    if (provList.indexOf(prov) < 0) { prov = ''; kab = ''; }
    var kabList = prov ? unik(lokTahap.filter(function (s) { return s.provinsi === prov; }).map(function (s) { return s.kabKota; })) : [];
    if (kabList.indexOf(kab) < 0) kab = '';
    $app.innerHTML =
      '<div class="kartu">' +
      '<h2>1. Pilih tahap</h2><div class="seg">' +
      tahapList.map(function (t) {
        var lt = m.lokus.filter(function (x) { return x.tahap === t; });
        var d = lt.map(function (x) { return x.tanggalMulai; }).sort();
        var e = lt.map(function (x) { return x.tanggalSelesai; }).sort();
        return '<button class="' + (t === tahap ? 'aktif' : '') + '" data-tahap="' + esc(t) + '"><b>' + esc(t) + '</b><small>' +
          esc(rentangTgl(d[0], e[e.length - 1])) + '</small></button>';
      }).join('') + '</div>' +
      '<h2>2. Pilih provinsi</h2>' +
      '<select id="selProv" class="input"><option value="">Pilih...</option>' +
      provList.map(function (x) { return '<option' + (x === prov ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<h2>3. Pilih kabupaten atau kota</h2>' +
      '<select id="selKab" class="input"' + (prov ? '' : ' disabled') + '><option value="">Pilih...</option>' +
      kabList.map(function (x) {
        var n = lokTahap.filter(function (s) { return s.provinsi === prov && s.kabKota === x; }).length;
        return '<option value="' + esc(x) + '"' + (x === kab ? ' selected' : '') + '>' + esc(x) + ' (' + n + ' lokus)</option>';
      }).join('') + '</select>' +
      '</div><div id="boxLokus"></div>' +
      '<p class="kecil tengah"><a href="#" id="muatUlangMaster">Muat ulang data lokus dan petugas</a></p>';
    document.querySelectorAll('[data-tahap]').forEach(function (b) {
      b.onclick = function () { tahap = b.getAttribute('data-tahap'); kab = ''; simpanPilihan(); gambar(); };
    });
    document.getElementById('selProv').onchange = function (e) { prov = e.target.value; kab = ''; simpanPilihan(); gambar(); };
    document.getElementById('selKab').onchange = function (e) { kab = e.target.value; simpanPilihan(); perbaruiDaftarLokus(m); };
    document.getElementById('muatUlangMaster').onclick = async function (e) {
      e.preventDefault(); muat('Memuat ulang...');
      try { await apiGet('bersihkanCache'); await ambilMaster(true); toast('Data diperbarui'); } catch (er) { toast(er.message, 'galat'); }
      tampilBeranda();
    };
    perbaruiDaftarLokus(m);
  }
  window._berandaState = function () { return { tahap: tahap, prov: prov, kab: kab }; };
  gambar();
}

function lencanaStatus(id) {
  var d = bacaLokal(K.draft + id), ss = statusLokus[id], l = '';
  if (ss && ss.status === 'selesai') l = '<span class="lencana ok">Selesai</span>';
  else if (ss && ss.status === 'draft') l = '<span class="lencana sedang">Draft ' + ss.butirTerisi + ' dari ' + ss.totalButir + '</span>';
  else if (ss) l = '<span class="lencana">Belum mulai</span>';
  if (d && (!ss || ss.status !== 'selesai')) l += ' <span class="lencana info">Ada perubahan di perangkat ini</span>';
  return l;
}

function perbaruiDaftarLokus(m) {
  var box = document.getElementById('boxLokus');
  if (!box || !window._berandaState) return;
  var st = window._berandaState();
  if (!st.kab) { box.innerHTML = ''; return; }
  var daftar = m.lokus.filter(function (s) { return s.tahap === st.tahap && s.provinsi === st.prov && s.kabKota === st.kab; });
  if (!daftar.length) { box.innerHTML = ''; return; }
  var mulai = daftar.map(function (s) { return s.tanggalMulai; }).sort()[0];
  var akhir = daftar.map(function (s) { return s.tanggalSelesai; }).sort().pop();
  box.innerHTML =
    '<div class="kartu"><h2>' + esc(st.kab) + '</h2>' +
    '<p class="kecil">' + esc(st.prov) + ' · ' + esc(st.tahap) + '<br>Pelaksanaan: ' + esc(rentangTgl(mulai, akhir)) + '</p></div>' +
    '<h2 class="judul-luar">4. Pilih lokus</h2>' +
    daftar.map(function (s) {
      var ket = s.jenis === 'UPT'
        ? '<span class="lencana upt">Sesi UPT</span> Instrumen UPT'
        : 'NPSN ' + esc(s.npsn) + ' · ' + esc(s.kategori) + (s.gugus ? ' · Gugus ' + esc(s.gugus) : '');
      return '<a class="kartu lokus" href="#/isi/' + encodeURIComponent(s.idLokus) + '"><div><b>' + esc(s.nama) + '</b>' +
        '<div class="kecil">' + ket + '</div></div><div>' + lencanaStatus(s.idLokus) + '</div></a>';
    }).join('');
}

// ------------------------------------------------------------ form: definisi langkah
function susunLangkah(bank) {
  var l = [{ id: 'hadir', judul: 'Kehadiran', bagian: '' }], ada = {};
  bank.forEach(function (b) {
    if (ada[b.bagian]) return;
    ada[b.bagian] = true;
    var m = /^([A-Z]+\d+)\.\s*(.*)$/.exec(b.bagian);
    l.push({ id: 'bag' + l.length, judul: m ? m[2] : b.bagian, kode: m ? m[1] : '', bagian: b.bagian });
  });
  l.push({ id: 'periksa', judul: 'Periksa dan kirim', bagian: '' });
  return l;
}
function hitungSekarang() { return Aturan.hitung(F.bank, F.tabel, F.jenis, F.jawaban); }
function langkahDariBagian(bagian) {
  for (var i = 0; i < F.langkah.length; i++) if (F.langkah[i].bagian === bagian) return i;
  return 0;
}
function kekurangan(hit) {
  hit = hit || hitungSekarang();
  var k = hit.kurang.map(function (x) { return { kunci: x.id, label: x.label, langkah: langkahDariBagian(x.bagian) }; });
  if (!F.tanggal) k.unshift({ kunci: 'tanggal', label: 'Tanggal pelaksanaan', langkah: 0 });
  if (!F.petugas.length) k.unshift({ kunci: 'petugas', label: 'Petugas yang hadir', langkah: 0 });
  if (!F.responden.length) k.unshift({ kunci: 'responden', label: 'Minimal satu responden', langkah: 0 });
  F.responden.forEach(function (r, i) { if (kosong(r.nama) || kosong(r.peran)) k.push({ kunci: 'responden' + i, label: 'Responden ke-' + (i + 1) + ': nama dan peran', langkah: 0 }); });
  return k;
}
function hadirLengkap() {
  return !!F.tanggal && F.petugas.length > 0 && F.responden.length > 0 && F.responden.every(function (r) { return !kosong(r.nama) && !kosong(r.peran); });
}
function langkahLengkap(i, hit) {
  var l = F.langkah[i];
  if (l.id === 'hadir') return hadirLengkap();
  if (l.id === 'periksa') return kekurangan(hit).length === 0;
  hit = hit || hitungSekarang();
  return hit.unit.every(function (u) { return u.bagian !== l.bagian || !u.tampil || !u.wajib || u.terisi; });
}

// ------------------------------------------------------------ form: muat
async function tampilForm(id) {
  muat('Membuka isian...');
  var m;
  try { m = await ambilMaster(); } catch (e) { return galat(e.message, function () { tampilForm(id); }); }
  var s = lokusDari(m, id);
  if (!s) return galat('Lokus ' + id + ' tidak ditemukan di data master.', function () { location.hash = '#/'; });

  var server = null, kabarServer = '';
  try { server = await apiGetIsian(id); } catch (e) { kabarServer = 'Data tersimpan di server tidak bisa dibaca (' + e.message + '). Yang tampil dari perangkat ini.'; }
  var lokal = bacaLokal(K.draft + id);
  var bank = m.bank.filter(function (b) { return b.instrumen === s.jenis; });
  var tim = timDari(m, s.idTim);

  F = {
    id: id, s: s, jenis: s.jenis, bank: bank, tabel: m.tabel, opsi: m.opsi, petugasMaster: m.petugas,
    timPetugas: tim ? tim.petugas.slice() : [], langkah: susunLangkah(bank),
    step: 0, status: server ? server.status : 'baru', kotor: false, adaServer: !!server, kabar: kabarServer,
    tanggal: '', petugas: [], pendampingNama: '', pendampingInstansi: '', jawaban: {}, responden: [], petugasLain: false, kunci: false, bukaGrup: {}
  };
  var sumber = null;
  if (lokal && lokal.data) { sumber = lokal.data; F.kotor = true; F.kabar = 'Isian yang belum terkirim dari perangkat ini dimuat kembali.'; }
  else if (server) sumber = server;
  if (sumber) {
    F.tanggal = sumber.tanggalPelaksanaan || '';
    F.petugas = (sumber.petugasHadir || []).slice();
    F.pendampingNama = sumber.pendampingNama || '';
    F.pendampingInstansi = sumber.pendampingInstansi || '';
    F.jawaban = Object.assign({}, sumber.jawaban || {});
    F.responden = (sumber.responden || []).map(function (r) { return { nama: r.nama, peran: r.peran, manual: !!r.manual }; });
  }
  if (!F.tanggal) F.tanggal = hariIni();
  if (!sumber && !F.petugas.length) {
    var pt = bacaLokal(K.petugas);
    if (pt && pt.length) F.petugas = pt.filter(function (n) { return F.timPetugas.indexOf(n) >= 0; });
  }
  Aturan.isiAwal(F.bank, F.jenis, s, F.jawaban);
  Aturan.hitungOtomatis(F.bank, F.jawaban);
  gambarForm();
}

// ------------------------------------------------------------ form: gambar
function htmlProfil() {
  var s = F.s;
  if (s.jenis === 'UPT') {
    return '<details class="kartu profil"' + (F.step === 0 ? ' open' : '') + '><summary>Tentang sesi ini</summary><div class="profil-isi">' +
      '<div><b>' + esc(s.nama) + '</b> · ' + esc(s.provinsi) + ' · ' + esc(s.tahap) + '</div>' +
      '<p class="kecil">Wawancara dengan BBPMP/BPMP memakai instrumen UPT: 14 pertanyaan dalam 6 bagian, ditambah angka agregat bila UPT memiliki rekapnya. Sekolah sasaran di provinsi ini: ' +
      esc(String(tandaiJumlahSatdik(s.provinsi))) + ' satuan pendidikan.</p></div></details>';
  }
  var komponen = [['Literasi Numerasi', s.anggaranLitNum, s.realisasiLitNum], ['Digitalisasi', s.anggaranDig, s.realisasiDig], ['Tata Kelola/SPMI', s.anggaranTk, s.realisasiTk]];
  var adaRkas = Aturan.angka(s.totalAnggaran) > 0;
  return '<details class="kartu profil"' + (F.step === 0 ? ' open' : '') + '><summary>Profil sekolah dari data dukung (Dapodik Oktober 2026)</summary>' +
    '<div class="profil-isi">' +
    '<div><b>' + esc(Number(s.jumlahSiswa || 0).toLocaleString('id-ID')) + '</b> siswa · ' + esc(s.kategori) + (s.gugus ? ' · Gugus <b>' + esc(s.gugus) + '</b>' : '') + '</div>' +
    '<div class="chips-profil">' +
    '<span class="lencana ' + (s.penerima2025 === 'Ya' ? 'ok' : '') + '">Penerima BOSKIN 2025: ' + esc(s.penerima2025 || '-') + '</span>' +
    '<span class="lencana ' + (Aturan.angka(s.silpa2025) > 0 ? 'sedang' : '') + '">SiLPA 2025: ' + (Aturan.angka(s.silpa2025) > 0 ? esc(rupiah(s.silpa2025)) : 'tidak ada') + '</span>' +
    '<span class="lencana ' + (/sudah/i.test(s.statusRkas) ? 'ok' : 'sedang') + '">' + esc(s.statusRkas || 'Status RKAS tidak ada') + '</span>' +
    '<span class="lencana ' + (/sudah/i.test(s.statusBku) ? 'ok' : 'sedang') + '">' + esc(s.statusBku || 'Status BKU tidak ada') + '</span>' +
    '<span class="lencana ' + (s.supervisi === 'Ya' ? 'info' : '') + '">Supervisi BOSKIN sebelumnya: ' + (s.supervisi === 'Ya' ? 'pernah mengisi' + (s.respondenSupervisi ? ' (' + esc(s.respondenSupervisi) + ')' : '') : 'belum') + '</span>' +
    '</div>' +
    (adaRkas
      ? '<table class="tabel-kecil"><thead><tr><th>Komponen</th><th>Anggaran</th><th>Realisasi</th></tr></thead><tbody>' +
        komponen.map(function (k) { return '<tr><td>' + esc(k[0]) + '</td><td>' + esc(rupiah(k[1]) || '-') + '</td><td>' + esc(rupiah(k[2]) || '-') + '</td></tr>'; }).join('') +
        '<tr class="total"><td>Total</td><td>' + esc(rupiah(s.totalAnggaran)) + '</td><td>' + esc(rupiah(s.totalRealisasi) || 'Rp 0') + '</td></tr></tbody></table>'
      : '<p class="kecil">Belum ada RKAS di data dukung, anggaran tercatat 0.</p>') +
    '<p class="kecil">Bahan pembuka obrolan dan pembanding tabel anggaran. Bukan jawaban: tabel anggaran diisi sesuai kondisi saat kunjungan.</p></div></details>';
}
function tandaiJumlahSatdik(provinsi) {
  var m = AppCache.master; if (!m) return '';
  return m.lokus.filter(function (x) { return x.jenis === 'Satdik' && x.provinsi === provinsi; }).length;
}

function gambarForm() {
  var hit = hitungSekarang();
  var l = F.langkah[F.step], n = F.langkah.length, total = hit.total, terisi = hit.terisi;
  var persen = total ? Math.round(terisi / total * 100) : 0;
  var h = '';
  h += '<div class="kepala-form"><a href="#/" class="kembali">Ganti lokus</a><div class="nama-lokus">' + esc(F.s.nama) + '</div>' +
    '<div class="kecil">' + (F.s.npsn ? 'NPSN ' + esc(F.s.npsn) + ' · ' : esc(labelJenis(F.s)) + ' · ') + esc(F.s.kabKota) + ' · ' + esc(F.s.provinsi) + ' · ' + esc(F.s.tahap) + '</div>' +
    '<div class="bar"><div style="width:' + persen + '%"></div></div>' +
    '<div class="kecil" id="infoTerisi">' + teksTerisi(hit) + '</div>' +
    '<div class="titik">' + F.langkah.map(function (x, i) {
      return '<button class="' + (i === F.step ? 'aktif ' : '') + (langkahLengkap(i, hit) && i < n - 1 ? 'lengkap ' : '') + '" data-ke="' + i + '" aria-label="' + esc(x.judul) + '" title="' + esc(x.judul) + '">' + (x.kode || (i + 1)) + '</button>';
    }).join('') + '</div></div>';
  h += htmlProfil();
  if (F.kabar) h += '<div class="info">' + esc(F.kabar) + '</div>';
  var wawancara = !!l.bagian;
  var tag = wawancara ? ' <span class="lencana info">Dari wawancara responden</span>' : '';
  h += '<div class="kartu"><div class="kecil">Langkah ' + (F.step + 1) + ' dari ' + n + tag + '</div><h2>' + (l.kode ? esc(l.kode) + '. ' : '') + esc(l.judul) + '</h2>';
  if (l.id === 'hadir') h += htmlHadir();
  else if (l.id === 'periksa') h += htmlPeriksa(hit);
  else h += htmlBagian(l, hit);
  h += '</div>';
  h += '<div class="navbawah"><button class="btn" data-aksi="mundur"' + (F.step === 0 ? ' disabled' : '') + '>Kembali</button>' +
    (F.status === 'selesai' ? '' : '<button class="btn" data-aksi="draft">Simpan sementara</button>') +
    (F.step < n - 1 ? '<button class="btn utama" data-aksi="maju">Lanjut</button>' : '') + '</div>';
  $app.innerHTML = h;
  pasangForm();
  var da = document.querySelector('.titik .aktif');
  if (da && da.scrollIntoView) da.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function teksTerisi(hit) {
  var persen = hit.total ? Math.round(hit.terisi / hit.total * 100) : 0;
  return hit.terisi + ' dari ' + hit.total + ' butir terisi (' + persen + '%)' + (F.status === 'selesai' ? ' · sudah dikirim selesai' : '');
}

function htmlHadir() {
  var h = '';
  h += '<label class="lbl">Tanggal pelaksanaan</label><input type="date" class="input" data-f="tanggal" value="' + esc(F.tanggal) + '">';
  h += '<label class="lbl">Petugas yang hadir</label>';
  var daftar = F.timPetugas.slice();
  F.petugas.forEach(function (p) { if (daftar.indexOf(p) < 0) daftar.push(p); });
  if (F.timPetugas.length) h += '<p class="kecil">Anggota tim ' + esc(F.s.idTim) + ' menurut data master. Centang yang hadir.</p>';
  h += '<div class="cek-daftar">';
  daftar.forEach(function (p) {
    h += '<label class="cek"><input type="checkbox" data-petugas="' + esc(p) + '"' + (F.petugas.indexOf(p) >= 0 ? ' checked' : '') + '><span>' + esc(p) +
      (F.timPetugas.indexOf(p) < 0 ? ' <i class="kecil">(di luar tim)</i>' : '') + '</span></label>';
  });
  h += '</div>';
  if (!F.petugas.length) h += '<p class="kosong-info">Belum ada petugas dicentang.</p>';
  var sisa = F.petugasMaster.filter(function (p) { return daftar.indexOf(p.nama) < 0; });
  h += '<select class="input" data-pilpetugas><option value="">+ Tambah petugas dari tim lain...</option>' +
    sisa.map(function (p) { return '<option value="' + esc(p.nama) + '">' + esc(p.nama) + '</option>'; }).join('') +
    '<option value="__lain">Petugas lain (ketik sendiri)</option></select>';
  if (F.petugasLain) h += '<div class="baris"><input class="input" id="petugasBaru" placeholder="Nama petugas"><button class="btn" data-aksi="tambahPetugas">Tambah</button></div>';
  h += '<label class="lbl">Pendamping dari Cabang Dinas Pendidikan</label><input class="input" data-f="pendampingNama" placeholder="Nama pendamping (kosongkan bila tidak ada)" value="' + esc(F.pendampingNama) + '">' +
    '<input class="input" data-f="pendampingInstansi" placeholder="Instansi, misalnya KCD Wilayah II" value="' + esc(F.pendampingInstansi) + '">';
  h += '<label class="lbl">Responden yang hadir</label><p class="kecil">Ketuk peran untuk menambah responden, lalu ketik namanya. Peran lain bisa ditambahkan sendiri.</p><div class="chips">';
  daftarPeran().forEach(function (o) { h += '<button class="chip" data-aksi="tambahPeran" data-peran="' + esc(o.nilai) + '">+ ' + esc(o.nilai) + '</button>'; });
  h += '<button class="chip" data-aksi="tambahLain">+ Peran lain</button></div><div id="daftarResponden">' + htmlResponden() + '</div>';
  return h;
}
function daftarPeran() { return F.opsi['Peran Responden ' + F.jenis] || F.opsi['Peran Responden'] || []; }
function htmlResponden() {
  if (!F.responden.length) return '<p class="kosong-info">Belum ada responden.</p>';
  var ops = daftarPeran().map(function (o) { return o.nilai; });
  return F.responden.map(function (r, i) {
    var baku = ops.indexOf(r.peran) >= 0;
    return '<div class="resp"><div class="resp-no">' + (i + 1) + '</div><div class="resp-isi">' +
      '<input class="input" data-r="' + i + '" data-rf="nama" placeholder="Nama responden" value="' + esc(r.nama) + '">' +
      (baku ? '<div class="peran">' + esc(r.peran) + '</div>' : '<input class="input" data-r="' + i + '" data-rf="peran" placeholder="Peran, misalnya Wakil Kepala Sekolah" value="' + esc(r.peran) + '">') +
      '</div><button class="hapus" data-aksi="hapusResp" data-i="' + i + '" aria-label="Hapus responden">Hapus</button></div>';
  }).join('');
}

// ---- butir dan tabel
function htmlBagian(l, hit) {
  var h = '', unit = hit.unit.filter(function (u) { return u.bagian === l.bagian; });
  var tampak = unit.filter(function (u) { return u.tampil; });
  if (!tampak.length) return '<p class="kosong-info">Tidak ada pertanyaan yang berlaku di bagian ini untuk lokus ini.</p>';
  unit.forEach(function (u) {
    if (!u.tampil) return;
    h += u.jenis === 'butir' ? htmlButir(u.butir) : htmlTabel(u);
  });
  return h;
}

function inputButir(b, v, kecil) {
  var id = esc(b.idButir);
  if (b.tipe === 'Pilihan') {
    var o = F.opsi[b.opsi] || [];
    return '<div class="pilih' + (kecil ? ' pilih-sebaris' : '') + '">' + o.map(function (x) {
      return '<label class="kartu-pilih' + (v === x.nilai ? ' aktif' : '') + '"><input type="radio" name="p_' + id + '" data-pil="' + id + '" value="' + esc(x.nilai) + '"' + (v === x.nilai ? ' checked' : '') + '><b>' + esc(x.nilai) + '</b>' + (x.keterangan && !kecil ? '<span>' + esc(x.keterangan) + '</span>' : '') + '</label>';
    }).join('') + '</div>';
  }
  if (b.tipe === 'Rupiah') {
    if (/^jumlah:/.test(b.isiOtomatis || '')) return '<div class="total-sel" data-total="' + id + '">' + esc(rupiah(v) || 'Rp 0') + '</div>';
    return '<div class="rp"><span>Rp</span><input class="input" inputmode="numeric" data-j="' + id + '" data-rp="1" value="' + esc(angkaRibuan(v)) + '" placeholder="0"></div>';
  }
  if (b.tipe === 'Angka') return '<input class="input" inputmode="numeric" data-j="' + id + '" value="' + esc(v) + '" placeholder="Angka">';
  if (b.tipe === 'Tanggal') return '<input type="date" class="input" data-j="' + id + '" value="' + esc(v) + '">';
  if (b.tipe === 'Teks Singkat') return '<input class="input" data-j="' + id + '" value="' + esc(v) + '" placeholder="' + (kecil ? '' : 'Jawaban singkat') + '">';
  return '<textarea class="input area" rows="' + (kecil ? 2 : 3) + '" data-j="' + id + '" placeholder="Catat jawaban responden">' + esc(v) + '</textarea>' +
    (kecil ? '' : '<button class="chip kecil-chip" data-aksi="tidakAda" data-j="' + id + '">Responden tidak punya jawaban</button>');
}
function htmlPembanding(b) {
  if (!b.pembanding || kosong(F.s[b.pembanding])) return '';
  var v = F.s[b.pembanding], teks = b.tipe === 'Rupiah' ? rupiah(v) : String(v);
  return '<div class="kecil pembanding">Dapodik Okt 2026: ' + esc(teks) + '</div>';
}
function htmlButir(b) {
  var v = kosong(F.jawaban[b.idButir]) ? '' : F.jawaban[b.idButir];
  var h = '<div class="butir" data-butir="' + esc(b.idButir) + '"><div class="butir-teks">' + esc(b.teks) + (b.wajib ? '' : ' <i>(boleh dikosongkan)</i>') + '</div>';
  if (b.pendalaman && b.pendalaman.length) h += '<div class="pendalaman"><span>Pendalaman bila jawaban belum lengkap</span><ul>' + b.pendalaman.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
  if (b.keterangan) h += '<div class="kecil bantu">' + esc(b.keterangan) + '</div>';
  h += inputButir(b, v, false) + htmlPembanding(b) + '</div>';
  return h;
}
function htmlTabel(u) {
  var t = u.tabel, perKolom = /kolom/i.test(t.susunPer), grup = [], peta = {};
  u.sel.forEach(function (c) {
    if (!Aturan.syaratTerpenuhi(c.tampilJika, F.jawaban)) return;
    var k = perKolom ? c.kolom : c.baris;
    if (!peta[k]) { peta[k] = { judul: k, sel: [] }; grup.push(peta[k]); }
    peta[k].sel.push(c);
  });
  var h = '<div class="butir tabel" data-tabel="' + esc(t.id) + '"><div class="butir-teks">' + esc(t.judul) + (u.wajib ? '' : ' <i>(boleh dikosongkan)</i>') + '</div>';
  if (t.keterangan) h += '<div class="kecil bantu">' + esc(t.keterangan) + '</div>';
  grup.forEach(function (g) {
    var semuaOtomatis = g.sel.every(function (c) { return /^jumlah:/.test(c.isiOtomatis || ''); });
    var kunciGrup = t.id + '|' + g.judul;
    var adaIsi = g.sel.some(function (c) { return !kosong(F.jawaban[c.idButir]); });
    // Baris bebas (punya sel "Kegiatan") dilipat selama kosong agar tabel panjang tetap ringkas di HP.
    var bisaLipat = !perKolom && g.sel.some(function (c) { return /^kegiatan$/i.test(c.kolom); });
    if (bisaLipat && !adaIsi && !F.bukaGrup[kunciGrup]) {
      h += '<button class="grup-lipat" data-aksi="bukaGrup" data-grup="' + esc(kunciGrup) + '">+ ' + esc(g.judul) + '</button>';
      return;
    }
    h += '<div class="grup' + (semuaOtomatis ? ' grup-total' : '') + '"><div class="grup-judul">' + esc(g.judul) + '</div>';
    g.sel.forEach(function (c) {
      var v = kosong(F.jawaban[c.idButir]) ? '' : F.jawaban[c.idButir];
      var label = perKolom ? c.baris : c.kolom;
      h += '<div class="sel' + (c.tipe === 'Rupiah' || c.tipe === 'Angka' ? ' sel-rp' : '') + '"><label class="lbl-sel">' + esc(label) + '</label>' + inputButir(c, v, true) + htmlPembanding(c) +
        (c.keterangan && !/^jumlah:/.test(c.isiOtomatis || '') ? '<div class="kecil bantu">' + esc(c.keterangan) + '</div>' : '') + '</div>';
    });
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function htmlPeriksa(hit) {
  var k = kekurangan(hit);
  var h = '<p>' + hit.terisi + ' dari ' + hit.total + ' butir terisi. Responden: ' + F.responden.length + '. Petugas hadir: ' + F.petugas.length + '.</p>';
  if (k.length) {
    h += '<div class="peringatan"><b>' + k.length + ' bagian masih perlu dilengkapi:</b><ul>' + k.map(function (x) {
      var lg = F.langkah[x.langkah];
      return '<li><a href="#" data-ke="' + x.langkah + '">' + esc(x.label) + '</a>' + (lg && lg.kode ? ' <span class="kecil">(' + esc(lg.kode) + ')</span>' : '') + '</li>';
    }).join('') + '</ul></div>';
  } else {
    h += '<div class="info ok">Semua bagian wajib sudah terisi. Periksa sekali lagi bila perlu, lalu kirim.</div>';
  }
  h += '<button class="btn utama besar" data-aksi="kirim"' + (k.length ? ' disabled' : '') + '>' + (F.status === 'selesai' ? 'Simpan perubahan' : 'Kirim sebagai selesai') + '</button>';
  if (F.status !== 'selesai') h += '<p class="kecil">Belum lengkap? Gunakan Simpan sementara. Isian bisa dilanjutkan kapan saja dari perangkat mana pun.</p>';
  h += '<p class="kecil">Laporan pelaksanaan, SPPD, dan dokumentasi tetap diunggah lewat microsite (Menu Unggah Laporan Petugas), paling lambat H+2.</p>';
  return h;
}

// ------------------------------------------------------------ form: interaksi
var simpanOtomatisLokal = debounce(function () {
  if (!F) return;
  simpanLokal(K.draft + F.id, { at: Date.now(), data: muatan('draft') });
  if (F.petugas.length) simpanLokal(K.petugas, F.petugas);
}, 400);

function tandaiKotor() {
  F.kotor = true;
  simpanOtomatisLokal();
  var hit = hitungSekarang(), p = hit.total ? Math.round(hit.terisi / hit.total * 100) : 0;
  var info = document.getElementById('infoTerisi');
  if (info) info.textContent = teksTerisi(hit);
  var bar = document.querySelector('.bar > div'); if (bar) bar.style.width = p + '%';
  document.querySelectorAll('.titik button').forEach(function (el, i) {
    el.classList.toggle('lengkap', langkahLengkap(i, hit) && i < F.langkah.length - 1);
  });
}

function segarkanTotal() {
  var diubah = Aturan.hitungOtomatis(F.bank, F.jawaban);
  diubah.forEach(function (id) {
    var el = document.querySelector('[data-total="' + id + '"]');
    if (el) el.textContent = rupiah(F.jawaban[id]) || 'Rp 0';
  });
}

function muatan(status) {
  return {
    idLokus: F.id, status: status, tanggalPelaksanaan: F.tanggal, petugasHadir: F.petugas,
    pendampingNama: F.pendampingNama, pendampingInstansi: F.pendampingInstansi,
    jawaban: F.jawaban, responden: F.responden
  };
}

function pasangForm() {
  $app.oninput = function (e) {
    var el = e.target;
    if (el.hasAttribute('data-j')) {
      var id = el.getAttribute('data-j');
      if (el.hasAttribute('data-rp')) {
        var digit = el.value.replace(/\D/g, '');
        F.jawaban[id] = digit;
        var tampil = angkaRibuan(digit);
        if (el.value !== tampil) el.value = tampil;
        segarkanTotal();
      } else if (el.getAttribute('inputmode') === 'numeric') {
        F.jawaban[id] = el.value.replace(/[^\d]/g, '');
        if (el.value !== F.jawaban[id]) el.value = F.jawaban[id];
      } else {
        F.jawaban[id] = el.value;
      }
      tandaiKotor();
    } else if (el.hasAttribute('data-f')) { F[el.getAttribute('data-f')] = el.value; tandaiKotor(); }
    else if (el.hasAttribute('data-r')) { F.responden[Number(el.getAttribute('data-r'))][el.getAttribute('data-rf')] = el.value; tandaiKotor(); }
  };
  $app.onchange = function (e) {
    var el = e.target;
    if (el.hasAttribute('data-pilpetugas')) {
      var v = el.value;
      if (v === '__lain') { F.petugasLain = true; gambarForm(); var pb = document.getElementById('petugasBaru'); if (pb) pb.focus(); }
      else if (v && F.petugas.indexOf(v) < 0) { F.petugas.push(v); tandaiKotor(); gambarForm(); }
    } else if (el.hasAttribute('data-petugas')) {
      var p = el.getAttribute('data-petugas'), i = F.petugas.indexOf(p);
      if (el.checked && i < 0) F.petugas.push(p);
      if (!el.checked && i >= 0) F.petugas.splice(i, 1);
      tandaiKotor();
      var ki = document.querySelector('.cek-daftar + .kosong-info'); if (ki) ki.remove();
    } else if (el.hasAttribute('data-pil')) {
      var id = el.getAttribute('data-pil');
      F.jawaban[id] = el.value; tandaiKotor();
      // pilihan bisa membuka atau menutup butir lain; gambar ulang langkah
      gambarForm();
      var fokus = document.querySelector('[data-butir="' + id + '"]');
      if (fokus && fokus.scrollIntoView) fokus.scrollIntoView({ block: 'nearest' });
    } else if (el.hasAttribute('data-j') && el.type === 'date') {
      F.jawaban[el.getAttribute('data-j')] = el.value; tandaiKotor();
    }
  };
  $app.onclick = async function (e) {
    var t = e.target.closest('[data-aksi],[data-ke]');
    if (!t) return;
    if (t.hasAttribute('data-ke')) { e.preventDefault(); await pindah(Number(t.getAttribute('data-ke'))); return; }
    var a = t.getAttribute('data-aksi');
    if (a === 'maju') return pindah(F.step + 1);
    if (a === 'mundur') return pindah(F.step - 1);
    if (a === 'draft') return kirim('draft', t);
    if (a === 'kirim') return kirim('selesai', t);
    if (a === 'tambahPetugas') {
      var inp = document.getElementById('petugasBaru'), nm = inp.value.trim();
      if (nm && F.petugas.indexOf(nm) < 0) { F.petugas.push(nm); F.petugasLain = false; tandaiKotor(); gambarForm(); }
      return;
    }
    if (a === 'tambahPeran') { F.responden.push({ nama: '', peran: t.getAttribute('data-peran'), manual: false }); tandaiKotor(); return segarkanResponden(true); }
    if (a === 'tambahLain') { F.responden.push({ nama: '', peran: '', manual: true }); tandaiKotor(); return segarkanResponden(true); }
    if (a === 'hapusResp') { F.responden.splice(Number(t.getAttribute('data-i')), 1); tandaiKotor(); return segarkanResponden(false); }
    if (a === 'tidakAda') {
      var id = t.getAttribute('data-j'); F.jawaban[id] = 'Responden tidak memiliki jawaban atau tidak ditanyakan.'; tandaiKotor();
      var ta = document.querySelector('textarea[data-j="' + id + '"]'); if (ta) ta.value = F.jawaban[id]; return;
    }
    if (a === 'bukaGrup') {
      var kg = t.getAttribute('data-grup'); F.bukaGrup[kg] = true; gambarForm();
      var g = Array.prototype.find.call(document.querySelectorAll('.grup-judul'), function (el) { return el.textContent === kg.split('|')[1]; });
      if (g) { g.scrollIntoView({ block: 'center' }); var inp = g.parentNode.querySelector('input,textarea'); if (inp) inp.focus(); }
      return;
    }
  };
}

function segarkanResponden(fokusTerakhir) {
  document.getElementById('daftarResponden').innerHTML = htmlResponden();
  if (fokusTerakhir) {
    var semua = document.querySelectorAll('#daftarResponden [data-rf="nama"]');
    if (semua.length) semua[semua.length - 1].focus();
  }
}

async function pindah(ke) {
  if (ke < 0 || ke >= F.langkah.length) return;
  // simpan ke server diam-diam saat pindah langkah, kecuali sudah berstatus selesai
  if (F.kotor && F.status !== 'selesai' && adaSesuatu()) {
    simpanLokal(K.draft + F.id, { at: Date.now(), data: muatan('draft') });
    apiSimpanIsian(muatan('draft')).then(function () { F.kotor = false; F.adaServer = true; F.status = 'draft'; hapusLokal(K.draft + F.id); })
      .catch(function (er) { console.error('simpan otomatis', er); toast('Belum tersimpan di server, aman di perangkat ini.', 'galat'); });
  }
  F.step = ke; F.kabar = ''; gambarForm(); window.scrollTo(0, 0);
}
function adaSesuatu() { return hitungSekarang().terisi > 0 || F.responden.length > 0 || F.petugas.length > 0; }

async function kirim(status, tombol) {
  if (F.kunci) return;
  F.kunci = true;
  var teksAwal = tombol ? tombol.textContent : '';
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Menyimpan...'; }
  try {
    var r = await apiSimpanIsian(muatan(status));
    F.kotor = false; F.adaServer = true; hapusLokal(K.draft + F.id);
    if (status === 'selesai') { F.kunci = false; location.hash = '#/selesai/' + encodeURIComponent(F.id); return; }
    F.status = 'draft';
    toast('Tersimpan: ' + r.butirTerisi + ' dari ' + r.totalButir + ' butir');
  } catch (e) {
    var kur = e.kurang ? ' (' + e.kurang.length + ' bagian)' : '';
    toast(e.message + kur, 'galat');
  }
  F.kunci = false;
  if (tombol) { tombol.disabled = false; tombol.textContent = teksAwal; }
}

// ------------------------------------------------------------ konfirmasi selesai
async function tampilSelesai(id) {
  var m = await ambilMaster().catch(function () { return null; });
  var s = m && lokusDari(m, id);
  var lain = s ? m.lokus.filter(function (x) { return x.idTim === s.idTim && x.idLokus !== id; }) : [];
  $app.innerHTML = '<div class="kartu tengah"><div class="centang">✓</div><h2>Isian terkirim</h2><p>' + esc(s ? s.nama : id) + ' sudah tercatat selesai.</p>' +
    '<p class="kecil">Laporan pelaksanaan dan dokumentasi diunggah lewat microsite, paling lambat H+2.</p>' +
    lain.map(function (x) { return '<a class="btn utama besar" href="#/isi/' + encodeURIComponent(x.idLokus) + '">Lanjut ke ' + esc(x.nama) + '</a>'; }).join('') +
    '<a class="btn besar" href="#/">Kembali ke daftar lokus</a><a class="btn besar" href="#/progres">Lihat progres</a></div>';
}

// ------------------------------------------------------------ panduan
function tampilPanduan() {
  $app.innerHTML =
    '<div class="kartu panduan"><h2>Panduan petugas</h2>' +
    '<p>Satu lokus, satu isian. Isi saat wawancara, kirim setelah bagian wajib terisi. Sekolah memakai instrumen satuan pendidikan (12 bagian), sesi BBPMP/BPMP memakai instrumen UPT (6 bagian).</p>' +
    '<ol>' +
    '<li><b>Pilih lokus.</b> Buka <a href="#/">Isi instrumen</a>. Pilih tahap, provinsi, kabupaten atau kota, lalu sekolah atau sesi UPT yang sedang dikunjungi.</li>' +
    '<li><b>Kehadiran.</b> Periksa tanggal, centang anggota tim yang hadir (petugas dari tim lain bisa ditambah lewat daftar, nama di luar daftar lewat <i>Petugas lain</i>), ketik nama dan instansi pendamping Cabang Dinas bila ada. Tambah responden dengan mengetuk perannya, lalu ketik namanya.</li>' +
    '<li><b>Bagian instrumen.</b> Satu langkah untuk satu bagian panduan wawancara. Bacakan pertanyaan utama dengan bahasa wajar; daftar pendalaman dipakai bila jawaban belum lengkap. Catat jawaban dengan kata-kata responden. Pertanyaan Ya/Tidak atau Sudah/Belum membuka pertanyaan lanjutan sesuai jawabannya.</li>' +
    '<li><b>Kartu profil sekolah</b> di atas isian berisi data dukung Dapodik Oktober 2026: jumlah siswa, gugus, status RKAS dan BKU, SiLPA 2025, anggaran dan realisasi per komponen. Pakai sebagai pembuka obrolan dan pembanding. Tabel anggaran T3 dan T4 tetap diisi sesuai kondisi saat kunjungan, angka Dapodik hanya tampil sebagai pembanding di bawah kolomnya.</li>' +
    '<li><b>Tabel.</b> Tabel bimtek diisi per jenis bimtek (literasi numerasi, digitalisasi, tata kelola/SPMI). Tabel anggaran diisi per kegiatan; total dihitung otomatis. Baris kegiatan yang tidak ada dibiarkan kosong.</li>' +
    '<li><b>Periksa dan kirim.</b> Bagian yang belum lengkap tampil sebagai daftar; ketuk untuk langsung ke sana. Bila lengkap, tekan <i>Kirim sebagai selesai</i>.</li>' +
    '<li><b>Setelah kirim.</b> Tombol lanjut ke lokus lain dari tim yang sama muncul. Laporan pelaksanaan, SPPD, dan dokumentasi tetap diunggah lewat microsite (Menu Unggah Laporan Petugas), paling lambat H+2 setelah kegiatan. Aplikasi ini hanya untuk isian instrumen dan rekap pengisian.</li>' +
    '</ol></div>' +
    '<div class="kartu panduan"><h2>Isian aman dari sinyal putus</h2><ul>' +
    '<li>Setiap ketikan tersimpan di perangkat ini. Isian juga dikirim ke server saat pindah langkah atau saat menekan <i>Simpan sementara</i>.</li>' +
    '<li>Sinyal hilang di tengah jalan: lanjut mengetik, kirim setelah sinyal kembali. Jangan hapus data browser sebelum isian terkirim.</li>' +
    '<li>Melanjutkan isian: buka lokus yang sama dari perangkat ini atau perangkat lain. Isian terakhir langsung termuat.</li>' +
    '<li>Mengubah isian yang sudah selesai: buka lagi lokusnya, ubah, lalu di langkah terakhir tekan <i>Simpan perubahan</i>.</li>' +
    '</ul></div>' +
    '<div class="kartu panduan"><h2>Bila ada kendala</h2><ul>' +
    '<li><b>Tombol Kirim tidak aktif.</b> Masih ada bagian wajib kosong. Lihat daftarnya di langkah terakhir.</li>' +
    '<li><b>Diminta kode akses.</b> Masukkan kode dari koordinator. Kode hanya ditanyakan sekali di perangkat ini.</li>' +
    '<li><b>Lokus, tim, atau petugas keliru.</b> Hubungi koordinator. Data diubah di spreadsheet master, lalu ketuk <i>Muat ulang data lokus dan petugas</i> di beranda.</li>' +
    '<li><b>Muncul pesan merah.</b> Foto layar dan kirim ke koordinator.</li>' +
    '</ul></div>' +
    '<details class="kartu panduan"><summary>Untuk koordinator</summary><ul>' +
    '<li>Lokus, tim, petugas, pilihan dropdown, tabel, dan butir pertanyaan diubah di spreadsheet <b>MonitoringBOSKIN_Data_Master</b>. Perubahan terbaca aplikasi paling lama 10 menit, atau langsung lewat tombol muat ulang di beranda.</li>' +
    '<li>Hasil isian ada di spreadsheet <b>MonitoringBOSKIN_Hasil_Isian</b>: sheet Isian Satdik, Isian UPT, Responden. Rekap Ringkas, Rekap Pengisian, dan Rekap Anggaran terhitung otomatis. Tab <a href="#/progres">Progres</a> menampilkan status yang sama.</li>' +
    '<li>Jangan mengubah atau menghapus ID butir (misalnya S-04 atau T3-R01-ANG) yang sudah ada isiannya. Butir baru cukup ditambah sebagai baris baru di Bank Soal.</li>' +
    '<li>Sebelum kegiatan dimulai, hapus baris uji lewat fungsi hapusDataUji di proyek Apps Script, atau hapus manual baris 2 ke bawah di sheet Isian dan Responden.</li>' +
    '</ul></details>';
}

// ------------------------------------------------------------ progres
async function tampilProgres() {
  muat('Memuat progres...');
  var p;
  try { p = await apiGetProgress(); } catch (e) { return galat(e.message, tampilProgres); }
  var fTahap = '', fProv = '', fJenis = '';
  function gambar() {
    var tahaps = Array.from(new Set(p.lokus.map(function (s) { return s.tahap; }))).sort();
    var provs = Array.from(new Set(p.lokus.map(function (s) { return s.provinsi; }))).sort();
    var data = p.lokus.filter(function (s) { return (!fTahap || s.tahap === fTahap) && (!fProv || s.provinsi === fProv) && (!fJenis || s.jenis === fJenis); });
    var r = { target: data.length, selesai: 0, draft: 0, belum: 0 };
    data.forEach(function (s) { r[s.status] = (r[s.status] || 0) + 1; });
    var persen = r.target ? Math.round(r.selesai / r.target * 100) : 0;
    var h = '<div class="kartu"><div class="baris">' +
      '<select id="fTahap" class="input"><option value="">Semua tahap</option>' + tahaps.map(function (t) { return '<option' + (t === fTahap ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<select id="fProv" class="input"><option value="">Semua provinsi</option>' + provs.map(function (t) { return '<option' + (t === fProv ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<select id="fJenis" class="input"><option value="">Satdik dan UPT</option><option value="Satdik"' + (fJenis === 'Satdik' ? ' selected' : '') + '>Satdik saja</option><option value="UPT"' + (fJenis === 'UPT' ? ' selected' : '') + '>UPT saja</option></select></div>' +
      '<div class="angka"><div><b>' + r.selesai + '</b><span>Selesai</span></div><div><b>' + r.draft + '</b><span>Draft</span></div><div><b>' + r.belum + '</b><span>Belum mulai</span></div><div><b>' + persen + '%</b><span>dari ' + r.target + ' lokus</span></div></div>' +
      '<div class="bar"><div style="width:' + persen + '%"></div></div><p class="kecil">Diperbarui ' + esc(p.diambil) + ' · <a href="#" id="segarkan">Segarkan</a></p></div>';
    var peta = {};
    data.forEach(function (s) { var k = s.tahap + '|' + s.provinsi + '|' + s.kabKota; (peta[k] = peta[k] || []).push(s); });
    Object.keys(peta).sort().forEach(function (k) {
      var arr = peta[k], tiga = k.split('|');
      h += '<div class="kartu"><div class="kab"><b>' + esc(tiga[2]) + '</b><span class="kecil">' + esc(tiga[1]) + ' · ' + esc(tiga[0]) + ' · Tim ' + esc(arr.map(function (x) { return x.idTim; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</span></div>';
      arr.forEach(function (s) {
        var lb = s.status === 'selesai' ? '<span class="lencana ok">Selesai</span>' : s.status === 'draft' ? '<span class="lencana sedang">Draft ' + s.butirTerisi + '/' + s.totalButir + '</span>' : '<span class="lencana">Belum mulai</span>';
        var ket = s.jenis === 'UPT' ? '<span class="lencana upt">Sesi UPT</span>' : esc(s.kategori);
        if (s.tanggal) ket += ' · ' + esc(tglIndo(s.tanggal));
        h += '<a class="baris-lok" href="#/isi/' + encodeURIComponent(s.idLokus) + '"><div>' + esc(s.nama) + '<div class="kecil">' + ket + '</div></div>' + lb + '</a>';
      });
      h += '</div>';
    });
    $app.innerHTML = h;
    document.getElementById('fTahap').onchange = function (e) { fTahap = e.target.value; gambar(); };
    document.getElementById('fProv').onchange = function (e) { fProv = e.target.value; gambar(); };
    document.getElementById('fJenis').onchange = function (e) { fJenis = e.target.value; gambar(); };
    document.getElementById('segarkan').onclick = function (e) { e.preventDefault(); tampilProgres(); };
  }
  gambar();
}

// ------------------------------------------------------------ mulai
window.addEventListener('beforeunload', function (e) {
  if (F && F.kotor && location.hash.indexOf('#/isi/') === 0) { e.preventDefault(); e.returnValue = ''; }
});
rute();
