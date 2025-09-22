const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

/**
 * Mengambil konten teks bersih dari sebuah URL artikel menggunakan
 * engine Readability dari Mozilla.
 * @param {string} url - URL artikel berita yang akan diproses.
 * @returns {Promise<string|null>} Konten teks bersih dari artikel, atau null jika gagal.
 */
async function fetchArticleContent(url) {
    try {
        console.log(`- Fetching content from: ${url}`);

        // 1. Ambil HTML mentah dari URL menggunakan axios
        // Menambahkan User-Agent penting agar tidak diblokir oleh beberapa situs
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            }
        });
        const html = response.data;

        // 2. Buat lingkungan DOM virtual menggunakan JSDOM
        // Memberikan URL ke JSDOM membantu menyelesaikan path relatif (misal: gambar)
        const dom = new JSDOM(html, { url });

        // 3. Gunakan Readability untuk mengekstrak artikel dari DOM
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        // 4. Kembalikan konten teks jika artikel berhasil diparsing
        if (article && article.textContent) {
            // Membersihkan spasi berlebih dan baris baru yang tidak perlu
            return article.textContent.replace(/\s\s+/g, ' ').trim();
        } else {
            console.warn(`- Readability could not parse meaningful content for: ${url}`);
            return null;
        }

    } catch (error) {
        // Penanganan error yang lebih detail
        if (error.response) {
            // Request dibuat dan server merespon dengan status code di luar 2xx
            console.error(`Error fetching ${url}: Server responded with status ${error.response.status}`);
        } else if (error.request) {
            // Request dibuat tapi tidak ada respon yang diterima
            console.error(`Error fetching ${url}: No response received from server.`);
        } else {
            // Error terjadi saat setup request atau parsing
            console.error(`Error processing content for ${url}:`, error.message);
        }
        return null;
    }
}

module.exports = { fetchArticleContent };