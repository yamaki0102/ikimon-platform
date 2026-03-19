import Vision
import CoreML
import UIKit
import CoreLocation

/// 2段階推論パイプライン:
/// Stage 1: Vision Framework の物体検出（生物らしいものを検出）
/// Stage 2: Core ML 分類モデル（種名を推定）
///
/// 初期バージョンでは Vision の組み込み分類器を使用。
/// 将来: カスタム YOLO + 種分類モデルに置き換え。
@MainActor
class SpeciesDetector: ObservableObject {
    @Published var activeDetections: [Detection] = []
    @Published var recentDetections: [Detection] = []
    @Published var allDetections: [Detection] = []
    @Published var uniqueSpeciesCount: Int = 0

    private var seenSpecies: Set<String> = []
    private var isProcessing = false
    private let locationManager = CLLocationManager()
    private var currentLocation: CLLocationCoordinate2D?

    // 検出の閾値
    private let autoRecordThreshold: Float = 0.70
    private let displayThreshold: Float = 0.40

    // トラッキング: 同じ物体の連続検出を防ぐ
    private var recentlyDetectedTaxa: [String: Date] = [:]
    private let deduplicationInterval: TimeInterval = 5.0 // 5秒以内の同一種は無視

    // 組み込み分類リクエスト
    private lazy var classificationRequest: VNClassifyImageRequest = {
        let request = VNClassifyImageRequest { [weak self] request, error in
            guard let results = request.results as? [VNClassificationObservation] else { return }
            Task { @MainActor in
                self?.handleClassificationResults(results)
            }
        }
        #if targetEnvironment(simulator)
        // シミュレータでは利用不可
        #else
        request.revision = VNClassifyImageRequestRevision1
        #endif
        return request
    }()

    // 物体検出リクエスト
    private lazy var objectDetectionRequest: VNDetectRectanglesRequest = {
        let request = VNDetectRectanglesRequest { [weak self] request, error in
            // 将来: YOLO カスタムモデルに置き換え
        }
        request.maximumObservations = 10
        return request
    }()

    func startSession() {
        seenSpecies.removeAll()
        allDetections.removeAll()
        recentDetections.removeAll()
        activeDetections.removeAll()
        uniqueSpeciesCount = 0
        recentlyDetectedTaxa.removeAll()

        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }

    func endSession() {
        locationManager.stopUpdatingLocation()
    }

    /// カメラフレームを受け取って推論を実行
    nonisolated func detect(in pixelBuffer: CVPixelBuffer) {
        // メインスレッドではない
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        do {
            // Vision 組み込み分類（初期バージョン）
            let request = VNClassifyImageRequest { request, error in
                guard let results = request.results as? [VNClassificationObservation] else { return }
                Task { @MainActor [weak self] in
                    self?.handleClassificationResults(results)
                }
            }
            try handler.perform([request])
        } catch {
            // 推論エラーは無視（次のフレームでリトライ）
        }
    }

    /// 分類結果を処理
    private func handleClassificationResults(_ results: [VNClassificationObservation]) {
        // 生物関連のカテゴリだけフィルタ
        let bioResults = results.filter { observation in
            let id = observation.identifier.lowercased()
            return isBiologicalCategory(id) && observation.confidence >= displayThreshold
        }

        // トップ3を取得
        let topResults = Array(bioResults.prefix(3))

        // アクティブ検出を更新
        activeDetections = topResults.enumerated().map { index, obs in
            let screenY = CGFloat(100 + index * 80)
            return Detection(
                id: UUID(),
                taxonName: mapToJapaneseName(obs.identifier),
                scientificName: obs.identifier,
                confidence: obs.confidence,
                screenPosition: CGPoint(x: UIScreen.main.bounds.width / 2, y: screenY),
                timestamp: Date(),
                location: currentLocation,
                thumbnail: nil,
                type: .visual
            )
        }

        // 新しい種を記録
        for detection in activeDetections {
            guard detection.confidence >= autoRecordThreshold else { continue }

            let taxonKey = detection.taxonName
            let now = Date()

            // 重複排除
            if let lastSeen = recentlyDetectedTaxa[taxonKey],
               now.timeIntervalSince(lastSeen) < deduplicationInterval {
                continue
            }

            recentlyDetectedTaxa[taxonKey] = now

            if !seenSpecies.contains(taxonKey) {
                seenSpecies.insert(taxonKey)
                uniqueSpeciesCount = seenSpecies.count

                // 触覚フィードバック
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            }

            allDetections.append(detection)
            recentDetections.insert(detection, at: 0)
            if recentDetections.count > 10 {
                recentDetections.removeLast()
            }
        }
    }

    /// Vision の分類名が生物かどうか判定
    private func isBiologicalCategory(_ identifier: String) -> Bool {
        let bioKeywords = [
            "bird", "insect", "butterfly", "moth", "beetle", "spider",
            "flower", "plant", "tree", "mushroom", "fungus", "fern",
            "fish", "frog", "lizard", "snake", "turtle",
            "mammal", "cat", "dog", "deer", "rabbit",
            "dragonfly", "bee", "wasp", "ant",
            "leaf", "blossom", "seed", "fruit",
        ]
        return bioKeywords.contains { identifier.contains($0) }
    }

    /// Vision の英語分類名を日本語名にマッピング（暫定）
    /// 将来: ikimon.life の Taxon API を使ってリアルタイム変換
    private func mapToJapaneseName(_ identifier: String) -> String {
        let mapping: [String: String] = [
            "bird": "鳥類",
            "butterfly": "チョウ",
            "moth": "ガ",
            "beetle": "甲虫",
            "spider": "クモ",
            "dragonfly": "トンボ",
            "bee": "ハチ",
            "flower": "花",
            "mushroom": "キノコ",
            "frog": "カエル",
            "lizard": "トカゲ",
            "tree": "樹木",
        ]

        let lower = identifier.lowercased()
        for (key, value) in mapping {
            if lower.contains(key) { return value }
        }
        return identifier
    }
}
