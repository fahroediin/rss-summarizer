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
        let pendingArticles = articlesToProcess[category];
        let batchNumber = 1;

        while (pendingArticles.length > 0) {
            const articlesForSummary = pendingArticles.splice(0, 3);

            console.log(`\n- Memproses batch #${batchNumber} untuk kategori [${category}] dengan ${articlesForSummary.length} artikel.`);
            batchNumber++;

            try {
                // --- TAHAP 1: DISTILASI (MAP) ---
                console.log(`- Tahap 1: Mengekstrak poin kunci...`);
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
                    console.warn(`- Gagal mengekstrak poin kunci untuk batch ini. Melanjutkan ke batch berikutnya.`);
                    continue;
                }

                // --- TAHAP 2: SINTESIS (REDUCE) ---
                console.log(`- Tahap 2: Mensintesis ${allKeyPoints.length} set poin kunci...`);
                const combinedKeyPoints = allKeyPoints.join('\n\n');
                
                // --- PROMPT SINTESIS YANG DISEMPURNAKAN ---
                const synthesisPrompt = `
                    Anda adalah seorang Kepala Editor yang bertugas membuat ringkasan eksekutif harian.
                    Berdasarkan KUMPULAN FAKTA UTAMA dari beberapa berita dalam kategori "${category}" berikut, buatlah sebuah ringkasan akhir yang TEMATIK dan SANGAT RINGKAS.

                    ATURAN PENTING:
                    1. Gunakan format 2-3 bullet point utama (gunakan tanda • atau -).
                    2. Setiap poin harus merangkum satu tema atau tren utama yang muncul dari fakta-fakta yang diberikan.
                    3. Gunakan bahasa yang lugas, padat, dan langsung ke intinya.
                    4. JANGAN mengulang fakta secara mentah-mentah, tetapi SINTESISKAN menjadi kesimpulan tingkat tinggi.
                    5. JANGAN menulis kalimat pembuka atau penutup.

                    Kumpulan Fakta Utama:
                    """
                    ${combinedKeyPoints}
                    """
                `;
                const summaryText = await getGeminiResponse(geminiSummarizerClient, synthesisPrompt);

                if (!summaryText || summaryText.length < 30) {
                    console.warn(`- Guardrail: Ringkasan sintesis untuk batch ini terlalu pendek. Melewati.`);
                    continue;
                }

                await createSummaryAndUpdateArticles(category, summaryText, articlesForSummary);

            } catch (error) {
                console.error(`- Gagal memproses batch ini untuk kategori [${category}]`, error.message);
            }
        }
    }
    console.log('Summarizer Agent: Selesai.');
}

module.exports = { summarizePendingArticles };