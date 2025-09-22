```markdown
# Agentic RSS Summarizer

Sistem otomatis cerdas yang mengambil berita dari feed RSS, mengkategorikannya, membuat ringkasan mendalam menggunakan AI, dan mengirimkan pembaruan harian melalui Telegram.

Proyek ini dibangun menggunakan pendekatan **Agentic AI**, di mana tugas-tugas kompleks dipecah menjadi "agen" yang lebih kecil dan terspesialisasi.

## ✨ Fitur Utama

*   **Arsitektur Agentic:** Empat agen independen (Fetcher, Categorizer, Summarizer, Notifier) bekerja sama dalam sebuah alur kerja.
*   **Kategorisasi Cerdas:** Menggunakan Google Gemini untuk mengklasifikasikan berita secara akurat ke dalam kategori yang Anda tentukan.
*   **Peringkasan Mendalam:** Mampu meringkas konten artikel penuh (bukan hanya judul) menggunakan strategi Map-Reduce untuk menangani teks yang panjang.
*   **Efisien & Hemat Biaya:**
    *   **Deduplikasi Otomatis:** Hanya memproses berita baru, menghemat kuota API LLM.
    *   **Rate Limiting:** Mengelola permintaan API ke Gemini dengan cerdas untuk menghindari error.
*   **Notifikasi Telegram:** Mengirim ringkasan harian yang diformat dengan baik langsung ke Telegram Anda.
*   **Penyimpanan Terstruktur:** Menyimpan ringkasan dan referensi artikel di database Supabase (PostgreSQL).

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
git clone https://github.com/username/fahroediin-rss-summarizer.git
cd fahroediin-rss-summarizer
```

### 2. Instal Dependensi

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Duplikat file `.env.example` menjadi `.env` dan isi dengan kredensial Anda.

```bash
cp .env.example .env
```

Buka file `.env` dan lengkapi detail berikut:

#### Mendapatkan Kredensial:

*   **Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)**:
    1.  Buka Proyek Supabase Anda.
    2.  Pergi ke `Project Settings` (ikon gear) -> `API`.
    3.  Salin `URL` dan `service_role` key. **Penting:** Gunakan `service_role` key, bukan `anon` key.

*   **Gemini (`GEMINI_API_KEY_...)**:
    1.  Kunjungi [Google AI Studio](https://aistudio.google.com/app/apikey).
    2.  Buat dua API key berbeda (satu untuk Categorizer, satu untuk Summarizer) untuk manajemen kuota yang lebih baik.

*   **Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)**:
    1.  Cari `@BotFather` di Telegram, gunakan `/newbot` untuk membuat bot dan dapatkan **Token**.
    2.  Cari `@userinfobot` di Telegram untuk mendapatkan **Chat ID** numerik Anda.
    3.  **Penting:** Kirim pesan `/start` ke bot baru Anda sebelum menjalankan aplikasi ini.

### 4. Setup Database Supabase

Buka **SQL Editor** di dashboard Supabase Anda dan jalankan skrip berikut untuk membuat tabel yang diperlukan:

```sql
-- 1. BUAT TABEL SUMMARIES
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BUAT TABEL ARTICLES
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID REFERENCES public.summaries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  source TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AKTIFKAN & ATUR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Izinkan service_role (backend kita) untuk mengakses segalanya
CREATE POLICY "Allow full access for service role" ON public.summaries FOR ALL TO service_role USING (true);
CREATE POLICY "Allow full access for service role" ON public.articles FOR ALL TO service_role USING (true);
```

---

## 🛠️ Penggunaan

Jalankan alur kerja secara manual:

```bash
node main.js
```

Aplikasi akan:
1.  Mengambil berita dari RSS.
2.  Memeriksa artikel baru.
3.  Mengkategorikan dan meringkas artikel baru.
4.  Menyimpan ke Supabase.
5.  Mengirim notifikasi ke Telegram.

### Otomatisasi (Opsional)

Untuk menjalankan secara otomatis (misalnya, setiap 4 jam), hapus komentar pada bagian `cron.schedule` di file `main.js`:

```javascript
// main.js

// Jadwalkan untuk berjalan setiap 4 jam
cron.schedule('0 */4 * * *', () => {
    console.log('Menjalankan siklus terjadwal...');
    runWorkflow();
});
```
Lalu jalankan `node main.js` terus-menerus di server (gunakan `pm2` untuk produksi).

---

## 🧠 Bagaimana Cara Kerjanya? (Alur Agentic)

Sistem ini bekerja seperti pabrik perakitan berita:

1.  **Agent 1: Fetcher** (`src/agents/fetcher.agent.js`)
    *   Mengambil daftar artikel dari URL RSS yang telah ditentukan.

2.  **(Logika Deduplikasi)** (`main.js` & `supabase.service.js`)
    *   Membandingkan artikel yang di-fetch dengan database. Hanya artikel **baru** yang diteruskan ke tahap berikutnya.

3.  **Agent 2: Categorizer** (`src/agents/categorizer.agent.js`)
    *   Menggunakan Gemini (Key 1) untuk memberi label pada setiap artikel baru (misal: Teknologi, Politik).
    *   Memproses dalam *batch* dengan jeda untuk mematuhi Rate Limit API.

4.  **Agent 3: Summarizer** (`src/agents/summarizer.agent.js`)
    *   Mengelompokkan artikel berdasarkan kategori.
    *   Untuk setiap kategori:
        *   Mengambil konten teks penuh dari artikel utama (menggunakan `Readability`).
        *   Menggunakan Gemini (Key 2) dan strategi **Map-Reduce** untuk meringkas teks panjang.
        *   Menyimpan ringkasan dan referensi artikel ke Supabase.

5.  **Agent 4: Notifier** (`src/services/telegram.service.js`)
    *   Mengambil ringkasan dari 24 jam terakhir dari Supabase.
    *   Mengirimkannya sebagai pesan yang diformat rapi ke Telegram.

---

## 🗂️ Struktur Proyek

```
.
├── main.js                      # Orchestrator utama alur kerja
├── package.json
├── src/
│   ├── agents/                  # Logika spesifik untuk setiap Agen AI
│   │   ├── categorizer.agent.js
│   │   ├── fetcher.agent.js
│   │   └── summarizer.agent.js
│   ├── config/                  # Konfigurasi (Kategori, Env Vars)
│   ├── services/                # Koneksi ke layanan eksternal (LLM, DB, Notifikasi)
│   │   ├── llm.service.js
│   │   ├── supabase.service.js
│   │   └── telegram.service.js
│   └── utils/                   # Fungsi pembantu (Pemrosesan teks, delay, dll.)
│       ├── content.fetcher.js
│       ├── delay.js
│       └── text.processor.js
```

## ⚙️ Kustomisasi

*   **Menambah/Mengubah Sumber RSS**: Edit array `RSS_FEEDS` di `src/agents/fetcher.agent.js`.
*   **Menambah/Mengubah Kategori**: Edit array `ALLOWED_CATEGORIES` di `src/config/categories.js`.

---
```