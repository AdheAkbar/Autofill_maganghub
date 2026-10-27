# MagangHub AI Document & PDF Auto-Filler (Powered by 9Router)

Ekstensi Google Chrome (Manifest V3) cerdas yang dirancang khusus untuk memindai dokumen sertifikat / CV / ijazah / laporan magang dalam format PDF atau gambar, mengekstrak isi dokumen secara multimodal (teks + Vision OCR), lalu **secara otomatis mengisi formulir profil di MagangHub Kemnaker / SIAPkerja** serta **melampirkan file dokumen secara otomatis** melalui gateway AI [9Router](https://9router.com/).

---

## 🌟 Fitur Utama & Keunggulan

1. **Hybrid Document Reader (PDF.js + Multimodal Vision OCR)**:
   - Mengekstrak teks digital PDF menggunakan `pdf.js` offline.
   - Merender halaman pertama PDF menjadi gambar Base64 resolusi tinggi untuk dianalisis oleh model multimodal (seperti Gemini Flash, Claude Sonnet, atau GPT-4o di 9Router). Mampu membaca sertifikat hasil *scan*, foto ijazah, atau sertifikat berbasis desain grafis tanpa teks digital.

2. **Hierarchical DOM Context Scanner**:
   - Membaca hierarki formulir secara kontekstual untuk membedakan kolom ganda dengan nama yang sama.
   - **Mencegah tertukarnya split-fields**: Kolom `Bulan` dan `Tahun` pada **Tanggal dikeluarkan** vs **Tanggal berakhir** tidak akan tertukar karena dibaca bersamaan dengan *heading* induknya.

3. **Smart Decimal & Month Formatter**:
   - Menangani aturan spesifik MagangHub seperti *"Tambahkan , apabila desimal"* pada kolom **Nilai** (mengubah `88.50` menjadi `88,5`).
   - Mencocokkan nama bulan Bahasa Indonesia (`Januari` - `Desember`) maupun angka bulan (`1` - `12`).

4. **Smart Combobox & Dropdown Matcher**:
   - Memilih otomatis opsi pada dropdown lembaga sertifikasi (BNSP, Kemnaker, Google, Dicoding, Microsoft, dll.).
   - Mampu membuka custom combobox, mengetik kata kunci pencarian, dan mengeklik opsi terbaik.

5. **Auto File Upload Injector (`DataTransfer` API)**:
   - File PDF yang Anda unggah di panel ekstensi **otomatis disuntikkan langsung ke input upload file ("Dokumen sertifikasi")** di formulir web. Anda tidak perlu mencari dan mengunggah ulang file dari File Explorer.

6. **Human-in-the-Loop Review Mode**:
   - Kolom yang terisi ditandai dengan highlight visual:
     - 🟢 **Hijau (Yakin)**: Jika data tertera jelas di dokumen.
     - 🟠 **Kuning (Perlu Dicek)**: Jika data merupakan hasil inferensi.
   - Dilengkapi tombol **"🔍 Fokus ke Kolom"** di Side Panel untuk mengarahkan layar dan kursor langsung ke field tersebut.
   - Ekstensi **tidak menekan submit akhir secara otomatis**, memberikan Anda kendali penuh untuk memeriksa dan mengoreksi data sebelum disimpan.

---

## 📁 Struktur Direktori Ekstensi

```
extension-chrome-maganghub/
├── manifest.json              # Konfigurasi Chrome Extension Manifest V3 (Side Panel API)
├── background.js             # Service Worker: Pengatur integrasi multimodal 9Router & fallback
├── content.js                # DOM Scanner hierarkis, dropdown matcher, dan DataTransfer injector
├── content.css               # Styling highlight kolom, badge keyakinan, dan efek animasi fokus
├── sidepanel.html            # Antarmuka panel samping Chrome (Drag & drop, review, setting)
├── sidepanel.js              # Logika ekstraksi PDF/Vision, pemanggilan AI, dan antarmuka Side Panel
├── styles.css                # Desain UI modern dan responsif untuk Side Panel
├── test_form_maganghub.html  # Halaman simulasi lokal formulir MagangHub Kemnaker
├── contoh_sertifikat_bnsp.pdf# Contoh sertifikat kompetensi untuk pengujian langsung
├── icons/                    # Ikon ekstensi resolusi 16, 32, 48, dan 128 px
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── lib/                      # Pustaka PDF.js lokal (bebas dependensi eksternal / offline)
    ├── pdf.js
    ├── pdf.min.js
    ├── pdf.worker.js
    └── pdf.worker.min.js
```

---

## 🚀 Panduan Instalasi di Google Chrome

1. Buka browser **Google Chrome**.
2. Masuk ke halaman ekstensi dengan mengetikkan:
   ```
   chrome://extensions/
   ```
3. Aktifkan **Mode Pengembang (Developer mode)** di pojok kanan atas.
4. Klik tombol **Muat yang belum dibongkar (Load unpacked)** di pojok kiri atas.
5. Pilih folder:
   ```
   c:\Users\akbar\Downloads\extension chrome untuk membantu mengisi form maganghub
   ```
6. Ekstensi **"MagangHub AI Document & PDF Auto-Filler (9Router)"** akan langsung terpasang dan siap digunakan!
7. Klik ikon pin (📌) di bar ekstensi Chrome agar ikon ekstensi selalu terlihat.

---

## 🔌 Konfigurasi Otomatis 9Router

Ekstensi ini **sudah otomatis terkonfigurasi** langsung dengan 9Router yang sedang aktif di sistem Anda:
- **Endpoint URL**: `http://localhost:20128/v1/chat/completions`
- **API Key**: isi dengan Default Key dari dasbor 9Router Anda di panel pengaturan ekstensi (tidak disimpan di repositori)
- **Model**: `AdheRouter` *(Combo model multimodal aktif Anda yang mencakup Gemini & Claude dengan Vision OCR)*

> [!NOTE]
> 9Router lokal Anda memiliki sistem autentikasi bawaan (`401 Missing API key` jika tanpa key). Oleh karena itu, ekstensi ini **sudah otomatis menyertakan API Key resmi dari 9Router Anda**, sehingga Anda tidak perlu mengetikkan atau menyalin key secara manual lagi!

### Cara Memastikan Koneksi:
1. Klik ikon ekstensi di Chrome untuk membuka **Side Panel**.
2. Status di pojok kanan atas akan langsung menampilkan:
   `🟢 9Router Ready (<latensi> ms)`.
3. Anda juga dapat masuk ke tab **⚙️ Pengaturan 9Router** dan mengeklik tombol **⚡ Tes Koneksi**.

---

## 🧪 Cara Menguji Secara Langsung (Uji Coba Cepat)

Kami telah menyertakan halaman simulasi form MagangHub (`test_form_maganghub.html`) dan file sertifikat contoh (`contoh_sertifikat_bnsp.pdf`):

1. Di Google Chrome, buka tab baru dan drag-and-drop file `test_form_maganghub.html` ke Chrome (atau ketik URL file lokalnya).
2. Buka Side Panel ekstensi.
3. Tarik (*drag-and-drop*) file `contoh_sertifikat_bnsp.pdf` ke area upload dokumen di Side Panel.
4. Klik tombol **🚀 Scan Dokumen & Isi Form via 9Router**.
5. Amati proses otomatis:
   - Nama sertifikasi terisi: `Junior Web Developer`
   - Lembaga sertifikasi otomatis terpilih: `BNSP`
   - Nilai terformat dengan koma: `88,5`
   - Tanggal dikeluarkan: `Oktober` dan `2025`
   - Tanggal berakhir: Dikosongkan secara cerdas (karena berlaku seumur hidup)
   - Dokumen sertifikasi: File `contoh_sertifikat_bnsp.pdf` otomatis terlampir di input upload file.
   - Kolom di layar web akan memiliki highlight hijau dan badge status keyakinan AI.

---

## 🌐 Penggunaan pada Portal MagangHub Asli

1. Login ke portal [MagangHub Kemnaker](https://maganghub.kemnaker.go.id/) atau ekosistem [SIAPkerja Kemnaker](https://siapkerja.kemnaker.go.id/).
2. Buka halaman formulir yang ingin diisi (misal: **Tambah Sertifikasi**, **Pengalaman**, atau **Pendidikan**).
3. Buka Side Panel ekstensi di sebelah kanan layar.
4. Unggah dokumen PDF atau foto sertifikat Anda.
5. Tambahkan instruksi opsional di kolom prompt jika ada preferensi khusus (misal: *"Gunakan nama lembaga sesuai sertifikat"*).
6. Klik **🚀 Scan Dokumen & Isi Form via 9Router**.
7. Periksa kolom yang sudah terisi melalui ringkasan di Side Panel atau langsung pada formulir web.
8. Klik tombol simpan pada halaman MagangHub untuk menyelesaikan pendaftaran.
