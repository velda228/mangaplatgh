// Simple test parser for AsuraScans
console.log("Parser loaded successfully");

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
    return "Hello from JavaScript!";
}

function parseMangaList(html) {
    console.log("parseMangaList called with HTML length:", html.length);
    
    try {
        // Очищаем HTML от проблемных символов
        html = cleanHtml(html);
        
        const mangas = [];
        
        // Простой парсинг для тестирования
        const pattern = /<a href="series\/([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*block[^"]*"[^>]*>([^<]+)<\/span>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            const cover = match[2].startsWith("http") ? match[2] : `https://gg.asuracomic.net${match[2]}`;
            const title = match[3].trim();
            
            mangas.push({
                id: id,
                title: title,
                url: `https://asuracomic.net/series/${id}`,
                coverURL: cover,
                author: null,
                status: null,
                description: null,
                tags: []
            });
        }
        
        console.log("Found", mangas.length, "manga");
        
        const result = {
            manga: mangas,
            hasMore: html.includes('class="flex bg-themecolor"') && html.includes('Next')
        };
        
        const jsonResult = JSON.stringify(result);
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
        
        // Ищем основной контейнер как в Rust коде
        const wrapperMatch = html.match(/<div[^>]*class="[^"]*grid[^"]*[^"]*grid-cols-12[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
        if (!wrapperMatch) {
            console.log("Wrapper not found");
            return JSON.stringify(null);
        }
        
        const wrapperHtml = wrapperMatch[1];
        
        // Извлекаем данные используя те же селекторы, что и в Rust
        const coverMatch = wrapperHtml.match(/<img[^>]+alt="poster"[^>]+src="([^"]+)"/);
        const cover = coverMatch ? coverMatch[1] : "";
        
        const titleMatch = wrapperHtml.match(/<span[^>]*class="[^"]*text-xl[^"]*[^"]*font-bold[^"]*"[^>]*>([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        
        // Author - ищем div с h3 содержащим "Author"
        const authorMatch = wrapperHtml.match(/<h3[^>]*>Author<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        let author = "";
        if (authorMatch) {
            author = authorMatch[1].trim();
            if (author === "_") author = "";
        }
        
        // Artist - ищем div с h3 содержащим "Artist"
        const artistMatch = wrapperHtml.match(/<h3[^>]*>Artist<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        let artist = "";
        if (artistMatch) {
            artist = artistMatch[1].trim();
            if (artist === "_") artist = "";
        }
        
        // Description
        const descMatch = wrapperHtml.match(/<span[^>]*class="[^"]*font-medium[^"]*[^"]*text-sm[^"]*"[^>]*>([^<]+)<\/span>/);
        const description = descMatch ? descMatch[1].trim() : "";
        
        // Categories/Tags - ищем кнопки с классом text-white
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
        
        console.log("Parsed manga details:", { title, author, artist, description, tags, status });
        
        return JSON.stringify({
            id: mangaId,
            title: title,
            url: `https://asuracomic.net/series/${mangaId}`,
            coverURL: cover,
            author: author,
            artist: artist,
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
        
        // Ищем контейнер с главами как в Rust коде
        const chapterContainerMatch = html.match(/<div[^>]*class="[^"]*scrollbar-thumb-themecolor[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (!chapterContainerMatch) {
            console.log("Chapter container not found");
            return JSON.stringify([]);
        }
        
        const containerHtml = chapterContainerMatch[1];
        
        // Ищем все группы глав
        const groupPattern = /<div[^>]*class="[^"]*group[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        let groupMatch;
        
        while ((groupMatch = groupPattern.exec(containerHtml)) !== null) {
            const groupHtml = groupMatch[1];
            
            // Проверяем, что глава не заблокирована (нет SVG)
            if (groupHtml.includes('<svg')) {
                console.log("Chapter is locked, skipping");
                continue;
            }
            
            // Извлекаем ссылку
            const linkMatch = groupHtml.match(/<a[^>]+href="([^"]+)"/);
            if (!linkMatch) continue;
            
            const rawUrl = linkMatch[1];
            
            // Извлекаем ID главы из URL
            const chapterIdMatch = rawUrl.match(/chapter\/([^\/\?]+)/);
            if (!chapterIdMatch) continue;
            
            const chapterId = chapterIdMatch[1];
            const url = `https://asuracomic.net/series/${mangaId}/${chapterId}`;
            
            // Извлекаем заголовок главы
            const titleMatch = groupHtml.match(/<h3[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
            const title = titleMatch ? titleMatch[1].trim() : "";
            
            // Извлекаем номер главы
            const chapterMatch = groupHtml.match(/<h3[^>]*class="[^"]*text-sm[^"]*"[^>]*>([^<]+)<\/h3>/);
            let chapterNumber = -1;
            if (chapterMatch) {
                const chapterText = chapterMatch[1].replace(title, "").replace("Chapter", "").trim();
                chapterNumber = parseFloat(chapterText) || -1;
            }
            
            // Извлекаем дату (если есть)
            const dateMatch = groupHtml.match(/<h3[^>]*>([^<]+)<\/h3>/g);
            let uploadDate = null;
            if (dateMatch && dateMatch.length > 0) {
                // Ищем последний h3 без вложенных элементов
                for (let i = dateMatch.length - 1; i >= 0; i--) {
                    const dateText = dateMatch[i].replace(/<[^>]*>/g, '').trim();
                    if (dateText && !dateText.includes('Chapter') && !dateText.includes(title)) {
                        // Пытаемся распарсить дату
                        try {
                            uploadDate = new Date(dateText).toISOString();
                        } catch (e) {
                            console.log("Could not parse date:", dateText);
                        }
                        break;
                    }
                }
            }
            
            chapters.push({
                id: chapterId,
                title: title,
                url: url,
                number: chapterNumber,
                volume: null,
                scanlator: null,
                uploadDate: uploadDate
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
        
        // Remove script tags from hydration that can cut up the page list (как в Rust коде)
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
        
        // Если не нашли в JSON, пробуем найти просто URL страниц
        if (pages.length === 0) {
            const pageMatches = html.match(/https:\/\/gg\.asuracomic\.net\/storage\/media\/[^"]+/g);
            if (pageMatches) {
                pageMatches.forEach((pageUrl, index) => {
                    pages.push(pageUrl);
                });
            }
        }
        
        console.log("Found", pages.length, "pages");
        
        return JSON.stringify(pages);
    } catch (error) {
        console.log("Error in parseChapterPages:", error);
        return JSON.stringify([]);
    }
}

console.log("All functions defined");

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
