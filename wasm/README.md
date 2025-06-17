# WASM-парсер на C/C++

## Зависимости
- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
- [Gumbo Parser](https://github.com/google/gumbo-parser)
- [cJSON](https://github.com/DaveGamble/cJSON)

## Сборка локально

```sh
# Установить Emscripten (один раз)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Клонировать зависимости и собрать
cd /path/to/GitHubRepository/wasm
./build.sh
```

## Структура
- `src/main.c` — основной парсер
- `src/gumbo/` — исходники Gumbo Parser
- `src/cJSON/` — исходники cJSON
- `build.sh` — скрипт сборки

## Использование
- После сборки появятся файлы `manga_parser.js` и `manga_parser.wasm`.
- Вызывайте функцию `get_manga_details(html)` из JS/Swift, передавая HTML-страницу.
- Возвращается JSON с деталями манги.

## CI/CD
- Автоматическая сборка через GitHub Actions (см. `.github/workflows/build.yml`). 