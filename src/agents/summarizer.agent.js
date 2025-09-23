const { initializeGeminiClient, getGeminiResponse } = require('../services/llm.service');
const { saveSummaryAndArticles } = require('../services/supabase.service');
const { fetchArticleContent } = require('../utils/content.fetcher');
const { extractKeyPoints } = require('../utils/text.processor');
const { delay } = require('../utils/delay');
const config = require('../config/environment');

const geminiSummarizerClient = initializeGeminiClient(config.gemini.summarizer);

async function processAndStoreSummaries(categorizedArticles) {
    console.log('Summarizer Agent: Memulai proses peringkasan dengan strategi Distilasi Bertingkat...');
    
    const articlesByCategory = categorizedArticles.reduce((acc, article) => {
        acc[article.category] = acc[article.category] || [];
        acc[article.category].push(article);
        return acc;
    }, {});

    for (const category in articlesByCategory) {
        if (category === 'Lainnya' || articlesByCategory[category].length < 1) continue;

        console.log(`\n--- Memproses Kategori: [${category}] ---`);
        const articlesForSummary = articlesByCategory[category].slice(0, 3);
        
        try {
            // --- TAHAP 1: DISTILASI (MAP) ---
            console.log(`- Tahap 1: Mengekstrak poin kunci dari ${articlesForSummary.length} artikel...`);
            const allKeyPoints = [];

            for (const article of articlesForSummary) {
                const content = await fetchArticleContent(article.link);
                if (content && content.length > 100) {
                    const keyPoints = await extractKeyPoints(content, geminiSummarizerClient);
                    allKeyPoints.push(`Poin-poin dari "${article.title}":\n${keyPoints}`);
                    // Beri jeda kecil antar panggilan API untuk lebih ramah rate limit
                    await delay(1000); // Jeda 1 detik
                }
            }

            if (allKeyPoints.length === 0) {
                console.warn(`- Gagal mengekstrak poin kunci untuk semua artikel di kategori [${category}]. Melewati.`);
                continue;
            }

            // --- TAHAP 2: SINTESIS (REDUCE) ---
            console.log(`- Tahap 2: Mensintesis ${allKeyPoints.length} set poin kunci...`);
            const combinedKeyPoints = allKeyPoints.join('\n\n');

            const synthesisPrompt = `
                Anda adalah seorang editor berita senior yang cerdas.
                Berdasarkan KUMPULAN POIN-POIN KUNCI dari beberapa artikel berita berikut, tulis sebuah ringkasan SINTESIS yang koheren dalam 2-4 paragraf.
                Gabungkan ide-ide yang serupa dan bentuk sebuah narasi yang mengalir.
                LANGSUNG ke isi ringkasan. JANGAN menulis kalimat pembuka seperti "Berikut adalah sintesis...".

                Kumpulan Poin Kunci:
                """
                ${combinedKeyPoints}
                """
            `;

            const summaryText = await getGeminiResponse(geminiSummarizerClient, synthesisPrompt);

            // Guardrail
            if (!summaryText || summaryText.length < 50) {
                console.warn(`- Guardrail: Ringkasan sintesis untuk [${category}] terlalu pendek atau gagal. Melewati.`);
                continue;
            }

            // Simpan ke database
            const allArticlesInCategory = articlesByCategory[category];
            await saveSummaryAndArticles(category, summaryText, allArticlesInCategory);

        } catch (error) {
            console.error(`- Gagal memproses ringkasan untuk kategori [${category}]`, error.message);
        }
    }
    console.log('Summarizer Agent: Selesai.');
}

module.exports = { processAndStoreSummaries };