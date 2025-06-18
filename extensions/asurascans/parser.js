// Simple test parser for AsuraScans
console.log("Parser loaded successfully");

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
