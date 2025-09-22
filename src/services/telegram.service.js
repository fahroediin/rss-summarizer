const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function getRecentSummaries() {
    const twentyFourHoursAgo = new Date(new Date() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('summaries')
        .select(`category, summary_text, articles ( title, link )`)
        .gte('created_at', twentyFourHoursAgo)
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

    const summaries = await getRecentSummaries();
    if (summaries.length === 0) {
        console.log('Notifier Agent: Tidak ada ringkasan baru untuk dikirim. Melewati.');
        return;
    }

    const bot = new TelegramBot(config.telegram.botToken);

    // --- LOGIKA PENGIRIMAN YANG DISEMPURNAKAN ---

    // 1. Kirim satu pesan pembuka (header)
    const headerMessage = `*Ringkasan Berita Terkini* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita dalam 24 jam terakhir:`;
    try {
        await bot.sendMessage(config.telegram.chatId, headerMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Gagal mengirim pesan pembuka:', e.message);
        return; // Hentikan jika header saja gagal
    }

    // 2. Kirim setiap kategori sebagai pesan terpisah untuk keterbacaan
    for (const summary of summaries) {
        let categoryMessage = `--------------------\n\n`;
        categoryMessage += `*Kategori: ${summary.category}*\n\n`;
        categoryMessage += `_${summary.summary_text.trim()}_\n\n`;
        categoryMessage += `*Sumber Berita Terkait:*\n`;
        
        summary.articles.slice(0, 3).forEach(article => {
            const cleanTitle = article.title.replace(/[[\]()]/g, '');
            categoryMessage += `- [${cleanTitle}](${article.link})\n`;
        });

        try {
            // Kirim pesan untuk kategori ini
            await bot.sendMessage(config.telegram.chatId, categoryMessage, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            });
            console.log(`✅ Pesan untuk kategori [${summary.category}] berhasil dikirim.`);
        } catch (error) {
            console.error(`❌ Gagal mengirim pesan untuk kategori [${summary.category}]:`, error.message);
        }
    }
    console.log('Notifier Agent: Semua notifikasi Telegram telah dikirim.');
}

module.exports = { sendTelegramNotification };