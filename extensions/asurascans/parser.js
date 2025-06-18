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
        
        return JSON.stringify({
            id: mangaId,
            title: "Test Manga",
            url: `https://asuracomic.net/series/${mangaId}`,
            coverURL: "",
            author: "Test Author",
            artist: "",
            description: "Test Description",
            tags: [],
            status: "Unknown"
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
        
        return JSON.stringify([]);
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
        
        return JSON.stringify([]);
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
