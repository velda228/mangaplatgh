// Madara Scans Parser
console.log("Madara parser loaded successfully");

// Madara Parser
const BASE_URL = "https://madarascans.com";

// Helper functions
function getMangaId(url) {
    const match = url.match(/series\/([^\/\?]+)/);
    return match ? match[1] : null;
}

function getMangaUrl(id) {
    return `${BASE_URL}/series/${id}`;
}

function getChapterId(url) {
    const match = url.match(/chapter\/([^\/\?]+)/);
    return match ? match[1] : null;
}

function getChapterUrl(chapterId, mangaId) {
    return `${BASE_URL}/series/${mangaId}/${chapterId}`;
}

// Main functions
function getMangaList(page = 1) {
    const url = `${BASE_URL}/series/?order=update&page=${page}`;
    
    return JSON.stringify({
        url: url,
        manga: [],
        hasMore: false
    });
}

function getMangaDetails(mangaId) {
    const url = getMangaUrl(mangaId);
    
    return JSON.stringify({
        url: url,
        id: mangaId,
        title: "",
        coverURL: "",
        author: "",
        description: "",
        tags: [],
        status: "Unknown"
    });
}

function getChapterList(mangaId) {
    const url = getMangaUrl(mangaId);
    
    return JSON.stringify([]);
}

function getChapterPages(chapterId, mangaId) {
    const url = getChapterUrl(chapterId, mangaId);
    
    return JSON.stringify([]);
}

// Функция для очистки HTML от проблемных символов
function cleanHtml(html) {
    if (!html) return "";
    
    // Заменяем проблемные символы на правильные
    return html
        .replace(/&#39;/g, "'")  // HTML entity для апострофа
        .replace(/&#x27;/g, "'") // hex entity для апострофа
        .replace(/&apos;/g, "'") // HTML entity для апострофа
        .replace(/&quot;/g, '"') // HTML entity для кавычек
        .replace(/&amp;/g, '&')  // HTML entity для амперсанда
        .replace(/&lt;/g, '<')   // HTML entity для <
        .replace(/&gt;/g, '>')   // HTML entity для >
        .replace(/&#8217;/g, "'") // Unicode для апострофа
        .replace(/&#8216;/g, "'") // Unicode для апострофа
        .replace(/&#8220;/g, '"') // Unicode для кавычек
        .replace(/&#8221;/g, '"'); // Unicode для кавычек
}

function testFunction() {
    console.log("testFunction called");
    return "Hello from Madara JavaScript!";
}

function parseMangaList(html) {
    console.log("parseMangaList called with HTML length:", html.length);
    
    try {
        // Очищаем HTML от проблемных символов
        html = cleanHtml(html);
        
        const result = [];
        
        // Отладочная информация - ищем различные паттерны
        console.log("Looking for manga patterns...");
        
        // Проверяем наличие различных контейнеров
        const hasPageItemDetail = html.includes('page-item-detail');
        const hasCTabsItemContent = html.includes('c-tabs-item__content');
        const hasMangaItem = html.includes('manga-item');
        
        console.log("HTML contains:", {
            pageItemDetail: hasPageItemDetail,
            cTabsItemContent: hasCTabsItemContent,
            mangaItem: hasMangaItem
        });
        
        // Пробуем разные паттерны для поиска манги
        let pattern;
        let foundPattern = "";
        
        // Паттерн 1: page-item-detail
        pattern = /<div class="page-item-detail[^\"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
        let match = pattern.exec(html);
        if (match) {
            foundPattern = "page-item-detail";
            console.log("Found manga using page-item-detail pattern");
        } else {
            // Паттерн 2: c-tabs-item__content
            pattern = /<div class="c-tabs-item__content"[^>]*>([\s\S]*?)<\/div>/g;
            match = pattern.exec(html);
            if (match) {
                foundPattern = "c-tabs-item__content";
                console.log("Found manga using c-tabs-item__content pattern");
            } else {
                // Паттерн 3: manga-item
                pattern = /<div class="manga-item"[^>]*>([\s\S]*?)<\/div>/g;
                match = pattern.exec(html);
                if (match) {
                    foundPattern = "manga-item";
                    console.log("Found manga using manga-item pattern");
                } else {
                    // Паттерн 4: общий поиск ссылок на мангу
                    pattern = /<a[^>]+href="[^"]*manga[^"]*"[^>]*>[\s\S]*?<\/a>/g;
                    match = pattern.exec(html);
                    if (match) {
                        foundPattern = "general manga links";
                        console.log("Found manga using general manga links pattern");
                    }
                }
            }
        }
        
        if (!foundPattern) {
            console.log("No manga pattern found, trying to extract sample HTML...");
            // Выводим часть HTML для анализа
            const sampleHtml = html.substring(0, 2000);
            console.log("Sample HTML:", sampleHtml);
            return JSON.stringify({
                manga: [],
                hasMore: false
            });
        }
        
        // Сбрасываем регулярное выражение
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(html)) !== null) {
            let block = match[1];
            console.log("Processing block:", block.substring(0, 200) + "...");

            // Ссылка на мангу - пробуем разные паттерны
            let urlMatch = block.match(/<a[^>]+href="([^"]*manga[^"]*)"/);
            let url = urlMatch ? urlMatch[1] : "";

            // Обложка - пробуем разные паттерны
            let coverMatch = block.match(/data-src="([^"]+)"/) || 
                           block.match(/src="([^"]+)"/) ||
                           block.match(/<img[^>]+src="([^"]+)"/);
            let cover = coverMatch ? coverMatch[1] : "";

            // Название - пробуем разные паттерны
            let titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/) ||
                           block.match(/<a[^>]*>([^<]+)<\/a>/) ||
                           block.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
            let title = titleMatch ? titleMatch[1].trim() : "";

            console.log("Extracted:", { url, cover, title });

            if (url && title) {
                // Делаем абсолютные ссылки
                if (!url.startsWith("http")) url = "https://madarascans.com" + url;
                if (cover && !cover.startsWith("http")) cover = "https://madarascans.com" + cover;
                
                // Извлекаем ID из URL
                const idMatch = url.match(/manga\/([^\/\?]+)/) || url.match(/series\/([^\/\?]+)/);
                const id = idMatch ? idMatch[1] : title.toLowerCase().replace(/\s+/g, '-');
                
                result.push({
                    id: id,
                    title: title,
                    url: url,
                    coverURL: cover,
                    author: null,
                    status: null,
                    description: null,
                    tags: []
                });
            }
        }

        // Проверка наличия следующей страницы
        let hasMore = /<a[^>]*class="[^"]*next[^"]*"[^>]*>Next<\/a>/.test(html) ||
                     /<a[^>]*class="[^"]*page-numbers[^"]*"[^>]*>Next<\/a>/.test(html);

        console.log("Found", result.length, "manga");
        
        const jsonResult = JSON.stringify({
            manga: result,
            hasMore: hasMore
        });
        
        console.log("Returning JSON:", jsonResult);
        
        return jsonResult;
    } catch (error) {
        console.log("Error in parseMangaList:", error);
        return JSON.stringify({
            manga: [],
            hasMore: false
        });
    }
}

