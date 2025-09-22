    require('dotenv').config();

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
        }
    };

    module.exports = config;