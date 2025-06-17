#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>
#include "gumbo.h"
#include "cJSON.h"

#define BASE_URL "https://asuracomic.net"

// --- Вспомогательные функции ---
static void find_manga_items(GumboNode* node, cJSON* manga_array) {
    if (node->type != GUMBO_NODE_ELEMENT) return;
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "a") == 0) {
        GumboAttribute* href = gumbo_get_attribute(&node->v.element.attributes, "href");
        if (href && strstr(href->value, "/series/")) {
            char url[512];
            snprintf(url, sizeof(url), "%s%s", BASE_URL, href->value);
            const char* cover = NULL;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* child = node->v.element.children.data[j];
                if (child->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(child->v.element.tag), "img") == 0) {
                    GumboAttribute* src = gumbo_get_attribute(&child->v.element.attributes, "src");
                    if (src) { cover = src->value; break; }
                }
            }
            const char* title = NULL;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* child = node->v.element.children.data[j];
                if (child->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(child->v.element.tag), "span") == 0) {
                    GumboAttribute* class_attr = gumbo_get_attribute(&child->v.element.attributes, "class");
                    if (class_attr && strstr(class_attr->value, "block text-[13.3px] font-bold")) {
                        if (child->v.element.children.length > 0) {
                            GumboNode* text = child->v.element.children.data[0];
                            if (text->type == GUMBO_NODE_TEXT) { title = text->v.text.text; break; }
                        }
                    }
                }
            }
            if (title && cover) {
                cJSON* manga = cJSON_CreateObject();
                cJSON_AddStringToObject(manga, "title", title);
                cJSON_AddStringToObject(manga, "url", url);
                cJSON_AddStringToObject(manga, "cover", cover);
                cJSON_AddItemToArray(manga_array, manga);
            }
        }
    }
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        find_manga_items(node->v.element.children.data[i], manga_array);
    }
}

EMSCRIPTEN_KEEPALIVE
const char* get_manga_list(const char* html, const char* filters_json) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* result = cJSON_CreateObject();
    cJSON* manga_array = cJSON_CreateArray();
    cJSON_AddItemToObject(result, "manga", manga_array);
    find_manga_items(output->root, manga_array);
    int has_more = 0;
    GumboVector* children = &output->root->v.element.children;
    for (unsigned int i = 0; i < children->length; ++i) {
        GumboNode* node = children->data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;
        if (strcmp(gumbo_normalized_tagname(node->v.element.tag), "a") == 0) {
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "flex bg-themecolor")) {
                has_more = 1; break;
            }
        }
    }
    cJSON_AddBoolToObject(result, "has_more", has_more);
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);
    static char buffer[16384];
    snprintf(buffer, sizeof(buffer), "%s", result_str);
    free(result_str);
    return buffer;
}

// --- Детали манги ---
static GumboNode* find_by_class(GumboNode* node, const char* tag, const char* class_name) {
    if (node->type != GUMBO_NODE_ELEMENT) return NULL;
    if (strcmp(gumbo_normalized_tagname(node->v.element.tag), tag) == 0) {
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, class_name)) return node;
    }
    for (unsigned int i = 0; i < node->v.element.children.length; ++i) {
        GumboNode* found = find_by_class(node->v.element.children.data[i], tag, class_name);
        if (found) return found;
    }
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
const char* get_manga_details(const char* html) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* result = cJSON_CreateObject();
    GumboNode* wrapper = find_by_class(output->root, "div", "grid grid-cols-12");
    const char* cover = "";
    if (wrapper) {
        GumboNode* img = find_by_class(wrapper, "img", "");
        if (img) {
            GumboAttribute* src = gumbo_get_attribute(&img->v.element.attributes, "src");
            if (src) cover = src->value;
        }
    }
    cJSON_AddStringToObject(result, "cover", cover);
    const char* title = "";
    if (wrapper) {
        GumboNode* span = find_by_class(wrapper, "span", "text-xl font-bold");
        if (span && span->v.element.children.length > 0) {
            GumboNode* text = span->v.element.children.data[0];
            if (text->type == GUMBO_NODE_TEXT) title = text->v.text.text;
        }
    }
    cJSON_AddStringToObject(result, "title", title);
    const char* description = "";
    if (wrapper) {
        GumboNode* desc = find_by_class(wrapper, "span", "font-medium text-sm");
        if (desc && desc->v.element.children.length > 0) {
            GumboNode* text = desc->v.element.children.data[0];
            if (text->type == GUMBO_NODE_TEXT) description = text->v.text.text;
        }
    }
    cJSON_AddStringToObject(result, "description", description);
    cJSON* genres = cJSON_CreateArray();
    if (wrapper) {
        for (unsigned int i = 0; i < wrapper->v.element.children.length; ++i) {
            GumboNode* node = wrapper->v.element.children.data[i];
            if (node->type != GUMBO_NODE_ELEMENT) continue;
            GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
            if (class_attr && strstr(class_attr->value, "text-white")) {
                if (node->v.element.children.length > 0) {
                    GumboNode* text = node->v.element.children.data[0];
                    if (text->type == GUMBO_NODE_TEXT) cJSON_AddItemToArray(genres, cJSON_CreateString(text->v.text.text));
                }
            }
        }
    }
    cJSON_AddItemToObject(result, "genres", genres);
    cJSON_AddStringToObject(result, "author", "");
    cJSON_AddStringToObject(result, "artist", "");
    cJSON_AddStringToObject(result, "status", "unknown");
    char* result_str = cJSON_PrintUnformatted(result);
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    cJSON_Delete(result);
    static char buffer[8192];
    snprintf(buffer, sizeof(buffer), "%s", result_str);
    free(result_str);
    return buffer;
}

