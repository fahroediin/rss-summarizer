const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/**
 * Menyimpan artikel yang baru dikategorikan ke database.
 * Menggunakan 'upsert' dengan ON CONFLICT untuk menghindari duplikasi berdasarkan link.
 * @param {Array<object>} articles - Array artikel yang sudah memiliki properti 'category'.
 */
async function saveCategorizedArticles(articles) {
    if (!articles || articles.length === 0) return;

    const articlesToInsert = articles.map(article => ({
        title: article.title,
        link: article.link,
        source: article.source,
        published_at: article.pubDate,
        category: article.category,
        status: 'categorized', // Status awal
    }));

    const { error } = await supabase
        .from('articles')
        .insert(articlesToInsert, {
            onConflict: 'link' // Jika link sudah ada, jangan lakukan apa-apa (abaikan)
        });

    if (error) {
        console.error('Supabase Error (saveCategorizedArticles):', error.message);
    } else {
        console.log(`- Berhasil menyimpan/mengabaikan ${articles.length} artikel yang dikategorikan.`);
    }
}

/**
 * Mengambil artikel yang siap untuk diringkas, dikelompokkan berdasarkan kategori.
 * @returns {Promise<object>} Objek di mana key adalah kategori dan value adalah array artikel.
 */
async function getArticlesToSummarize() {
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'categorized'); // Ambil hanya yang berstatus 'categorized'

    if (error) {
        console.error('Supabase Error (getArticlesToSummarize):', error.message);
        return {};
    }

    // Kelompokkan hasil berdasarkan kategori
    return data.reduce((acc, article) => {
        acc[article.category] = acc[article.category] || [];
        acc[article.category].push(article);
        return acc;
    }, {});
}

/**
 * Membuat record ringkasan baru dan mengupdate status artikel yang digunakan.
 * @param {string} category - Kategori ringkasan.
 * @param {string} summaryText - Teks ringkasan dari AI.
 * @param {Array<object>} sourceArticles - Artikel yang digunakan untuk membuat ringkasan.
 */
async function createSummaryAndUpdateArticles(category, summaryText, sourceArticles) {
    // 1. Buat record ringkasan baru
    const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .insert({ category, summary_text: summaryText })
        .select('id')
        .single();

    if (summaryError) {
        console.error('Supabase Error (create summary):', summaryError.message);
        throw summaryError;
    }
    const summaryId = summaryData.id;

    // 2. Update status artikel yang digunakan
    const articleIdsToUpdate = sourceArticles.map(a => a.id);
    const { error: updateError } = await supabase
        .from('articles')
        .update({ status: 'summarized', summary_id: summaryId })
        .in('id', articleIdsToUpdate);

    if (updateError) {
        console.error('Supabase Error (update articles):', updateError.message);
        // Idealnya, kita harus melakukan rollback (menghapus summary yang baru dibuat)
        throw updateError;
    }

    console.log(`- Berhasil membuat ringkasan [${category}] dan mengupdate ${articleIdsToUpdate.length} artikel.`);
}

// Fungsi ini masih kita butuhkan untuk deduplikasi awal
async function findExistingLinks(articleLinks) {
    if (!articleLinks || articleLinks.length === 0) return new Set();
    const { data, error } = await supabase.from('articles').select('link').in('link', articleLinks);
    if (error) {
        console.error('Supabase Error (findExistingLinks):', error.message);
        return new Set();
    }
    return new Set(data.map(item => item.link));
}

module.exports = {
    saveCategorizedArticles,
    getArticlesToSummarize,
    createSummaryAndUpdateArticles,
    findExistingLinks,
};