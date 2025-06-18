// Madara Scans Parser
console.log("Madara parser loaded successfully");

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

function parseMangaList(html) {
    console.log("parseMangaList called with HTML length:", html.length);
    
    if (!html) {
        console.log("No HTML provided");
        return JSON.stringify({ manga: [], hasMore: false });
    }
    
    // Очищаем HTML от проблемных символов
    const cleanHTML = cleanHtml(html);
    console.log("Looking for manga patterns...");
    
    const manga = [];
    
    try {
        // Паттерн 1: Поиск ссылок на мангу в формате /series/name
        const seriesPattern = /href="\/series\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = seriesPattern.exec(cleanHTML)) !== null) {
            const id = match[1];
            const title = match[2].trim();
            
            // Проверяем, что это действительно манга, а не навигация
            if (title && title.length > 2 && !title.includes('Page') && !title.includes('Next') && !title.includes('Previous')) {
                const mangaItem = {
                    id: id,
                    title: title,
                    url: `https://madarascans.com/series/${id}`,
                    coverURL: null,
                    author: null,
                    status: null,
                    description: null,
                    tags: []
                };
                
                // Ищем обложку для этой манги
                const coverPattern = new RegExp(`href="\/series\/${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*<img[^>]*src="([^"]+)"`, 'i');
                const coverMatch = cleanHTML.match(coverPattern);
                if (coverMatch) {
                    mangaItem.coverURL = coverMatch[1];
                }
                
                // Проверяем, что манга еще не добавлена
                if (!manga.find(m => m.id === id)) {
                    manga.push(mangaItem);
                    console.log("Found manga:", title);
                }
            }
        }
        
        // Паттерн 2: Поиск в карточках манги
        const cardPattern = /<div[^>]*class="[^"]*manga[^"]*"[^>]*>.*?<a[^>]*href="\/series\/([^"]+)"[^>]*>([^<]+)<\/a>/gis;
        while ((match = cardPattern.exec(cleanHTML)) !== null) {
            const id = match[1];
            const title = match[2].trim();
            
            if (title && title.length > 2 && !manga.find(m => m.id === id)) {
                const mangaItem = {
                    id: id,
                    title: title,
                    url: `https://madarascans.com/series/${id}`,
                    coverURL: null,
                    author: null,
                    status: null,
                    description: null,
                    tags: []
                };
                
                // Ищем обложку в той же карточке
                const coverPattern = /<img[^>]*src="([^"]+)"[^>]*>/i;
                const coverMatch = match[0].match(coverPattern);
                if (coverMatch) {
                    mangaItem.coverURL = coverMatch[1];
                }
                
                manga.push(mangaItem);
                console.log("Found manga in card:", title);
            }
        }
        
        // Паттерн 3: Поиск в списках
        const listPattern = /<li[^>]*>.*?<a[^>]*href="\/series\/([^"]+)"[^>]*>([^<]+)<\/a>/gis;
        while ((match = listPattern.exec(cleanHTML)) !== null) {
            const id = match[1];
            const title = match[2].trim();
            
            if (title && title.length > 2 && !manga.find(m => m.id === id)) {
                const mangaItem = {
                    id: id,
                    title: title,
                    url: `https://madarascans.com/series/${id}`,
                    coverURL: null,
                    author: null,
                    status: null,
                    description: null,
                    tags: []
                };
                
                manga.push(mangaItem);
                console.log("Found manga in list:", title);
            }
        }
        
        console.log(`Found ${manga.length} manga total`);
        
    } catch (error) {
        console.log("Error in parseMangaList:", error.message);
    }
    
    const result = {
        manga: manga,
        hasMore: false
    };
    
    console.log("Returning JSON:", JSON.stringify(result));
    return JSON.stringify(result);
}

