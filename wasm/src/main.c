#include <stdio.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "gumbo.h"
#include "cJSON.h"

// Поиск текста по тегу и классу
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

EMSCRIPTEN_KEEPALIVE
const char* get_manga_details(const char* html) {
    GumboOutput* output = gumbo_parse(html);
    const char* title = find_text_by_class(output->root, "span", "text-xl font-bold");
    const char* cover = ""; // Можно добавить аналогичный поиск по img[alt=poster]
    gumbo_destroy_output(&kGumboDefaultOptions, output);

    cJSON* json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "title", title ? title : "");
    cJSON_AddStringToObject(json, "cover", cover);
    static char buffer[1024];
    snprintf(buffer, sizeof(buffer), "%s", cJSON_PrintUnformatted(json));
    cJSON_Delete(json);
    return buffer;
} 