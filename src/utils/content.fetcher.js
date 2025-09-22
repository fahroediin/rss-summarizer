const Mercury = require('@postlight/mercury-parser');

async function fetchArticleContent(url) {
    try {
        console.log(`- Fetching content from: ${url}`);
        const result = await Mercury.parse(url);
        return result.textContent;
    } catch (error) {
        console.error(`Error fetching or parsing content for ${url}:`, error.message);
        return null;
    }
}

module.exports = { fetchArticleContent };