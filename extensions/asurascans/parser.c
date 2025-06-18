#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "gumbo.h"
#include "cJSON.h"

// Константы
#define BASE_URL "https://asuracomic.net"
#define MAX_STRING_LENGTH 1024

// Структуры данных для работы с мангой
typedef struct {
    char* id;
    char* title;
    char* cover;
    char* description;
    char* author;
    char* artist;
    char* status;
    char* tags;
    char* chapters;
} MangaInfo;

typedef struct {
    char* id;
    char* title;
    char* number;
    char* date;
    char* scanlator;
} ChapterInfo;

typedef struct {
    char* url;
    char* filename;
} PageInfo;

// Глобальные переменные для хранения данных
static char* current_html = NULL;
static char* current_url = NULL;

// Прототипы вспомогательных функций
static char* extract_text(GumboNode* node);
static char* extract_attribute(GumboNode* node, const char* attr_name);
static GumboNode* find_by_class(GumboNode* node, const char* tag, const char* classname);
static void find_manga_items_asura(GumboNode* node, cJSON* manga_array);
static void check_has_more(GumboNode* node, int* has_more);
static char* find_author(GumboNode* node);
static char* find_status(GumboNode* node);
static void find_chapters_asura(GumboNode* node, cJSON* chapters);

// Реализация вспомогательных функций
static char* extract_text(GumboNode* node) {
    if (!node) return NULL;
    
    if (node->type == GUMBO_NODE_TEXT) {
        return strdup(node->v.text.text);
    }
    
    if (node->type == GUMBO_NODE_ELEMENT) {
        for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
            char* text = extract_text(node->v.element.children.data[i]);
            if (text) return text;
        }
    }
    
    return NULL;
}

static char* extract_attribute(GumboNode* node, const char* attr_name) {
    if (!node || node->type != GUMBO_NODE_ELEMENT) return NULL;
    
    GumboAttribute* attr = gumbo_get_attribute(&node->v.element.attributes, attr_name);
    if (attr) {
        return strdup(attr->value);
    }
    
    return NULL;
}

static GumboNode* find_by_class(GumboNode* node, const char* tag, const char* classname) {
    if (node->type != GUMBO_NODE_ELEMENT) return NULL;
    
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), tag) == 0) {
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, classname)) {
            return node;
        }
    }
    
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        GumboNode* child = find_by_class(node->v.element.children.data[i], tag, classname);
        if (child) return child;
    }
    
    return NULL;
}

