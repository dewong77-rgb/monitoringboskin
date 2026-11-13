# Monitoring BOS Kinerja Terbaik SMA 2026

Instrumen isian lapangan untuk Monitoring Implementasi BOS Kinerja Kategori Kinerja Terbaik Jenjang SMA Tahun 2026 (Direktorat SMA, Kemendikdasmen). Pola yang sama dengan aplikasi Identifikasi Kebutuhan ABPS dan verval ATS: frontend statis di Vercel, Apps Script sebagai Web App, dua spreadsheet Google Sheets sebagai basis data (Data Master dan Hasil Isian).

Repo ini tidak memuat data kegiatan (lokus, petugas, data dukung, hasil). Semua data ada di spreadsheet.

## Susunan

- `index.html`, `css/`, `js/`: frontend tanpa build. `js/config.js` berisi URL Web App.
- `js/aturan.js`: aturan instrumen (syarat tampil, hitung butir, sel otomatis). Salinan identik ada di bagian akhir `apps-script/Util.gs` agar server dan browser menghitung sama.
- `apps-script/`: tujuh file proyek Apps Script mandiri (Config, Util, Web, Master, Isian, Progres, Setup). Disalin manual ke script.google.com.
- `vercel.json`: header keamanan dan clean URL.

## Arsitektur

1. Data Master (spreadsheet, diubah tim): Petunjuk, Lokus, Tim, Petugas, Opsi, Tabel, Bank Soal.
2. Hasil Isian (spreadsheet, diisi aplikasi): Rekap Ringkas, Rekap Pengisian, Rekap Anggaran, Isian Satdik, Isian UPT, Responden, Acuan Lokus, Acuan Instrumen.
3. Apps Script Web App (Execute as Me, Access Anyone). GET untuk baca, POST `text/plain` berisi JSON untuk simpan. Respons selalu `{ok, data | error, perluKode?, kurang?}`.
4. Frontend: beranda pilih tahap, provinsi, kabupaten atau kota, lokus; wizard per bagian instrumen; draft tersimpan di perangkat dan di server; tab Progres dan Panduan.

## Kontrak API

| Aksi | Metode | Parameter | Hasil |
| --- | --- | --- | --- |
| `ping` | GET | | `{aplikasi, waktu}` |
| `getMaster` | GET | | `{lokus, tim, petugas, opsi, tabel, bank}` |
| `bersihkanCache` | GET | | `{dibersihkan}` |
| `getIsian` | GET | `idLokus` | isian tersimpan atau `null` |
| `getProgress` | GET | | `{lokus[], ringkas, diambil}` |
| `saveIsian` | POST | `{idLokus, status, tanggalPelaksanaan, petugasHadir, pendampingNama, pendampingInstansi, jawaban, responden}` | `{kodeReferensi, status, butirTerisi, totalButir}` |

Kunci isian: `BOSKIN-<ID Lokus>` (NPSN untuk sekolah, kode UPT untuk BB/BPMP). Satu lokus satu baris (upsert).

## Bank Soal

Satu baris per butir. Sel tabel juga satu baris per sel dengan kolom Tabel, Baris, Kolom terisi, sehingga satu kolom per sel di Hasil Isian. Kolom penting: `Tipe Jawaban` (Teks Panjang, Teks Singkat, Angka, Rupiah, Tanggal, Pilihan), `Tampil Jika` (`ID=Nilai` atau `ID!=Nilai`), `Isi Otomatis` (`silpaAda`, `silpa2025`, `jumlah:T3:Anggaran`), `Pembanding` (nama kolom data dukung yang ditampilkan di bawah sel).

## Pemasangan

Lihat komentar di awal `apps-script/Setup.gs`. Setelah Web App di-deploy, isi `BASE_URL` di `js/config.js` lalu push.
