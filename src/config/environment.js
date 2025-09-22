require('dotenv').config();

const rssFeedsString = process.env.RSS_FEED_URLS || '';

const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    gemini: {
        categorizer: process.env.GEMINI_API_KEY_CATEGORIZER,
        summarizer: process.env.GEMINI_API_KEY_SUMMARIZER,
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },
    rssFeedUrls: rssFeedsString.split(',').filter(Boolean),
    
    // --- VARIABEL BARU UNTUK CRON ---
    // Ambil jadwal dari .env, jika tidak ada, default ke jam 5 pagi setiap hari
    cronSchedule: process.env.CRON_SCHEDULE || '0 5 * * *',
    // Ambil timezone dari .env, jika tidak ada, default ke Asia/Jakarta
    cronTimezone: process.env.CRON_TIMEZONE || 'Asia/Jakarta',
};

module.exports = config;