function parseMangaDetails(html, url) {
    console.log("parseMangaDetails called for URL:", url);
    
    if (!html) {
        return JSON.stringify({});
    }
    
    const cleanHTML = cleanHtml(html);
    
    try {
        // Извлекаем ID из URL
        const idMatch = url.match(/series\/([^\/\?]+)/);
        const id = idMatch ? idMatch[1] : "";
        
        // Ищем название
        let title = "";
        const titleMatch = cleanHTML.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          cleanHTML.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1].trim();
        }
        
        // Ищем описание
        let description = "";
        const descMatch = cleanHTML.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         cleanHTML.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }
        
        // Ищем автора
        let author = "";
        const authorMatch = cleanHTML.match(/Author[^:]*:\s*<[^>]*>([^<]+)<\/[^>]*>/i) ||
                           cleanHTML.match(/Author[^:]*:\s*([^<\n]+)/i);
        if (authorMatch) {
            author = authorMatch[1].trim();
        }
        
        // Ищем статус
        let status = "";
        const statusMatch = cleanHTML.match(/Status[^:]*:\s*<[^>]*>([^<]+)<\/[^>]*>/i) ||
                           cleanHTML.match(/Status[^:]*:\s*([^<\n]+)/i);
        if (statusMatch) {
            status = statusMatch[1].trim();
        }
        
        // Ищем обложку
        let coverURL = "";
        const coverMatch = cleanHTML.match(/<img[^>]*class="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i) ||
                          cleanHTML.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*cover[^"]*"/i);
        if (coverMatch) {
            coverURL = coverMatch[1];
        }
        
        // Ищем теги
        const tags = [];
        const tagMatches = cleanHTML.match(/<a[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/a>/gi);
        if (tagMatches) {
            tagMatches.forEach(tagMatch => {
                const tagText = tagMatch.replace(/<[^>]*>/g, '').trim();
                if (tagText && !tags.includes(tagText)) {
                    tags.push(tagText);
                }
            });
        }
        
        const result = {
            id: id,
            title: title,
            url: url,
            coverURL: coverURL,
            author: author,
            status: status,
            description: description,
            tags: tags
        };
        
        console.log("Manga details:", result);
        return JSON.stringify(result);
        
    } catch (error) {
        console.log("Error in parseMangaDetails:", error.message);
        return JSON.stringify({});
    }
}

function parseChapterList(html, url) {
    console.log("parseChapterList called for URL:", url);
    
    if (!html) {
        return JSON.stringify({ chapters: [] });
    }
    
    const cleanHTML = cleanHtml(html);
    const chapters = [];
    
    try {
        // Извлекаем ID манги из URL
        const mangaIdMatch = url.match(/series\/([^\/\?]+)/);
        const mangaId = mangaIdMatch ? mangaIdMatch[1] : "";
        
        // Ищем главы
        const chapterPattern = /<a[^>]*href="\/chapter\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = chapterPattern.exec(cleanHTML)) !== null) {
            const chapterId = match[1];
            const title = match[2].trim();
            
            if (title && title.length > 0) {
                const chapter = {
                    id: chapterId,
                    title: title,
                    url: `https://madarascans.com/chapter/${chapterId}`,
                    chapterNumber: null,
                    volumeNumber: null,
                    language: "en",
                    scanlator: null,
                    dateUploaded: null
                };
                
                // Извлекаем номер главы из названия
                const chapterNumMatch = title.match(/Chapter\s+(\d+(?:\.\d+)?)/i);
                if (chapterNumMatch) {
                    chapter.chapterNumber = parseFloat(chapterNumMatch[1]);
                }
                
                chapters.push(chapter);
                console.log("Found chapter:", title);
            }
        }
        
        // Сортируем главы по номеру
        chapters.sort((a, b) => {
            if (a.chapterNumber && b.chapterNumber) {
                return b.chapterNumber - a.chapterNumber;
            }
            return 0;
        });
        
        console.log(`Found ${chapters.length} chapters`);
        
    } catch (error) {
        console.log("Error in parseChapterList:", error.message);
    }
    
    const result = { chapters: chapters };
    console.log("Returning chapters:", JSON.stringify(result));
    return JSON.stringify(result);
}

function parseChapterPages(html, url) {
    console.log("parseChapterPages called for URL:", url);
    
    if (!html) {
        return JSON.stringify({ pages: [] });
    }
    
    const cleanHTML = cleanHtml(html);
    const pages = [];
    
    try {
        // Ищем изображения страниц
        const pagePattern = /<img[^>]*class="[^"]*wp-manga-chapter-img[^"]*"[^>]*src="([^"]+)"/gi;
        let match;
        
        while ((match = pagePattern.exec(cleanHTML)) !== null) {
            const imageUrl = match[1];
            
            if (imageUrl && imageUrl.length > 0) {
                const page = {
                    index: pages.length,
                    imageURL: imageUrl,
                    baseURL: null
                };
                
                pages.push(page);
                console.log("Found page:", imageUrl);
            }
        }
        
        // Альтернативный паттерн для изображений
        if (pages.length === 0) {
            const altPagePattern = /<img[^>]*src="([^"]+)"[^>]*class="[^"]*chapter[^"]*"/gi;
            while ((match = altPagePattern.exec(cleanHTML)) !== null) {
                const imageUrl = match[1];
                
                if (imageUrl && imageUrl.length > 0 && !imageUrl.includes('logo') && !imageUrl.includes('banner')) {
                    const page = {
                        index: pages.length,
                        imageURL: imageUrl,
                        baseURL: null
                    };
                    
                    pages.push(page);
                    console.log("Found page (alt):", imageUrl);
                }
            }
        }
        
        console.log(`Found ${pages.length} pages`);
        
    } catch (error) {
        console.log("Error in parseChapterPages:", error.message);
    }
    
    const result = { pages: pages };
    console.log("Returning pages:", JSON.stringify(result));
    return JSON.stringify(result);
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
