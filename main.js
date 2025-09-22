const cron = require('node-cron');
const { fetchArticles } = require('./src/agents/fetcher.agent');
const { categorizeArticle } = require('./src/agents/categorizer.agent');
const { processAndStoreSummaries } = require('./src/agents/summarizer.agent');
const { delay } = require('./src/utils/delay');
const { initializeAndSend: sendWhatsAppNotification } = require('./src/services/whatsapp.service');

async function runWorkflow() {
    console.log(`\n===== Memulai Alur Kerja Summarizer [${new Date().toISOString()}] =====`);

    // 1. Fetcher Agent
    const allArticles = await fetchArticles();
    if (allArticles.length === 0) {
        console.log('Tidak ada artikel baru ditemukan. Alur kerja selesai.');
        return;
    }

    // 2. Categorizer Agent (DENGAN BATCH PROCESSING)
    console.log('Categorizer Agent: Memulai kategorisasi dengan batch processing...');
    
    const BATCH_SIZE = 8; // Ukuran batch, di bawah limit RPM (10-15) untuk keamanan
    const DELAY_BETWEEN_BATCHES = 61000; // Jeda 61 detik antar batch untuk mereset kuota per menit
    const categorizedArticles = [];

    for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
        const batch = allArticles.slice(i, i + BATCH_SIZE);
        console.log(`- Memproses batch ${Math.floor(i / BATCH_SIZE) + 1} (artikel ${i + 1} sampai ${i + batch.length})`);

        const categorizationPromises = batch.map(categorizeArticle);
        const batchResults = await Promise.all(categorizationPromises);
        categorizedArticles.push(...batchResults);

        if (i + BATCH_SIZE < allArticles.length) {
            console.log(`- Jeda ${DELAY_BETWEEN_BATCHES / 1000} detik sebelum batch berikutnya...`);
            await delay(DELAY_BETWEEN_BATCHES);
        }
    }
    console.log('Categorizer Agent: Selesai.');

    // 3. Summarizer Agent
    await processAndStoreSummaries(categorizedArticles);
    
    // 4. Notifier Agent
    console.log('===== Memulai Tahap Notifikasi =====');
    await sendWhatsAppNotification();

    console.log('===== Alur Kerja Selesai =====');
}

// Jalankan sekali saat aplikasi dimulai
runWorkflow();

// Jadwalkan untuk berjalan setiap 4 jam (contoh)
// cron.schedule('0 */4 * * *', () => {
//     runWorkflow();
// });