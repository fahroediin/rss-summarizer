const cron = require('node-cron');
const config = require('./src/config/environment');
const { fetchArticles } = require('./src/agents/fetcher.agent');
const { categorizeArticle } = require('./src/agents/categorizer.agent');
const { summarizePendingArticles } = require('./src/agents/summarizer.agent');
const { delay } = require('./src/utils/delay');
const { sendTelegramNotification } = require('./src/services/telegram.service');
const { findExistingLinks, saveCategorizedArticles } = require('./src/services/supabase.service');

/**
 * Alur Kerja 1: Ingestion
 * Mengambil, memfilter, mengkategorikan, dan menyimpan artikel baru.
 */
async function runIngestionWorkflow() {
    console.log('\n===== Memulai Alur Kerja Ingestion =====');
    const allArticles = await fetchArticles();
    if (allArticles.length === 0) {
        console.log('Ingestion: Tidak ada artikel ditemukan dari RSS.');
        return;
    }

    const fetchedLinks = allArticles.map(article => article.link);
    const existingLinks = await findExistingLinks(fetchedLinks);
    const newArticles = allArticles.filter(article => !existingLinks.has(article.link));
    
    if (newArticles.length === 0) {
        console.log('Ingestion: Tidak ada artikel baru untuk diproses.');
        return;
    }
    console.log(`Ingestion: Ditemukan ${newArticles.length} artikel baru. Memulai kategorisasi...`);

    const BATCH_SIZE = 8;
    const DELAY_BETWEEN_BATCHES = 61000;
    for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
        const batch = newArticles.slice(i, i + BATCH_SIZE);
        console.log(`- Memproses batch ${Math.floor(i / BATCH_SIZE) + 1} (artikel ${i + 1} sampai ${i + batch.length})`);
        const categorizationPromises = batch.map(categorizeArticle);
        const categorizedBatch = await Promise.all(categorizationPromises);
        
        await saveCategorizedArticles(categorizedBatch);

        if (i + BATCH_SIZE < newArticles.length) {
            console.log(`- Jeda ${DELAY_BETWEEN_BATCHES / 1000} detik sebelum batch berikutnya...`);
            await delay(DELAY_BETWEEN_BATCHES);
        }
    }
    console.log('===== Alur Kerja Ingestion Selesai =====');
}

/**
 * Alur Kerja 2: Summarization
 * Mengambil artikel yang tertunda dari DB dan meringkasnya.
 */
async function runSummarizationWorkflow() {
    console.log('\n===== Memulai Alur Kerja Summarization =====');
    await summarizePendingArticles();
    console.log('===== Alur Kerja Summarization Selesai =====');
}

/**
 * Alur Kerja 3: Notification
 * Mengirim ringkasan terbaru ke pengguna.
 */
async function runNotificationWorkflow() {
    console.log('\n===== Memulai Alur Kerja Notifikasi =====');
    await sendTelegramNotification();
    console.log('===== Alur Kerja Notifikasi Selesai =====');
}

/**
 * FUNGSI UTAMA UNTUK MENJALANKAN SEMUA ALUR KERJA SECARA BERURUTAN
 */
async function runFullCycle() {
    const startTime = Date.now();
    console.log(`\n\n🚀 MEMULAI SIKLUS LENGKAP: [${new Date().toISOString()}]`);
    
    await runIngestionWorkflow();
    await runSummarizationWorkflow();
    await runNotificationWorkflow();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n🏁 SIKLUS LENGKAP SELESAI. Durasi: ${duration} detik.`);
}


// --- CRON JOB ORCHESTRATOR ---
if (!cron.validate(config.cronSchedule)) {
    console.error(`❌ Jadwal cron "${config.cronSchedule}" tidak valid. Harap periksa file .env Anda.`);
    process.exit(1);
}

cron.schedule(config.cronSchedule, () => {
    // Fungsi di dalam cron sekarang hanya memanggil siklus penuh
    runFullCycle();
}, {
    scheduled: true,
    timezone: config.cronTimezone
});

console.log(`✅ Penjadwal (cron job) telah diaktifkan. Jadwal: "${config.cronSchedule}" di zona waktu "${config.cronTimezone}".`);

// =================================================================
// BAGIAN YANG HILANG SEBELUMNYA:
// Jalankan satu siklus penuh saat aplikasi pertama kali dimulai untuk testing/immediate run.
// =================================================================
runFullCycle();