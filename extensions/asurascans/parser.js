// Asura Scans Parser

function getMangaList(html, options) {
    // options: { page, filters }
    let result = [];
    let debug = [];

    // 1. Основной паттерн для карточек манги
    const mangaPattern = /<a[^>]+href="\/series\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = mangaPattern.exec(html)) !== null) {
        let block = match[1];
        let url = (block.match(/<a[^>]+href="([^"]+)"/) || [])[1] || "";
        let title = (block.match(/<h3[^>]*>([^<]+)<\/h3>/) || [])[1] || "";
        let cover = (block.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
        
        if (url && title && cover) {
            if (!url.startsWith("http")) url = "https://asuracomic.net" + url;
            if (!cover.startsWith("http")) cover = "https://asuracomic.net" + cover;
            result.push({ 
                title: title.trim(),
                url: url,
                cover: cover
            });
        }
    }

    // 2. Альтернативный паттерн для карточек
    if (result.length === 0) {
        const altPattern = /<div[^>]+class="[^"]*manga-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        while ((match = altPattern.exec(html)) !== null) {
            let block = match[1];
            let url = (block.match(/<a[^>]+href="([^"]+)"/) || [])[1] || "";
            let title = (block.match(/<h4[^>]*>([^<]+)<\/h4>/) || [])[1] || "";
            let cover = (block.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
            
            if (url && title && cover) {
                if (!url.startsWith("http")) url = "https://asuracomic.net" + url;
                if (!cover.startsWith("http")) cover = "https://asuracomic.net" + cover;
                result.push({ 
                    title: title.trim(),
                    url: url,
                    cover: cover
                });
            }
        }
    }

    // Лог для отладки
    if (typeof console !== 'undefined') {
        console.log('[ASURA DEBUG] Найдено манги:', result.length);
        if (result.length > 0) console.log('[ASURA DEBUG] Первая манга:', result[0]);
    }

    // Проверка наличия следующей страницы
    let hasMore = /<a[^>]*class="[^"]*next[^"]*"[^>]*>Next<\/a>/.test(html);
    return {
        manga: result,
        has_more: hasMore
    };
}

function parseMangaDetails(html) {
    let result = {};
    
    // Заголовок
    result.title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || "";
    
    // Обложка
    result.cover = (html.match(/<img[^>]+alt="[^"]*cover[^"]*"[^>]+src="([^"]+)"/) || [])[1] || "";
    if (result.cover && !result.cover.startsWith("http")) {
        result.cover = "https://asuracomic.net" + result.cover;
    }
    
    // Описание
    result.description = (html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    result.description = result.description.replace(/<[^>]+>/g, '').trim();
    
    // Статус
    let statusMatch = html.match(/<div[^>]+class="[^"]*status[^"]*"[^>]*>([^<]+)<\/div>/);
    if (statusMatch) {
        let status = statusMatch[1].toLowerCase();
        if (status.includes('ongoing')) result.status = 'ongoing';
        else if (status.includes('completed')) result.status = 'completed';
        else if (status.includes('hiatus')) result.status = 'hiatus';
        else if (status.includes('dropped')) result.status = 'dropped';
        else result.status = 'unknown';
    } else {
        result.status = 'unknown';
    }
    
    // Автор и художник
    result.author = (html.match(/<div[^>]+class="[^"]*author[^"]*"[^>]*>([^<]+)<\/div>/) || [])[1] || "Unknown";
    result.artist = (html.match(/<div[^>]+class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/div>/) || [])[1] || "Unknown";
    
    // Жанры
    result.genres = [];
    const genrePattern = /<a[^>]+class="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/g;
    let genreMatch;
    while ((genreMatch = genrePattern.exec(html)) !== null) {
        result.genres.push(genreMatch[1].trim());
    }
    
    // Главы
    result.chapters = [];
    const chapterPattern = /<a[^>]+href="\/chapter\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let chapterMatch;
    while ((chapterMatch = chapterPattern.exec(html)) !== null) {
        let chapterBlock = chapterMatch[1];
        let url = (chapterBlock.match(/<a[^>]+href="([^"]+)"/) || [])[1] || "";
        let title = chapterBlock.replace(/<[^>]+>/g, '').trim();
        
        if (url && title) {
            if (!url.startsWith("http")) url = "https://asuracomic.net" + url;
            
            // Извлекаем номер главы
            let numberMatch = title.match(/Chapter\s+(\d+(\.\d+)?)/i) || url.match(/chapter[/-](\d+(\.\d+)?)/i);
            let number = numberMatch ? parseFloat(numberMatch[1]) : result.chapters.length + 1;
            
            result.chapters.push({
                id: url.split('/').pop(),
                title: title,
                number: number,
                url: url
            });
        }
    }
    
    return result;
}

function parseChapterPages(html) {
    let pages = [];
    
    // Ищем изображения в HTML
    const imgPattern = /<img[^>]+class="[^"]*chapter-image[^"]*"[^>]+src="([^"]+)"/g;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
        let url = imgMatch[1];
        if (url) {
            pages.push({
                index: pages.length + 1,
                url: url
            });
        }
    }
    
    // Если не нашли изображения в HTML, ищем в скриптах
    if (pages.length === 0) {
        const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/g;
        let scriptMatch;
        while ((scriptMatch = scriptPattern.exec(html)) !== null) {
            let scriptContent = scriptMatch[1];
            if (scriptContent.includes('"pages":[')) {
                let pagesMatch = scriptContent.match(/"pages":\[(.*?)\]/);
                if (pagesMatch) {
                    try {
                        let pagesData = JSON.parse('[' + pagesMatch[1] + ']');
                        pagesData.forEach((page, index) => {
                            if (page.url) {
                                pages.push({
                                    index: index + 1,
                                    url: page.url.replace(/\\\//g, '/')
                                });
                            }
                        });
                        break;
                    } catch (e) {
                        console.error('Failed to parse pages data:', e);
                    }
                }
            }
        }
    }
    
    return pages;
}

// Экспортируем функции
globalThis.getMangaList = getMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
