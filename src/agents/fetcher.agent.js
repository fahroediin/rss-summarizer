const Parser = require('rss-parser');
const config = require('../config/environment'); // <-- Impor konfigurasi

const parser = new Parser();

// Gunakan daftar RSS dari file konfigurasi
const RSS_FEEDS = config.rssFeedUrls;

async function fetchArticles() {
    console.log('Fetcher Agent: Memulai pengambilan artikel...');

    if (!RSS_FEEDS || RSS_FEEDS.length === 0) {
        console.warn('⚠️ Tidak ada URL RSS yang dikonfigurasi di file .env. Melewati tahap fetching.');
        return [];
    }

    let allArticles = [];
    for (const url of RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(url.trim()); // .trim() untuk jaga-jaga jika ada spasi
            feed.items.forEach(item => {
                allArticles.push({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    snippet: item.contentSnippet || item.content,
                    source: feed.title,
                });
            });
        } catch (error) {
            console.error(`Gagal mengambil dari URL: ${url}`, error.message);
        }
    }
    console.log(`Fetcher Agent: Selesai. Total artikel diambil: ${allArticles.length}`);
    return allArticles;
}

module.exports = { fetchArticles };