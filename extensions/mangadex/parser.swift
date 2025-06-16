import Foundation

struct MangaDexParser {
    private let baseUrl: String
    private let apiUrl: String
    
    init(baseUrl: String) {
        self.baseUrl = baseUrl
        self.apiUrl = "\(baseUrl)/api/v2"
    }
    
    func getMangaList() async throws -> [Manga] {
        let url = URL(string: "\(apiUrl)/manga")!
        let (data, _) = try await URLSession.shared.data(from: url)
        // Здесь будет парсинг JSON ответа от API
        return []
    }
    
    func getMangaDetails(id: String) async throws -> MangaDetails {
        let url = URL(string: "\(apiUrl)/manga/\(id)")!
        let (data, _) = try await URLSession.shared.data(from: url)
        // Здесь будет парсинг JSON ответа от API
        return MangaDetails(id: id, title: "", description: "", chapters: [])
    }
    
    func getChapterPages(chapterId: String) async throws -> [String] {
        let url = URL(string: "\(apiUrl)/at-home/server/\(chapterId)")!
        let (data, _) = try await URLSession.shared.data(from: url)
        // Здесь будет парсинг JSON ответа от API
        return []
    }
} 