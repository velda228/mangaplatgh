// Asura Scans Parser

function parseMangaList(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = [];
    
    const mangaCards = doc.querySelectorAll('.bsx');
    mangaCards.forEach(card => {
        const link = card.querySelector('a');
        const img = card.querySelector('img');
        const title = card.querySelector('.tt');
        
        if (link && img && title) {
            items.push({
                id: link.getAttribute('href').split('/').pop(),
                title: title.textContent.trim(),
                coverUrl: img.getAttribute('src'),
                url: link.getAttribute('href')
            });
        }
    });
    
    return items;
}

function parseMangaDetails(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const title = doc.querySelector('.entry-title')?.textContent.trim();
    const cover = doc.querySelector('.thumb img')?.getAttribute('src');
    const description = doc.querySelector('.entry-content')?.textContent.trim();
    
    // Парсинг статуса
    let status = 'unknown';
    const statusElement = doc.querySelector('.imptdt:contains("Status") i');
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
    doc.querySelectorAll('.fmed').forEach(el => {
        const label = el.textContent.toLowerCase();
        if (label.includes('author')) {
            author = el.nextElementSibling?.textContent.trim() || 'Unknown';
        }
        if (label.includes('artist')) {
            artist = el.nextElementSibling?.textContent.trim() || 'Unknown';
        }
    });
    
    // Парсинг жанров
    const genres = [];
    doc.querySelectorAll('.mgen a').forEach(genre => {
        genres.push(genre.textContent.trim());
    });
    
    // Парсинг глав
    const chapters = [];
    doc.querySelectorAll('#chapterlist li').forEach((chapter, index) => {
        const link = chapter.querySelector('a');
        const title = chapter.querySelector('.chapternum')?.textContent.trim();
        const url = link?.getAttribute('href');
        
        if (title && url) {
            // Извлекаем номер главы из заголовка
            const numberMatch = title.match(/Chapter\s+(\d+(\.\d+)?)/i);
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
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const pages = [];
    
    // Ищем скрипт с данными страниц
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
    
    return pages;
}

// Экспортируем функции парсера
globalThis.getMangaList = parseMangaList;
globalThis.parseMangaDetails = parseMangaDetails;
globalThis.parseChapterPages = parseChapterPages; 
