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
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const wrapper = doc.querySelector("div.grid.grid-cols-12");
        if (!wrapper) return null;

        // Обложка
        const cover = wrapper.querySelector("img[alt=poster]")?.getAttribute("src") || "";

        // Название
        const title = wrapper.querySelector("span.text-xl.font-bold")?.textContent?.trim() || "";

        // Автор и художник (ищем вручную)
        let author = "";
        let artist = "";
        const divs = wrapper.querySelectorAll("div.flex");
        divs.forEach(div => {
            const h3s = div.querySelectorAll("h3");
            if (h3s.length >= 2) {
                const label = h3s[0].textContent.trim();
                if (label === "Author") author = h3s[1].textContent.trim() === "_" ? "" : h3s[1].textContent.trim();
                if (label === "Artist") artist = h3s[1].textContent.trim() === "_" ? "" : h3s[1].textContent.trim();
            }
        });

        // Описание
        const description = wrapper.querySelector("span.font-medium.text-sm")?.textContent?.trim() || "";

        // Жанры
        const genres = Array.from(wrapper.querySelectorAll("div[class^=space] > div.flex > button.text-white"))
            .map(btn => btn.textContent.trim());

        // Статус
        let status = "unknown";
        divs.forEach(div => {
            const h3s = div.querySelectorAll("h3");
            if (h3s.length >= 2 && h3s[0].textContent.trim() === "Status") {
                const statusText = h3s[1].textContent.trim();
                switch (statusText) {
                    case "Ongoing": status = "ongoing"; break;
                    case "Hiatus": status = "hiatus"; break;
                    case "Completed": status = "completed"; break;
                    case "Dropped": status = "dropped"; break;
                    case "Season End": status = "hiatus"; break;
                }
            }
        });

        // Главы
        const chapters = [];
        const chapterDivs = doc.querySelectorAll("div.scrollbar-thumb-themecolor > div.group");
        chapterDivs.forEach(div => {
            if (div.querySelector("h3 > span > svg")) return; // Пропуск заблокированных
            const a = div.querySelector("a");
            if (!a) return;
            const chapterURL = a.getAttribute("href") || "";
            const titleSpan = div.querySelector("h3 > span");
            const chapterTitle = titleSpan ? titleSpan.textContent.trim() : "";
            const chapterText = div.querySelector("h3.text-sm")?.textContent || "";
            const chapterNumber = parseFloat(
                chapterText.replace(chapterTitle, "").replace("Chapter", "").trim()
            ) || -1;
            // Дата (ищем h3 без вложенных элементов)
            let dateText = "";
            const h3s = div.querySelectorAll("h3");
            h3s.forEach(h3 => {
                if (!h3.querySelector("*")) {
                    dateText = h3.textContent.trim();
                }
            });
            const fullChapterURL = chapterURL.startsWith("http")
                ? chapterURL
                : "https://asuracomic.net" + (chapterURL.startsWith("/") ? chapterURL : "/" + chapterURL);
            chapters.push({
                title: chapterTitle,
                number: chapterNumber,
                url: fullChapterURL,
                date: dateText
            });
        });

        return {
            title,
            cover,
            author,
            artist,
            description,
            status,
            genres,
            chapters
        };
    } catch (error) {
        console.log("[ERROR] Ошибка в parseMangaDetails:", error.message);
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
