// Asura Scans Parser

function getMangaList(html, options) {
    // options: { page, filters }
    // filters: { title, genres: [], status, type, sort }
    let page = options && options.page ? options.page : 1;
    let filters = options && options.filters ? options.filters : {};

    console.log("[DEBUG] getMangaList: page=", page, "filters=", filters);
    console.log("[DEBUG] HTML length:", html.length);

    // --- Парсинг HTML ---
    const pattern = /<a href="series\/([^\"]+)">[\s\S]*?<img[^>]+src="([^\"]+)"[^>]*>[\s\S]*?<span class="block text-\[13\.3px\] font-bold">([^<]+)<\/span>/g;
    let result = [];
    let match;

    while ((match = pattern.exec(html)) !== null) {
        let mangaUrl = "/series/" + match[1];
        let fullMangaUrl = mangaUrl.startsWith("http") ? mangaUrl : "https://asuracomic.net" + mangaUrl;
        let coverUrl = match[2].startsWith("/") ? "https://gg.asuracomic.net" + match[2] : match[2];
        let title = match[3].trim();

        console.log("[DEBUG] Found manga:", { title, url: fullMangaUrl, cover: coverUrl });
        
        result.push({
            title: title,
            url: fullMangaUrl,
            cover: coverUrl
        });
    }

    console.log("[DEBUG] Total manga found:", result.length);
    if (result.length > 0) {
        console.log("[DEBUG] First manga:", result[0]);
    }

    // Проверка наличия следующей страницы
    let hasMore = /<a[^>]*class="flex bg-themecolor[^\"]*"[^>]*>Next<\/a>/.test(html);
    console.log("[DEBUG] Has more pages:", hasMore);

    return {
        manga: result,
        has_more: hasMore
    };
}

function parseMangaDetails(html) {
    console.log("[DEBUG] parseMangaDetails: начало парсинга");
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Название
    const title = doc.querySelector('span.text-xl.font-bold')?.textContent?.trim() || "";
    console.log("[DEBUG] title:", title);
    
    // Обложка
    const cover = doc.querySelector('img.rounded')?.getAttribute('src') || "";
    console.log("[DEBUG] cover:", cover);
    
    // Описание
    const description = doc.querySelector('span.font-medium.text-sm.text-[#A2A2A2]')?.textContent?.trim() || "";
    console.log("[DEBUG] description:", description?.substring(0, 50) + "...");
    
    // Автор
    let author = "";
    const authorDiv = doc.querySelector('div:has(h3:contains(Author))');
    if (authorDiv) {
        const h3s = authorDiv.querySelectorAll('h3');
        if (h3s.length > 1) author = h3s[1].textContent.trim();
    }
    console.log("[DEBUG] author:", author);
    
    // Художник
    let artist = "";
    const artistDiv = doc.querySelector('div:has(h3:contains(Artist))');
    if (artistDiv) {
        const h3s = artistDiv.querySelectorAll('h3');
        if (h3s.length > 1) artist = h3s[1].textContent.trim();
    }
    console.log("[DEBUG] artist:", artist);
    
    // Статус
    let status = "unknown";
    const statusDiv = doc.querySelector('div:has(h3:contains(Status))');
    if (statusDiv) {
        const h3s = statusDiv.querySelectorAll('h3');
        if (h3s.length > 1) {
            const statusText = h3s[1].textContent.trim().toLowerCase();
            if (statusText.includes('ongoing')) status = 'ongoing';
            else if (statusText.includes('completed')) status = 'completed';
            else if (statusText.includes('hiatus')) status = 'hiatus';
            else if (statusText.includes('dropped')) status = 'dropped';
        }
    }
    console.log("[DEBUG] status:", status);
    
    // Жанры
    const genres = Array.from(doc.querySelectorAll('div.flex.flex-row.flex-wrap.gap-3 button'))
        .map(button => button.textContent.trim());
    console.log("[DEBUG] genres:", genres);
    
    // Главы
    const chapters = [];
    const chapterDivs = doc.querySelectorAll('div.pl-4.py-2.border.rounded-md.group.w-full');
    let chapterIndex = 1;
    
    for (const div of chapterDivs) {
        const a = div.querySelector('a');
        const h3s = a?.querySelectorAll('h3');
        if (!h3s || h3s.length < 2) continue;
        
        const rawTitle = h3s[0].textContent.trim();
        const dateText = h3s[1].textContent.trim();
        const chapterURL = a.getAttribute('href') || "";
        
        // Извлекаем номер главы
        const numberMatch = rawTitle.match(/([0-9]+(?:\.[0-9]+)?)/);
        const number = numberMatch ? parseFloat(numberMatch[1]) : chapterIndex;
        
        if (!chapterURL) continue;
        
        // Формируем полный URL
        const fullChapterURL = chapterURL.startsWith('http') ? 
            chapterURL : 
            'https://asuracomic.net' + (chapterURL.startsWith('/') ? chapterURL : '/' + chapterURL);
        
        chapters.push({
            title: rawTitle,
            number: number,
            url: fullChapterURL,
            date: dateText
        });
        
        chapterIndex++;
    }
    console.log("[DEBUG] chapters count:", chapters.length);
    
    const result = {
        title,
        cover,
        author,
        artist,
        description,
        status,
        genres,
        chapters
    };
    
    console.log("[DEBUG] parseMangaDetails: завершение парсинга");
    return result;
}