// --- Полная реализация парсинга глав ---
EMSCRIPTEN_KEEPALIVE
const char* get_chapter_list(const char* html) {
    GumboOutput* output = gumbo_parse(html);
    cJSON* chapters = cJSON_CreateArray();
    GumboNode* root = output->root;
    // Ищем div.scrollbar-thumb-themecolor > div.group
    for (unsigned int i = 0; i < root->v.element.children.length; ++i) {
        GumboNode* node = root->v.element.children.data[i];
        if (node->type != GUMBO_NODE_ELEMENT) continue;
        GumboAttribute* class_attr = gumbo_get_attribute(&node->v.element.attributes, "class");
        if (class_attr && strstr(class_attr->value, "group")) {
            // id и url
            const char* url = NULL;
            const char* id = NULL;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* a = node->v.element.children.data[j];
                if (a->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(a->v.element.tag), "a") == 0) {
                    GumboAttribute* href = gumbo_get_attribute(&a->v.element.attributes, "href");
                    if (href) {
                        url = href->value;
                        id = href->value; // Можно доработать для выделения id
                        break;
                    }
                }
            }
            // title
            const char* title = NULL;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* h3 = node->v.element.children.data[j];
                if (h3->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(h3->v.element.tag), "h3") == 0) {
                    if (h3->v.element.children.length > 0) {
                        GumboNode* span = h3->v.element.children.data[0];
                        if (span->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(span->v.element.tag), "span") == 0) {
                            if (span->v.element.children.length > 0) {
                                GumboNode* text = span->v.element.children.data[0];
                                if (text->type == GUMBO_NODE_TEXT) title = text->v.text.text;
                            }
                        }
                    }
                }
            }
            // chapter number (ищем в h3.text-sm)
            float chapter_num = 0;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* h3 = node->v.element.children.data[j];
                if (h3->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(h3->v.element.tag), "h3") == 0) {
                    GumboAttribute* class_attr2 = gumbo_get_attribute(&h3->v.element.attributes, "class");
                    if (class_attr2 && strstr(class_attr2->value, "text-sm")) {
                        if (h3->v.element.children.length > 0) {
                            GumboNode* text = h3->v.element.children.data[0];
                            if (text->type == GUMBO_NODE_TEXT) {
                                const char* txt = text->v.text.text;
                                const char* ch = strstr(txt, "Chapter");
                                if (ch) {
                                    ch += 7;
                                    while (*ch == ' ') ch++;
                                    chapter_num = atof(ch);
                                }
                            }
                        }
                    }
                }
            }
            // date (ищем в h3 без вложенных элементов)
            const char* date = NULL;
            for (unsigned int j = 0; j < node->v.element.children.length; ++j) {
                GumboNode* h3 = node->v.element.children.data[j];
                if (h3->type == GUMBO_NODE_ELEMENT && strcmp(gumbo_normalized_tagname(h3->v.element.tag), "h3") == 0) {
                    if (h3->v.element.children.length == 1) {
                        GumboNode* text = h3->v.element.children.data[0];
                        if (text->type == GUMBO_NODE_TEXT) date = text->v.text.text;
                    }
                }
            }
            cJSON* chapter = cJSON_CreateObject();
            cJSON_AddStringToObject(chapter, "id", id ? id : "");
            cJSON_AddStringToObject(chapter, "title", title ? title : "");
            cJSON_AddNumberToObject(chapter, "chapter", chapter_num);
            cJSON_AddStringToObject(chapter, "date_updated", date ? date : "");
            cJSON_AddStringToObject(chapter, "url", url ? url : "");
            cJSON_AddItemToArray(chapters, chapter);
        }
    }
    gumbo_destroy_output(&kGumboDefaultOptions, output);
    static char buffer[8192];
    snprintf(buffer, sizeof(buffer), "%s", cJSON_PrintUnformatted(chapters));
    cJSON_Delete(chapters);
    return buffer;
}

// --- Полная реализация парсинга страниц главы ---
EMSCRIPTEN_KEEPALIVE
const char* get_chapter_pages(const char* html) {
    cJSON* pages = cJSON_CreateArray();
    // Ищем "pages":[{"order":1,"url":"https://gg.asuracomic.net/storage/media..."}, ...]
    const char* p = strstr(html, "\"pages\":[");
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
    static char buffer[8192];
    snprintf(buffer, sizeof(buffer), "%s", cJSON_PrintUnformatted(pages));
    cJSON_Delete(pages);
    return buffer;
}
