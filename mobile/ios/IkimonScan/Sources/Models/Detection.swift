import Foundation
import CoreLocation
import UIKit

/// 検出結果のデータモデル
struct Detection: Identifiable {
    let id: UUID
    let taxonName: String
    let scientificName: String
    let confidence: Float
    var screenPosition: CGPoint
    let timestamp: Date
    let location: CLLocationCoordinate2D?
    var thumbnail: UIImage?
    let type: DetectionType

    var icon: String {
        switch type {
        case .audio: return "waveform"
        case .visual: return "camera"
        case .sensor: return "sensor.fill"
        }
    }

    /// API送信用の辞書に変換
    func toEventDict() -> [String: Any] {
        var dict: [String: Any] = [
            "type": type.rawValue,
            "taxon_name": taxonName,
            "scientific_name": scientificName,
            "confidence": confidence,
            "timestamp": ISO8601DateFormatter().string(from: timestamp),
            "model": "vision_classify_v1",
        ]
        if let loc = location {
            dict["lat"] = loc.latitude
            dict["lng"] = loc.longitude
        }
        return dict
    }
}

enum DetectionType: String {
    case audio = "audio"
    case visual = "visual"
    case sensor = "sensor"
}

/// スキャンセッションのサマリー
struct ScanSession: Identifiable {
    let id: UUID
    let date: Date
    let durationSeconds: Int
    let detections: [Detection]

    var speciesCount: Int {
        Set(detections.map(\.taxonName)).count
    }

    var topDetections: [Detection] {
        var seen: Set<String> = []
        return detections.filter { det in
            guard !seen.contains(det.taxonName) else { return false }
            seen.insert(det.taxonName)
            return true
        }
    }

    var dateString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d HH:mm"
        return fmt.string(from: date)
    }
}
