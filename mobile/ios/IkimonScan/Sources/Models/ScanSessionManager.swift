import Foundation
import Combine

/// アプリ全体のセッション状態管理
@MainActor
class ScanSessionManager: ObservableObject {
    @Published var sessions: [ScanSession] = []
    @Published var totalDetections: Int = 0
    @Published var totalSpecies: Int = 0
    @Published var totalSessions: Int = 0

    var lastSession: ScanSession? { sessions.last }

    private let storageKey = "ikimon_scan_sessions"

    init() {
        loadFromStorage()
    }

    func addSession(detections: [Detection], duration: Int) {
        let session = ScanSession(
            id: UUID(),
            date: Date(),
            durationSeconds: duration,
            detections: detections
        )
        sessions.append(session)
        recalculateStats()
        saveToStorage()
    }

    private func recalculateStats() {
        totalSessions = sessions.count
        totalDetections = sessions.reduce(0) { $0 + $1.detections.count }
        let allSpecies = Set(sessions.flatMap { $0.detections.map(\.taxonName) })
        totalSpecies = allSpecies.count
    }

    // MARK: - Persistence (UserDefaults, 簡易版)

    private func saveToStorage() {
        let data = sessions.map { session -> [String: Any] in
            [
                "id": session.id.uuidString,
                "date": session.date.timeIntervalSince1970,
                "duration": session.durationSeconds,
                "species_count": session.speciesCount,
                "detection_count": session.detections.count,
            ]
        }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func loadFromStorage() {
        // 簡易版: セッション数だけ復元
        guard let data = UserDefaults.standard.array(forKey: storageKey) as? [[String: Any]] else { return }
        totalSessions = data.count
        totalDetections = data.reduce(0) { $0 + ($1["detection_count"] as? Int ?? 0) }
    }
}
