#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>
#include "gumbo.h"
#include "cJSON.h"

#define BASE_URL "https://asuracomic.net"

// Вспомогательные функции для работы с HTML
const char* find_text_by_class(GumboNode* node, const char* tag, const char* class_name) {
    if (node->type != GUMBO_NODE_ELEMENT) return NULL;
    GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
    if (class_attr && strstr(class_attr->value, class_name)) {
        if (strcmp(tag, gumbo_normalized_tagname(node->v.element.tag)) == 0) {
            for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
                GumboNode* child = node->v.element.children.data[i];
                if (child->type == GUMBO_NODE_TEXT) return child->v.text.text;
            }
        }
    }
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        const char* result = find_text_by_class(node->v.element.children.data[i], tag, class_name);
        if (result) return result;
    }
    return NULL;
}

const char* find_attr_by_class(GumboNode* node, const char* tag, const char* class_name, const char* attr) {
    if (node->type != GUMBO_NODE_ELEMENT) return NULL;
    GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
    if (class_attr && strstr(class_attr->value, class_name)) {
        if (strcmp(tag, gumbo_normalized_tagname(node->v.element.tag)) == 0) {
            GumboAttribute* target_attr = gumbo_get_attribute(&node->v.element.attributes, attr);
            if (target_attr) return target_attr->value;
        }
    }
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        const char* result = find_attr_by_class(node->v.element.children.data[i], tag, class_name, attr);
        if (result) return result;
    }
    return NULL;
}

// Получение списка манги
EMSCRIPTEN_KEEPALIVE
const char* get_manga_list(const char* html, const char* filters_json) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* result = cJSON_CreateObject();
    cJSON* manga_array = cJSON_CreateArray();
    cJSON_AddItemToObject(result, "manga", manga_array);

    // Парсим фильтры
    cJSON* filters = cJSON_Parse(filters_json);
    if (filters) {
        // TODO: Применить фильтры к URL
        cJSON_Delete(filters);
    }

    // Ищем все манги в сетке
    GumboNode* root = output->root;
    GumboVector* children = &root->v.element.children;
    for (unsigned int i = 0; i < children->length; ++i) {
        GumboNode* node = children->data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;

        // Ищем ссылки на мангу
        if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "a") == 0) {
            GumboAttribute* href = gumbo_get_attribute(&node->v.element.attributes, "href");
            if (!href || !strstr(href->value, "/series/")) continue;

            // Получаем URL
            char* url = malloc(strlen(BASE_URL) + strlen(href->value) + 1);
            sprintf(url, "%s%s", BASE_URL, href->value);

            // Ищем обложку
            const char* cover = find_attr_by_class(node, "img", "w-full", "src");
            if (!cover) continue;

            // Ищем название
            const char* title = find_text_by_class(node, "span", "block text-[13.3px] font-bold");
            if (!title) continue;

            // Создаем объект манги
            cJSON* manga = cJSON_CreateObject();
            cJSON_AddStringToObject(manga, "title", title);
            cJSON_AddStringToObject(manga, "url", url);
            cJSON_AddStringToObject(manga, "cover", cover);
            cJSON_AddItemToArray(manga_array, manga);

            free(url);
        }
    }

    // Проверяем наличие следующей страницы
    int has_more = 0;
    for (unsigned int i = 0; i < children->length; ++i) {
        GumboNode* node = children->data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;
        if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "a") == 0) {
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "flex bg-themecolor")) {
                const char* text = find_text_by_class(node, "span", "");
                if (text && strcmp(text, "Next") == 0) {
                    has_more = 1;
                    break;
                }
            }
        }
    }
    cJSON_AddBoolToObject(result, "has_more", has_more);

    // Формируем результат
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);

    return result_str;
}

