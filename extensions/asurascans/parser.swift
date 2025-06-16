import Foundation

struct AsuraScansManga: Codable, Identifiable {
    let id: String
    let title: String
    let coverUrl: String
}

struct AsuraScansParser {
    let baseUrl: String
    
    func getMangaList() async throws -> [AsuraScansManga] {
        // Пример: парсим фейковый JSON (реально тут должен быть парсинг HTML или API)
        let url = URL(string: "https://asuratoon.com/api/manga-list.json")!
        let (data, _) = try await URLSession.shared.data(from: url)
        let mangas = try JSONDecoder().decode([AsuraScansManga].self, from: data)
        return mangas
    }
} 