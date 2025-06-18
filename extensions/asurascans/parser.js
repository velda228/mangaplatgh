// AsuraScans Parser
const BASE_URL = "https://asuracomic.net/";

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
    const url = `${BASE_URL}/series?page=${page}`;
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return JSON.stringify({
        url: url,
        manga: [],
        hasMore: false
    });
}

function getMangaDetails(mangaId) {
    const url = getMangaUrl(mangaId);
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
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
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return JSON.stringify([]);
}

function getChapterPages(chapterId, mangaId) {
    const url = getChapterUrl(chapterId, mangaId);
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return JSON.stringify([]);
}

// Функции для парсинга HTML (вызываются из Swift)
function parseMangaList(html) {
    try {
        console.log("Starting parseMangaList");
        
        // Простой парсинг с помощью регулярных выражений
        const mangas = [];
        
        // Проверяем, есть ли манга в HTML
        if (!html.includes('series/')) {
            console.log("No series links found in HTML");
            return JSON.stringify({
                manga: [],
                hasMore: false
            });
        }
        
        // Паттерн для поиска манги - более гибкий
        const pattern = /<a[^>]+href="[^"]*series\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
        let match;
        let matchCount = 0;
        
        while ((match = pattern.exec(html)) !== null) {
            matchCount++;
            const id = match[1];
            const cover = match[2].startsWith("http") ? match[2] : `https://gg.asuracomic.net${match[2]}`;
            const title = match[3].trim();
            
            console.log(`Found manga ${matchCount}: ${title} (${id})`);
            
            mangas.push({
                id: id,
                title: title,
                url: getMangaUrl(id),
                coverURL: cover,
                author: null,
                status: null,
                description: null,
                tags: []
            });
        }
        
        console.log(`Total manga found: ${mangas.length}`);
        
        const hasMore = html.includes('class="flex bg-themecolor"') && html.includes('Next');
        
        const result = {
            manga: mangas,
            hasMore: hasMore
        };
        
        console.log("Returning result:", JSON.stringify(result));
        return JSON.stringify(result);
    } catch (error) {
        console.log("Error parsing manga list:", error);
        return JSON.stringify({
            manga: [],
            hasMore: false
        });
    }
}

function parseMangaDetails(html, mangaId) {
    try {
        // Простой парсинг с помощью регулярных выражений
        const coverMatch = html.match(/<img[^>]+alt="poster"[^>]+src="([^"]+)"/);
        const cover = coverMatch ? coverMatch[1] : "";
        
        const titleMatch = html.match(/<span class="text-xl font-bold">([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        const authorMatch = html.match(/<h3[^>]*>Author<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        let author = "";
        if (authorMatch) {
            author = authorMatch[1].trim();
            if (author === "_") author = "";
        }
        
        const descMatch = html.match(/<span class="font-medium text-sm">([^<]+)<\/span>/);
        const description = descMatch ? descMatch[1].trim() : "";
        
        const tags = [];
        const genrePattern = /<button[^>]*class="[^"]*text-white[^"]*"[^>]*>([^<]+)<\/button>/g;
        let genreMatch;
        while ((genreMatch = genrePattern.exec(html)) !== null) {
            tags.push(genreMatch[1].trim());
        }
        
        let status = "Unknown";
        const statusMatch = html.match(/<h3[^>]*>Status<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        if (statusMatch) {
            const statusText = statusMatch[1].trim();
            switch (statusText) {
                case "Ongoing": status = "Ongoing"; break;
                case "Hiatus": status = "Hiatus"; break;
                case "Completed": status = "Completed"; break;
                case "Dropped": status = "Cancelled"; break;
                case "Season End": status = "Hiatus"; break;
                default: status = "Unknown";
            }
        }
        
        return JSON.stringify({
            id: mangaId,
            title: title,
            url: getMangaUrl(mangaId),
            coverURL: cover,
            author: author,
            artist: "",
            description: description,
            tags: tags,
            status: status
        });
    } catch (error) {
        console.log("Error parsing manga details:", error);
        return JSON.stringify(null);
    }
}

function parseChapterList(html, mangaId) {
    try {
        const chapters = [];
        
        // Паттерн для поиска глав
        const pattern = /<div class="group">[\s\S]*?<a[^>]+href="([^"]+)">[\s\S]*?<h3[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
            const rawUrl = match[1];
            const title = match[2].trim();
            
            // Пропускаем заблокированные главы
            if (html.includes('<svg') && html.indexOf('<svg') < html.indexOf(rawUrl)) {
                continue;
            }
            
            const chapterId = getChapterId(rawUrl);
            if (!chapterId) continue;
            
            const url = getChapterUrl(chapterId, mangaId);
            
            // Извлекаем номер главы
            const numberMatch = html.match(/Chapter\s*([0-9.]+)/);
            const chapterNumber = numberMatch ? parseFloat(numberMatch[1]) : -1;
            
            chapters.push({
                id: chapterId,
                title: title,
                url: url,
                number: chapterNumber,
                volume: null,
                scanlator: null,
                uploadDate: null
            });
        }
        
        return JSON.stringify(chapters);
    } catch (error) {
        console.log("Error parsing chapter list:", error);
        return JSON.stringify([]);
    }
}

function parseChapterPages(html) {
    try {
        // Remove script tags that might interfere with parsing
        html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        
        const pages = [];
        const pageMatches = html.match(/https:\/\/gg\.asuracomic\.net\/storage\/media\/[^"]+/g);
        
        if (pageMatches) {
            pageMatches.forEach((pageUrl, index) => {
                pages.push(pageUrl);
            });
        }
        
        return JSON.stringify(pages);
    } catch (error) {
        console.log("Error parsing chapter pages:", error);
        return JSON.stringify([]);
    }
}

// Export functions for WASM interface
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getMangaList,
        getMangaDetails,
        getChapterList,
        getChapterPages,
        parseMangaList,
        parseMangaDetails,
        parseChapterList,
        parseChapterPages
    };
} 
