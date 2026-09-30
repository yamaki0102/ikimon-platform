import Foundation

struct MobilePlatformDiscoveryDocument: Decodable, Equatable {
    let platform: String
    let environment: String
    let product: String
    let capabilityEndpoint: String
    let authorizationIssuer: String
    let supportedPlatformContracts: [String]
    let serverTime: String
    let descriptorDigest: String

    enum CodingKeys: String, CodingKey {
        case platform
        case environment
        case product
        case capabilityEndpoint = "capability_endpoint"
        case authorizationIssuer = "authorization_issuer"
        case supportedPlatformContracts = "supported_platform_contracts"
        case serverTime = "server_time"
        case descriptorDigest = "descriptor_digest"
    }
}

struct MobilePlatformCapability: Decodable, Equatable {
    let capabilityId: String
    let version: String
    let state: String
    let validUntil: String

    enum CodingKeys: String, CodingKey {
        case capabilityId = "capability_id"
        case version
        case state
        case validUntil = "valid_until"
    }
}

struct MobilePlatformContractRange: Decodable, Equatable {
    let min: String
    let max: String
}

struct MobilePlatformContractRanges: Decodable, Equatable {
    let platform: MobilePlatformContractRange
}

struct MobilePlatformCapabilityResponse: Decodable, Equatable {
    let maintenanceMode: String
    let contracts: MobilePlatformContractRanges
    let capabilities: [MobilePlatformCapability]
    let configDigest: String
    let validUntil: String

    enum CodingKeys: String, CodingKey {
        case maintenanceMode = "maintenance_mode"
        case contracts
        case capabilities
        case configDigest = "config_digest"
        case validUntil = "valid_until"
    }
}

struct MobilePlatformDiscoveryResult: Equatable {
    let discovery: MobilePlatformDiscoveryDocument
    let capabilities: MobilePlatformCapabilityResponse
}

enum MobilePlatformDiscoveryError: Error, Equatable {
    case invalidCapabilitiesPath
    case transportStatus(Int)
    case platformMismatch
    case environmentInvalid
    case productMismatch
    case contractMismatch
    case authorizationIssuerRequired
    case descriptorDigestInvalid
    case configDigestInvalid
    case invalidCapability
    case providerResourceLeak
}

/// Read-only client for the canonical mobile product contract.
///
/// The descriptor identifies IKIMON Cloudflare OS, while capability identifiers contain
/// no R2/D1/Queue/DO binding detail. The client therefore remains valid if backend adapters
/// are replaced and can be called from a future shared shell or a full-native client.
struct MobilePlatformDiscoveryClient {
    static let expectedPlatform = "ikimon-cloudflare-os"
    static let expectedPlatformContract = "1.0"
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

        guard let capabilitiesURL = Self.resolveRelativePath(discovery.capabilityEndpoint, against: origin) else {
            throw MobilePlatformDiscoveryError.invalidCapabilitiesPath
        }
        let capabilities: MobilePlatformCapabilityResponse = try await get(capabilitiesURL)
        try Self.validate(capabilities: capabilities)
        return MobilePlatformDiscoveryResult(discovery: discovery, capabilities: capabilities)
    }

    static func validate(discovery: MobilePlatformDiscoveryDocument) throws {
        guard discovery.platform == expectedPlatform else {
            throw MobilePlatformDiscoveryError.platformMismatch
        }
        guard ["development", "staging", "production"].contains(discovery.environment) else {
            throw MobilePlatformDiscoveryError.environmentInvalid
        }
        guard discovery.product == expectedProduct else {
            throw MobilePlatformDiscoveryError.productMismatch
        }
        guard discovery.supportedPlatformContracts.contains(expectedPlatformContract) else {
            throw MobilePlatformDiscoveryError.contractMismatch
        }
        guard !discovery.authorizationIssuer.isEmpty else {
            throw MobilePlatformDiscoveryError.authorizationIssuerRequired
        }
        guard discovery.descriptorDigest.hasPrefix("sha256:") else {
            throw MobilePlatformDiscoveryError.descriptorDigestInvalid
        }
        guard isSafeRelativeAPIPath(discovery.capabilityEndpoint) else {
            throw MobilePlatformDiscoveryError.invalidCapabilitiesPath
        }
    }

    static func validate(capabilities response: MobilePlatformCapabilityResponse) throws {
        guard ["none", "read_only", "unavailable"].contains(response.maintenanceMode) else {
            throw MobilePlatformDiscoveryError.invalidCapability
        }
        guard !response.contracts.platform.min.isEmpty,
              !response.contracts.platform.max.isEmpty else {
            throw MobilePlatformDiscoveryError.contractMismatch
        }
        guard response.configDigest.hasPrefix("sha256:") else {
            throw MobilePlatformDiscoveryError.configDigestInvalid
        }
        guard !response.validUntil.isEmpty else {
            throw MobilePlatformDiscoveryError.invalidCapability
        }
        for capability in response.capabilities {
            guard !capability.capabilityId.isEmpty,
                  !capability.version.isEmpty,
                  !capability.validUntil.isEmpty,
                  ["available", "degraded", "read_only", "disabled"].contains(capability.state) else {
                throw MobilePlatformDiscoveryError.invalidCapability
            }
            if containsProviderResourceName(capability.capabilityId) {
                throw MobilePlatformDiscoveryError.providerResourceLeak
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

    private static func containsProviderResourceName(_ value: String) -> Bool {
        let normalized = value.lowercased()
        return ["r2_bucket", "d1_database", "durable_object", "hyperdrive_config", "queue_binding"]
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
