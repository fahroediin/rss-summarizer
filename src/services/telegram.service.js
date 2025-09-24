const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

// Inisialisasi Supabase client untuk membaca data
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/**
 * Mengambil ringkasan yang dibuat pada "hari kemarin" (berdasarkan kalender).
 * @returns {Promise<Array<object>>}
 */
async function getRecentSummaries() {
    // --- LOGIKA WAKTU BARU: MENGHITUNG TANGGAL DI JAVASCRIPT ---

    // 1. Dapatkan tanggal hari ini dan set waktunya ke awal hari (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Dapatkan tanggal kemarin dengan mengurangi satu hari dari hari ini
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // 3. Konversi ke format string ISO yang dimengerti Supabase
    const startOfYesterdayISO = yesterday.toISOString();
    const startOfTodayISO = today.toISOString();

    console.log(`- Mengambil ringkasan dari hari kemarin (antara ${startOfYesterdayISO} dan ${startOfTodayISO}).`);

    const { data, error } = await supabase
        .from('summaries')
        .select(`category, summary_text, articles ( title, link )`)
        // Gunakan nilai string ISO yang sudah dihitung
        .gte('created_at', startOfYesterdayISO)
        .lt('created_at', startOfTodayISO)
        .order('category', { ascending: true });

    if (error) {
        console.error("Error fetching summaries from Supabase:", error.message);
        return [];
    }
    return data;
}

/**
 * Mengirim ringkasan berita ke Telegram.
 */
async function sendTelegramNotification() {
    console.log('Notifier Agent: Menyiapkan pengiriman ke Telegram...');

    if (!config.telegram.botToken || !config.telegram.chatId) {
        console.error('❌ Error: Token atau Chat ID Telegram tidak ditemukan di file .env');
        return;
    }

    const summaries = await getRecentSummaries();
    if (summaries.length === 0) {
        console.log('Notifier Agent: Tidak ada ringkasan dari hari kemarin untuk dikirim. Melewati.');
        return;
    }

    // Logika untuk memindahkan kategori "Lainnya" ke akhir
    const lainnyaIndex = summaries.findIndex(summary => summary.category === 'Lainnya');
    if (lainnyaIndex > -1) {
        const lainnyaSummary = summaries.splice(lainnyaIndex, 1)[0];
        summaries.push(lainnyaSummary);
        console.log('- Kategori "Lainnya" dipindahkan ke urutan terakhir.');
    }

    const bot = new TelegramBot(config.telegram.botToken);

    // Kirim pesan pembuka
    const headerMessage = `*Ringkasan Berita Kemarin* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita yang diproses kemarin:`;
    try {
        await bot.sendMessage(config.telegram.chatId, headerMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Gagal mengirim pesan pembuka:', e.message);
        return;
    }

    // Kirim setiap kategori sebagai pesan terpisah
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