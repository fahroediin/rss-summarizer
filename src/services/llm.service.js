const { getGeminiResponse } = require('../services/llm.service');

/**
 * Mengekstrak 3-4 FAKTA UTAMA dari sebuah konten artikel.
 * Ini adalah langkah "distilasi" yang cepat dan murah.
 * @param {string} content - Konten teks penuh dari satu artikel.
 * @param {GenerativeModel} model - Instance model Gemini.
 * @returns {Promise<string>} String berisi fakta-fakta utama.
 */
async function extractKeyPoints(content, model) {
    const truncatedContent = content.substring(0, 10000);

    // --- PROMPT DISTILASI YANG DISEMPURNAKAN ---
    const prompt = `
        Anda adalah seorang analis berita yang sangat efisien.
        Tugas Anda adalah membaca teks berikut dan mengekstrak 3-4 FAKTA UTAMA yang paling penting.

        ATURAN:
        1. Gunakan format bullet point (-).
        2. Setiap poin harus berupa kalimat tunggal yang ringkas dan padat informasi.
        3. Fokus pada inti berita (Siapa, Apa, Kapan, di Mana, Mengapa).
        4. Hindari opini atau detail yang tidak perlu.
        5. JANGAN menulis kalimat pembuka atau penutup.

        Teks:
        """
        ${truncatedContent}
        """
    `;
    return getGeminiResponse(model, prompt);
}

// Fungsi-fungsi lama ini bisa tetap ada untuk referensi atau penggunaan di masa depan
async function summarizeLongText(text, model) { /* ... implementasi lama ... */ }
async function synthesizeMultipleContents(contents, category, model) { /* ... implementasi lama ... */ }


module.exports = { summarizeLongText, synthesizeMultipleContents, extractKeyPoints };