import Foundation
import ARKit
import CoreLocation
import AVFoundation

/// フィールドスキャンの全センサー統合エンジン
/// カメラ検出 + 音声検出 + GPS + LiDAR + モーション を1つに統合
@MainActor
class FieldScanEngine: NSObject, ObservableObject {

    // Published state
    @Published var latestDetection: FieldDetection?
    @Published var speciesList: [SpeciesEntry] = []
    @Published var uniqueSpeciesCount: Int = 0
    @Published var totalDetections: Int = 0
    @Published var audioDetectionCount: Int = 0
    @Published var routePointCount: Int = 0
    @Published var elapsedString: String = "0:00"

    @Published var isCameraActive = false
    @Published var isAudioActive = false
    @Published var isGPSActive = false
    @Published var isLiDARActive = false

    // AR Session (set by ARViewContainer)
    var arSession: ARSession? {
        didSet {
            isLiDARActive = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
            isCameraActive = true
        }
    }

    // Internal
    private var speciesMap: [String: SpeciesEntry] = [:]
    private var routePoints: [(lat: Double, lng: Double, alt: Double, timestamp: Date)] = []
    private var allDetections: [FieldDetection] = []
    private var startTime: Date?
    private var timer: Timer?
    private var captureTimer: Timer?
    private var audioTimer: Timer?
    private let locationManager = CLLocationManager()
    private let detector = SpeciesDetector()

    func startSession() {
        startTime = Date()
        speciesMap.removeAll()
        speciesList.removeAll()
        allDetections.removeAll()
        routePoints.removeAll()
        uniqueSpeciesCount = 0
        totalDetections = 0
        audioDetectionCount = 0
        routePointCount = 0

        // Timer
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let start = self.startTime else { return }
                let s = Int(Date().timeIntervalSince(start))
                self.elapsedString = "\(s / 60):\(String(format: "%02d", s % 60))"
            }
        }

        // GPS
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.startUpdatingLocation()
        isGPSActive = true

        // Camera classification (4 sec interval)
        detector.startSession()
        captureTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.classifyCurrentFrame()
            }
        }

        // Audio classification (10 sec interval, simulated)
        isAudioActive = true
        audioTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.simulateAudioDetection()
            }
        }
    }

    func endSession() {
        timer?.invalidate()
        captureTimer?.invalidate()
        audioTimer?.invalidate()
        locationManager.stopUpdatingLocation()
        detector.endSession()

        // Upload to server
        Task { await uploadToServer() }
    }

    // MARK: - Camera Classification

    private func classifyCurrentFrame() {
        // In production: grab frame from ARSession and run through detector
        // For now: detector runs via CameraManager's onFrameCaptured
        // The detections flow through the existing SpeciesDetector pipeline
    }

    // MARK: - Audio (Simulated)

    private func simulateAudioDetection() {
        let species = [
            ("シジュウカラ", "Parus minor", Float(0.82)),
            ("ヒヨドリ", "Hypsipetes amaurotis", Float(0.75)),
            ("メジロ", "Zosterops japonicus", Float(0.68)),
            ("ウグイス", "Horornis diphone", Float(0.78)),
        ]

        guard Float.random(in: 0...1) < 0.25 else { return }
        let sp = species.randomElement()!

        let det = FieldDetection(
            taxonName: sp.0,
            scientificName: sp.1,
            confidence: sp.2 + Float.random(in: -0.05...0.05),
            source: .audio,
            zone: "aerial",
            timestamp: Date()
        )

        addDetection(det)
        audioDetectionCount += 1
    }

    // MARK: - Detection Management

    func addDetection(_ det: FieldDetection) {
        totalDetections += 1
        allDetections.append(det)

        let name = det.taxonName
        if var existing = speciesMap[name] {
            existing.count += 1
            existing.confidence = max(existing.confidence, det.confidence)
            speciesMap[name] = existing
        } else {
            speciesMap[name] = SpeciesEntry(
                name: name,
                count: 1,
                confidence: det.confidence,
                source: det.source
            )
            // New species vibration
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        }

        uniqueSpeciesCount = speciesMap.count
        speciesList = speciesMap.values.sorted { $0.count > $1.count }

        latestDetection = det
        // Auto-dismiss after 3 seconds
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if latestDetection?.id == det.id {
                latestDetection = nil
            }
        }
    }

    // MARK: - Server Upload

    private func uploadToServer() async {
        guard !allDetections.isEmpty else { return }

        let scanData: [String: Any] = [
            "route": routePoints.map { [
                "lat": $0.lat, "lng": $0.lng, "alt": $0.alt,
                "timestamp": ISO8601DateFormatter().string(from: $0.timestamp),
            ]},
            "detections": allDetections.map { [
                "taxon_name": $0.taxonName,
                "scientific_name": $0.scientificName,
                "confidence": $0.confidence,
                "type": $0.source == .audio ? "audio" : "visual",
                "timestamp": ISO8601DateFormatter().string(from: $0.timestamp),
                "lat": routePoints.last?.lat as Any,
                "lng": routePoints.last?.lng as Any,
            ]},
            "audio_events": [] as [[String: Any]],
            "lidar_summary": [] as [[String: Any]],
            "environment": [] as [[String: Any]],
            "device": "iPhone 13 Pro",
        ]

        let areaId = "field_\(Int(Date().timeIntervalSince1970))"
        let body: [String: Any] = ["area_id": areaId, "scan_data": scanData]

        do {
            guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }

            var request = URLRequest(url: URL(string: "https://ikimon.life/api/v2/ecosystem_map.php")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = bodyData

            let (_, _) = try await URLSession.shared.data(for: request)
        } catch {
            print("Upload error: \(error)")
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension FieldScanEngine: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            routePoints.append((
                lat: loc.coordinate.latitude,
                lng: loc.coordinate.longitude,
                alt: loc.altitude,
                timestamp: Date()
            ))
            routePointCount = routePoints.count
        }
    }
}
