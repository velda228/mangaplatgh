// Asura Scans Parser

function createDocument(html) {
    // Используем встроенный DOMParser если он есть
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
    }
    
    // Fallback для Node.js окружения
    if (typeof require !== 'undefined') {
        const jsdom = require('jsdom');
        const { JSDOM } = jsdom;
        const dom = new JSDOM(html);
        return dom.window.document;
    }
    
    throw new Error('No DOM parser available');
}

function parseMangaList(html) {
    const doc = createDocument(html);
    const items = [];
    
    // Новая структура использует Next.js и имеет другие классы
    const mangaCards = doc.querySelectorAll('a[href^="/series/"]');
    mangaCards.forEach(card => {
        const img = card.querySelector('img');
        const title = card.querySelector('h3, h4, .title'); // Ищем заголовок в разных возможных элементах
        
        if (img && title) {
            const href = card.getAttribute('href');
            items.push({
                id: href.split('/').pop(),
                title: title.textContent.trim(),
                coverUrl: img.getAttribute('src'),
                url: href
            });
        }
    });
    
    return items;
}

function parseMangaDetails(html) {
    const doc = createDocument(html);
    
    // Обновленные селекторы для деталей манги
    const title = doc.querySelector('h1')?.textContent.trim();
    const cover = doc.querySelector('img[alt*="cover"]')?.getAttribute('src');
    const description = doc.querySelector('[class*="description"]')?.textContent.trim();
    
    // Парсинг статуса
    let status = 'unknown';
    const statusElement = doc.querySelector('[class*="status"]');
    if (statusElement) {
        const statusText = statusElement.textContent.toLowerCase();
        if (statusText.includes('ongoing')) status = 'ongoing';
        else if (statusText.includes('completed')) status = 'completed';
        else if (statusText.includes('hiatus')) status = 'hiatus';
        else if (statusText.includes('dropped')) status = 'dropped';
    }
    
    // Парсинг автора и художника
    let author = 'Unknown';
    let artist = 'Unknown';
    
    // Ищем метаданные в разных возможных местах
    doc.querySelectorAll('[class*="metadata"] div, [class*="info"] div').forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('author')) {
            author = el.querySelector('span, a')?.textContent.trim() || 'Unknown';
        }
        if (text.includes('artist')) {
            artist = el.querySelector('span, a')?.textContent.trim() || 'Unknown';
        }
    });
    
    // Парсинг жанров
    const genres = [];
    doc.querySelectorAll('[class*="genres"] a, [class*="tags"] a').forEach(genre => {
        genres.push(genre.textContent.trim());
    });
    
    // Парсинг глав
    const chapters = [];
    doc.querySelectorAll('a[href*="/chapter/"]').forEach((chapter, index) => {
        const title = chapter.textContent.trim();
        const url = chapter.getAttribute('href');
        
        if (title && url) {
            // Извлекаем номер главы из заголовка или URL
            const numberMatch = (title.match(/Chapter\s+(\d+(\.\d+)?)/i) || url.match(/chapter[/-](\d+(\.\d+)?)/i));
            const number = numberMatch ? parseFloat(numberMatch[1]) : index + 1;
            
            chapters.push({
                id: url.split('/').pop(),
                title: title,
                number: number,
                url: url
            });
        }
    });
    
    return {
        title,
        cover,
        description,
        status,
        author,
        artist,
        genres,
        chapters
    };
}

function parseChapterPages(html) {
    const doc = createDocument(html);
    const pages = [];
    
    // Ищем изображения глав
    doc.querySelectorAll('img[class*="chapter"]').forEach((img, index) => {
        const url = img.getAttribute('src');
        if (url) {
            pages.push({
                index: index + 1,
                url: url
            });
        }
    });
    
    // Если не нашли изображения напрямую, ищем в скриптах
    if (pages.length === 0) {
        const scripts = doc.querySelectorAll('script');
        let pagesData = null;
        
        for (const script of scripts) {
            const content = script.textContent;
            if (content && content.includes('"pages":[')) {
                const match = content.match(/"pages":\[(.*?)\]/);
                if (match) {
                    try {
                        pagesData = JSON.parse('[' + match[1] + ']');
                        break;
                    } catch (e) {
                        console.error('Failed to parse pages data:', e);
                    }
                }
            }
        }
        
        if (pagesData) {
            pagesData.forEach((page, index) => {
                if (page.url) {
                    pages.push({
                        index: index + 1,
                        url: page.url.replace(/\\\//g, '/')
                    });
                }
            });
        }
    }
    
    return pages;
}

// Экспортируем функции парсера
globalThis.getMangaList = parseMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
