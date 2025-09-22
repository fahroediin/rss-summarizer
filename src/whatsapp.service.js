const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function getRecentSummaries() {
    const twentyFourHoursAgo = new Date(new Date() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('summaries')
        .select(`category, summary_text, articles ( title, link )`)
        .gte('created_at', twentyFourHoursAgo)
        .order('category', { ascending: true });

    if (error) {
        console.error("Error fetching summaries from Supabase:", error.message);
        return [];
    }
    return data;
}

async function initializeAndSend() {
    console.log('Notifier Agent: Menginisialisasi WhatsApp...');
    const summaries = await getRecentSummaries();
    if (summaries.length === 0) {
        console.log('Notifier Agent: Tidak ada ringkasan baru untuk dikirim. Melewati.');
        return;
    }

    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });

    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
        console.log('Pindai QR code ini dengan WhatsApp Anda, lalu tunggu...');
    });

    client.on('ready', async () => {
        console.log('Notifier Agent: WhatsApp client siap!');
        let message = `*Ringkasan Berita Terkini* ☀️\n\nBerikut adalah rangkuman dari berbagai sumber berita dalam 24 jam terakhir:\n--------------------\n\n`;

        for (const summary of summaries) {
            message += `*Kategori: ${summary.category}*\n${summary.summary_text}\n\n_Sumber Berita Terkait:_\n`;
            summary.articles.slice(0, 3).forEach(article => {
                message += `- _${article.title}_\n`;
            });
            message += `--------------------\n\n`;
        }

        try {
            await client.sendMessage(config.whatsappTargetId, message);
            console.log(`✅ Ringkasan berhasil dikirim ke ${config.whatsappTargetId}`);
        } catch (error) {
            console.error(`❌ Gagal mengirim pesan WhatsApp:`, error.message);
        } finally {
            console.log('Notifier Agent: Menutup koneksi WhatsApp.');
            await client.destroy();
        }
    });

    await client.initialize();
}

module.exports = { initializeAndSend };