function parseMangaDetails(html, mangaId) {
    console.log("parseMangaDetails called");
    
    try {
        // Очищаем HTML от проблемных символов
        html = cleanHtml(html);
        
        // Простой парсинг деталей манги для Madara
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        const authorMatch = html.match(/<span[^>]*>Author[^<]*<\/span>[^<]*<span[^>]*>([^<]+)<\/span>/);
        const author = authorMatch ? authorMatch[1].trim() : "";
        
        const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : "";
        
        const statusMatch = html.match(/<span[^>]*>Status[^<]*<\/span>[^<]*<span[^>]*>([^<]+)<\/span>/);
        const status = statusMatch ? statusMatch[1].trim() : "Unknown";
        
        // Теги/жанры
        const tags = [];
        const genrePattern = /<a[^>]*class="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/g;
        let genreMatch;
        while ((genreMatch = genrePattern.exec(html)) !== null) {
            tags.push(genreMatch[1].trim());
        }
        
        return JSON.stringify({
            id: mangaId,
            title: title,
            url: `https://madarascans.com/manga/${mangaId}`,
            coverURL: "",
            author: author,
            artist: "",
            description: description,
            tags: tags,
            status: status
        });
    } catch (error) {
        console.log("Error in parseMangaDetails:", error);
        return JSON.stringify(null);
    }
}

function parseChapterList(html, mangaId) {
    console.log("parseChapterList called");
    
    try {
        // Очищаем HTML от проблемных символов
        html = cleanHtml(html);
        
        const chapters = [];
        
        // Парсинг глав для Madara
        const chapterPattern = /<li[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        let match;
        
        while ((match = chapterPattern.exec(html)) !== null) {
            const url = match[1];
            const title = match[2].trim();
            
            // Извлекаем ID главы из URL
            const chapterIdMatch = url.match(/chapter\/([^\/\?]+)/);
            const chapterId = chapterIdMatch ? chapterIdMatch[1] : title.lowercase().replace(/\s+/g, '-');
            
            // Извлекаем номер главы
            const numberMatch = title.match(/Chapter\s*([0-9.]+)/i);
            const chapterNumber = numberMatch ? parseFloat(numberMatch[1]) : -1;
            
            chapters.push({
                id: chapterId,
                title: title,
                url: url.startsWith("http") ? url : `https://madarascans.com${url}`,
                number: chapterNumber,
                volume: null,
                scanlator: null,
                uploadDate: null
            });
        }
        
        console.log("Found", chapters.length, "chapters");
        
        return JSON.stringify(chapters);
    } catch (error) {
        console.log("Error in parseChapterList:", error);
        return JSON.stringify([]);
    }
}

function parseChapterPages(html) {
    console.log("parseChapterPages called");
    
    try {
        // Очищаем HTML от проблемных символов
        html = cleanHtml(html);
        
        const pages = [];
        
        // Парсинг страниц для Madara
        const pagePattern = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]+src="([^"]+)"/g;
        let match;
        
        while ((match = pagePattern.exec(html)) !== null) {
            const pageUrl = match[1];
            if (pageUrl && !pageUrl.includes('data:image')) {
                pages.push(pageUrl);
            }
        }
        
        console.log("Found", pages.length, "pages");
        
        return JSON.stringify(pages);
    } catch (error) {
        console.log("Error in parseChapterPages:", error);
        return JSON.stringify([]);
    }
}

console.log("All Madara functions defined");

// Export functions for WASM interface
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseMangaList,
        parseMangaDetails,
        parseChapterList,
        parseChapterPages,
        testFunction
    };
} 
