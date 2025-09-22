require('dotenv').config();

// Ambil string RSS dari .env, atau string kosong jika tidak ada
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
    // Proses string menjadi array
    // .split(',') akan memecah string berdasarkan koma
    // .filter(Boolean) akan menghapus string kosong jika ada koma di akhir
    rssFeedUrls: rssFeedsString.split(',').filter(Boolean),
};

module.exports = config;