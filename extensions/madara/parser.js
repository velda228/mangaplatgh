function getMangaList(html, options) {
    // options: { page, filters }
    let result = [];
    let debug = [];

    // 1. Каталог: <div class="c-tabs-item__content">
    const madaraPattern = /<div class="c-tabs-item__content"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    while ((match = madaraPattern.exec(html)) !== null) {
        let block = match[1];
        let url = (block.match(/<a[^>]+href=\"([^\"]+)\"/) || [])[1] || "";
        let title = (block.match(/<a[^>]+title=\"([^\"]+)\"/) || [])[1] || "";
        let cover = (block.match(/<img[^>]+src=\"([^\"]+)\"/) || [])[1] || "";
        if (url && title && cover) {
            if (!url.startsWith("http")) url = "https://madarascans.com" + url;
            if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
            result.push({ title, url, cover });
        }
    }

    // 2. Альтернатива: <div class="page-item-detail">
    if (result.length === 0) {
        const pageItemPattern = /<div class=\"page-item-detail[^\"]*\">([\s\S]*?)<\/div>/g;
        while ((match = pageItemPattern.exec(html)) !== null) {
            let block = match[1];
            let url = (block.match(/<a[^>]+href=\"([^\"]+)\"/) || [])[1] || "";
            let title = (block.match(/<a[^>]+title=\"([^\"]+)\"/) || [])[1] || "";
            let cover = (block.match(/<img[^>]+src=\"([^\"]+)\"/) || [])[1] || "";
            if (url && title && cover) {
                if (!url.startsWith("http")) url = "https://madarascans.com" + url;
                if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
                result.push({ title, url, cover });
            }
        }
    }

    // 3. Главная: .bsx (универсальный вариант)
    if (result.length === 0) {
        const bsxPattern = /<div class=\"bsx[^"]*\">([\s\S]*?)<\/div>\s*<\/div>/g;
        while ((match = bsxPattern.exec(html)) !== null) {
            let block = match[1];
            // Ссылка
            let url = (block.match(/<a[^>]+href=\"([^\"]+)\"/) || [])[1] || "";
            // Название: сначала ищем в .tt, если нет — в title
            let ttMatch = block.match(/<div class=\"tt\">([\s\S]*?)<\/div>/);
            let title = ttMatch ? ttMatch[1].replace(/<[^>]+>/g, '').trim() : "";
            if (!title) {
                let titleAttr = (block.match(/<a[^>]+title=\"([^\"]+)\"/) || [])[1] || "";
                title = titleAttr.trim();
            }
            // Обложка
            let coverMatch = block.match(/<img[^>]+src=\"([^\"]+)\"/);
            let cover = coverMatch ? coverMatch[1] : "";
            if (url && title && cover) {
                if (!url.startsWith("http")) url = "https://madarascans.com" + url;
                if (!cover.startsWith("http")) cover = "https://madarascans.com" + cover;
                result.push({ title, url, cover });
            }
        }
    }

    // Лог для отладки (можно удалить после теста)
    if (typeof console !== 'undefined') {
        console.log('[MADARA DEBUG] Найдено манги:', result.length);
        if (result.length > 0) console.log('[MADARA DEBUG] Первая манга:', result[0]);
    }

    // Проверка наличия следующей страницы (по кнопке Next)
    let hasMore = /<a[^>]*class=\"next page-numbers\"[^>]*>Next<\/a>/.test(html);
    return {
        manga: result,
        has_more: hasMore
    };
} 
