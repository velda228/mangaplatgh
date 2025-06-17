// Asura Scans Parser

function getMangaList(html, options) {
    // options: { page, filters }
    // filters: { title, genres: [], status, type, sort }
    let page = options && options.page ? options.page : 1;
    let filters = options && options.filters ? options.filters : {};

    console.log("[DEBUG] getMangaList: page=", page, "filters=", filters);
    console.log("[DEBUG] HTML length:", html.length);

    // --- Парсинг HTML ---
    const pattern = /<a href="series\/([^\"]+)">[\s\S]*?<img[^>]+src="([^\"]+)"[^>]*>[\s\S]*?<span class="block text-\[13\.3px\] font-bold">([^<]+)<\/span>/g;
    let result = [];
    let match;

    while ((match = pattern.exec(html)) !== null) {
        let mangaUrl = "/series/" + match[1];
        let fullMangaUrl = mangaUrl.startsWith("http") ? mangaUrl : "https://asuracomic.net" + mangaUrl;
        let coverUrl = match[2].startsWith("/") ? "https://gg.asuracomic.net" + match[2] : match[2];
        let title = match[3].trim();

        console.log("[DEBUG] Found manga:", { title, url: fullMangaUrl, cover: coverUrl });
        
        result.push({
            title: title,
            url: fullMangaUrl,
            cover: coverUrl
        });
    }

    console.log("[DEBUG] Total manga found:", result.length);
    if (result.length > 0) {
        console.log("[DEBUG] First manga:", result[0]);
    }

    // Проверка наличия следующей страницы
    let hasMore = /<a[^>]*class="flex bg-themecolor[^\"]*"[^>]*>Next<\/a>/.test(html);
    console.log("[DEBUG] Has more pages:", hasMore);

    return {
        manga: result,
        has_more: hasMore
    };
}

function parseMangaDetails(html) {
    console.log("[DEBUG] parseMangaDetails: HTML length=", html.length);

    // Извлекаем основную информацию
    const titleMatch = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const coverMatch = /<div[^>]*class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/i.exec(html);
    const cover = coverMatch ? coverMatch[1] : "";

    const descriptionMatch = /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
    const description = descriptionMatch ? descriptionMatch[1].replace(/<[^>]+>/g, '').trim() : "";

    // Извлекаем автора и статус
    let author = "Unknown";
    let artist = null;
    let status = "Unknown";

    const infoPattern = /<div[^>]*class="[^"]*fmed[^"]*"[^>]*>([^<]+)<\/div>\s*<div[^>]*class="[^"]*fmed[^"]*"[^>]*>([^<]+)<\/div>/g;
    let infoMatch;
    while ((infoMatch = infoPattern.exec(html)) !== null) {
        const label = infoMatch[1].toLowerCase();
        const value = infoMatch[2].trim();
        
        if (label.includes("author")) {
            author = value;
        } else if (label.includes("artist")) {
            artist = value;
        } else if (label.includes("status")) {
            status = value;
        }
    }

    // Извлекаем главы
    const chapters = [];
    const chapterPattern = /<li[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*chapternum[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/g;
    const numberPattern = /([0-9]+(?:\.[0-9]+)?)/;
    
    let chapterMatch;
    let index = 1;
    while ((chapterMatch = chapterPattern.exec(html)) !== null) {
        const url = chapterMatch[1];
        const title = chapterMatch[2].trim();
        
        // Извлекаем номер главы
        const numberMatch = numberPattern.exec(title);
        const number = numberMatch ? parseFloat(numberMatch[1]) : index;
        
        if (url && title) {
            chapters.push({
                url: url.startsWith("http") ? url : "https://asuracomic.net" + url,
                title: title,
                number: number
            });
        }
        index++;
    }

    // Извлекаем жанры
    const genres = [];
    const genrePattern = /<a[^>]*class="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/g;
    let genreMatch;
    while ((genreMatch = genrePattern.exec(html)) !== null) {
        genres.push(genreMatch[1].trim());
    }

    console.log("[DEBUG] Parsed manga details:", {
        title,
        cover,
        author,
        artist,
        status,
        description: description.substring(0, 100) + "...",
        chaptersCount: chapters.length,
        genresCount: genres.length
    });

    return {
        title,
        cover: cover.startsWith("http") ? cover : "https://gg.asuracomic.net" + cover,
        author,
        artist,
        description,
        status,
        genres,
        chapters
    };
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