// Получение деталей манги
EMSCRIPTEN_KEEPALIVE
const char* get_manga_details(const char* html) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* result = cJSON_CreateObject();

    // Находим основной блок с информацией
    GumboNode* wrapper = NULL;
    for (unsigned int i = 0; i < output->root->v.element.children.length; ++i) {
        GumboNode* node = output->root->v.element.children.data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, "grid grid-cols-12")) {
            wrapper = node;
            break;
        }
    }

    if (wrapper) {
        // Обложка
        const char* cover = find_attr_by_class(wrapper, "img", "", "src");
        cJSON_AddStringToObject(result, "cover", cover ? cover : "");

        // Название
        const char* title = find_text_by_class(wrapper, "span", "text-xl font-bold");
        cJSON_AddStringToObject(result, "title", title ? title : "");

        // Автор и художник
        const char* author = find_text_by_class(wrapper, "h3", "Author");
        const char* artist = find_text_by_class(wrapper, "h3", "Artist");
        cJSON_AddStringToObject(result, "author", author ? author : "");
        cJSON_AddStringToObject(result, "artist", artist ? artist : "");

        // Описание
        const char* description = find_text_by_class(wrapper, "span", "font-medium text-sm");
        cJSON_AddStringToObject(result, "description", description ? description : "");

        // Жанры
        cJSON* genres = cJSON_CreateArray();
        for (unsigned int i = 0; i < wrapper->v.element.children.length; ++i) {
            GumboNode* node = wrapper->v.element.children.data[i];
            if (node->type != GUMBO_NODE_ELEMENT) continue;
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "text-white")) {
                const char* genre = find_text_by_class(node, "button", "text-white");
                if (genre) cJSON_AddItemToArray(genres, cJSON_CreateString(genre));
            }
        }
        cJSON_AddItemToObject(result, "genres", genres);

        // Статус
        const char* status_text = find_text_by_class(wrapper, "h3", "Status");
        char* status = "unknown";
        if (status_text) {
            if (strcmp(status_text, "Ongoing") == 0) status = "ongoing";
            else if (strcmp(status_text, "Hiatus") == 0) status = "hiatus";
            else if (strcmp(status_text, "Completed") == 0) status = "completed";
            else if (strcmp(status_text, "Dropped") == 0) status = "dropped";
            else if (strcmp(status_text, "Season End") == 0) status = "hiatus";
        }
        cJSON_AddStringToObject(result, "status", status);

        // Главы
        cJSON* chapters = cJSON_CreateArray();
        for (unsigned int i = 0; i < output->root->v.element.children.length; ++i) {
            GumboNode* node = output->root->v.element.children.data[i];
            if (node->type != GUMBO_NODE_ELEMENT) continue;
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "group")) {
                // Пропускаем блоки с SVG
                if (find_attr_by_class(node, "svg", "", "")) continue;

                const char* url = find_attr_by_class(node, "a", "", "href");
                const char* title = find_text_by_class(node, "span", "");
                const char* number_text = find_text_by_class(node, "h3", "text-sm");
                const char* date = find_text_by_class(node, "h3", "");

                if (url) {
                    cJSON* chapter = cJSON_CreateObject();
                    cJSON_AddStringToObject(chapter, "title", title ? title : "");
                    cJSON_AddStringToObject(chapter, "url", url);
                    if (number_text) {
                        char* number_str = strstr(number_text, "Chapter");
                        if (number_str) {
                            number_str += 7; // Skip "Chapter"
                            while (*number_str == ' ') number_str++;
                            cJSON_AddNumberToObject(chapter, "number", atof(number_str));
                        }
                    }
                    cJSON_AddStringToObject(chapter, "date", date ? date : "");
                    cJSON_AddItemToArray(chapters, chapter);
                }
            }
        }
        cJSON_AddItemToObject(result, "chapters", chapters);
    }

    // Формируем результат
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);

    return result_str;
}

// Получение страниц главы
EMSCRIPTEN_KEEPALIVE
const char* get_chapter_pages(const char* html) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* pages = cJSON_CreateArray();

    // Ищем изображения в HTML
    for (unsigned int i = 0; i < output->root->v.element.children.length; ++i) {
        GumboNode* node = output->root->v.element.children.data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;
        if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "img") == 0) {
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "chapter-image")) {
                GumboAttribute* src = gumbo_get_attribute(&node->v.element.attributes, "src");
                if (src) {
                    cJSON* page = cJSON_CreateObject();
                    cJSON_AddNumberToObject(page, "index", cJSON_GetArraySize(pages) + 1);
                    cJSON_AddStringToObject(page, "url", src->value);
                    cJSON_AddItemToArray(pages, page);
                }
            }
        }
    }

    // Если не нашли изображения в HTML, ищем в скриптах
    if (cJSON_GetArraySize(pages) == 0) {
        for (unsigned int i = 0; i < output->root->v.element.children.length; ++i) {
            GumboNode* node = output->root->v.element.children.data[i];
            if (node->type != GUMBO_NODE_ELEMENT) continue;
            if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "script") == 0) {
                const char* content = find_text_by_class(node, "script", "");
                if (content && strstr(content, "\"pages\":[")) {
                    // TODO: Парсинг JSON из скрипта
                }
            }
        }
    }

    // Формируем результат
    char* result_str = cJSON_PrintUnformatted(pages);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(pages);

    return result_str;
} 
