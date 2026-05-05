package life.ikimon.api

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

class MobileApiConfigContractTest {
    private val projectRoot = generateSequence(File(System.getProperty("user.dir") ?: ".")) { it.parentFile }
        .first { File(it, "app/src/main/kotlin").exists() }

    @Test
    fun mobileFieldSessionClientsUseSharedApiConfig() {
        val mobileClient = File(projectRoot, "app/src/main/kotlin/life/ikimon/api/MobileFieldSessionClient.kt").readText()
        val recapClient = File(projectRoot, "app/src/main/kotlin/life/ikimon/api/SessionRecapClient.kt").readText()

        assertContains(mobileClient, "MobileApiConfig.fieldSessionApiBase(context)")
        assertContains(recapClient, "MobileApiConfig.fieldSessionApiBase(context)")
        assertFalse(mobileClient.contains("https://ikimon.life/api/v1/mobile/field-sessions"))
        assertFalse(recapClient.contains("https://ikimon.life/api/v1/mobile/field-sessions"))
    }

    @Test
    fun debugAndReleaseApiBasesAreDeclaredSeparately() {
        val buildFile = File(projectRoot, "app/build.gradle.kts").readText()

        assertContains(buildFile, "FIELD_SESSION_API_BASE")
        assertContains(buildFile, "http://127.0.0.1:3200/api/v1/mobile/field-sessions")
        assertContains(buildFile, "https://ikimon.life/api/v1/mobile/field-sessions")
        assertContains(buildFile, "manifestPlaceholders[\"usesCleartextTraffic\"] = \"true\"")
        assertContains(buildFile, "manifestPlaceholders[\"usesCleartextTraffic\"] = \"false\"")
    }
}
