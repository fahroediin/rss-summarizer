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

module.exports = { saveSummaryAndArticles };