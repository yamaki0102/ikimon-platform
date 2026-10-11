package life.ikimon.api

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

class MobilePlatformDiscoveryContractTest {
    private val projectRoot = generateSequence(File(System.getProperty("user.dir") ?: ".")) { it.parentFile }
        .first { File(it, "app/src/main/kotlin").exists() }

    @Test
    fun discoveryClientUsesCanonicalVersionedContract() {
        val source = File(
            projectRoot,
            "app/src/main/kotlin/life/ikimon/api/MobilePlatformDiscoveryClient.kt",
        ).readText()

        assertContains(source, "ikimon-cloudflare-os")
        assertContains(source, "EXPECTED_PLATFORM_CONTRACT = \"1.0\"")
        assertContains(source, "/.well-known/ikimon-platform")
        assertContains(source, "capability_endpoint")
        assertContains(source, "MobileApiConfig.currentRuntimeOrigin(context)")
        assertContains(source, "setOf(\"available\", \"degraded\", \"read_only\", \"disabled\")")
    }

    @Test
    fun discoveryClientDoesNotContainProviderCredentialsOrBindingValues() {
        val source = File(
            projectRoot,
            "app/src/main/kotlin/life/ikimon/api/MobilePlatformDiscoveryClient.kt",
        ).readText().lowercase()

        assertFalse(source.contains("api_token"))
        assertFalse(source.contains("account_id"))
        assertFalse(source.contains("bucket_name"))
        assertFalse(source.contains("database_id"))
        assertFalse(source.contains("queue_name"))
        assertFalse(source.contains("workers.dev"))
    }
}
