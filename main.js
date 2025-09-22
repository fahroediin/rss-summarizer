const cron = require('node-cron');
const { fetchArticles } = require('./src/agents/fetcher.agent');
const { categorizeArticle } = require('./src/agents/categorizer.agent');
const { processAndStoreSummaries } = require('./src/agents/summarizer.agent');
const { delay } = require('./src/utils/delay');
const { sendTelegramNotification } = require('./src/services/telegram.service');
// Impor fungsi baru dari supabase.service
const { findExistingLinks } = require('./src/services/supabase.service');

async function runWorkflow() {
    console.log(`\n===== Memulai Alur Kerja Summarizer [${new Date().toISOString()}] =====`);

    // 1. Fetcher Agent
    const allArticles = await fetchArticles();
    if (allArticles.length === 0) {
        console.log('Tidak ada artikel ditemukan dari RSS. Alur kerja selesai.');
        // Kita tetap jalankan notifikasi, mungkin ada ringkasan lama yang belum terkirim
        await sendTelegramNotification();
        return;
    }

    // =================================================================
    // LANGKAH BARU: DEDUPLIKASI ARTIKEL
    // =================================================================
    console.log(`- Total artikel di-fetch: ${allArticles.length}. Memeriksa duplikat di database...`);
    
    // Ambil semua link dari artikel yang di-fetch
    const fetchedLinks = allArticles.map(article => article.link);
    
    // Tanyakan ke Supabase link mana yang sudah ada
    const existingLinks = await findExistingLinks(fetchedLinks);

    // Filter untuk mendapatkan hanya artikel yang benar-benar baru
    const newArticles = allArticles.filter(article => !existingLinks.has(article.link));
    
    console.log(`- Ditemukan ${newArticles.length} artikel baru untuk diproses.`);
    // =================================================================

    // Jika tidak ada artikel baru, kita bisa lewati proses AI dan langsung kirim notifikasi
    if (newArticles.length === 0) {
        console.log('Tidak ada artikel baru. Melewati tahap kategorisasi dan peringkasan.');
    } else {
        // 2. Categorizer Agent (HANYA MEMPROSES ARTIKEL BARU)
        console.log('Categorizer Agent: Memulai kategorisasi dengan batch processing...');
        
        const BATCH_SIZE = 8;
        const DELAY_BETWEEN_BATCHES = 61000;
        const categorizedArticles = [];

        for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
            const batch = newArticles.slice(i, i + BATCH_SIZE);
            console.log(`- Memproses batch ${Math.floor(i / BATCH_SIZE) + 1} (artikel ${i + 1} sampai ${i + batch.length})`);

            const categorizationPromises = batch.map(categorizeArticle);
            const batchResults = await Promise.all(categorizationPromises);
            categorizedArticles.push(...batchResults);

            if (i + BATCH_SIZE < newArticles.length) {
                console.log(`- Jeda ${DELAY_BETWEEN_BATCHES / 1000} detik sebelum batch berikutnya...`);
                await delay(DELAY_BETWEEN_BATCHES);
            }
        }
        console.log('Categorizer Agent: Selesai.');

        // 3. Summarizer Agent (HANYA MEMPROSES ARTIKEL BARU)
        await processAndStoreSummaries(categorizedArticles);
    }
    
    // 4. Notifier Agent (tetap berjalan untuk mengirim ringkasan terbaru)
    console.log('===== Memulai Tahap Notifikasi =====');
    await sendTelegramNotification();

    console.log('===== Alur Kerja Selesai =====');
}

// Jalankan sekali saat aplikasi dimulai
runWorkflow();

// Jadwalkan untuk berjalan setiap hari pada jam 5 pagi.
cron.schedule('0 5 * * *', () => {
    console.log(`⏰ Menjalankan siklus terjadwal harian pada jam 5 pagi... [${new Date().toISOString()}]`);
    runWorkflow();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta" // <-- PENTING: Tentukan zona waktu!
});