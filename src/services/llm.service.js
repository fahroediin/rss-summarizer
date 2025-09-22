const { GoogleGenerativeAI } = require('@google/generative-ai');
const { delay } = require('../utils/delay');

function initializeGeminiClient(apiKey) {
    if (!apiKey) {
        throw new Error("Gemini API Key is missing!");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

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
            if (error.message.includes('429')) {
                console.warn(`- Rate limit terdeteksi. Percobaan ${attempt}/${MAX_RETRIES}. Mencoba lagi dalam ${currentDelay / 1000} detik...`);
                await delay(currentDelay);
                currentDelay *= 2; // Exponential backoff
            } else {
                console.error("Error calling Gemini API (non-rate-limit):", error.message);
                throw error;
            }
        }
    }
    throw new Error(`Gagal memanggil Gemini API setelah ${MAX_RETRIES} percobaan.`);
}

module.exports = { initializeGeminiClient, getGeminiResponse };