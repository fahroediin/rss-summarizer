const { initializeGeminiClient } = require('../services/llm.service');
const { saveSummaryAndArticles } = require('../services/supabase.service');
const { fetchArticleContent } = require('../utils/content.fetcher');
// Impor fungsi baru dan hapus yang lama jika tidak dipakai
const { synthesizeMultipleContents } = require('../utils/text.processor');
const config = require('../config/environment');

const geminiSummarizerClient = initializeGeminiClient(config.gemini.summarizer);

async function processAndStoreSummaries(categorizedArticles) {
    console.log('Summarizer Agent: Memulai proses peringkasan...');
    const articlesByCategory = categorizedArticles.reduce((acc, article) => {
        acc[article.category] = acc[article.category] || [];
        acc[article.category].push(article);
        return acc;
    }, {});

    for (const category in articlesByCategory) {
        if (category === 'Lainnya' || articlesByCategory[category].length < 1) continue;

        // Ambil hingga 3 artikel teratas untuk disintesis agar tidak terlalu berat
        const articlesForSummary = articlesByCategory[category].slice(0, 3);
        
        try {
            // 1. Ambil konten penuh dari SEMUA artikel yang dipilih
            const contentPromises = articlesForSummary.map(article => fetchArticleContent(article.link));
            const allContents = await Promise.all(contentPromises);

            // Filter konten yang gagal diambil
            const validContents = allContents.filter(content => content !== null && content.length > 100);

            if (validContents.length === 0) {
                console.warn(`- Gagal mengambil konten untuk semua artikel di kategori [${category}]. Melewati.`);
                continue;
            }

            // 2. Gunakan fungsi sintesis baru
            const summaryText = await synthesizeMultipleContents(validContents, category, geminiSummarizerClient);

            // 3. Guardrail
            if (!summaryText || summaryText.length < 50) {
                console.warn(`- Guardrail: Ringkasan sintesis untuk [${category}] terlalu pendek atau gagal. Melewati.`);
                continue;
            }

            // 4. Simpan ke database (gunakan semua artikel yang di-fetch untuk kategori ini sebagai referensi)
            const allArticlesInCategory = articlesByCategory[category];
            await saveSummaryAndArticles(category, summaryText, allArticlesInCategory);

        } catch (error) {
            console.error(`- Gagal memproses ringkasan untuk kategori [${category}]`, error.message);
        }
    }
    console.log('Summarizer Agent: Selesai.');
}

module.exports = { processAndStoreSummaries };