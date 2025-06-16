function getMangaList(html, options) {
    // options: { page, filters }
    let result = [];

    // 1. Каталог: <div class="c-tabs-item__content">
    const madaraPattern = /<div class="c-tabs-item__content"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    while ((match = madaraPattern.exec(html)) !== null) {
        let block = match[1];
        let urlMatch = block.match(/<a[^>]+href=\"([^\"]+)\"/);
        let url = urlMatch ? urlMatch[1] : "";
        let titleMatch = block.match(/<a[^>]+title=\"([^\"]+)\"/);
        let title = titleMatch ? titleMatch[1].trim() : "";
        let coverMatch = block.match(/<img[^>]+src=\"([^\"]+)\"/);
        let cover = coverMatch ? coverMatch[1] : "";
        if (url && cover && title) {
            if (!url.startsWith("http")) url = "https://madarascans.com" + url;
            if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
            result.push({ title, url, cover });
        }
    }

    // 2. Главная: .bsx (если каталог пуст)
    if (result.length === 0) {
        const bsxPattern = /<div class=\"bsx[^\"]*\">([\s\S]*?)<\/div>\s*<\/div>/g;
        while ((match = bsxPattern.exec(html)) !== null) {
            let block = match[1];
            let urlMatch = block.match(/<a[^>]+href=\"([^\"]+)\"[^>]*title=\"([^\"]+)\"/);
            let url = urlMatch ? urlMatch[1] : "";
            let title = urlMatch ? urlMatch[2].trim() : "";
            if (!title) {
                let ttMatch = block.match(/<div class=\"tt\">([\s\S]*?)<\/div>/);
                title = ttMatch ? ttMatch[1].replace(/<[^>]+>/g, '').trim() : "";
            }
            let coverMatch = block.match(/<img[^>]+data-src=\"([^\"]+)\"/) || block.match(/<img[^>]+src=\"([^\"]+)\"/);
            let cover = coverMatch ? coverMatch[1] : "";
            if (url && cover && title) {
                if (!url.startsWith("http")) url = "https://madarascans.com" + url;
                if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
                result.push({ title, url, cover });
            }
        }
    }

    // Проверка наличия следующей страницы (по кнопке Next)
    let hasMore = /<a[^>]*class=\"next page-numbers\"[^>]*>Next<\/a>/.test(html);
    return {
        manga: result,
        has_more: hasMore
    };
} 
