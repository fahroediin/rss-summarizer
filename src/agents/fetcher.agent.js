const Parser = require('rss-parser');
const parser = new Parser();

const RSS_FEEDS = [
   // 'https://www.theverge.com/rss/index.xml',
   // 'https://rss.detik.com/index.php/detikcom',
    'https://www.cnbcindonesia.com/news/rss'
    //'https://www.reuters.com/news/rss',
];

async function fetchArticles() {
    console.log('Fetcher Agent: Memulai pengambilan artikel...');
    let allArticles = [];
    for (const url of RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(url);
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