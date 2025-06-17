// Asura Scans Parser

function getMangaList(html, options) {
    console.log("[DEBUG] getMangaList: options=", options);
    console.log("[DEBUG] HTML length:", html.length);
    
    let result = [];

    // Используем тот же селектор, что и в Aidoku
    const mangaPattern = /<div class="grid[^"]*">([\s\S]*?)<\/div>/g;
    let gridMatch = mangaPattern.exec(html);
    
    if (gridMatch) {
        console.log("[DEBUG] Found grid container");
        let gridHtml = gridMatch[1];
        
        // Ищем все ссылки внутри grid
        const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        
        while ((match = linkPattern.exec(gridHtml)) !== null) {
            let url = match[1];
            let block = match[2];
            
            // Извлекаем обложку
            let coverMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/);
            let cover = coverMatch ? coverMatch[1] : null;
            
            // Извлекаем название (используем тот же селектор: div.block > span.block)
            let titleMatch = block.match(/<div[^>]*class="[^"]*block[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*block[^"]*"[^>]*>([^<]+)<\/span>/);
            let title = titleMatch ? titleMatch[1] : null;
            
            if (url && title && cover) {
                // Нормализуем URL
                if (!url.startsWith("http")) {
                    url = "https://asuracomic.net" + (url.startsWith("/") ? url : "/" + url);
                }
                
                // Нормализуем URL обложки
                if (!cover.startsWith("http")) {
                    cover = "https://gg.asuracomic.net" + (cover.startsWith("/") ? cover : "/" + cover);
                }
                
                console.log("[DEBUG] Found manga:", { title, url, cover });
                
                result.push({ 
                    title: title.trim(),
                    url: url,
                    cover: cover
                });
            }
        }
    }

    // Проверяем наличие кнопки Next (используя тот же селектор из Aidoku)
    let hasMore = /<div[^>]*class="[^"]*flex[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*flex[^"]*bg-themecolor[^"]*"[^>]*>[\s\S]*?Next[\s\S]*?<\/a>/.test(html);

    console.log("[DEBUG] Total manga found:", result.length);
    if (result.length > 0) {
        console.log("[DEBUG] First manga:", result[0]);
    }
    console.log("[DEBUG] Has more pages:", hasMore);

    return {
        manga: result,
        has_more: hasMore
    };
}

function parseMangaDetails(html) {
    console.log("[DEBUG] parseMangaDetails: HTML length=", html.length);
    
    let result = {};
    
    // Заголовок
    result.title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || "";
    console.log("[DEBUG] Title:", result.title);
    
    // Обложка
    result.cover = (html.match(/<img[^>]+alt="[^"]*cover[^"]*"[^>]+src="([^"]+)"/) || [])[1] || "";
    if (result.cover && !result.cover.startsWith("http")) {
        result.cover = "https://gg.asuracomic.net" + result.cover;
    }
    console.log("[DEBUG] Cover:", result.cover);
    
    // Описание
    result.description = (html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    result.description = result.description.replace(/<[^>]+>/g, '').trim();
    console.log("[DEBUG] Description length:", result.description.length);
    
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
    console.log("[DEBUG] Status:", result.status);
    
    // Автор и художник
    result.author = (html.match(/<div[^>]+class="[^"]*author[^"]*"[^>]*>([^<]+)<\/div>/) || [])[1] || "Unknown";
    result.artist = (html.match(/<div[^>]+class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/div>/) || [])[1] || "Unknown";
    console.log("[DEBUG] Author:", result.author);
    console.log("[DEBUG] Artist:", result.artist);
    
    // Жанры
    result.genres = [];
    const genrePattern = /<a[^>]+class="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/g;
    let genreMatch;
    while ((genreMatch = genrePattern.exec(html)) !== null) {
        result.genres.push(genreMatch[1].trim());
    }
    console.log("[DEBUG] Genres:", result.genres);
    
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
    console.log("[DEBUG] Chapters found:", result.chapters.length);
    
    return result;
}

function parseChapterPages(html) {
    console.log("[DEBUG] parseChapterPages: HTML length=", html.length);
    
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
    console.log("[DEBUG] Found images in HTML:", pages.length);
    
    // Если не нашли изображения в HTML, ищем в скриптах
    if (pages.length === 0) {
        console.log("[DEBUG] Looking for images in scripts");
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
                        console.log("[DEBUG] Found images in script:", pages.length);
                        break;
                    } catch (e) {
                        console.error("[DEBUG] Failed to parse pages data:", e);
                    }
                }
            }
        }
    }
    
    // Если все еще нет страниц, ищем по специфичному паттерну AsuraScans
    if (pages.length === 0) {
        console.log("[DEBUG] Looking for AsuraScans specific pattern");
        const asuraPattern = /"pages":\[(.*?)\]/;
        let asuraMatch = html.match(asuraPattern);
        if (asuraMatch) {
            try {
                let pagesData = JSON.parse('[' + asuraMatch[1] + ']');
                pagesData.forEach((page, index) => {
                    if (page.url) {
                        pages.push({
                            index: index + 1,
                            url: page.url.replace(/\\\//g, '/')
                        });
                    }
                });
                console.log("[DEBUG] Found images in AsuraScans pattern:", pages.length);
            } catch (e) {
                console.error("[DEBUG] Failed to parse AsuraScans pages:", e);
            }
        }
    }
    
    console.log("[DEBUG] Total pages found:", pages.length);
    return pages;
}

// Экспортируем функции
globalThis.getMangaList = getMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
