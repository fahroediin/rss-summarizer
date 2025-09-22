const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

// Inisialisasi Supabase client untuk membaca data
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// Fungsi ini sama persis seperti sebelumnya, kita gunakan lagi
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

/**
 * Mengirim ringkasan berita ke Telegram.
 * Jauh lebih sederhana: tidak perlu inisialisasi, QR, atau koneksi persisten.
 */
async function sendTelegramNotification() {
    console.log('Notifier Agent: Menyiapkan pengiriman ke Telegram...');

    // Validasi konfigurasi
    if (!config.telegram.botToken || !config.telegram.chatId) {
        console.error('❌ Error: Token atau Chat ID Telegram tidak ditemukan di file .env');
        return;
    }

    const summaries = await getRecentSummaries();
    if (summaries.length === 0) {
        console.log('Notifier Agent: Tidak ada ringkasan baru untuk dikirim. Melewati.');
        return;
    }

    // Inisialisasi bot. Tidak perlu polling karena kita hanya mengirim.
    const bot = new TelegramBot(config.telegram.botToken);

    // Pesan pembuka
    const headerMessage = `*Ringkasan Berita Terkini* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita dalam 24 jam terakhir:`;
    await bot.sendMessage(config.telegram.chatId, headerMessage, { parse_mode: 'Markdown' });

    // Kirim satu pesan per kategori untuk menghindari batas karakter Telegram (4096)
    for (const summary of summaries) {
        let categoryMessage = `--------------------\n\n`;
        categoryMessage += `*Kategori: ${summary.category}*\n\n`;
        categoryMessage += `${summary.summary_text}\n\n`;
        categoryMessage += `_Sumber Berita Terkait:_\n`;
        
        summary.articles.slice(0, 3).forEach(article => {
            // Format Markdown untuk link: [Teks](URL)
            categoryMessage += `- [${article.title}](${article.link})\n`;
        });

        try {
            // Kirim pesan untuk kategori ini
            await bot.sendMessage(config.telegram.chatId, categoryMessage, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true // Agar tidak memunculkan preview link yang besar
            });
            console.log(`✅ Pesan untuk kategori [${summary.category}] berhasil dikirim.`);
        } catch (error) {
            console.error(`❌ Gagal mengirim pesan untuk kategori [${summary.category}]:`, error.message);
        }
    }
    console.log('Notifier Agent: Semua notifikasi Telegram telah dikirim.');
}

module.exports = { sendTelegramNotification };