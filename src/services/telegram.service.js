const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function getRecentSummaries() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfYesterdayISO = yesterday.toISOString();
    const startOfTodayISO = today.toISOString();

    console.log(`- Mengambil ringkasan dari hari kemarin (antara ${startOfYesterdayISO} dan ${startOfTodayISO}).`);

    const { data, error } = await supabase
        .from('summaries')
        .select(`category, summary_text, articles ( title, link )`)
        .gte('created_at', startOfYesterdayISO)
        .lt('created_at', startOfTodayISO)
        .order('category', { ascending: true });

    if (error) {
        console.error("Error fetching summaries from Supabase:", error.message);
        return [];
    }
    return data;
}

async function sendTelegramNotification() {
    console.log('Notifier Agent: Menyiapkan pengiriman ke Telegram...');

    if (!config.telegram.botToken || !config.telegram.chatId) {
        console.error('❌ Error: Token atau Chat ID Telegram tidak ditemukan di file .env');
        return;
    }

    const summariesFromDB = await getRecentSummaries();
    if (summariesFromDB.length === 0) {
        console.log('Notifier Agent: Tidak ada ringkasan dari hari kemarin untuk dikirim. Melewati.');
        return;
    }

    // --- LOGIKA PENGGABUNGAN RINGKASAN ---
    const combinedSummaries = summariesFromDB.reduce((acc, summary) => {
        if (!acc[summary.category]) {
            acc[summary.category] = {
                category: summary.category,
                summary_texts: [],
                articles: []
            };
        }
        acc[summary.category].summary_texts.push(summary.summary_text);
        acc[summary.category].articles.push(...summary.articles);
        return acc;
    }, {});

    let summariesToSend = Object.values(combinedSummaries);

    // Logika untuk memindahkan kategori "Lainnya" ke akhir
    const lainnyaIndex = summariesToSend.findIndex(summary => summary.category === 'Lainnya');
    if (lainnyaIndex > -1) {
        const lainnyaSummary = summariesToSend.splice(lainnyaIndex, 1)[0];
        summariesToSend.push(lainnyaSummary);
        console.log('- Kategori "Lainnya" dipindahkan ke urutan terakhir.');
    }

    const bot = new TelegramBot(config.telegram.botToken);

    const headerMessage = `*Ringkasan Berita Kemarin* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita yang diproses kemarin:`;
    try {
        await bot.sendMessage(config.telegram.chatId, headerMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Gagal mengirim pesan pembuka:', e.message);
        return;
    }

    // Kirim setiap kategori yang sudah digabungkan
    for (const summary of summariesToSend) {
        const fullSummaryText = summary.summary_texts.join('\n'); // Gabungkan dengan satu baris baru

        let categoryMessage = `--------------------\n\n`;
        categoryMessage += `*Kategori: ${summary.category}*\n\n`;
        categoryMessage += `_${fullSummaryText.trim()}_\n\n`;
        categoryMessage += `*Sumber Berita Terkait:*\n`;
        
        const uniqueArticles = [...new Map(summary.articles.map(item => [item['link'], item])).values()];
        uniqueArticles.slice(0, 5).forEach(article => {
            const cleanTitle = article.title.replace(/[[\]()]/g, '');
            categoryMessage += `- [${cleanTitle}](${article.link})\n`;
        });

        try {
            await bot.sendMessage(config.telegram.chatId, categoryMessage, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            });
            console.log(`✅ Pesan gabungan untuk kategori [${summary.category}] berhasil dikirim.`);
        } catch (error) {
            console.error(`❌ Gagal mengirim pesan untuk kategori [${summary.category}]:`, error.message);
        }
    }
    console.log('Notifier Agent: Semua notifikasi Telegram telah dikirim.');
}

module.exports = { sendTelegramNotification };