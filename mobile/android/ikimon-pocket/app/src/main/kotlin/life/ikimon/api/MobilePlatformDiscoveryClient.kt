package life.ikimon.api

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class MobilePlatformDiscovery(
    val platform: String,
    val environment: String,
    val product: String,
    val capabilityEndpoint: String,
    val authorizationIssuer: String,
    val supportedPlatformContracts: List<String>,
    val serverTime: String,
    val descriptorDigest: String,
)

data class MobilePlatformCapability(
    val capabilityId: String,
    val version: String,
    val state: String,
    val validUntil: String,
)

data class MobilePlatformCapabilityResponse(
    val maintenanceMode: String,
    val platformContractMin: String,
    val platformContractMax: String,
    val capabilities: List<MobilePlatformCapability>,
    val configDigest: String,
    val validUntil: String,
)

data class MobilePlatformDiscoveryResult(
    val discovery: MobilePlatformDiscovery,
    val capabilities: MobilePlatformCapabilityResponse,
)

/**
 * Read-only discovery client for the canonical provider-resource-opaque mobile contract.
 *
 * The descriptor identifies IKIMON Cloudflare OS as the platform, while capability IDs
 * deliberately contain no R2/D1/Queue/DO binding detail. The same semantic client can be
 * reused from a future shared shell or a full-native ZUKAN client.
 *
 * Network I/O is synchronous to match the existing mobile API clients. Call from an
 * existing worker/background dispatcher rather than the Android main thread.
 */
object MobilePlatformDiscoveryClient {
    const val EXPECTED_PLATFORM = "ikimon-cloudflare-os"
    const val EXPECTED_PLATFORM_CONTRACT = "1.0"
    const val EXPECTED_PRODUCT = "zukan"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun discover(context: Context): MobilePlatformDiscoveryResult {
        val origin = MobileApiConfig.currentRuntimeOrigin(context).trimEnd('/')
        val discoveryJson = getJson("$origin/.well-known/ikimon-platform")
        val discovery = parseDiscovery(discoveryJson)
        validateDiscovery(discovery)

        val capabilityJson = getJson("$origin${discovery.capabilityEndpoint}")
        val capabilities = parseCapabilities(capabilityJson)
        validateCapabilities(capabilities)
        return MobilePlatformDiscoveryResult(discovery, capabilities)
    }

    internal fun parseDiscovery(json: JSONObject): MobilePlatformDiscovery {
        val rawContracts = json.optJSONArray("supported_platform_contracts")
        val supportedContracts = buildList {
            if (rawContracts != null) {
                for (index in 0 until rawContracts.length()) {
                    rawContracts.optString(index).takeIf(String::isNotBlank)?.let(::add)
                }
            }
        }
        return MobilePlatformDiscovery(
            platform = json.optString("platform"),
            environment = json.optString("environment"),
            product = json.optString("product"),
            capabilityEndpoint = json.optString("capability_endpoint"),
            authorizationIssuer = json.optString("authorization_issuer"),
            supportedPlatformContracts = supportedContracts,
            serverTime = json.optString("server_time"),
            descriptorDigest = json.optString("descriptor_digest"),
        )
    }

    internal fun parseCapabilities(json: JSONObject): MobilePlatformCapabilityResponse {
        val rawCapabilities = json.optJSONArray("capabilities")
        val capabilities = buildList {
            if (rawCapabilities != null) {
                for (index in 0 until rawCapabilities.length()) {
                    val item = rawCapabilities.optJSONObject(index) ?: continue
                    add(
                        MobilePlatformCapability(
                            capabilityId = item.optString("capability_id"),
                            version = item.optString("version"),
                            state = item.optString("state"),
                            validUntil = item.optString("valid_until"),
                        ),
                    )
                }
            }
        }
        val platformContracts = json.optJSONObject("contracts")?.optJSONObject("platform")
        return MobilePlatformCapabilityResponse(
            maintenanceMode = json.optString("maintenance_mode"),
            platformContractMin = platformContracts?.optString("min").orEmpty(),
            platformContractMax = platformContracts?.optString("max").orEmpty(),
            capabilities = capabilities,
            configDigest = json.optString("config_digest"),
            validUntil = json.optString("valid_until"),
        )
    }

    internal fun validateDiscovery(discovery: MobilePlatformDiscovery) {
        require(discovery.platform == EXPECTED_PLATFORM) { "mobile_platform_identity_mismatch" }
        require(discovery.product == EXPECTED_PRODUCT) { "mobile_platform_product_mismatch" }
        require(discovery.environment in setOf("development", "staging", "production")) {
            "mobile_platform_environment_invalid"
        }
        require(EXPECTED_PLATFORM_CONTRACT in discovery.supportedPlatformContracts) {
            "mobile_platform_contract_unsupported"
        }
        require(isSafeRelativeApiPath(discovery.capabilityEndpoint)) { "mobile_platform_capabilities_path_invalid" }
        require(discovery.authorizationIssuer.isNotBlank()) { "mobile_platform_authorization_issuer_required" }
        require(discovery.descriptorDigest.startsWith("sha256:")) { "mobile_platform_descriptor_digest_invalid" }
    }

    internal fun validateCapabilities(response: MobilePlatformCapabilityResponse) {
        require(response.maintenanceMode in setOf("none", "read_only", "unavailable")) {
            "mobile_platform_maintenance_mode_invalid"
        }
        require(response.platformContractMin.isNotBlank() && response.platformContractMax.isNotBlank()) {
            "mobile_platform_contract_range_required"
        }
        require(response.configDigest.startsWith("sha256:")) { "mobile_platform_config_digest_invalid" }
        require(response.validUntil.isNotBlank()) { "mobile_platform_valid_until_required" }
        response.capabilities.forEach { capability ->
            require(capability.capabilityId.isNotBlank()) { "mobile_platform_capability_id_required" }
            require(capability.version.isNotBlank()) { "mobile_platform_capability_version_required" }
            require(capability.state in setOf("available", "degraded", "read_only", "disabled")) {
                "mobile_platform_capability_state_invalid"
            }
            require(capability.validUntil.isNotBlank()) { "mobile_platform_capability_expiry_required" }
            require(!containsProviderResourceName(capability.capabilityId)) {
                "mobile_platform_provider_resource_detail_leaked"
            }
        }
    }

    internal fun isSafeRelativeApiPath(path: String): Boolean =
        path.startsWith('/')
            && !path.startsWith("//")
            && !path.contains("://")
            && !path.contains('\\')

    private fun containsProviderResourceName(value: String): Boolean {
        val normalized = value.lowercase()
        return listOf("r2_bucket", "d1_database", "durable_object", "hyperdrive_config", "queue_binding")
            .any(normalized::contains)
    }

    private fun getJson(url: String): JSONObject {
        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Accept", "application/json")
            .addHeader("User-Agent", "ikimon-field-companion/platform-discovery")
            .build()
        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(responseBody.ifBlank { "mobile_platform_discovery_failed" })
            }
            return JSONObject(responseBody)
        }
    }
}
