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

// CSS Selector helper functions
function select(html, selector) {
    // Простая реализация CSS селекторов
    if (selector === "div.grid > a[href]") {
        return selectGridLinks(html);
    } else if (selector === "div.flex > a.flex.bg-themecolor:contains(Next)") {
        return selectNextButton(html);
    } else if (selector === "div.grid.grid-cols-12") {
        return selectWrapper(html);
    } else if (selector === "div.scrollbar-thumb-themecolor > div.group") {
        return selectChapterGroups(html);
    }
    return [];
}

function selectGridLinks(html) {
    const links = [];
    const pattern = /<div[^>]*class="[^"]*grid[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/g;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
        const linkHtml = match[0];
        const href = match[1];
        
        // Извлекаем img и span
        const imgMatch = linkHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        const spanMatch = linkHtml.match(/<span[^>]*class="[^"]*block[^"]*"[^>]*>([^<]+)<\/span>/);
        
        if (imgMatch && spanMatch) {
            links.push({
                href: href,
                img: imgMatch[1],
                title: spanMatch[1].trim()
            });
        }
    }
    
    return links;
}

function selectNextButton(html) {
    return html.includes('class="flex bg-themecolor"') && html.includes('Next') ? [1] : [];
}

function selectWrapper(html) {
    const wrapperMatch = html.match(/<div[^>]*class="[^"]*grid[^"]*[^"]*grid-cols-12[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    return wrapperMatch ? [wrapperMatch[1]] : [];
}

function selectChapterGroups(html) {
    const groups = [];
    const pattern = /<div[^>]*class="[^"]*scrollbar-thumb-themecolor[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*group[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
        groups.push(match[1]);
    }
    
    return groups;
}

// Main functions
function getMangaList(page = 1) {
    const url = `${BASE_URL}/series?page=${page}`;
    
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

// Функции для парсинга HTML (вызываются из Swift)
function parseMangaList(html) {
    try {
        const mangas = [];
        
        // Используем тот же селектор, что и в Rust коде
        const nodes = select(html, "div.grid > a[href]");
        
        for (const node of nodes) {
            const rawUrl = node.href;
            const id = getMangaId(rawUrl);
            if (!id) continue;
            
            const url = getMangaUrl(id);
            const cover = node.img.startsWith("http") ? node.img : `https://gg.asuracomic.net${node.img}`;
            const title = node.title;
            
            mangas.push({
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
        
        // Проверяем наличие кнопки "Next"
        const hasMore = select(html, "div.flex > a.flex.bg-themecolor:contains(Next)").length > 0;
        
        return JSON.stringify({
            manga: mangas,
            hasMore: hasMore
        });
    } catch (error) {
        return JSON.stringify({
            manga: [],
            hasMore: false
        });
    }
}

function parseMangaDetails(html, mangaId) {
    try {
        const wrapper = select(html, "div.grid.grid-cols-12");
        if (wrapper.length === 0) return JSON.stringify(null);
        
        const wrapperHtml = wrapper[0];
        
        // Извлекаем данные используя те же селекторы, что и в Rust
        const coverMatch = wrapperHtml.match(/<img[^>]+alt="poster"[^>]+src="([^"]+)"/);
        const cover = coverMatch ? coverMatch[1] : "";
        
        const titleMatch = wrapperHtml.match(/<span[^>]*class="[^"]*text-xl[^"]*[^"]*font-bold[^"]*"[^>]*>([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        // Author
        const authorMatch = wrapperHtml.match(/<h3[^>]*>Author<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        let author = "";
        if (authorMatch) {
            author = authorMatch[1].trim();
            if (author === "_") author = "";
        }
        
        // Artist
        const artistMatch = wrapperHtml.match(/<h3[^>]*>Artist<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        let artist = "";
        if (artistMatch) {
            artist = artistMatch[1].trim();
            if (artist === "_") artist = "";
        }
        
        // Description
        const descMatch = wrapperHtml.match(/<span[^>]*class="[^"]*font-medium[^"]*[^"]*text-sm[^"]*"[^>]*>([^<]+)<\/span>/);
        const description = descMatch ? descMatch[1].trim() : "";
        
        // Categories/Tags
        const tags = [];
        const genrePattern = /<button[^>]*class="[^"]*text-white[^"]*"[^>]*>([^<]+)<\/button>/g;
        let genreMatch;
        while ((genreMatch = genrePattern.exec(wrapperHtml)) !== null) {
            tags.push(genreMatch[1].trim());
        }
        
        // Status
        let status = "Unknown";
        const statusMatch = wrapperHtml.match(/<h3[^>]*>Status<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
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
            artist: artist,
            description: description,
            tags: tags,
            status: status
        });
    } catch (error) {
        return JSON.stringify(null);
    }
}

function parseChapterList(html, mangaId) {
    try {
        const chapters = [];
        
        // Используем тот же селектор, что и в Rust коде
        const nodes = select(html, "div.scrollbar-thumb-themecolor > div.group");
        
        for (const nodeHtml of nodes) {
            // Проверяем, что глава не заблокирована (нет SVG)
            if (nodeHtml.includes('<svg')) continue;
            
            // Извлекаем ссылку
            const linkMatch = nodeHtml.match(/<a[^>]+href="([^"]+)"/);
            if (!linkMatch) continue;
            
            const rawUrl = linkMatch[1];
            const chapterId = getChapterId(rawUrl);
            if (!chapterId) continue;
            
            const url = getChapterUrl(chapterId, mangaId);
            
            // Извлекаем заголовок
            const titleMatch = nodeHtml.match(/<h3[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
            const title = titleMatch ? titleMatch[1].trim() : "";
            
            // Извлекаем номер главы
            const chapterMatch = nodeHtml.match(/<h3[^>]*class="[^"]*text-sm[^"]*"[^>]*>([^<]+)<\/h3>/);
            let chapterNumber = -1;
            if (chapterMatch) {
                const chapterText = chapterMatch[1].replace(title, "").replace("Chapter", "").trim();
                chapterNumber = parseFloat(chapterText) || -1;
            }
            
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
        return JSON.stringify([]);
    }
}

function parseChapterPages(html) {
    try {
        // Remove script tags from hydration that can cut up the page list
        html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        
        const pages = [];
        
        // Find bounds of the page list (как в Rust коде)
        const pageListStart = html.indexOf('"pages":[{"order":1,"url":"https://gg.asuracomic.net/storage/media');
        if (pageListStart !== -1) {
            const pageListEnd = html.indexOf('}]', pageListStart);
            if (pageListEnd !== -1) {
                const pageListText = html.substring(pageListStart, pageListEnd);
                
                // Ищем все URL страниц
                const pageMatches = pageListText.match(/https:\/\/gg\.asuracomic\.net\/storage\/media\/[^"]+/g);
                if (pageMatches) {
                    pageMatches.forEach((pageUrl, index) => {
                        pages.push(pageUrl);
                    });
                }
            }
        }
        
        return JSON.stringify(pages);
    } catch (error) {
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
