function getMangaList(html, options) {
    // options: { page, filters }
    let result = [];
    // Ищем все .bsx (с любыми классами)
    const bsxPattern = /<div class="bsx[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    while ((match = bsxPattern.exec(html)) !== null) {
        let block = match[1];
        // Ссылка и название (title)
        let urlMatch = block.match(/<a[^>]+href=\"([^\"]+)\"[^>]*title=\"([^\"]+)\"/);
        let url = urlMatch ? urlMatch[1] : "";
        let title = urlMatch ? urlMatch[2].trim() : "";
        // Если не нашли title, пробуем найти название из .tt
        if (!title) {
            let ttMatch = block.match(/<div class=\"tt\">([\s\S]*?)<\/div>/);
            title = ttMatch ? ttMatch[1].replace(/<[^>]+>/g, '').trim() : "";
        }
        // Обложка: сначала ищем data-src, потом src
        let coverMatch = block.match(/<img[^>]+data-src=\"([^\"]+)\"/) || block.match(/<img[^>]+src=\"([^\"]+)\"/);
        let cover = coverMatch ? coverMatch[1] : "";
        if (url && cover && title) {
            if (!url.startsWith("http")) url = "https://madarascans.com" + url;
            if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
            result.push({
                title: title,
                url: url,
                cover: cover
            });
        }
    }
    // Проверка наличия следующей страницы (по кнопке Next)
    let hasMore = /<a[^>]*class=\"next page-numbers\"[^>]*>Next<\/a>/.test(html);
    return {
        manga: result,
        has_more: hasMore
    };
} 
