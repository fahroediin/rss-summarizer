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

    // --- MEMBANGUN SATU PESAN TUNGGAL ---
    let fullMessage = `*Ringkasan Berita Terkini* ☀️\n\n`;
    fullMessage += `Berikut adalah rangkuman dari berbagai sumber berita dalam 24 jam terakhir:\n`;

    for (const summary of summaries) {
        fullMessage += `\n--------------------\n\n`;
        fullMessage += `*Kategori: ${summary.category}*\n\n`;
        // Gunakan format italic untuk ringkasan agar lebih menonjol
        fullMessage += `_${summary.summary_text.trim()}_\n\n`;
        fullMessage += `*Sumber Berita Terkait:*\n`;
        
        summary.articles.slice(0, 3).forEach(article => {
            // Membersihkan judul dari karakter yang bisa merusak Markdown
            const cleanTitle = article.title.replace(/[[\]()]/g, '');
            // Format Markdown untuk link: [Teks](URL)
            fullMessage += `- [${cleanTitle}](${article.link})\n`;
        });
    }

    // --- MENGIRIM PESAN ---
    try {
        // Kirim pesan tunggal yang sudah dibangun
        await bot.sendMessage(config.telegram.chatId, fullMessage, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
        });
        console.log(`✅ Ringkasan lengkap berhasil dikirim ke Telegram.`);
    } catch (error) {
        // Penanganan jika pesan terlalu panjang (batas 4096 karakter)
        if (error.response && error.response.body.description.includes('message is too long')) {
            console.warn('⚠️ Pesan terlalu panjang, mencoba mengirim per kategori...');
            // Fallback: kirim per kategori jika pesan gabungan gagal
            await sendInChunks(bot, summaries);
        } else {
            console.error(`❌ Gagal mengirim pesan gabungan:`, error.message);
        }
    }
}

// Fungsi fallback jika pesan gabungan terlalu panjang
async function sendInChunks(bot, summaries) {
    for (const summary of summaries) {
        let chunkMessage = `*Kategori: ${summary.category}*\n\n`;
        chunkMessage += `_${summary.summary_text.trim()}_\n\n`;
        chunkMessage += `*Sumber Berita Terkait:*\n`;
        summary.articles.slice(0, 3).forEach(article => {
            const cleanTitle = article.title.replace(/[[\]()]/g, '');
            chunkMessage += `- [${cleanTitle}](${article.link})\n`;
        });
        try {
            await bot.sendMessage(config.telegram.chatId, chunkMessage, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            });
        } catch (e) {
            console.error(`Gagal mengirim chunk untuk kategori ${summary.category}:`, e.message);
        }
    }
}

module.exports = { sendTelegramNotification };