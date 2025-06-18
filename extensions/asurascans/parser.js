// Simple test parser for AsuraScans
console.log("Parser loaded successfully");

// Функция для декодирования HTML-сущностей
function decodeHtmlEntities(text) {
    if (!text) return text;
    
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&hellip;': '…',
        '&mdash;': '—',
        '&ndash;': '–',
        '&lsquo;': '\u2018',
        '&rsquo;': '\u2019',
        '&ldquo;': '\u201C',
        '&rdquo;': '\u201D'
    };
    
    return text.replace(/&[a-zA-Z0-9#]+;/g, function(match) {
        return entities[match] || match;
    });
}

// Функция для очистки текста от лишних символов
function cleanText(text) {
    if (!text) return text;
    
    return text
        .replace(/\s+/g, ' ')  // Заменяем множественные пробелы на один
        .replace(/^\s+|\s+$/g, '')  // Убираем пробелы в начале и конце
        .replace(/[\u2018\u2019]/g, "'")  // Заменяем smart quotes на обычные
        .replace(/[\u201C\u201D]/g, '"');  // Заменяем smart quotes на обычные
}

function testFunction() {
    console.log("testFunction called");
    return "Hello from JavaScript!";
}

function parseMangaList(html) {
    console.log("parseMangaList called with HTML length:", html.length);
    
    try {
        const mangas = [];
        
        // Простой парсинг для тестирования
        const pattern = /<a href="series\/([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*block[^"]*"[^>]*>([^<]+)<\/span>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
            const id = match[1];
            const cover = match[2].startsWith("http") ? match[2] : `https://gg.asuracomic.net${match[2]}`;
            const title = cleanText(decodeHtmlEntities(match[3].trim()));
            
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
    return JSON.stringify({
        id: mangaId,
        title: cleanText(decodeHtmlEntities("Test Manga")),
        url: `https://asuracomic.net/series/${mangaId}`,
        coverURL: "",
        author: cleanText(decodeHtmlEntities("Test Author")),
        artist: "",
        description: cleanText(decodeHtmlEntities("Test Description")),
        tags: [],
        status: "Unknown"
    });
}

function parseChapterList(html, mangaId) {
    console.log("parseChapterList called");
    return JSON.stringify([]);
}

function parseChapterPages(html) {
    console.log("parseChapterPages called");
    return JSON.stringify([]);
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
