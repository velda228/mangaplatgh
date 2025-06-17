#!/bin/bash
set -e
cd src
emcc main.c gumbo/*.c cJSON/*.c -I./gumbo/src -I./cJSON -s WASM=1 -s EXPORTED_FUNCTIONS='["_get_manga_details"]' -o ../manga_parser.js 