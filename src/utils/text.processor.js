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

module.exports = { summarizeLongText };