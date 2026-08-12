package life.ikimon.api

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class MobilePlatformDiscovery(
    val schema: String,
    val product: String,
    val mobileContractVersion: String,
    val capabilitiesPath: String,
    val providerOpaque: Boolean,
)

data class MobilePlatformCapability(
    val id: String,
    val version: String,
    val state: String,
)

data class MobilePlatformCapabilityManifest(
    val contractVersion: String,
    val product: String,
    val capabilities: List<MobilePlatformCapability>,
)

data class MobilePlatformDiscoveryResult(
    val discovery: MobilePlatformDiscovery,
    val manifest: MobilePlatformCapabilityManifest,
)

/**
 * Read-only discovery client for the provider-opaque mobile contract.
 *
 * This deliberately knows nothing about Workers, R2, D1, Queues, Durable Objects,
 * Hyperdrive, or any other infrastructure implementation. It is safe to reuse from
 * a future shared shell because the server exposes only product-level capabilities.
 *
 * Network I/O is synchronous to match the existing mobile API clients. Call from an
 * existing worker/background dispatcher rather than the Android main thread.
 */
object MobilePlatformDiscoveryClient {
    const val EXPECTED_SCHEMA = "ikimon.platform-discovery/v1"
    const val EXPECTED_CONTRACT_VERSION = "ikimon.mobile-platform/v1"
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

        val manifestJson = getJson("$origin${discovery.capabilitiesPath}")
        val manifest = parseManifest(manifestJson)
        validateManifest(manifest)
        return MobilePlatformDiscoveryResult(discovery, manifest)
    }

    internal fun parseDiscovery(json: JSONObject): MobilePlatformDiscovery = MobilePlatformDiscovery(
        schema = json.optString("schema"),
        product = json.optString("product"),
        mobileContractVersion = json.optString("mobileContractVersion"),
        capabilitiesPath = json.optString("capabilities"),
        providerOpaque = json.optBoolean("providerOpaque", false),
    )

    internal fun parseManifest(json: JSONObject): MobilePlatformCapabilityManifest {
        val rawCapabilities = json.optJSONArray("capabilities")
        val capabilities = buildList {
            if (rawCapabilities != null) {
                for (index in 0 until rawCapabilities.length()) {
                    val item = rawCapabilities.optJSONObject(index) ?: continue
                    add(
                        MobilePlatformCapability(
                            id = item.optString("id"),
                            version = item.optString("version"),
                            state = item.optString("state"),
                        ),
                    )
                }
            }
        }
        return MobilePlatformCapabilityManifest(
            contractVersion = json.optString("contractVersion"),
            product = json.optString("product"),
            capabilities = capabilities,
        )
    }

    internal fun validateDiscovery(discovery: MobilePlatformDiscovery) {
        require(discovery.schema == EXPECTED_SCHEMA) { "mobile_platform_schema_unsupported" }
        require(discovery.product == EXPECTED_PRODUCT) { "mobile_platform_product_mismatch" }
        require(discovery.mobileContractVersion == EXPECTED_CONTRACT_VERSION) { "mobile_platform_contract_unsupported" }
        require(discovery.providerOpaque) { "mobile_platform_provider_opaque_required" }
        require(isSafeRelativeApiPath(discovery.capabilitiesPath)) { "mobile_platform_capabilities_path_invalid" }
    }

    internal fun validateManifest(manifest: MobilePlatformCapabilityManifest) {
        require(manifest.contractVersion == EXPECTED_CONTRACT_VERSION) { "mobile_platform_manifest_contract_mismatch" }
        require(manifest.product == EXPECTED_PRODUCT) { "mobile_platform_manifest_product_mismatch" }
        manifest.capabilities.forEach { capability ->
            require(capability.id.isNotBlank()) { "mobile_platform_capability_id_required" }
            require(capability.version.isNotBlank()) { "mobile_platform_capability_version_required" }
            require(capability.state in setOf("available", "preview", "contract_only")) {
                "mobile_platform_capability_state_invalid"
            }
            require(!containsProviderImplementationName(capability.id)) {
                "mobile_platform_provider_detail_leaked"
            }
        }
    }

    internal fun isSafeRelativeApiPath(path: String): Boolean =
        path.startsWith('/')
            && !path.startsWith("//")
            && !path.contains("://")
            && !path.contains('\\')

    private fun containsProviderImplementationName(value: String): Boolean {
        val normalized = value.lowercase()
        return listOf("cloudflare", "r2_bucket", "d1_database", "durable_object", "hyperdrive_config")
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
