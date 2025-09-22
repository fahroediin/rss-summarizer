const { initializeGeminiClient } = require('../services/llm.service');
const { saveSummaryAndArticles } = require('../services/supabase.service');
const { fetchArticleContent } = require('../utils/content.fetcher');
const { summarizeLongText } = require('../utils/text.processor');
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

        const articlesForSummary = articlesByCategory[category].slice(0, 5);
        const mainArticle = articlesForSummary[0];

        try {
            const fullContent = await fetchArticleContent(mainArticle.link);
            if (!fullContent) {
                console.warn(`- Gagal mengambil konten untuk [${mainArticle.title}]. Melewati kategori [${category}].`);
                continue;
            }

            console.log(`- Summarizing full content for category [${category}]...`);
            const summaryText = await summarizeLongText(fullContent, geminiSummarizerClient);

            if (!summaryText || summaryText.length < 50) {
                console.warn(`- Guardrail: Ringkasan untuk [${category}] terlalu pendek atau gagal. Melewati.`);
                continue;
            }

            await saveSummaryAndArticles(category, summaryText, articlesForSummary);
        } catch (error) {
            console.error(`- Gagal memproses ringkasan untuk kategori [${category}]`, error.message);
        }
    }
    console.log('Summarizer Agent: Selesai.');
}

module.exports = { processAndStoreSummaries };