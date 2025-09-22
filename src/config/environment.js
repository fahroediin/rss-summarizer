require('dotenv').config();

const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    gemini: {
        categorizer: process.env.GEMINI_API_KEY_CATEGORIZER,
        summarizer: process.env.GEMINI_API_KEY_SUMMARIZER,
    },
    whatsappTargetId: process.env.WHATSAPP_TARGET_ID,
};

module.exports = config;