// Вспомогательные функции - выносим их в начало файла
static void find_manga_items_asura(GumboNode* node, cJSON* manga_array) {
    if (node->type != GUMBO_NODE_ELEMENT) return;
    
    // Ищем div с классом grid
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "div") == 0) {
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, "grid")) {
            // Ищем ссылки внутри div.grid
            for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
                GumboNode* child = node->v.element.children.data[i];
                if (child->type == GUMBO_NODE_ELEMENT && 
                    strcmp(gumbo_normalized_tagname(child->v.element.tag), "a") == 0) {
                    
                    GumboAttribute* href = gumbo_get_attribute(&child->v.element.attributes, "href");
                    if (href && strstr(href->value, "/series/")) {
                        // Извлекаем ID из URL
                        const char* id_start = strstr(href->value, "/series/");
                        if (id_start) {
                            id_start += 8; // Пропускаем "/series/"
                            char id[100];
                            strncpy(id, id_start, 99);
                            id[99] = '\0';
                            
                            // Ищем обложку (img внутри ссылки)
                            const char* cover = NULL;
                            for (unsigned int j = 0; j < child->v.element.children.length; ++j) {
                                GumboNode* img = child->v.element.children.data[j];
                                if (img->type == GUMBO_NODE_ELEMENT && 
                                    strcmp(gumbo_normalized_tagname(img->v.element.tag), "img") == 0) {
                                    GumboAttribute* src = gumbo_get_attribute(&img->v.element.attributes, "src");
                                    if (src) {
                                        cover = src->value;
                                        break;
                                    }
                                }
                            }
                            
                            // Ищем заголовок (span с классом block)
                            const char* title = NULL;
                            for (unsigned int j = 0; j < child->v.element.children.length; ++j) {
                                GumboNode* span = child->v.element.children.data[j];
                                if (span->type == GUMBO_NODE_ELEMENT && 
                                    strcmp(gumbo_normalized_tagname(span->v.element.tag), "span") == 0) {
                                    GumboAttribute* span_class = gumbo_get_attribute(&span->v.element.attributes, "class");
                                    if (span_class && strstr(span_class->value, "block")) {
                                        char* text = extract_text(span);
                                        if (text) {
                                            title = text;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if (title) {
                                cJSON* manga = cJSON_CreateObject();
                                cJSON_AddStringToObject(manga, "id", id);
                                cJSON_AddStringToObject(manga, "title", title);
                                cJSON_AddStringToObject(manga, "cover", cover ? cover : "");
                                cJSON_AddStringToObject(manga, "description", "");
                                cJSON_AddStringToObject(manga, "url", href->value);
                                cJSON_AddItemToArray(manga_array, manga);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Рекурсивно обрабатываем дочерние элементы
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        find_manga_items_asura(node->v.element.children.data[i], manga_array);
    }
}

static void check_has_more(GumboNode* node, int* has_more) {
    if (node->type != GUMBO_NODE_ELEMENT) return;
    
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "a") == 0) {
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, "flex") && strstr(class_attr->value, "bg-themecolor")) {
            char* text = extract_text(node);
            if (text && strstr(text, "Next")) {
                *has_more = 1;
            }
            if (text) free(text);
        }
    }
    
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        check_has_more(node->v.element.children.data[i], has_more);
    }
}

static char* find_author(GumboNode* node) {
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        GumboNode* child = node->v.element.children.data[i];
        if (child->type == GUMBO_NODE_ELEMENT && 
            strcmp(gumbo_normalized_tagname(child->v.element.tag), "div") == 0) {
            
            // Ищем div с h3 содержащим "Author"
            for (unsigned int j = 0; j < child->v.element.children.length; ++j) {
                GumboNode* h3 = child->v.element.children.data[j];
                if (h3->type == GUMBO_NODE_ELEMENT && 
                    strcmp(gumbo_normalized_tagname(h3->v.element.tag), "h3") == 0) {
                    char* text = extract_text(h3);
                    if (text && strstr(text, "Author")) {
                        // Следующий h3 содержит имя автора
                        if (j + 1 < child->v.element.children.length) {
                            GumboNode* author_h3 = child->v.element.children.data[j + 1];
                            if (author_h3->type == GUMBO_NODE_ELEMENT && 
                                strcmp(gumbo_normalized_tagname(author_h3->v.element.tag), "h3") == 0) {
                                char* author = extract_text(author_h3);
                                free(text);
                                return author;
                            }
                        }
                    }
                    if (text) free(text);
                }
            }
        }
    }
    return NULL;
}

static char* find_status(GumboNode* node) {
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        GumboNode* child = node->v.element.children.data[i];
        if (child->type == GUMBO_NODE_ELEMENT && 
            strcmp(gumbo_normalized_tagname(child->v.element.tag), "div") == 0) {
            
            for (unsigned int j = 0; j < child->v.element.children.length; ++j) {
                GumboNode* h3 = child->v.element.children.data[j];
                if (h3->type == GUMBO_NODE_ELEMENT && 
                    strcmp(gumbo_normalized_tagname(h3->v.element.tag), "h3") == 0) {
                    char* text = extract_text(h3);
                    if (text && strstr(text, "Status")) {
                        if (j + 1 < child->v.element.children.length) {
                            GumboNode* status_h3 = child->v.element.children.data[j + 1];
                            if (status_h3->type == GUMBO_NODE_ELEMENT && 
                                strcmp(gumbo_normalized_tagname(status_h3->v.element.tag), "h3") == 0) {
                                char* status = extract_text(status_h3);
                                free(text);
                                return status;
                            }
                        }
                    }
                    if (text) free(text);
                }
            }
        }
    }
    return NULL;
}

