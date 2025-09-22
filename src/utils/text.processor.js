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
    // Gabungkan semua konten menjadi satu teks besar, dipisahkan oleh pembatas yang jelas.
    const combinedText = contents
        .map((content, index) => `--- ARTIKEL ${index + 1} ---\n${content}`)
        .join('\n\n');

    // Prompt Engineering: Instruksi yang jauh lebih spesifik
    const prompt = `
        Anda adalah seorang editor berita senior yang sangat cerdas.
        Tugas Anda adalah membaca beberapa artikel berita dalam kategori "${category}" dan menulis sebuah ringkasan SINTESIS yang menangkap tema-tema utama, tren, atau peristiwa paling signifikan dari SEMUA artikel tersebut.

        ATURAN:
        1. JANGAN hanya meringkas satu artikel. Temukan benang merah atau poin-poin penting dari semua artikel yang disediakan.
        2. Tulis dalam 2-4 paragraf singkat atau poin-poin (bullet points).
        3. Gunakan Bahasa Indonesia yang formal dan netral.
        4. Fokus pada "apa" dan "mengapa" dari berita-berita tersebut secara kolektif.

        Berikut adalah konten dari beberapa artikel berita:
        ${combinedText}
    `;

    console.log(`- Synthesizing ${contents.length} articles for category [${category}]...`);
    
    // Kita bisa menggunakan summarizeLongText jika gabungan teksnya sangat panjang,
    // tapi untuk 3-5 artikel, biasanya satu panggilan langsung sudah cukup dan lebih baik hasilnya.
    // Jika Anda sering mengalami error token di sini, baru gunakan strategi Map-Reduce.
    return getGeminiResponse(model, prompt);
}

module.exports = { summarizeLongText, synthesizeMultipleContents };