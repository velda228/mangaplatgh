function getMangaList(html, options) {Add commentMore actions
    // options: { page, filters }
    let result = [];
    // Пример парсинга главной страницы Madara (список манги)
    // Каждый элемент манги находится в <div class="page-item-detail">
    const pattern = /<div class="page-item-detail[^\"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        let block = match[1];

        // Ссылка на мангу
        let urlMatch = block.match(/<a href=\"([^\"]+)\"/);
        let url = urlMatch ? urlMatch[1] : "";

        // Обложка
        let coverMatch = block.match(/data-src=\"([^\"]+)\"/) || block.match(/src=\"([^\"]+)\"/);
        let cover = coverMatch ? coverMatch[1] : "";

        // Название
        let titleMatch = block.match(/<h3 class=\"h5\">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        let title = titleMatch ? titleMatch[1].trim() : "";

        if (url && cover && title) {
            // Делаем абсолютные ссылки
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
