#!/bin/bash
set -e
cd src
emcc main.c gumbo/src/*.c cJSON/*.c -I./gumbo/src -I./cJSON -s WASM=1 -s EXPORTED_FUNCTIONS='["_get_manga_list", "_get_manga_details", "_get_chapter_pages"]' -o ../manga_parser.js 
