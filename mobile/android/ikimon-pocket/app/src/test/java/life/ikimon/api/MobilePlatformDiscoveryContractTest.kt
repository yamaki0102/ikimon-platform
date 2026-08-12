package life.ikimon.api

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

class MobilePlatformDiscoveryContractTest {
    private val projectRoot = generateSequence(File(System.getProperty("user.dir") ?: ".")) { it.parentFile }
        .first { File(it, "app/src/main/kotlin").exists() }

    @Test
    fun discoveryClientUsesVersionedProviderOpaqueContract() {
        val source = File(
            projectRoot,
            "app/src/main/kotlin/life/ikimon/api/MobilePlatformDiscoveryClient.kt",
        ).readText()

        assertContains(source, "ikimon.platform-discovery/v1")
        assertContains(source, "ikimon.mobile-platform/v1")
        assertContains(source, "/.well-known/ikimon-platform")
        assertContains(source, "providerOpaque")
        assertContains(source, "MobileApiConfig.currentRuntimeOrigin(context)")
    }

    @Test
    fun discoveryClientDoesNotContainProviderCredentialsOrBindings() {
        val source = File(
            projectRoot,
            "app/src/main/kotlin/life/ikimon/api/MobilePlatformDiscoveryClient.kt",
        ).readText().lowercase()

        assertFalse(source.contains("api_token"))
        assertFalse(source.contains("account_id"))
        assertFalse(source.contains("bucket_name"))
        assertFalse(source.contains("database_id"))
        assertFalse(source.contains("queue_name"))
    }
}
