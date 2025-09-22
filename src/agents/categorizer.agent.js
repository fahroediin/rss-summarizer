const { initializeGeminiClient, getGeminiResponse } = require('../services/llm.service');
const { ALLOWED_CATEGORIES } = require('../config/categories');
const config = require('../config/environment');

const geminiCategorizerClient = initializeGeminiClient(config.gemini.categorizer);
const SYSTEM_PROMPT = `Anda adalah editor berita AI. Klasifikasikan berita berikut ke dalam salah satu kategori ini: ${ALLOWED_CATEGORIES.join(', ')}. Berikan HANYA SATU nama kategori sebagai jawaban.`;

async function categorizeArticle(article) {
    const userPrompt = `${SYSTEM_PROMPT}\n\nJudul: "${article.title}"\nSnippet: "${(article.snippet || '').substring(0, 250)}..."\n\nKategori:`;
    let category = 'Lainnya';

    try {
        const llmResponse = await getGeminiResponse(geminiCategorizerClient, userPrompt);
        const foundCategory = ALLOWED_CATEGORIES.find(c => llmResponse.toLowerCase().includes(c.toLowerCase()));
        
        if (foundCategory) {
            category = foundCategory;
        } else {
            console.warn(`- Guardrail: Gemini mengembalikan kategori tidak valid ('${llmResponse}'), menggunakan 'Lainnya'.`);
        }
    } catch (error) {
        console.error(`- Gagal mengkategorikan artikel: "${article.title}"`);
    }
    
    return { ...article, category };
}

module.exports = { categorizeArticle };