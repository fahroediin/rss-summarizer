const { GoogleGenerativeAI } = require('@google/generative-ai');
const { delay } = require('../utils/delay');

/**
 * Membuat instance client Gemini yang sudah dikonfigurasi.
 * @param {string} apiKey - API Key untuk instance ini.
 * @returns {GenerativeModel}
 */
function initializeGeminiClient(apiKey) {
    if (!apiKey) {
        throw new Error("Gemini API Key is missing!");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Fungsi generik untuk mendapatkan respon dari model Gemini dengan mekanisme retry.
 * @param {GenerativeModel} model - Instance model Gemini.
 * @param {string} prompt - Teks prompt.
 * @returns {Promise<string>} - Respon teks dari AI.
 */
async function getGeminiResponse(model, prompt) {
    const MAX_RETRIES = 3;
    let attempt = 0;
    let currentDelay = 2000; // Jeda awal 2 detik

    while (attempt < MAX_RETRIES) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            attempt++;
            if (error.message.includes('429') || error.message.includes('503')) { // Menangani Rate Limit & Service Unavailable
                console.warn(`- API Error terdeteksi (${error.message.match(/\[(\d{3}) .*\]/)[1]}). Percobaan ${attempt}/${MAX_RETRIES}. Mencoba lagi dalam ${currentDelay / 1000} detik...`);
                await delay(currentDelay);
                currentDelay *= 2; // Exponential backoff
            } else {
                console.error("Error calling Gemini API (non-retryable):", error.message);
                throw error;
            }
        }
    }
    throw new Error(`Gagal memanggil Gemini API setelah ${MAX_RETRIES} percobaan.`);
}

// --- PERBAIKAN ADA DI SINI ---
// Pastikan kedua fungsi diekspor.
module.exports = { initializeGeminiClient, getGeminiResponse };