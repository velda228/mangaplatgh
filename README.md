# MangaPlatGH Extensions

Репозиторий расширений для приложения MangaPlatGH.

## Структура репозитория

```
extensions/
├── mangadex/
│   ├── config.json
│   └── parser.swift
├── mangaplus/
│   ├── config.json
│   └── parser.swift
└── index.json
```

## Формат расширения

### config.json
```json
{
    "name": "Название источника",
    "version": "1.0.0",
    "language": "ru",
    "baseUrl": "https://example.com",
    "iconUrl": "https://example.com/icon.png"
}
```

### parser.swift
```swift
import Foundation

struct MangaParser {
    func getMangaList() async throws -> [Manga] {
        // Реализация получения списка манги
    }
    
    func getMangaDetails(id: String) async throws -> MangaDetails {
        // Реализация получения деталей манги
    }
    
    func getChapterPages(chapterId: String) async throws -> [String] {
        // Реализация получения страниц главы
    }
}
```

## Как добавить новое расширение

1. Создайте новую папку в директории `extensions/` с названием вашего источника
2. Добавьте `config.json` с настройками источника
3. Добавьте `parser.swift` с реализацией парсера
4. Обновите `index.json` в корне директории `extensions/`

## Формат index.json
```json
{
    "extensions": [
        {
            "name": "MangaDex",
            "path": "mangadex",
            "version": "1.0.0",
            "language": "ru"
        }
    ]
}
```

# WASM-парсеры на C/C++

В этом репозитории будет папка `wasm/` для парсеров на C/C++ с поддержкой сборки в WebAssembly (WASM).

## Структура

- `wasm/src/` — исходники парсеров, библиотеки Gumbo и cJSON
- `wasm/build.sh` — скрипт сборки
- `wasm/README.md` — инструкция по сборке и использованию
- `.github/workflows/build.yml` — CI/CD для автоматической сборки WASM

## Быстрый старт

1. Установить Emscripten (см. wasm/README.md)
2. Собрать парсер:
   ```sh
   cd wasm
   ./build.sh
   ```
3. Использовать `manga_parser.wasm` и `manga_parser.js` в приложении 
