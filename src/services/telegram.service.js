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
    const startOfYesterday = "now()::date - interval '1 day'";
    const startOfToday = "now()::date";

    console.log(`- Mengambil ringkasan dari hari kemarin (antara ${startOfYesterday} dan ${startOfToday}).`);

    const { data, error } = await supabase
        .from('summaries')
        .select(`category, summary_text, articles ( title, link )`)
        .gte('created_at', startOfYesterday)
        .lt('created_at', startOfToday)
        .order('category', { ascending: true }); // <-- Biarkan ini, urutan abjad adalah dasar yang baik

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

    // =================================================================
    // LOGIKA BARU: PINDAHKAN KATEGORI "Lainnya" KE AKHIR
    // =================================================================
    const lainnyaIndex = summaries.findIndex(summary => summary.category === 'Lainnya');

    // Jika kategori "Lainnya" ditemukan di dalam array
    if (lainnyaIndex > -1) {
        // 1. Hapus item "Lainnya" dari posisinya saat ini dan simpan ke dalam variabel
        // .splice() mengembalikan array berisi item yang dihapus, jadi kita ambil item pertama ([0])
        const lainnyaSummary = summaries.splice(lainnyaIndex, 1)[0];
        
        // 2. Tambahkan item tersebut ke akhir array
        summaries.push(lainnyaSummary);
        
        console.log('- Kategori "Lainnya" dipindahkan ke urutan terakhir.');
    }
    // =================================================================

    const bot = new TelegramBot(config.telegram.botToken);

    // 1. Kirim satu pesan pembuka (header)
    const headerMessage = `*Ringkasan Berita Kemarin* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita yang diproses kemarin:`;
    try {
        await bot.sendMessage(config.telegram.chatId, headerMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Gagal mengirim pesan pembuka:', e.message);
        return;
    }

    // 2. Kirim setiap kategori sebagai pesan terpisah dengan urutan yang sudah benar
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