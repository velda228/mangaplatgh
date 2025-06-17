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
        console.log("[DEBUG] typeof DOMParser:", typeof DOMParser);
        if (typeof DOMParser === "undefined") {
            console.log("[ERROR] DOMParser не определён в этом окружении!");
            return null;
        }
        const parser = new DOMParser();
        console.log("[DEBUG] parser создан:", !!parser);
        const doc = parser.parseFromString(html, 'text/html');
        console.log("[DEBUG] doc:", !!doc, doc && typeof doc.querySelector);
        if (!doc || typeof doc.querySelector !== "function") {
            console.log("[ERROR] doc или querySelector не определены!");
            return null;
        }
        const wrapper = doc.querySelector("div.grid.grid-cols-12");
        if (!wrapper) {
            console.log("[ERROR] Не найден wrapper");
            return null;
        }
        console.log("[DEBUG] wrapper найден");

        // Обложка
        const cover = wrapper.querySelector("img[alt=poster]")?.getAttribute("src") || "";
        console.log("[DEBUG] cover:", cover);

        // Название
        const title = wrapper.querySelector("span.text-xl.font-bold")?.textContent?.trim() || "";
        console.log("[DEBUG] title:", title);

        // Автор и художник
        let author = "";
        let artist = "";
        const divs = wrapper.querySelectorAll("div.flex");
        console.log("[DEBUG] divs.flex count:", divs.length);
        divs.forEach((div, idx) => {
            const h3s = div.querySelectorAll("h3");
            if (h3s.length >= 2) {
                const label = h3s[0].textContent.trim();
                if (label === "Author") author = h3s[1].textContent.trim() === "_" ? "" : h3s[1].textContent.trim();
                if (label === "Artist") artist = h3s[1].textContent.trim() === "_" ? "" : h3s[1].textContent.trim();
            }
        });
        console.log("[DEBUG] author:", author);
        console.log("[DEBUG] artist:", artist);

        // Описание
        const description = wrapper.querySelector("span.font-medium.text-sm")?.textContent?.trim() || "";
        console.log("[DEBUG] description:", description);

        // Жанры
        const genres = Array.from(wrapper.querySelectorAll("div[class^=space] > div.flex > button.text-white"))
            .map(btn => btn.textContent.trim());
        console.log("[DEBUG] genres:", genres);

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
        console.log("[DEBUG] status:", status);

        // Главы
        const chapters = [];
        const chapterDivs = doc.querySelectorAll("div.scrollbar-thumb-themecolor > div.group");
        console.log("[DEBUG] chapterDivs count:", chapterDivs.length);
        chapterDivs.forEach((div, idx) => {
            if (div.querySelector("h3 > span > svg")) return;
            const a = div.querySelector("a");
            if (!a) return;
            const chapterURL = a.getAttribute("href") || "";
            const titleSpan = div.querySelector("h3 > span");
            const chapterTitle = titleSpan ? titleSpan.textContent.trim() : "";
            const chapterText = div.querySelector("h3.text-sm")?.textContent || "";
            const chapterNumber = parseFloat(
                chapterText.replace(chapterTitle, "").replace("Chapter", "").trim()
            ) || -1;
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
            console.log(`[DEBUG] chapter[${idx}]:`, {title: chapterTitle, number: chapterNumber, url: fullChapterURL, date: dateText});
        });

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