static void find_chapters_asura(GumboNode* node, cJSON* chapters) {
    if (node->type != GUMBO_NODE_ELEMENT) return;
    
    // Ищем div с классом group
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "div") == 0) {
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, "group")) {
            // Проверяем, что глава не заблокирована (нет svg)
            int unlocked = 1;
            for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
                GumboNode* child = node->v.element.children.data[i];
                if (child->type == GUMBO_NODE_ELEMENT && 
                    strcmp(gumbo_normalized_tagname(child->v.element.tag), "svg") == 0) {
                    unlocked = 0;
                    break;
                }
            }
            
            if (unlocked) {
                // Ищем ссылку на главу
                char* chapter_url = NULL;
                char* title = NULL;
                float chapter_num = -1.0;
                char* date = NULL;
                
                for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
                    GumboNode* child = node->v.element.children.data[i];
                    if (child->type == GUMBO_NODE_ELEMENT && 
                        strcmp(gumbo_normalized_tagname(child->v.element.tag), "a") == 0) {
                        chapter_url = extract_attribute(child, "href");
                        break;
                    }
                }
                
                // Ищем заголовок главы
                for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
                    GumboNode* child = node->v.element.children.data[i];
                    if (child->type == GUMBO_NODE_ELEMENT && 
                        strcmp(gumbo_normalized_tagname(child->v.element.tag), "h3") == 0) {
                        
                        // Ищем span внутри h3
                        for (unsigned int j = 0; j < child->v.element.children.length; ++j) {
                            GumboNode* span = child->v.element.children.data[j];
                            if (span->type == GUMBO_NODE_ELEMENT && 
                                strcmp(gumbo_normalized_tagname(span->v.element.tag), "span") == 0) {
                                title = extract_text(span);
                                break;
                            }
                        }
                        
                        // Ищем номер главы в h3 с классом text-sm
                        GumboAttribute* h3_class = gumbo_get_attribute(&child->v.element.attributes, "class");
                        if (h3_class && strstr(h3_class->value, "text-sm")) {
                            char* text = extract_text(child);
                            if (text) {
                                // Извлекаем номер из текста "Chapter X"
                                char* chapter_str = strstr(text, "Chapter");
                                if (chapter_str) {
                                    chapter_str += 7; // Пропускаем "Chapter"
                                    while (*chapter_str == ' ') chapter_str++;
                                    chapter_num = atof(chapter_str);
                                }
                                free(text);
                            }
                        }
                        
                        // Ищем дату в h3 без вложенных элементов
                        if (child->v.element.children.length == 1) {
                            GumboNode* text_node = child->v.element.children.data[0];
                            if (text_node->type == GUMBO_NODE_TEXT) {
                                date = strdup(text_node->v.text.text);
                            }
                        }
                    }
                }
                
                if (chapter_url) {
                    cJSON* chapter = cJSON_CreateObject();
                    cJSON_AddStringToObject(chapter, "id", chapter_url);
                    cJSON_AddStringToObject(chapter, "title", title ? title : "");
                    cJSON_AddNumberToObject(chapter, "chapter", chapter_num);
                    cJSON_AddStringToObject(chapter, "date_updated", date ? date : "");
                    cJSON_AddStringToObject(chapter, "url", chapter_url);
                    cJSON_AddItemToArray(chapters, chapter);
                    
                    if (title) free(title);
                    if (date) free(date);
                    free(chapter_url);
                }
            }
        }
    }
    
    // Рекурсивно обрабатываем дочерние элементы
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        find_chapters_asura(node->v.element.children.data[i], chapters);
    }
}

// Основные экспортируемые функции
char* get_manga_list_asura(char* url) {
    // Освобождаем предыдущие данные
    if (current_html) {
        free(current_html);
    }
    if (current_url) {
        free(current_url);
    }
    
    // Сохраняем новые данные
    current_html = strdup(url);
    current_url = strdup(url);
    
    GumboOutput* output = gumbo_parse(current_html);
    cJSON* result = cJSON_CreateObject();
    cJSON* manga_array = cJSON_CreateArray();
    cJSON_AddItemToObject(result, "manga_list", manga_array);
    
    // Ищем блоки с мангой на странице AsuraScans
    find_manga_items_asura(output->root, manga_array);
    
    // Проверяем наличие кнопки "Next" для определения has_more
    int has_more = 0;
    check_has_more(output->root, &has_more);
    cJSON_AddBoolToObject(result, "has_more", has_more);
    
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);
    
    return result_str;
}

