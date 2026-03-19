import Foundation

/// ikimon.life サーバー API クライアント
/// passive_event.php / scan_detection.php との通信
actor IkimonAPIClient {
    static let shared = IkimonAPIClient()

    private let baseURL: URL
    private let session: URLSession
    private var authToken: String?

    init(baseURL: String = "https://ikimon.life/api/v2") {
        self.baseURL = URL(string: baseURL)!
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    /// 認証トークンを設定
    func setAuthToken(_ token: String) {
        self.authToken = token
    }

    /// スキャン検出結果をバッチ送信
    /// POST /api/v2/scan_detection.php
    func submitScanDetections(
        detections: [Detection],
        sessionMeta: SessionMeta,
        photos: [Data] = []
    ) async throws -> ScanResponse {
        let url = baseURL.appendingPathComponent("scan_detection.php")

        // Multipart form data
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        addAuth(to: &request)

        var body = Data()

        // detections JSON
        let detectionsJSON = detections.enumerated().map { index, det -> [String: Any] in
            var dict = det.toEventDict()
            if index < photos.count {
                dict["photo_index"] = index
            }
            return dict
        }

        body.appendMultipartField(name: "detections", value: jsonString(detectionsJSON), boundary: boundary)

        // session meta JSON
        let sessionDict: [String: Any] = [
            "duration_sec": sessionMeta.durationSeconds,
            "distance_m": sessionMeta.distanceMeters,
            "device": sessionMeta.device,
            "app_version": sessionMeta.appVersion,
        ]
        body.appendMultipartField(name: "session", value: jsonString(sessionDict), boundary: boundary)

        // photos
        for (index, photoData) in photos.enumerated() {
            body.appendMultipartFile(name: "photos[]", filename: "scan_\(index).jpg", mimeType: "image/jpeg", data: photoData, boundary: boundary)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        return try JSONDecoder().decode(ScanResponse.self, from: data)
    }

    /// パッシブイベントをバッチ送信
    /// POST /api/v2/passive_event.php
    func submitPassiveEvents(
        events: [[String: Any]],
        sessionMeta: SessionMeta
    ) async throws -> PassiveResponse {
        let url = baseURL.appendingPathComponent("passive_event.php")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuth(to: &request)

        let body: [String: Any] = [
            "events": events,
            "session": [
                "duration_sec": sessionMeta.durationSeconds,
                "distance_m": sessionMeta.distanceMeters,
                "device": sessionMeta.device,
                "app_version": sessionMeta.appVersion,
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        return try JSONDecoder().decode(PassiveResponse.self, from: data)
    }

    // MARK: - Helpers

    private func addAuth(to request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        // Cookie ベース認証のフォールバック
        request.setValue("ikimon-scan/0.1.0", forHTTPHeaderField: "User-Agent")
    }

    private func jsonString(_ obj: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: obj),
              let str = String(data: data, encoding: .utf8) else { return "[]" }
        return str
    }
}

// MARK: - Models

struct SessionMeta {
    let durationSeconds: Int
    let distanceMeters: Int
    let device: String
    let appVersion: String

    static var current: SessionMeta {
        SessionMeta(
            durationSeconds: 0,
            distanceMeters: 0,
            device: "iPhone 13 Pro",
            appVersion: "0.1.0"
        )
    }
}

struct ScanResponse: Decodable {
    let success: Bool
    let data: ScanResponseData?

    struct ScanResponseData: Decodable {
        let session_id: String?
        let observations_created: Int?
        let photos_saved: Int?
    }
}

struct PassiveResponse: Decodable {
    let success: Bool
    let data: PassiveResponseData?

    struct PassiveResponseData: Decodable {
        let session_id: String?
        let observations_created: Int?
    }
}

enum APIError: Error {
    case serverError(statusCode: Int)
    case decodingError
    case networkError(Error)
}

// MARK: - Data Extension for Multipart

extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append("\(value)\r\n".data(using: .utf8)!)
    }

    mutating func appendMultipartFile(name: String, filename: String, mimeType: String, data: Data, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }
}
