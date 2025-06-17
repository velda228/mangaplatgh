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
    console.log("[DEBUG] parseMangaDetails: HTML length=", html.length);

    // Создаем DOM-парсер
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Название
    const title = doc.querySelector('span.text-xl.font-bold')?.textContent?.trim() || "";
    
    // Обложка
    const cover = doc.querySelector('img.rounded')?.getAttribute('src') || "";
    
    // Описание
    const description = doc.querySelector('span.font-medium.text-sm.text-[#A2A2A2]')?.textContent?.trim() ||
        doc.querySelector('h3:contains(Synopsis) + span.font-medium.text-sm.text-[#A2A2A2]')?.textContent?.trim() ||
        doc.querySelector('span.font-medium.text-sm.text-[#A2A2A2]:last-child')?.textContent?.trim() ||
        doc.querySelector('h3:contains(Synopsis) + span')?.textContent?.trim() ||
        doc.querySelector('span.font-medium.text-sm')?.textContent?.trim() || "";
    
    // Автор
    let author = "";
    const authorLabel = doc.querySelector('h3:contains(Author)');
    if (authorLabel && authorLabel.nextElementSibling) {
        author = authorLabel.nextElementSibling.textContent.trim();
    }
    
    // Художник
    let artist = null;
    const artistLabel = doc.querySelector('h3:contains(Artist)');
    if (artistLabel && artistLabel.nextElementSibling) {
        artist = artistLabel.nextElementSibling.textContent.trim();
    }
    
    // Статус
    let status = "unknown";
    const statusDivs = doc.querySelectorAll('div.bg-[#343434]');
    for (const div of statusDivs) {
        const h3s = div.querySelectorAll('h3');
        if (h3s.length >= 2) {
            const label = h3s[0].textContent.trim().toLowerCase();
            const value = h3s[1].textContent.trim().toLowerCase();
            if (label.includes('status')) {
                if (value.includes('ongoing')) status = 'ongoing';
                else if (value.includes('completed')) status = 'completed';
                else if (value.includes('hiatus')) status = 'hiatus';
                else if (value.includes('cancelled')) status = 'cancelled';
                else if (value.includes('dropped')) status = 'dropped';
                else if (value.includes('season end')) status = 'season_end';
                else if (value.includes('coming soon')) status = 'coming_soon';
                break;
            }
        }
    }
    
    // Fallback для статуса: ищем по всему тексту
    if (status === 'unknown') {
        const allText = doc.body.textContent.toLowerCase();
        if (allText.includes('status ongoing')) status = 'ongoing';
        else if (allText.includes('status completed')) status = 'completed';
        else if (allText.includes('status hiatus')) status = 'hiatus';
        else if (allText.includes('status cancelled')) status = 'cancelled';
        else if (allText.includes('status dropped')) status = 'dropped';
        else if (allText.includes('status season end')) status = 'season_end';
        else if (allText.includes('status coming soon')) status = 'coming_soon';
    }
    
    // Количество подписчиков
    let favoriteCount = null;
    const followedByElements = doc.querySelectorAll('p.text-[#A2A2A2].text-[13px].text-center');
    for (const element of followedByElements) {
        const text = element.textContent;
        if (text.includes('Followed by')) {
            const match = text.match(/Followed by\s*(\d+)\s*people/i);
            if (match) {
                favoriteCount = parseInt(match[1]);
                break;
            }
        }
    }
    
    // Жанры
    const genres = Array.from(doc.querySelectorAll('div.flex.flex-row.flex-wrap.gap-3 button'))
        .map(button => button.textContent.trim());
    
    // Рейтинг
    const ratingText = doc.querySelector('span.ml-1.text-xs')?.textContent || "0";
    const rating = parseFloat(ratingText.replace(',', '.')) || 0;
    
    // Количество голосов
    let ratingCount = null;
    const ratingMatch = html.match(/"rating"\s*:\s*([0-9.]+)\s*,\s*"rating_count"\s*:\s*(\d+)/);
    if (ratingMatch && Math.abs(parseFloat(ratingMatch[1]) - rating) < 0.001) {
        ratingCount = parseInt(ratingMatch[2]);
    }
    
    // Главы
    const chapters = [];
    const chapterDivs = doc.querySelectorAll('div.pl-4.py-2.border.rounded-md.group.w-full');
    const numberRegex = /([0-9]+(?:\.[0-9]+)?)/;
    let chapterIndex = 1;
    
    for (const div of chapterDivs) {
        const a = div.querySelector('a');
        const h3s = a?.querySelectorAll('h3');
        if (!h3s || h3s.length < 2) continue;
        
        let rawTitle = h3s[0].textContent.trim();
        const dateText = h3s[1].textContent.trim();
        const chapterURL = a.getAttribute('href') || "";
        
        // Очищаем название
        rawTitle = rawTitle.replace(/Глава|Chapter/gi, '').trim();
        
        // Извлекаем номер и доп. текст
        const numberMatch = rawTitle.match(numberRegex);
        const numberString = numberMatch ? numberMatch[1] : String(chapterIndex);
        const extraText = numberMatch ? 
            rawTitle.slice(numberMatch.index + numberMatch[0].length).trim() : "";
        
        if (!chapterURL) continue;
        
        // Формируем полный URL
        const fullChapterURL = chapterURL.startsWith('http') ? 
            chapterURL : 
            'https://asuracomic.net' + (chapterURL.startsWith('/') ? chapterURL : '/' + chapterURL);
        
        chapters.push({
            url: fullChapterURL,
            title: extraText || rawTitle,
            number: parseFloat(numberString) || chapterIndex
        });
        
        chapterIndex++;
    }
    
    console.log("[DEBUG] Parsed manga details:", {
        title,
        cover,
        author,
        artist,
        status,
        description: description.substring(0, 100) + "...",
        chaptersCount: chapters.length,
        genresCount: genres.length,
        rating,
        ratingCount,
        favoriteCount
    });
    
    return {
        title,
        cover,
        author,
        artist,
        description,
        status,
        genres,
        chapters,
        rating,
        ratingCount,
        favoriteCount
    };
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
