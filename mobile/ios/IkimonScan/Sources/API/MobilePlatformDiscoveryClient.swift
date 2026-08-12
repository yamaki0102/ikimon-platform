import Foundation

struct MobilePlatformDiscoveryDocument: Decodable, Equatable {
    let schema: String
    let product: String
    let mobileContractVersion: String
    let capabilities: String
    let providerOpaque: Bool
}

struct MobilePlatformCapability: Decodable, Equatable {
    let id: String
    let version: String
    let state: String
}

struct MobilePlatformCapabilityManifest: Decodable, Equatable {
    let contractVersion: String
    let product: String
    let capabilities: [MobilePlatformCapability]
}

struct MobilePlatformDiscoveryResult: Equatable {
    let discovery: MobilePlatformDiscoveryDocument
    let manifest: MobilePlatformCapabilityManifest
}

enum MobilePlatformDiscoveryError: Error, Equatable {
    case invalidOrigin
    case invalidCapabilitiesPath
    case transportStatus(Int)
    case unsupportedSchema
    case productMismatch
    case contractMismatch
    case providerOpacityRequired
    case invalidCapability
    case providerDetailLeak
}

/// Read-only client for the provider-opaque mobile product contract.
///
/// The client intentionally has no Cloudflare/R2/D1/Queue knowledge. The same semantic
/// discovery shape can therefore be used by a future shared shell or a full-native client.
struct MobilePlatformDiscoveryClient {
    static let expectedSchema = "ikimon.platform-discovery/v1"
    static let expectedContractVersion = "ikimon.mobile-platform/v1"
    static let expectedProduct = "zukan"

    let origin: URL
    let session: URLSession

    init(origin: URL = URL(string: "https://ikimon.life")!, session: URLSession = .shared) {
        self.origin = origin
        self.session = session
    }

    func discover() async throws -> MobilePlatformDiscoveryResult {
        let discoveryURL = origin.appendingPathComponent(".well-known/ikimon-platform")
        let discovery: MobilePlatformDiscoveryDocument = try await get(discoveryURL)
        try Self.validate(discovery: discovery)

        guard let capabilitiesURL = Self.resolveRelativePath(discovery.capabilities, against: origin) else {
            throw MobilePlatformDiscoveryError.invalidCapabilitiesPath
        }
        let manifest: MobilePlatformCapabilityManifest = try await get(capabilitiesURL)
        try Self.validate(manifest: manifest)
        return MobilePlatformDiscoveryResult(discovery: discovery, manifest: manifest)
    }

    static func validate(discovery: MobilePlatformDiscoveryDocument) throws {
        guard discovery.schema == expectedSchema else {
            throw MobilePlatformDiscoveryError.unsupportedSchema
        }
        guard discovery.product == expectedProduct else {
            throw MobilePlatformDiscoveryError.productMismatch
        }
        guard discovery.mobileContractVersion == expectedContractVersion else {
            throw MobilePlatformDiscoveryError.contractMismatch
        }
        guard discovery.providerOpaque else {
            throw MobilePlatformDiscoveryError.providerOpacityRequired
        }
        guard isSafeRelativeAPIPath(discovery.capabilities) else {
            throw MobilePlatformDiscoveryError.invalidCapabilitiesPath
        }
    }

    static func validate(manifest: MobilePlatformCapabilityManifest) throws {
        guard manifest.contractVersion == expectedContractVersion else {
            throw MobilePlatformDiscoveryError.contractMismatch
        }
        guard manifest.product == expectedProduct else {
            throw MobilePlatformDiscoveryError.productMismatch
        }
        for capability in manifest.capabilities {
            guard !capability.id.isEmpty,
                  !capability.version.isEmpty,
                  ["available", "preview", "contract_only"].contains(capability.state) else {
                throw MobilePlatformDiscoveryError.invalidCapability
            }
            if containsProviderImplementationName(capability.id) {
                throw MobilePlatformDiscoveryError.providerDetailLeak
            }
        }
    }

    static func isSafeRelativeAPIPath(_ path: String) -> Bool {
        path.hasPrefix("/")
            && !path.hasPrefix("//")
            && !path.contains("://")
            && !path.contains("\\")
    }

    static func resolveRelativePath(_ path: String, against origin: URL) -> URL? {
        guard isSafeRelativeAPIPath(path),
              var components = URLComponents(url: origin, resolvingAgainstBaseURL: false),
              components.scheme == "https" || components.host == "127.0.0.1" || components.host == "localhost" else {
            return nil
        }
        components.path = path
        components.query = nil
        components.fragment = nil
        return components.url
    }

    private static func containsProviderImplementationName(_ value: String) -> Bool {
        let normalized = value.lowercased()
        return ["cloudflare", "r2_bucket", "d1_database", "durable_object", "hyperdrive_config"]
            .contains { normalized.contains($0) }
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ikimon-scan/platform-discovery", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw MobilePlatformDiscoveryError.transportStatus(0)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw MobilePlatformDiscoveryError.transportStatus(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