char* get_manga_details_asura(char* url) {
    if (current_html) {
        free(current_html);
    }
    if (current_url) {
        free(current_url);
    }
    
    current_html = strdup(url);
    current_url = strdup(url);
    
    GumboOutput* output = gumbo_parse(current_html);
    cJSON* result = cJSON_CreateObject();
    
    // Ищем wrapper div с классом grid grid-cols-12
    GumboNode* wrapper = find_by_class(output->root, "div", "grid grid-cols-12");
    if (wrapper) {
        // Ищем обложку
        GumboNode* img = find_by_class(wrapper, "img", "");
        if (img) {
            char* cover = extract_attribute(img, "src");
            if (cover) {
                cJSON_AddStringToObject(result, "cover", cover);
                free(cover);
            }
        }
        
        // Ищем заголовок
        GumboNode* title_span = find_by_class(wrapper, "span", "text-xl font-bold");
        if (title_span) {
            char* title = extract_text(title_span);
            if (title) {
                cJSON_AddStringToObject(result, "title", title);
                free(title);
            }
        }
        
        // Ищем описание
        GumboNode* desc_span = find_by_class(wrapper, "span", "font-medium text-sm");
        if (desc_span) {
            char* description = extract_text(desc_span);
            if (description) {
                cJSON_AddStringToObject(result, "description", description);
                free(description);
            }
        }
        
        // Ищем автора
        char* author = find_author(wrapper);
        if (author) {
            cJSON_AddStringToObject(result, "author", author);
            free(author);
        } else {
            cJSON_AddStringToObject(result, "author", "");
        }
        
        // Ищем статус
        char* status = find_status(wrapper);
        if (status) {
            cJSON_AddStringToObject(result, "status", status);
            free(status);
        } else {
            cJSON_AddStringToObject(result, "status", "unknown");
        }
        
        // Ищем жанры
        cJSON* genres = cJSON_CreateArray();
        for (unsigned int i = 0; i < wrapper->v.element.children.length; ++i) {
            GumboNode* child = wrapper->v.element.children.data[i];
            if (child->type == GUMBO_NODE_ELEMENT && 
                strcmp(gumbo_normalized_tagname(child->v.element.tag), "button") == 0) {
                GumboAttribute* class_attr = gumbo_get_attribute(&child->v.element.attributes, "class");
                if (class_attr && strstr(class_attr->value, "text-white")) {
                    char* genre = extract_text(child);
                    if (genre) {
                        cJSON_AddItemToArray(genres, cJSON_CreateString(genre));
                        free(genre);
                    }
                }
            }
        }
        cJSON_AddItemToObject(result, "genres", genres);
    }
    
    // Добавляем остальные поля
    cJSON_AddStringToObject(result, "artist", "");
    cJSON_AddStringToObject(result, "tags", "");
    
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);
    
    return result_str;
}

char* get_chapter_list_asura(char* url) {
    if (current_html) {
        free(current_html);
    }
    if (current_url) {
        free(current_url);
    }
    
    current_html = strdup(url);
    current_url = strdup(url);
    
    GumboOutput* output = gumbo_parse(current_html);
    cJSON* chapters = cJSON_CreateArray();
    
    // Ищем блоки с главами (div.scrollbar-thumb-themecolor > div.group)
    find_chapters_asura(output->root, chapters);
    
    char* result_str = cJSON_PrintUnformatted(chapters);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(chapters);
    
    return result_str;
}

char* get_chapter_pages_asura(const char* html, const char* url) {
    if (current_html) {
        free(current_html);
    }
    if (current_url) {
        free(current_url);
    }
    
    current_html = strdup(html);
    current_url = strdup(url);
    
    cJSON* pages = cJSON_CreateArray();
    
    // Ищем "pages":[{"order":1,"url":"https://gg.asuracomic.net/storage/media..."}, ...]
    const char* p = strstr(current_html, "\"pages\":[");
    if (p) {
        p += 9; // skip "pages":[
        int index = 1;
        while (1) {
            const char* url_start = strstr(p, "https://gg.asuracomic.net/storage/media/");
            if (!url_start) break;
            const char* url_end = strchr(url_start, '\"');
            if (!url_end) break;
            int len = url_end - url_start;
            char url[1024];
            strncpy(url, url_start, len);
            url[len] = '\0';
            cJSON* page = cJSON_CreateObject();
            cJSON_AddNumberToObject(page, "index", index++);
            cJSON_AddStringToObject(page, "url", url);
            cJSON_AddItemToArray(pages, page);
            p = url_end + 1;
        }
    }
    
    char* result_str = cJSON_PrintUnformatted(pages);
    cJSON_Delete(pages);
    
    return result_str;
}

// Функция очистки памяти
EMSCRIPTEN_KEEPALIVE
void cleanup_asura() {
    if (current_html) {
        free(current_html);
        current_html = NULL;
    }
    if (current_url) {
        free(current_url);
        current_url = NULL;
    }
} 
