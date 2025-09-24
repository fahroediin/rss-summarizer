const { getGeminiResponse } = require('../services/llm.service');

async function summarizeLongText(text, model) {
    const chunkSize = 8000;
    const textChunks = [];

    if (!text || text.length < 200) {
        return "Konten tidak cukup untuk diringkas.";
    }

    for (let i = 0; i < text.length; i += chunkSize) {
        textChunks.push(text.substring(i, i + chunkSize));
    }
    console.log(`- Text split into ${textChunks.length} chunk(s) for summarization.`);

    const chunkSummariesPromises = textChunks.map((chunk, index) => {
        const prompt = `Anda adalah AI yang efisien. Ringkas teks berikut sepadat mungkin tanpa kehilangan poin-poin dan entitas utama. Ini adalah bagian ${index + 1} dari ${textChunks.length}.\n\nTeks:\n"""${chunk}"""`;
        return getGeminiResponse(model, prompt);
    });
    const chunkSummaries = await Promise.all(chunkSummariesPromises);

    if (chunkSummaries.length === 1) {
        return chunkSummaries[0];
    }

    const combinedSummaries = chunkSummaries.join('\n\n---\n\n');
    const finalPrompt = `Anda adalah seorang editor ahli. Buat satu ringkasan akhir yang koheren, lancar, dan komprehensif dari beberapa ringkasan parsial berikut. Gabungkan poin-poin yang tumpang tindih dan bentuk narasi yang utuh dalam format poin-poin.\n\nRingkasan Parsial:\n"""${combinedSummaries}"""`;
    
    console.log('- Performing final reduce step on combined summaries...');
    const finalSummary = await getGeminiResponse(model, finalPrompt);

    return finalSummary;
}
/**
 * Mensintesis beberapa konten artikel menjadi satu ringkasan tematik yang koheren.
 * @param {Array<string>} contents - Array berisi konten teks dari beberapa artikel.
 * @param {string} category - Nama kategori untuk memberikan konteks pada AI.
 * @param {GenerativeModel} model - Instance model Gemini.
 * @returns {Promise<string>} Ringkasan sintesis.
 */
async function synthesizeMultipleContents(contents, category, model) {
    const combinedText = contents
        .map((content, index) => `--- ARTIKEL ${index + 1} ---\n${content}`)
        .join('\n\n');

    // --- PROMPT YANG DIPERBARUI ---
    const prompt = `
        Anda adalah seorang editor berita senior yang sangat cerdas dan ringkas.
        Tugas Anda adalah membaca beberapa artikel berita dalam kategori "${category}" dan menulis sebuah ringkasan SINTESIS yang menangkap tema-tema utama dari SEMUA artikel tersebut.

        ATURAN PENTING:
        1. JANGAN hanya meringkas satu artikel. Temukan benang merah dari semua artikel.
        2. Tulis dalam 2-4 paragraf singkat atau poin-poin (bullet points).
        3. Gunakan Bahasa Indonesia yang formal dan netral.
        4. **LANGSUNG ke isi ringkasan. JANGAN menulis kalimat pembuka seperti "Berikut adalah sintesis..." atau kalimat penutup apa pun.**

        Berikut adalah konten dari beberapa artikel berita:
        ${combinedText}
    `;

    console.log(`- Synthesizing ${contents.length} articles for category [${category}]...`);
    
    return getGeminiResponse(model, prompt);
}

/**
 * Mengekstrak 3-4 FAKTA UTAMA dari sebuah konten artikel.
 * Ini adalah langkah "distilasi" yang cepat dan murah.
 * @param {string} content - Konten teks penuh dari satu artikel.
 * @param {GenerativeModel} model - Instance model Gemini.
 * @returns {Promise<string>} String berisi fakta-fakta utama.
 */
async function extractKeyPoints(content, model) {
    const truncatedContent = content.substring(0, 10000);

    // --- PROMPT YANG DIPERBARUI ---
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

module.exports = { summarizeLongText, synthesizeMultipleContents, extractKeyPoints };