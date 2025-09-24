```markdown

# Agentic RSS Summarizer

Sebuah sistem AI otonom yang dirancang untuk mengumpulkan, menganalisis, dan meringkas berita dari berbagai sumber RSS. Proyek ini mengubah lautan informasi harian menjadi ringkasan tematik yang cerdas dan mengirimkannya sebagai laporan harian melalui Telegram.

Dibangun dengan arsitektur **Agentic AI** yang tangguh dan *stateful*, sistem ini memecah tugas-tugas kompleks menjadi alur kerja independen yang berkomunikasi melalui database, memastikan keandalan dan efisiensi.

## ✨ Fitur Utama

*   **Arsitektur Stateful & Tangguh:** Alur kerja untuk pengambilan data (*ingestion*), peringkasan (*summarization*), dan notifikasi berjalan secara independen. Kegagalan pada satu tahap tidak akan menghentikan yang lain, dan sistem akan otomatis mencoba kembali tugas yang tertunda pada siklus berikutnya.
*   **Peringkasan Sintesis Cerdas:** Tidak hanya meringkas satu artikel, AI ini membaca **beberapa artikel** per kategori dan **mensintesis** tema-tema utama menjadi satu narasi yang koheren.
*   **Strategi AI Bertingkat (Distilasi):** Menggunakan pendekatan *Summarize-then-Synthesize* yang canggih untuk menghindari batas token dan *rate limiting* API, membuatnya sangat efisien dan hemat biaya.
*   **Konfigurasi Penuh dari `.env`:** Semua pengaturan penting—sumber RSS, jadwal cron, zona waktu, dan kategori berita—dapat diubah langsung dari file `.env` tanpa menyentuh kode.
*   **Deduplikasi Cerdas:** Sistem secara otomatis mendeteksi dan mengabaikan berita yang sudah pernah diproses, memastikan tidak ada pekerjaan ganda.
*   **Notifikasi Harian Terstruktur:** Mengirimkan ringkasan berita dari **hari kalender kemarin** setiap pagi melalui Telegram, dengan kategori "Lainnya" selalu di akhir untuk keterbacaan maksimal.
*   **Penyimpanan Berbasis Status:** Setiap artikel dilacak statusnya (`categorized`, `summarized`) di database Supabase, memungkinkan alur kerja yang andal.

---

## 📋 Prasyarat

Sebelum memulai, pastikan Anda memiliki:

1.  **Node.js** (v18 atau lebih baru) terinstal.
2.  Akun **Supabase** (Gratis).
3.  Akun **Google AI Studio** untuk mendapatkan API Key Gemini (Gratis).
4.  Akun **Telegram**.

---

## 🚀 Instalasi & Pengaturan

### 1. Klon Repositori

```bash
git clone https://github.com/fahroediin/rss-summarizer.git
cd rss-summarizer
```

### 2. Instal Dependensi

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Duplikat file `.env.example` menjadi `.env` dan isi dengan kredensial serta konfigurasi Anda.

```bash
cp .env.example .env
```

Buka file `.env` dan lengkapi semua nilainya. Petunjuk detail untuk mendapatkan setiap kredensial ada di dalam file `.env.example`.

**Penting:**
*   Pastikan URL RSS dipisahkan dengan koma tanpa spasi.
*   Kirim pesan `/start` ke bot Telegram Anda setelah membuatnya.

### 4. Setup Database Supabase

Buka **SQL Editor** di dashboard Supabase Anda dan jalankan skrip berikut untuk membuat tabel dengan skema yang benar (termasuk kolom `status` dan `category`).

**PERINGATAN:** Skrip ini akan menghapus tabel `articles` dan `summaries` jika sudah ada.

```sql
-- Hapus tabel lama untuk menghindari konflik
DROP TABLE IF EXISTS public.articles;
DROP TABLE IF EXISTS public.summaries;

