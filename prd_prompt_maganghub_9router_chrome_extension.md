# PRD & Master Prompt: MagangHub AI PDF-to-Form Auto-Filler Chrome Extension (Terintegrasi 9Router)

Dokumen ini berisi **Product Requirements Document (PRD)** dan **Master Prompt siap pakai** untuk membangun ekstensi Chrome cerdas yang dapat menerima **file PDF atau Gambar (Sertifikat, CV, Ijazah, Transkrip, atau Dokumen Magang)** beserta **instruksi prompt**, memindai isi dokumen sekaligus struktur formulir [MagangHub Kemnaker](https://maganghub.kemnaker.go.id/) / ekosistem SIAPkerja melalui [9Router AI Gateway](https://9router.com/), lalu **mengisi seluruh kolom input, dropdown, tanggal, hingga meng-upload file PDF tersebut secara otomatis** ke dalam form sehingga Anda tinggal memeriksa dan mengoreksi hasilnya.

## Bagian 1: Product Requirements Document (PRD)

### 1. Latar Belakang & Tujuan Produk
Saat melengkapi profil, administrasi, maupun laporan di [MagangHub Kemnaker](https://maganghub.kemnaker.go.id/) ([Panduan Pendaftaran & Administrasi MagangHub](https://janalokajournal.id/jadwal-maganghub-batch-3-tahun-2026/)), peserta harus mengisi banyak formulir berulang—mulai dari **Form Sertifikasi**, **Riwayat Pendidikan**, **Pengalaman Kerja**, hingga **Laporan Aktivitas**.

Berdasarkan struktur nyata **Form Sertifikasi MagangHub/SIAPkerja**, terdapat tantangan teknis spesifik yang harus ditangani secara otomatis oleh ekstensi:
1. **Kombinasi Input Beragam & Split Fields**:
   - **Lembaga sertifikasi**: Berupa *Dropdown / Searchable Combobox* (`Pilih lembaga sertifikasi`).
   - **Nilai**: Input teks dengan aturan format spesifik pada *helper text* (`Tambahkan , apabila desimal` — wajib memakai koma `,`, bukan titik `.`).
   - **Tanggal dikeluarkan & Tanggal berakhir**: Masing-masing terbagi menjadi **2 kolom terpisah (*Split Fields*)**, yaitu *Dropdown* `Bulan` dan *Input* `Tahun` yang memiliki label identik sehingga rawan tertukar jika tidak dibaca beserta *heading* induknya.
   - **Dokumen sertifikasi**: Area *Drag-and-Drop / File Upload* (`Format jpg, jpeg, png, pdf • ukuran maks 5MB`).
2. **Format PDF Sertifikat yang Beragam**:
   - Sertifikat PDF bisa berupa teks digital maupun hasil *scan*/desain grafis yang tidak memiliki *selectable text*.
   - Oleh karena itu, ekstensi harus memadukan ekstraksi teks **PDF.js** dengan **Render Halaman ke Base64 Image (Vision OCR)** yang dikirimkan ke model *multimodal* di [9Router](https://github.com/decolua/9router).

### 2. Alur Kerja Utama (End-to-End User Flow)

```
[Pengguna Drop File PDF Sertifikat + Ketik Prompt Opsional di Panel Ekstensi]
       │
       ├──► (A. PDF Parser & Vision Renderer)
       │    Mengekstrak teks PDF via PDF.js + Merender halaman 1 PDF menjadi PNG Base64
       │    (agar sertifikat hasil scan/gambar tetap terbaca sempurna oleh AI Vision)
       │
       ├──► (B. Deep Contextual DOM Scanner di Halaman MagangHub)
       │    Memindai setiap field beserta:
       │    • Group Heading ("Tanggal dikeluarkan" vs "Tanggal berakhir")
       │    • Label, Placeholder ("Tambahkan , apabila desimal"), & Helper Text ("ⓘ ...")
       │    • Daftar opsi pada <select> / Custom Dropdown ("Pilih lembaga sertifikasi", "Bulan")
       │    • Elemen <input type="file"> ("Dokumen sertifikasi")
       │
       ▼
[Background Service Worker (background.js)]
       │
       ▼ (HTTP POST ke http://localhost:20128/v1/chat/completions)
[9Router AI Gateway (OpenAI-Compatible Multimodal / Chat Endpoint)]
       │ • Membaca teks/gambar PDF Sertifikat + Instruksi Prompt Pengguna
       │ • Mencocokkan data sertifikat ke setiap ID field DOM & memilih opsi dropdown paling pas
       │ • Memformat nilai desimal dengan koma (,) dan memisahkan Bulan & Tahun terbit/berakhir
       ▼
[Smart DOM Injector & Auto-File Attacher (content.js)]
       │ • Mengisi semua field teks & memilih opsi dropdown secara reaktif (React/Vue compatible)
       │ • Otomatis melampirkan file PDF yang tadi di-drop ke kolom "Dokumen sertifikasi" (Upload)
       │ • Memberi highlight warna (Hijau = Yakin, Kuning = Perlu Dicek) untuk dikoreksi pengguna
```

### 3. Spesifikasi Fitur Inti Ekstensi

| Modul Fitur | Cara Kerja Teknis | Nilai Tambah bagi Pengguna |
| :--- | :--- | :--- |
| **Hybrid PDF Reader (Text + Vision OCR)** | Mengekstrak teks menggunakan `pdf.js` sekaligus merender halaman PDF ke `<canvas>` (Base64 PNG) untuk dikirim ke *endpoint* [9Router](https://www.hostinger.com/in/applications/9router) | Mampu membaca sertifikat digital maupun sertifikat *scan*/gambar (BNSP, TOEFL, Coursera, Dicoding, Kampus) tanpa gagal |
| **Hierarchical DOM Context Scanner** | Membaca struktur DOM secara hierarkis: menggabungkan *Section Title* (`Tanggal dikeluarkan`), *Placeholder* (`Bulan`, `Tahun`), dan *Helper Text* (`ⓘ ...`) | Mencegah AI salah mengisi kolom `Bulan` dan `Tahun` yang muncul dua kali (untuk Tanggal Dikeluarkan vs Tanggal Berakhir) |
| **Smart Dropdown & Combobox Matcher** | Membaca opsi `<select>` atau memicu pembukaan *custom dropdown* (`Pilih lembaga sertifikasi` & `Bulan`) lalu memilih opsi yang paling mendekati | Mengisi otomatis pilihan Lembaga Sertifikasi dan Bulan tanpa perlu *scroll* manual satu per satu |
| **Auto File Upload Injector (`DataTransfer`)** | Menyuntikkan objek `File` PDF yang sudah diunggah di ekstensi langsung ke `<input type="file">` pada bagian **Dokumen sertifikasi** | Menghemat waktu karena file PDF tidak perlu di-upload dua kali (cukup *drop* sekali di ekstensi, otomatis masuk ke form MagangHub) |
| **Human-in-the-Loop Review Mode** | Menambahkan *badge* status dan *outline* visual pada setiap *field* yang diisi otomatis tanpa langsung menekan tombol *Submit* akhir | Memudahkan Anda memeriksa dan mengoreksi langsung jika ada ejaan lembaga, skor, atau masa berlaku yang ingin diubah |

## Bagian 2: Master Prompt untuk AI Coding Assistant

Salin seluruh blok di bawah ini dan tempelkan ke AI Coding Assistant Anda (Cursor, Claude Code, Cline, atau Windsurf) untuk membuat seluruh kode ekstensi Chrome yang siap dimuat ke `chrome://extensions` (**Load unpacked**).

```markdown
# ROLE & OBJECTIVE
Kamu adalah Principal Chrome Extension Engineer (Manifest V3) dan AI Automation Architect.
Tugasmu adalah membuat kode sumber lengkap, modular, dan siap pakai (production-ready) untuk Chrome Extension bernama **"MagangHub AI Document & PDF Auto-Filler (Powered by 9Router)"**.

Cara kerja utama ekstensi ini:
1. Pengguna membuka halaman form di ekosistem MagangHub / SIAPkerja Kemnaker (`maganghub.kemnaker.go.id`, `monev.maganghub.kemnaker.go.id`, `siapkerja.kemnaker.go.id`, atau halaman form web lainnya).
2. Di dalam Side Panel / Popup ekstensi, pengguna mengunggah file **PDF atau Gambar** (misalnya: Sertifikat Kompetensi, CV, Ijazah, Transkrip Nilai, atau Dokumen Laporan) dan dapat menambahkan **Prompt Instruksi Opsional** (contoh: *"Isi form sertifikasi ini, jika tidak ada tanggal berakhir kosongkan saja"*).
3. Ekstensi mengekstrak isi PDF (baik teks maupun gambar halaman via Canvas Base64 untuk Vision OCR), memindai seluruh field form yang sedang tampil di halaman web secara cerdas, lalu mengirimkannya ke **9Router AI Gateway** (`http://localhost:20128/v1/chat/completions`).
4. 9Router menganalisis dokumen dan mengembalikan pemetaan JSON presisi untuk setiap field.
5. Ekstensi otomatis mengisikan nilai ke semua input teks, memilih opsi pada dropdown/combobox, memformat angka sesuai petunjuk form, serta **otomatis melampirkan file PDF tersebut ke kolom Upload File ("Dokumen sertifikasi")** di halaman web.
6. Ekstensi menandai (highlight) field yang telah terisi agar pengguna tinggal meninjau dan mengoreksi jika ada yang kurang tepat.

---

# STUDI KASUS ACUAN UTAMA: FORM SERTIFIKASI MAGANGHUB / SIAPKERJA
Pastikan DOM Scanner dan Injector menangani struktur spesifik berikut dengan sempurna:
1. **Nama / Judul Sertifikasi & Bidang** (Input teks / combobox di bagian atas form).
2. **Lembaga sertifikasi**:
   - Elemen: Dropdown / Custom Combobox dengan placeholder `"Pilih lembaga sertifikasi"`.
   - Helper text: `"Sebutkan lembaga yang menerbitkan sertifikasi ini untuk memperjelas kredibilitasnya."`
   - Perilaku: Ekstensi harus bisa memilih opsi yang cocok atau mengetikkan nama lembaga ke dalam searchable dropdown.
3. **Nilai**:
   - Elemen: Input teks dengan placeholder `"Tambahkan , apabila desimal"`.
   - Helper text: `"Masukkan nilai atau skor yang kamu peroleh dari sertifikasi ini, jika tersedia."`
   - Perilaku: Jika di PDF tertera skor/nilai desimal (misal `88.50` atau `3.75`), AI WAJIB mengubah titik menjadi koma (`88,5` atau `3,75`) sesuai instruksi placeholder. Jika di sertifikat tidak ada nilai/skor, biarkan kosong.
4. **Tanggal dikeluarkan** (Split Field - Grup 1):
   - Terdiri dari 2 elemen berdampingan di bawah label `"Tanggal dikeluarkan"`:
     a. Dropdown `"Bulan"` (Januari s/d Desember atau 1 s/d 12).
     b. Input teks `"Tahun"` (4 digit, misal `2025`).
   - Helper text: `"Tanggal ini menunjukkan kapan sertifikasi resmi diterbitkan."`
5. **Tanggal berakhir** (Split Field - Grup 2):
   - Terdiri dari 2 elemen berdampingan di bawah label `"Tanggal berakhir"`:
     a. Dropdown `"Bulan"`.
     b. Input teks `"Tahun"`.
   - Helper text: `"Isi jika sertifikasi memiliki masa berlaku."`
   - Perilaku: Karena `"Tanggal dikeluarkan"` dan `"Tanggal berakhir"` sama-sama memiliki sub-field ber-placeholder `"Bulan"` dan `"Tahun"`, DOM Scanner WAJIB menyertakan `groupLabel` / `sectionHeading` terdekat di atasnya agar AI tidak tertukar!
6. **Dokumen sertifikasi**:
   - Elemen: Dropzone / `<input type="file" accept=".jpg,.jpeg,.png,.pdf">` dengan teks `"Klik untuk meng-upload file kesini"` dan tombol `"Upload"` (ukuran maks 5MB).
   - Perilaku: Ekstensi WAJIB menyuntikkan file PDF/gambar yang diunggah pengguna di ekstensi langsung ke elemen `<input type="file">` ini menggunakan `DataTransfer` API sehingga dokumen langsung terlampir otomatis di form!

---

# SPESIFIKASI TEKNIS & STRUKTUR FILE (MANIFEST V3)

Buat seluruh file berikut secara lengkap tanpa potongan kode (`// TODO` dilarang):

### 1. `manifest.json`
- `"manifest_version": 3`
- Permissions: `["activeTab", "scripting", "storage", "sidePanel"]`
- Host Permissions:
  - `"https://*.kemnaker.go.id/*"`
  - `"http://localhost:20128/*"`
  - `"http://127.0.0.1:20128/*"`
  - `"<all_urls>"`
- Gunakan `side_panel` (`sidepanel.html`) sebagai antarmuka utama (karena Side Panel TIDAK akan tertutup saat pengguna mengeklik file dialog ketika memilih PDF atau saat memeriksa form di sebelah kiri!), serta atur `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` di `background.js`.

### 2. `sidepanel.html`, `sidepanel.js`, dan `styles.css`
- **Fitur Upload PDF / Gambar & Ekstraksi Multi-Layer**:
  - Area Drag & Drop file yang mendukung `.pdf`, `.png`, `.jpg`, `.jpeg` (maks 5MB).
  - Untuk membaca PDF di browser:
    - Sediakan parser teks & renderer PDF berbasis `pdf.js` (gunakan CDN resmi yang diizinkan atau modul lokal `lib/pdf.min.mjs`, ATAU sediakan ekstraktor PDF built-in + dukungan konversi gambar halaman pertama ke Base64 Data URL agar dapat dikirim sebagai input multimodal `image_url` ke 9Router).
    - Sertakan toggle: **"Gunakan Vision Mode (Kirim Gambar Dokumen ke 9Router untuk Sertifikat Scan/Visual)"** (aktif secara default).
  - Textarea **"Prompt / Instruksi Tambahan (Opsional)"**:
    - Contoh placeholder: *"Ambil data dari sertifikat ini. Kalau tidak ada masa berlaku, bagian Tanggal Berakhir dikosongkan saja."*
  - Checkbox **"Otomatis lampirkan file ini ke kolom Upload Dokumen di form"** (aktif secara default).
  - Tombol Utama: **"🚀 Scan Dokumen & Isi Form via 9Router"**.
- **Panel Hasil & Mode Koreksi (Review Card)**:
  - Setelah proses selesai, tampilkan tabel/daftar ringkas di Side Panel berisi:
    - Nama Kolom Form -> Nilai yang Diisikan -> Status Keyakinan (`Tinggi` / `Perlu Dicek`) -> Tombol `"Fokus ke Kolom"` (ketika diklik, halaman web akan scroll dan memfokuskan kursor ke field tersebut agar mudah dikoreksi pengguna).
- **Tab Konfigurasi 9Router**:
  - Endpoint URL (default: `http://localhost:20128/v1/chat/completions` sesuai standar OpenAI-compatible 9Router).
  - API Key (opsional).
  - Nama Model / Combo 9Router (default: `auto` atau model multimodal seperti `gemini-2.5-flash` / `claude-3-5-sonnet` / `gpt-4o`).
  - Tombol **"Tes Koneksi 9Router"**.

### 3. `content.js` (Hierarchical DOM Scanner, Custom Dropdown Handler & File Attacher)
- **Fungsi `scanPageForms()`**:
  - Memindai semua elemen input interaktif: `<input>`, `<textarea>`, `<select>`, custom combobox (`[role="combobox"]`, `[role="listbox"]`, `.multiselect`, `.v-select`, `.el-select`, `.react-select`, atau `div` yang memiliki placeholder `"Pilih..."` / `"Bulan"`), serta `<input type="file">`.
  - **Ekstraksi Konteks Hierarkis (Sangat Penting)**:
    Untuk setiap field, kumpulkan:
    - `fieldId`: ID unik yang disematkan ke atribut `data-mh-id`.
    - `groupLabel`: Teks judul/label grup terdekat di atas baris/container input (contoh: `"Tanggal dikeluarkan"`, `"Tanggal berakhir"`, `"Lembaga sertifikasi"`, `"Nilai"`).
    - `fieldLabel`: Label langsung atau placeholder (contoh: `"Bulan"`, `"Tahun"`, `"Tambahkan , apabila desimal"`).
    - `helperText`: Teks petunjuk di bawah input (contoh: `"ⓘ Masukkan nilai atau skor..."`, `"ⓘ Isi jika sertifikasi memiliki masa berlaku."`).
    - `fieldType`: `"text"`, `"number"`, `"textarea"`, `"select"`, `"custom-dropdown"`, atau `"file"`.
    - `options`: Jika berupa `<select>` atau custom dropdown yang opsinya sudah ada di DOM, ambil daftar teks opsinya (maksimal 50 opsi relevan) agar 9Router memilih teks opsi yang persis tersedia.
- **Fungsi `applyFormValues(mappedFields, uploadedFileData)`**:
  - **Untuk Input Teks & Textarea**:
    - Gunakan native value setter (`Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set`) lalu dispatch `focus`, `input`, `change`, dan `blur` dengan `{ bubbles: true }` agar state React/Vue/Next.js di MagangHub langsung ter-update.
  - **Untuk Standard `<select>` & Custom Dropdown (seperti `Pilih lembaga sertifikasi` & `Bulan`)**:
    - Jika `<select>`, cocokkan `value` atau teks `<option>` (case-insensitive, mendukung pencocokan nama bulan Indonesia `"Januari"`–`"Desember"` maupun angka `"1"`–`"12"`), set nilainya, dan dispatch `change`.
    - Jika berupa Custom Dropdown (Vue/React/Tailwind UI), buat helper otomatis yang:
      1. Mengeklik elemen trigger dropdown untuk membuka daftar opsi.
      2. Jika ada input pencarian di dalam dropdown, mengetikkan nilai yang dicari lalu menunggu 150ms.
      3. Mencari elemen opsi di dalam pop-up/listbox yang teksnya paling cocok (fuzzy/substring match) lalu mengekliknya secara otomatis.
  - **Untuk Kolom Upload (`Dokumen sertifikasi` / `<input type="file">`)**:
    - Jika `uploadedFileData` (base64, nama file, mimeType) dikirim dari Side Panel:
      1. Konversi kembali Base64 menjadi objek `Blob` dan `new File([blob], fileName, { type: mimeType })`.
      2. Gunakan `const dataTransfer = new DataTransfer(); dataTransfer.items.add(file);`
      3. Set `fileInput.files = dataTransfer.files;` lalu picu `fileInput.dispatchEvent(new Event('change', { bubbles: true }))` dan `new Event('input', { bubbles: true })`.
      4. Jika halaman menggunakan dropzone kustom tanpa `<input type="file">` langsung, picu juga `DragEvent('drop', { bubbles: true, dataTransfer })` pada area dropzone `"Klik untuk meng-upload file kesini"`.
  - **Visual Feedback untuk Koreksi Pengguna**:
    - Beri border lembut pada field yang diisi: hijau (`#10b981`) jika `confidence === "high"`, atau kuning-oranye (`#f59e0b`) jika `confidence === "review_needed"`, lengkap dengan floating badge kecil di pojok field yang menampilkan nilai dan bisa diklik untuk mengedit.
    - JANGAN menekan tombol submit form utama secara otomatis; biarkan pengguna memeriksa dan mengoreksi hasilnya terlebih dahulu.

### 4. `background.js` (9Router Multimodal & Structured JSON Orchestrator)
- Menerima payload dari `sidepanel.js` yang berisi:
  - `extractedPdfText` (teks dari PDF)
  - `documentImageBase64` (data URL gambar halaman PDF / gambar sertifikat)
  - `userPrompt` (instruksi tambahan dari pengguna)
  - `domFields` (array struktur field hasil scan dari `content.js`)
- Menyusun request `POST` ke `http://localhost:20128/v1/chat/completions` dengan System Prompt khusus yang memerintahkan AI untuk:
  1. Membaca seluruh informasi pada sertifikat/dokumen (Nama Sertifikat, Lembaga Penerbit, Nomor Kredensial, Nilai/Skor, Tanggal Diterbitkan, Tanggal Berakhir).
  2. Mematuhi instruksi `userPrompt` dari pengguna.
  3. Memperhatikan `groupLabel`, `fieldLabel`, dan `helperText` pada setiap item `domFields`:
     - Membedakan dengan tegas antara `Bulan`/`Tahun` milik `"Tanggal dikeluarkan"` dan `Bulan`/`Tahun` milik `"Tanggal berakhir"`.
     - Jika sertifikat tidak memiliki masa berlaku (seumur hidup / tidak tertulis tanggal kedaluwarsa), biarkan field di bawah `"Tanggal berakhir"` bernilai string kosong `""`.
     - Jika `fieldLabel` atau `helperText` meminta format khusus (seperti `"Tambahkan , apabila desimal"` pada kolom `"Nilai"`), format angka desimal menggunakan koma `,` (misal `"92,5"`).
  4. Mengembalikan JSON murni dengan skema:
     ```json
     {
       "documentSummary": {
         "title": "...",
         "issuer": "...",
         "score": "...",
         "issueDate": "...",
         "expiryDate": "..."
       },
       "filledFields": [
         {
           "fieldId": "mh_field_1",
           "groupLabel": "Tanggal dikeluarkan",
           "fieldLabel": "Bulan",
           "value": "Oktober",
           "confidence": "high",
           "note": "Diambil dari tanggal terbit 15 Oktober 2025"
         }
       ]
     }
     ```
- Sertakan fallback otomatis: jika model yang aktif di 9Router tidak mendukung input gambar (`image_url`), otomatis ulangi request hanya dengan `extractedPdfText`.

---

# OUTPUT YANG DIHARAPKAN
1. Tampilkan pohon direktori (folder structure) ekstensi.
2. Tulis kode lengkap untuk setiap file (`manifest.json`, `background.js`, `content.js`, `content.css`, `sidepanel.html`, `sidepanel.js`, `styles.css`).
3. Jelaskan langkah instalasi singkat (`chrome://extensions` -> Developer Mode -> Load Unpacked) dan cara menghubungkannya ke 9Router.
```

## Bagian 3: System Prompt Internal untuk 9Router (Khusus Ekstraksi PDF Sertifikat ke Form)

Berikut adalah logika *System Prompt* yang digunakan oleh ekstensi saat berbicara dengan [9Router](https://9router.com/) agar AI dapat berpikir dan memetakan PDF Sertifikat ke form seperti pada tangkapan layar Anda:

```text
Anda adalah AI Document-to-Form Mapper tingkat lanjut yang bertugas membaca dokumen (Sertifikat, CV, Transkrip, atau Laporan) dan mengisi formulir web MagangHub / SIAPkerja Kemnaker secara presisi.

INPUT YANG ANDA TERIMA:
1. Teks dan/atau Gambar visual dari dokumen PDF/Image yang diunggah pengguna.
2. Instruksi tambahan dari pengguna (User Prompt).
3. Daftar struktur field formulir (`domFields`) dari halaman web aktif, masing-masing dilengkapi `fieldId`, `groupLabel` (judul bagian induk), `fieldLabel` (label/placeholder input), `helperText` (petunjuk di bawah input), `fieldType`, dan `options` (daftar pilihan dropdown jika ada).

ATURAN PEMETAAN KRUSIAL:
1. PERHATIKAN GROUP LABEL (JANGAN TERTUKAR ANTAR TANGGAL):
   - Formulir sering memiliki dua bagian tanggal dengan sub-input yang sama-sama bernama "Bulan" dan "Tahun", misalnya:
     * Group "Tanggal dikeluarkan" -> terdiri dari sub-field "Bulan" dan "Tahun".
     * Group "Tanggal berakhir" -> terdiri dari sub-field "Bulan" dan "Tahun".
   - Pastikan tanggal terbit sertifikat masuk ke `fieldId` yang memiliki `groupLabel: "Tanggal dikeluarkan"`, dan masa berlaku/kedaluwarsa masuk ke `groupLabel: "Tanggal berakhir"`.
   - Jika di dalam sertifikat TIDAK tertulis tanggal kedaluwarsa/berakhir, WAJIB isi `"value": ""` (kosongkan) untuk "Bulan" dan "Tahun" pada grup "Tanggal berakhir".

2. PATUHI ATURAN FORMAT PADA PLACEHOLDER & HELPER TEXT:
   - Pada kolom "Nilai", placeholder berbunyi "Tambahkan , apabila desimal". Jika terdapat skor/nilai desimal pada sertifikat (contoh: 87.5 atau 3.85), ubah titik menjadi koma (contoh: "87,5" atau "3,85"). Jika tidak ada nilai/skor pada sertifikat, isi dengan `""`.
   - Pada kolom "Bulan", gunakan format nama bulan Bahasa Indonesia ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember") atau sesuaikan persis dengan daftar `options` yang tersedia pada field tersebut.

3. PENCOCOKAN DROPDOWN LEMBAGA SERTIFIKASI:
   - Untuk kolom "Lembaga sertifikasi", identifikasi nama instansi/organisasi penerbit sertifikat dari dokumen (misal: BNSP, Kementerian Ketenagakerjaan, Google, Coursera, Dicoding, Microsoft, dll.).
   - Jika field menyediakan daftar `options`, pilih nilai dari `options` yang paling mendekati. Jika tidak ada di daftar `options`, kembalikan nama resmi lembaga penerbit agar ekstensi dapat mengetikkannya ke dalam combobox pencarian.

4. TINGKAT KEYAKINAN (CONFIDENCE SCORE) UNTUK KOREKSI PENGGUNA:
   - Berikan `"confidence": "high"` jika data tertulis jelas di sertifikat.
   - Berikan `"confidence": "review_needed"` beserta `"note"` singkat jika data merupakan hasil inferensi atau jika nama lembaga perlu disesuaikan dengan daftar dropdown sistem.

KEMBALIKAN HANYA JSON VALID DENGAN FORMAT BERIKUT:
{
  "documentSummary": {
    "certificateName": "...",
    "issuer": "...",
    "score": "...",
    "issueMonth": "...",
    "issueYear": "...",
    "expiryMonth": "...",
    "expiryYear": "..."
  },
  "filledFields": [
    {
      "fieldId": "...",
      "groupLabel": "...",
      "fieldLabel": "...",
      "value": "...",
      "confidence": "high | review_needed",
      "note": "Alasan singkat pemilihan nilai untuk memudahkan pengecekan pengguna"
    }
  ]
}
```

## Bagian 4: Contoh Simulasi Cara Kerja pada Form Sertifikasi Anda

Ketika Anda membuka form seperti pada gambar yang Anda lampirkan, lalu men-*drop* file `Sertifikat_Kompetensi.pdf` ke dalam Side Panel ekstensi:

1. **Pembacaan Dokumen**: Ekstensi membaca teks dan gambar halaman pertama `Sertifikat_Kompetensi.pdf` lalu mengirimkannya ke [9Router](https://github.com/decolua/9router) bersama struktur ke-6 bagian form di layar Anda.
2. **Pengisian Otomatis per Kolom**:
   - **Lembaga sertifikasi**: Ekstensi membuka dropdown `Pilih lembaga sertifikasi`, mencari nama penerbit dari PDF, dan memilihnya.
   - **Nilai**: Jika ada skor di sertifikat (misal `90.5`), ekstensi mengisi `90,5` (otomatis memakai koma sesuai petunjuk *Tambahkan , apabila desimal*).
   - **Tanggal dikeluarkan**: Ekstensi memilih dropdown `Bulan` (misal `Agustus`) dan mengetik `Tahun` (misal `2025`) khusus pada baris **Tanggal dikeluarkan**.
   - **Tanggal berakhir**: Ekstensi memilih `Bulan` dan `Tahun` berakhir jika tertera di sertifikat, atau membiarkannya kosong jika sertifikat berlaku seumur hidup.
   - **Dokumen sertifikasi**: Ekstensi otomatis memasukkan file `Sertifikat_Kompetensi.pdf` tadi ke komponen **Upload** (`Klik untuk meng-upload file kesini`) tanpa perlu Anda cari ulang di *File Explorer*.
3. **Koreksi Akhir oleh Anda**: Kolom yang sudah diisi akan ditandai dengan bingkai hijau/kuning. Anda cukup melihat sekilas di layar, mengoreksi bila ada yang ingin diubah, lalu menekan tombol simpan.
