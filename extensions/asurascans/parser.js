// AsuraScans Parser
const BASE_URL = "https://asuracomic.net";

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
    return {
        url: url,
        manga: [],
        hasMore: false
    };
}

function getMangaDetails(mangaId) {
    const url = getMangaUrl(mangaId);
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return {
        url: url,
        id: mangaId,
        title: "",
        coverURL: "",
        author: "",
        description: "",
        tags: [],
        status: "Unknown"
    };
}

function getChapterList(mangaId) {
    const url = getMangaUrl(mangaId);
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return [];
}

function getChapterPages(chapterId, mangaId) {
    const url = getChapterUrl(chapterId, mangaId);
    
    // В JavaScriptCore нет fetch, поэтому возвращаем URL для загрузки
    return [];
}

// Функции для парсинга HTML (вызываются из Swift)
function parseMangaList(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const mangas = [];
    const mangaElements = doc.querySelectorAll("div.grid > a[href]");
    
    mangaElements.forEach(element => {
        const rawUrl = element.href;
        const id = getMangaId(rawUrl);
        if (!id) return;
        
        const cover = element.querySelector("img")?.src || "";
        const title = element.querySelector("div.block > span.block")?.textContent?.trim() || "";
        
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
    });
    
    const hasMore = doc.querySelector("div.flex > a.flex.bg-themecolor:contains(Next)") !== null;
    
    return JSON.stringify({
        manga: mangas,
        hasMore: hasMore
    });
}

function parseMangaDetails(html, mangaId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const wrapper = doc.querySelector("div.grid.grid-cols-12");
    if (!wrapper) return JSON.stringify(null);
    
    const cover = wrapper.querySelector("img[alt=poster]")?.src || "";
    const title = wrapper.querySelector("span.text-xl.font-bold")?.textContent?.trim() || "";
    
    let author = "";
    const authorElement = wrapper.querySelector("div:has(h3:eq(0):containsOwn(Author)) > h3:eq(1)");
    if (authorElement) {
        author = authorElement.textContent?.trim() || "";
        if (author === "_") author = "";
    }
    
    let artist = "";
    const artistElement = wrapper.querySelector("div:has(h3:eq(0):containsOwn(Artist)) > h3:eq(1)");
    if (artistElement) {
        artist = artistElement.textContent?.trim() || "";
        if (artist === "_") artist = "";
    }
    
    const description = wrapper.querySelector("span.font-medium.text-sm")?.textContent?.trim() || "";
    
    const tags = [];
    const genreElements = wrapper.querySelectorAll("div[class^=space] > div.flex > button.text-white");
    genreElements.forEach(element => {
        const genre = element.textContent?.trim();
        if (genre) tags.push(genre);
    });
    
    let status = "Unknown";
    const statusElement = wrapper.querySelector("div.flex:has(h3:eq(0):containsOwn(Status)) > h3:eq(1)");
    if (statusElement) {
        const statusText = statusElement.textContent?.trim() || "";
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
        artist: artist,
        description: description,
        tags: tags,
        status: status
    });
}

function parseChapterList(html, mangaId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const chapters = [];
    const chapterElements = doc.querySelectorAll("div.scrollbar-thumb-themecolor > div.group");
    
    chapterElements.forEach(element => {
        // Check if chapter is unlocked (no lock icon)
        const lockIcon = element.querySelector("h3 > span > svg");
        if (lockIcon) return; // Skip locked chapters
        
        const linkElement = element.querySelector("a");
        if (!linkElement) return;
        
        const rawUrl = linkElement.href;
        const chapterId = getChapterId(rawUrl);
        const mangaIdFromUrl = getMangaId(rawUrl);
        
        if (!chapterId || !mangaIdFromUrl) return;
        
        const url = getChapterUrl(chapterId, mangaIdFromUrl);
        
        // Get chapter title
        const titleElement = element.querySelector("h3 > span");
        const title = titleElement?.textContent?.trim() || "";
        
        // Get chapter number
        const chapterText = element.querySelector("h3.text-sm")?.textContent?.trim() || "";
        const chapterNumber = parseFloat(chapterText.replace(title, "").replace("Chapter", "").trim()) || -1;
        
        // Get date
        const dateElement = element.querySelector("h3:not(:has(*))");
        let date = null;
        if (dateElement) {
            const dateText = dateElement.textContent?.trim() || "";
            // Simple date parsing - you might want to improve this
            try {
                date = new Date(dateText).toISOString();
            } catch (e) {
                date = null;
            }
        }
        
        chapters.push({
            id: chapterId,
            title: title,
            url: url,
            number: chapterNumber,
            volume: null,
            scanlator: null,
            uploadDate: date
        });
    });
    
    return JSON.stringify(chapters);
}

function parseChapterPages(html) {
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
