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

// Функции для парсинга HTML
function parseMangaList(html) {
    try {
        const mangas = [];
        
        // Паттерн для поиска манги в Madara
        const pattern = /<a[^>]+href="[^"]*series\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            const cover = match[2].startsWith("http") ? match[2] : `${BASE_URL}${match[2]}`;
            const title = match[3].trim();
            
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
        
        const hasMore = html.includes('class="next') || html.includes('Next');
        
        return JSON.stringify({
            manga: mangas,
            hasMore: hasMore
        });
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
        const coverMatch = html.match(/<img[^>]+class="[^"]*poster[^"]*"[^>]+src="([^"]+)"/);
        const cover = coverMatch ? coverMatch[1] : "";
        
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        const authorMatch = html.match(/<span[^>]*>Author[^<]*<\/span>[^<]*<span[^>]*>([^<]+)<\/span>/);
        const author = authorMatch ? authorMatch[1].trim() : "";
        
        const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/);
        const description = descMatch ? descMatch[1].trim() : "";
        
        const tags = [];
        const genrePattern = /<a[^>]+href="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/g;
        let genreMatch;
        while ((genreMatch = genrePattern.exec(html)) !== null) {
            tags.push(genreMatch[1].trim());
        }
        
        let status = "Unknown";
        const statusMatch = html.match(/<span[^>]*>Status[^<]*<\/span>[^<]*<span[^>]*>([^<]+)<\/span>/);
        if (statusMatch) {
            const statusText = statusMatch[1].trim();
            switch (statusText.toLowerCase()) {
                case "ongoing": status = "Ongoing"; break;
                case "hiatus": status = "Hiatus"; break;
                case "completed": status = "Completed"; break;
                case "dropped": status = "Cancelled"; break;
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
        
        // Паттерн для поиска глав в Madara
        const pattern = /<a[^>]+href="[^"]*chapter\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
            const chapterId = match[1];
            const title = match[2].trim();
            
            const url = getChapterUrl(chapterId, mangaId);
            
            // Извлекаем номер главы
            const numberMatch = title.match(/Chapter\s*([0-9.]+)/i);
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
        
        // Ищем изображения в различных форматах
        const imgPatterns = [
            /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]+src="([^"]+)"/g,
            /<img[^>]+src="([^"]*\.(jpg|jpeg|png|webp))"[^>]*>/g,
            /data-src="([^"]*\.(jpg|jpeg|png|webp))"/g
        ];
        
        for (const pattern of imgPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const pageUrl = match[1];
                if (pageUrl && !pages.includes(pageUrl)) {
                    pages.push(pageUrl);
                }
            }
        }
        
        return JSON.stringify(pages);
    } catch (error) {
        console.log("Error parsing chapter pages:", error);
        return JSON.stringify([]);
    }
}

// Export functions
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
