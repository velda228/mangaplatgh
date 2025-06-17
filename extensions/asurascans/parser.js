// Asura Scans Parser

// Экспортируем функции глобально
globalThis.getMangaList = getMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages;

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
    try {
        console.log("[DEBUG] parseMangaDetails: старт");
        
        // Находим основной блок с информацией
        const wrapperMatch = html.match(/<div class="grid grid-cols-12">([\s\S]*?)<\/div>\s*<\/div>/);
        if (!wrapperMatch) {
            console.log("[ERROR] Не найден wrapper");
            return null;
        }
        const wrapper = wrapperMatch[1];
        console.log("[DEBUG] wrapper найден");

        // Обложка
        const coverMatch = wrapper.match(/<img[^>]+alt="poster"[^>]+src="([^"]+)"/);
        const cover = coverMatch ? coverMatch[1] : "";
        console.log("[DEBUG] cover:", cover);

        // Название
        const titleMatch = wrapper.match(/<span class="text-xl font-bold">([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        console.log("[DEBUG] title:", title);

        // Автор и художник
        let author = "";
        let artist = "";
        const authorMatch = wrapper.match(/<h3[^>]*>Author<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        const artistMatch = wrapper.match(/<h3[^>]*>Artist<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        
        if (authorMatch) {
            author = authorMatch[1].trim();
            if (author === "_") author = "";
        }
        if (artistMatch) {
            artist = artistMatch[1].trim();
            if (artist === "_") artist = "";
        }
        console.log("[DEBUG] author:", author);
        console.log("[DEBUG] artist:", artist);

        // Описание
        const descMatch = wrapper.match(/<span class="font-medium text-sm">([^<]+)<\/span>/);
        const description = descMatch ? descMatch[1].trim() : "";
        console.log("[DEBUG] description:", description);

        // Жанры
        const genres = [];
        const genrePattern = /<button[^>]*class="[^"]*text-white[^"]*"[^>]*>([^<]+)<\/button>/g;
        let genreMatch;
        while ((genreMatch = genrePattern.exec(wrapper)) !== null) {
            genres.push(genreMatch[1].trim());
        }
        console.log("[DEBUG] genres:", genres);

        // Статус
        let status = "unknown";
        const statusMatch = wrapper.match(/<h3[^>]*>Status<\/h3>\s*<h3[^>]*>([^<]+)<\/h3>/);
        if (statusMatch) {
            const statusText = statusMatch[1].trim();
            switch (statusText) {
                case "Ongoing": status = "ongoing"; break;
                case "Hiatus": status = "hiatus"; break;
                case "Completed": status = "completed"; break;
                case "Dropped": status = "dropped"; break;
                case "Season End": status = "hiatus"; break;
            }
        }
        console.log("[DEBUG] status:", status);

        // Главы
        const chapters = [];
        const chapterPattern = /<div class="group">([\s\S]*?)<\/div>\s*<\/div>/g;
        let chapterMatch;
        while ((chapterMatch = chapterPattern.exec(html)) !== null) {
            const chapterBlock = chapterMatch[1];
            if (chapterBlock.includes('<svg')) continue; // Пропускаем блоки с SVG

            const urlMatch = chapterBlock.match(/<a[^>]+href="([^"]+)"/);
            const titleMatch = chapterBlock.match(/<h3[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
            const numberMatch = chapterBlock.match(/<h3[^>]*>Chapter\s*([0-9.]+)/);
            const dateMatch = chapterBlock.match(/<h3[^>]*>([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})<\/h3>/);

            if (urlMatch) {
                const chapterURL = urlMatch[1];
                const fullChapterURL = chapterURL.startsWith("http")
                    ? chapterURL
                    : "https://asuracomic.net" + (chapterURL.startsWith("/") ? chapterURL : "/" + chapterURL);

                chapters.push({
                    title: titleMatch ? titleMatch[1].trim() : "",
                    number: numberMatch ? parseFloat(numberMatch[1]) : -1,
                    url: fullChapterURL,
                    date: dateMatch ? dateMatch[1] : ""
                });
            }
        }

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
        console.log("[DEBUG] Итоговый результат:", JSON.stringify(result));
        return result;
    } catch (error) {
        console.log("[ERROR] Ошибка в parseMangaDetails:", error && error.message ? error.message : error);
        if (error && error.stack) console.log("[ERROR] Стек:", error.stack);
        return null;
    }
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