-- Buat ulang tabel summaries
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buat ulang tabel articles dengan kolom status dan kategori
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID REFERENCES public.summaries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  source TEXT,
  published_at TIMESTAMPTZ,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'categorized',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buat index untuk mempercepat query berdasarkan status
CREATE INDEX idx_articles_status_category ON public.articles (status, category);

-- Aktifkan RLS dan buat policy
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access for service role" ON public.summaries FOR ALL TO service_role USING (true);
CREATE POLICY "Allow full access for service role" ON public.articles FOR ALL TO service_role USING (true);
```

---

## 🛠️ Penggunaan

### Menjalankan Secara Manual

Untuk menjalankan satu siklus penuh secara langsung (berguna untuk testing):

```bash
node main.js
```

### Menjalankan sebagai Service Terjadwal

Untuk menjalankan aplikasi sebagai service yang akan berjalan sesuai jadwal di `.env`:

```bash
node main.js
```
Aplikasi akan menjalankan satu siklus penuh saat dimulai, lalu akan menunggu untuk berjalan lagi sesuai jadwal cron yang telah ditentukan. Untuk produksi, disarankan menggunakan manajer proses seperti `pm2`:

```bash
# Instal pm2 secara global
npm install pm2 -g

# Jalankan aplikasi dengan pm2
pm2 start main.js --name "rss-summarizer"
```

---

## 🧠 Bagaimana Cara Kerjanya? (Alur Kerja Stateful)

Sistem ini dibagi menjadi tiga alur kerja independen yang diatur oleh `main.js`:

1.  **Alur Kerja Ingestion**
    *   Mengambil artikel dari semua sumber RSS.
    *   Memfilter artikel yang sudah ada di database.
    *   Mengkategorikan artikel baru menggunakan Gemini.
    *   **Checkpoint:** Menyimpan artikel yang sudah dikategorikan ke Supabase dengan `status: 'categorized'`.

2.  **Alur Kerja Summarization**
    *   Meminta ke database: "Berikan semua artikel dengan `status: 'categorized'`."
    *   Untuk setiap kategori, melakukan **strategi distilasi bertingkat**:
        *   **Tahap 1 (Distilasi):** Mengekstrak poin-poin kunci dari setiap artikel secara individual (panggilan API kecil & cepat).
        *   **Tahap 2 (Sintesis):** Menggabungkan semua poin kunci dan memintanya untuk disintesis menjadi satu ringkasan naratif.
    *   **Checkpoint:** Menyimpan ringkasan baru ke tabel `summaries` dan meng-update status artikel terkait menjadi `status: 'summarized'`.

3.  **Alur Kerja Notifikasi**
    *   Meminta ke database: "Berikan semua ringkasan yang dibuat pada **hari kalender kemarin**."
    *   Mengurutkan ulang hasilnya agar kategori "Lainnya" selalu di akhir.
    *   Mengirimkan laporan harian yang rapi ke Telegram.

---

## 🗂️ Struktur Proyek

```
.
├── main.js                      # Orchestrator utama yang mengatur alur kerja
├── package.json
├── .env.example                 # Template untuk konfigurasi
└── src/
    ├── agents/                  # Logika inti untuk setiap tugas AI
    ├── config/                  # Pengelola konfigurasi dan environment
    ├── services/                # Konektor ke layanan eksternal (Supabase, Gemini, Telegram)
    └── utils/                   # Fungsi pembantu (pemrosesan teks, dll.)
```

## ⚙️ Kustomisasi

Semua kustomisasi utama dapat dilakukan di file `.env`:

*   **Menambah/Mengubah Sumber RSS**: Edit variabel `RSS_FEED_URLS`.
*   **Mengubah Jadwal**: Edit variabel `CRON_SCHEDULE` dan `CRON_TIMEZONE`.
*   **Menambah/Mengubah Kategori Berita**: Edit array `ALLOWED_CATEGORIES` di `src/config/categories.js`.

---

```