function parseChapterPages(html) {
    console.log("[DEBUG] parseChapterPages: HTML length=", html.length);
    
    let pages = [];
    
    // Ищем изображения в HTML
    const imgPattern = /<img[^>]+class="[^"]*chapter-image[^"]*"[^>]+src="([^"]+)"/g;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
        let url = imgMatch[1];
        if (url) {
            pages.push({
                index: pages.length + 1,
                url: url
            });
        }
    }
    console.log("[DEBUG] Found images in HTML:", pages.length);
    
    // Если не нашли изображения в HTML, ищем в скриптах
    if (pages.length === 0) {
        console.log("[DEBUG] Looking for images in scripts");
        const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/g;
        let scriptMatch;
        while ((scriptMatch = scriptPattern.exec(html)) !== null) {
            let scriptContent = scriptMatch[1];
            if (scriptContent.includes('"pages":[')) {
                let pagesMatch = scriptContent.match(/"pages":\[(.*?)\]/);
                if (pagesMatch) {
                    try {
                        let pagesData = JSON.parse('[' + pagesMatch[1] + ']');
                        pagesData.forEach((page, index) => {
                            if (page.url) {
                                pages.push({
                                    index: index + 1,
                                    url: page.url.replace(/\\\//g, '/')
                                });
                            }
                        });
                        console.log("[DEBUG] Found images in script:", pages.length);
                        break;
                    } catch (e) {
                        console.error("[DEBUG] Failed to parse pages data:", e);
                    }
                }
            }
        }
    }
    
    // Если все еще нет страниц, ищем по специфичному паттерну AsuraScans
    if (pages.length === 0) {
        console.log("[DEBUG] Looking for AsuraScans specific pattern");
        const asuraPattern = /"pages":\[(.*?)\]/;
        let asuraMatch = html.match(asuraPattern);
        if (asuraMatch) {
            try {
                let pagesData = JSON.parse('[' + asuraMatch[1] + ']');
                pagesData.forEach((page, index) => {
                    if (page.url) {
                        pages.push({
                            index: index + 1,
                            url: page.url.replace(/\\\//g, '/')
                        });
                    }
                });
                console.log("[DEBUG] Found images in AsuraScans pattern:", pages.length);
            } catch (e) {
                console.error("[DEBUG] Failed to parse AsuraScans pages:", e);
            }
        }
    }
    
    console.log("[DEBUG] Total pages found:", pages.length);
    return pages;
}

// Экспортируем функции
globalThis.getMangaList = getMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
