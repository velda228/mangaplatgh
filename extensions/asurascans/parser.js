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
    try {
        console.log("[DEBUG] parseMangaDetails: начало парсинга");
        console.log("[DEBUG] HTML первые 100 символов:", html.substring(0, 100));
        
        // Создаем DOMParser и проверяем его
        if (typeof DOMParser === 'undefined') {
            console.log("[ERROR] DOMParser не определен");
            return null;
        }
        
        const parser = new DOMParser();
        console.log("[DEBUG] DOMParser создан");
        
        // Парсим HTML
        const doc = parser.parseFromString(html, 'text/html');
        console.log("[DEBUG] HTML распарсен, documentElement:", doc.documentElement ? "существует" : "отсутствует");
        
        // Проверяем, что документ создан корректно
        if (!doc || !doc.documentElement) {
            console.log("[ERROR] Не удалось создать DOM документ");
            return null;
        }
        
        // Находим основной контейнер
        console.log("[DEBUG] Ищем основной контейнер");
        const wrapper = doc.querySelector("div.grid.grid-cols-12");
        console.log("[DEBUG] wrapper найден:", !!wrapper);
        
        if (!wrapper) {
            console.log("[DEBUG] Пробуем найти любой div в документе");
            const allDivs = doc.querySelectorAll("div");
            console.log("[DEBUG] Найдено div элементов:", allDivs.length);
            console.log("[DEBUG] Классы первых 3 div (если есть):");
            Array.from(allDivs).slice(0, 3).forEach((div, i) => {
                console.log(`[DEBUG] div ${i}:`, div.className);
            });
            
            // Пробуем альтернативный селектор
            console.log("[DEBUG] Пробуем альтернативный селектор");
            const altWrapper = doc.querySelector("div[class*='grid'][class*='grid-cols']");
            if (altWrapper) {
                console.log("[DEBUG] Найден альтернативный wrapper:", altWrapper.className);
                wrapper = altWrapper;
            } else {
                console.log("[ERROR] Не найден основной контейнер div.grid.grid-cols-12");
                return null;
            }
        }
        
        // Название
        console.log("[DEBUG] Ищем название");
        const titleEl = wrapper.querySelector("span.text-xl.font-bold");
        console.log("[DEBUG] Элемент названия найден:", !!titleEl);
        const title = titleEl?.textContent?.trim() || "";
        console.log("[DEBUG] title:", title);
        
        // Обложка
        console.log("[DEBUG] Ищем обложку");
        const coverEl = wrapper.querySelector("img[alt=poster]") || wrapper.querySelector("img.rounded");
        console.log("[DEBUG] Элемент обложки найден:", !!coverEl);
        const cover = coverEl?.getAttribute("src") || "";
        console.log("[DEBUG] cover:", cover);
        
        // Описание
        console.log("[DEBUG] Ищем описание");
        const descEl = wrapper.querySelector("span.font-medium.text-sm") || 
                      wrapper.querySelector("span.font-medium.text-sm.text-[#A2A2A2]");
        console.log("[DEBUG] Элемент описания найден:", !!descEl);
        const description = descEl?.textContent?.trim() || "";
        console.log("[DEBUG] description:", description?.substring(0, 50) + "...");
        
        // Автор
        console.log("[DEBUG] Ищем автора");
        let author = "";
        const authorDiv = wrapper.querySelector("div:has(h3:contains(Author))") || 
                         wrapper.querySelector("div.flex:has(h3:contains(Author))");
        if (authorDiv) {
            const h3s = authorDiv.querySelectorAll("h3");
            if (h3s.length > 1) {
                author = h3s[1].textContent.trim();
                if (author === "_") author = "";
            }
        }
        console.log("[DEBUG] author:", author);
        
        // Художник
        console.log("[DEBUG] Ищем художника");
        let artist = "";
        const artistDiv = wrapper.querySelector("div:has(h3:contains(Artist))") || 
                         wrapper.querySelector("div.flex:has(h3:contains(Artist))");
        if (artistDiv) {
            const h3s = artistDiv.querySelectorAll("h3");
            if (h3s.length > 1) {
                artist = h3s[1].textContent.trim();
                if (artist === "_") artist = "";
            }
        }
        console.log("[DEBUG] artist:", artist);
        
        // Статус
        console.log("[DEBUG] Ищем статус");
        let status = "unknown";
        const statusDiv = wrapper.querySelector("div.flex:has(h3:contains(Status))");
        if (statusDiv) {
            const h3s = statusDiv.querySelectorAll("h3");
            if (h3s.length > 1) {
                const statusText = h3s[1].textContent.trim().toLowerCase();
                switch (statusText) {
                    case "ongoing": status = "ongoing"; break;
                    case "completed": status = "completed"; break;
                    case "hiatus": status = "hiatus"; break;
                    case "dropped": status = "dropped"; break;
                    case "season end": status = "hiatus"; break;
                }
            }
        }
        console.log("[DEBUG] status:", status);
        
        // Жанры
        console.log("[DEBUG] Ищем жанры");
        const genreElements = wrapper.querySelectorAll("div[class^=space] > div.flex > button.text-white") ||
                            wrapper.querySelectorAll("div.flex.flex-row.flex-wrap.gap-3 button");
        console.log("[DEBUG] Найдено элементов жанров:", genreElements.length);
        const genres = Array.from(genreElements).map(button => button.textContent.trim());
        console.log("[DEBUG] genres:", genres);
        
        // Главы
        console.log("[DEBUG] Ищем главы");
        const chapters = [];
        const chapterDivs = doc.querySelectorAll("div.scrollbar-thumb-themecolor > div.group") ||
                           doc.querySelectorAll("div.pl-4.py-2.border.rounded-md.group.w-full");
        console.log("[DEBUG] Найдено элементов глав:", chapterDivs.length);
        
        for (const div of chapterDivs) {
            if (div.querySelector("h3 > span > svg")) continue;
            
            const a = div.querySelector("a");
            if (!a) continue;
            
            const chapterURL = a.getAttribute("href") || "";
            if (!chapterURL) continue;
            
            const titleSpan = div.querySelector("h3 > span");
            const title = titleSpan ? titleSpan.textContent.trim() : "";
            
            const chapterText = div.querySelector("h3.text-sm")?.textContent || "";
            const chapterNumber = parseFloat(
                chapterText
                    .replace(title, "")
                    .replace("Chapter", "")
                    .trim()
            ) || -1;
            
            const dateText = div.querySelector("h3:not(:has(*))")?.textContent?.trim() || "";
            
            const fullChapterURL = chapterURL.startsWith("http")
                ? chapterURL
                : "https://asuracomic.net" + (chapterURL.startsWith("/") ? chapterURL : "/" + chapterURL);
            
            chapters.push({
                title,
                number: chapterNumber,
                url: fullChapterURL,
                date: dateText
            });
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
    } catch (error) {
        console.log("[ERROR] Ошибка в parseMangaDetails:", error.message);
        console.log("[ERROR] Стек ошибки:", error.stack);
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

// Экспортируем функции
globalThis.getMangaList = getMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
