#!/bin/bash

# Скрипт сборки WASM парсера для AsuraScans
# Компилирует общий main.c вместе с специфичным parser.c

set -e

# Пути к файлам
WASM_SRC="../../wasm/src"
PARSER_C="parser.c"
OUTPUT_DIR="."
OUTPUT_NAME="asurascans_parser.wasm"

# Проверяем наличие необходимых файлов
if [ ! -f "$WASM_SRC/main.c" ]; then
    echo "Ошибка: Файл $WASM_SRC/main.c не найден"
    exit 1
fi

if [ ! -f "$PARSER_C" ]; then
    echo "Ошибка: Файл $PARSER_C не найден"
    exit 1
fi

echo "Сборка WASM парсера для AsuraScans..."

# Компилируем WASM модуль с библиотеками Gumbo и cJSON
emcc -O3 \
  -I "$WASM_SRC/cJSON" \
  -I "$WASM_SRC/gumbo/src" \
  "$WASM_SRC/cJSON/cJSON.c" \
  "$WASM_SRC/gumbo/src/"*.c \
  "$PARSER_C" \
  -o "$OUTPUT_DIR/$OUTPUT_NAME" \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_get_manga_list_asura","_get_manga_details_asura","_get_chapter_list_asura","_get_chapter_pages_asura","_cleanup_asura"]' \
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
