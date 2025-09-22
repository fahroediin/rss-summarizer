const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function saveSummaryAndArticles(category, summaryText, sourceArticles) {
    const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .insert({ category, summary_text: summaryText })
        .select('id')
        .single();

    if (summaryError) {
        console.error('Supabase Error (insert summary):', summaryError.message);
        throw summaryError;
    }

    const summaryId = summaryData.id;
    const articlesToInsert = sourceArticles.map(article => ({
        summary_id: summaryId,
        title: article.title,
        link: article.link,
        source: article.source,
        published_at: article.pubDate,
    }));

    const { error: articlesError } = await supabase
        .from('articles')
        .insert(articlesToInsert);

    if (articlesError) {
        console.error('Supabase Error (insert articles):', articlesError.message);
        throw articlesError;
    }

    console.log(`- Berhasil menyimpan ringkasan [${category}] dengan ${sourceArticles.length} artikel ke Supabase.`);
    return { summaryId };
}

/**
 * Memeriksa daftar link artikel di database dan mengembalikan link yang sudah ada.
 * @param {Array<string>} articleLinks - Array berisi URL artikel yang akan diperiksa.
 * @returns {Promise<Set<string>>} Sebuah Set yang berisi link-link yang sudah ada di database.
 */
async function findExistingLinks(articleLinks) {
    if (!articleLinks || articleLinks.length === 0) {
        return new Set();
    }

    try {
        const { data, error } = await supabase
            .from('articles')
            .select('link')
            .in('link', articleLinks); // .in() sangat efisien untuk query ini

        if (error) {
            console.error('Supabase Error (findExistingLinks):', error.message);
            return new Set(); // Kembalikan set kosong jika ada error
        }

        // Ubah array hasil [{link: 'url1'}, {link: 'url2'}] menjadi Set {'url1', 'url2'}
        // Menggunakan Set lebih cepat untuk pengecekan (lookup) daripada array.
        return new Set(data.map(item => item.link));

    } catch (error) {
        console.error('Error in findExistingLinks:', error.message);
        return new Set();
    }
}

// Jangan lupa untuk mengekspor fungsi baru ini
module.exports = { saveSummaryAndArticles, findExistingLinks };