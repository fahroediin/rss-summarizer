const { initializeGeminiClient, getGeminiResponse } = require('../services/llm.service');
const { getArticlesToSummarize, createSummaryAndUpdateArticles } = require('../services/supabase.service');
const { fetchArticleContent } = require('../utils/content.fetcher');
const { extractKeyPoints } = require('../utils/text.processor');
const { delay } = require('../utils/delay');
const config = require('../config/environment');

const geminiSummarizerClient = initializeGeminiClient(config.gemini.summarizer);

async function summarizePendingArticles() {
    console.log('Summarizer Agent: Memeriksa artikel yang tertunda untuk diringkas...');
    
    const articlesToProcess = await getArticlesToSummarize();
    const categories = Object.keys(articlesToProcess);

    if (categories.length === 0) {
        console.log('Summarizer Agent: Tidak ada artikel baru untuk diringkas.');
        return;
    }

    console.log(`Summarizer Agent: Ditemukan artikel di ${categories.length} kategori untuk diproses.`);

    for (const category of categories) {
        console.log(`\n--- Memproses Kategori: [${category}] ---`);
        const articlesForSummary = articlesToProcess[category].slice(0, 3);
        
        try {
            console.log(`- Tahap 1: Mengekstrak poin kunci dari ${articlesForSummary.length} artikel...`);
            const allKeyPoints = [];
            for (const article of articlesForSummary) {
                const content = await fetchArticleContent(article.link);
                if (content && content.length > 100) {
                    const keyPoints = await extractKeyPoints(content, geminiSummarizerClient);
                    allKeyPoints.push(`Poin-poin dari "${article.title}":\n${keyPoints}`);
                    await delay(1000);
                }
            }

            if (allKeyPoints.length === 0) {
                console.warn(`- Gagal mengekstrak poin kunci untuk semua artikel di kategori [${category}]. Melewati.`);
                continue;
            }

            console.log(`- Tahap 2: Mensintesis ${allKeyPoints.length} set poin kunci...`);
            const combinedKeyPoints = allKeyPoints.join('\n\n');
            const synthesisPrompt = `
                Anda adalah seorang editor berita senior yang cerdas dan ringkas.
                Berdasarkan KUMPULAN POIN-POIN KUNCI dari beberapa artikel berita berikut dalam kategori "${category}", tulis sebuah ringkasan SINTESIS yang koheren dalam 2-4 paragraf.
                Gabungkan ide-ide yang serupa dan bentuk sebuah narasi yang mengalir.
                LANGSUNG ke isi ringkasan. JANGAN menulis kalimat pembuka seperti "Berikut adalah sintesis...".

                Kumpulan Poin Kunci:
                """
                ${combinedKeyPoints}
                """
            `;
            // -----------------------------------------

            const summaryText = await getGeminiResponse(geminiSummarizerClient, synthesisPrompt);

            if (!summaryText || summaryText.length < 50) {
                console.warn(`- Guardrail: Ringkasan sintesis untuk [${category}] terlalu pendek. Melewati.`);
                continue;
            }

            await createSummaryAndUpdateArticles(category, summaryText, articlesForSummary);

        } catch (error) {
            console.error(`- Gagal memproses ringkasan untuk kategori [${category}]`, error.message);
            // Kita tidak melempar error lagi, agar bisa lanjut ke kategori berikutnya
        }
    }
    console.log('Summarizer Agent: Selesai.');
}

module.exports = { summarizePendingArticles };