#!/bin/bash

# Скрипт сборки WASM парсера для AsuraScans
# Компилирует общий main.c вместе с специфичным parser.c

set -e

# Пути к файлам
WASM_SRC_DIR="../../mangaplatgh/wasm/src"
PARSER_C="parser.c"
OUTPUT_DIR="."
OUTPUT_NAME="asurascans_parser.wasm"

# Проверяем наличие необходимых файлов
if [ ! -f "$WASM_SRC_DIR/main.c" ]; then
    echo "Ошибка: Файл $WASM_SRC_DIR/main.c не найден"
    exit 1
fi

if [ ! -f "$PARSER_C" ]; then
    echo "Ошибка: Файл $PARSER_C не найден"
    exit 1
fi

echo "Сборка WASM парсера для AsuraScans..."

# Компилируем WASM модуль с библиотеками Gumbo и cJSON
emcc \
    "$WASM_SRC_DIR/main.c" \
    "$PARSER_C" \
    -I"$WASM_SRC_DIR/gumbo/src" \
    -I"$WASM_SRC_DIR/cJSON" \
    "$WASM_SRC_DIR/gumbo/src/attribute.c" \
    "$WASM_SRC_DIR/gumbo/src/char_ref.c" \
    "$WASM_SRC_DIR/gumbo/src/error.c" \
    "$WASM_SRC_DIR/gumbo/src/parser.c" \
    "$WASM_SRC_DIR/gumbo/src/string_buffer.c" \
    "$WASM_SRC_DIR/gumbo/src/string_piece.c" \
    "$WASM_SRC_DIR/gumbo/src/tag.c" \
    "$WASM_SRC_DIR/gumbo/src/tokenizer.c" \
    "$WASM_SRC_DIR/gumbo/src/utf8.c" \
    "$WASM_SRC_DIR/gumbo/src/util.c" \
    "$WASM_SRC_DIR/gumbo/src/vector.c" \
    "$WASM_SRC_DIR/cJSON/cJSON.c" \
    -o "$OUTPUT_DIR/$OUTPUT_NAME" \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free","_get_manga_list","_get_manga_details","_get_chapter_list","_get_chapter_pages","_cleanup","_get_manga_list_asura","_get_manga_details_asura","_get_chapter_list_asura","_get_chapter_pages_asura","_cleanup_asura"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=65536 \
    -s MAXIMUM_MEMORY=16777216 \
    -O2 \
    --no-entry

echo "Сборка завершена: $OUTPUT_DIR/$OUTPUT_NAME"

# Проверяем размер файла
if [ -f "$OUTPUT_DIR/$OUTPUT_NAME" ]; then
    SIZE=$(du -h "$OUTPUT_DIR/$OUTPUT_NAME" | cut -f1)
    echo "Размер файла: $SIZE"
else
    echo "Ошибка: Файл не был создан"
    exit 1
fi 