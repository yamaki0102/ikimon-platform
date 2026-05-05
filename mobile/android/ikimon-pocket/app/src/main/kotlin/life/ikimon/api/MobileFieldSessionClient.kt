package life.ikimon.api

import android.content.Context
import life.ikimon.data.DetectionEvent
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class MobileSessionStartResult(
    val sessionId: String,
    val rawMediaPolicy: String,
)

data class MobileSessionRecap(
    val sceneCount: Int,
    val latestDigest: String,
    val nextLook: List<String>,
)

object MobileFieldSessionClient {
    private const val APP_VERSION = "0.8.1"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun start(context: Context, sessionId: String, movementMode: String): MobileSessionStartResult? {
        val installId = InstallIdentityManager.getOrCreateInstallId(context)
        val body = JSONObject().apply {
            put("session_id", sessionId)
            put("install_id", installId)
            put("movement_mode", movementMode)
        }
        return try {
            val json = post(context, "${MobileApiConfig.fieldSessionApiBase(context)}/start", body)
            MobileSessionStartResult(
                sessionId = json.optString("sessionId", sessionId),
                rawMediaPolicy = json.optString("rawMediaPolicy", "digest_only"),
            )
        } catch (_: Exception) {
            null
        }
    }

    fun sendSceneDigest(context: Context, sessionId: String, event: DetectionEvent): Boolean {
        if (event.sceneDigest.isNullOrBlank()) return false
        val installId = event.installId ?: InstallIdentityManager.getOrCreateInstallId(context)
        val body = JSONObject().apply {
            put("client_scene_id", event.photoRef ?: "${sessionId}_${event.timestamp}")
            put("session_id", sessionId)
            put("install_id", installId)
            put("captured_at", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US)
                .format(java.util.Date(event.timestamp)))
            put("lat", event.lat)
            put("lng", event.lng)
            put("movement_mode", event.movementMode ?: "walk")
            put("scene_digest", event.sceneDigest)
            put("detected_species", JSONArray().apply {
                if (event.scientificName != "environment_context" && event.scientificName.isNotBlank()) put(event.scientificName)
            })
            put("detected_features", JSONArray().apply {
                put(JSONObject().apply {
                    put("type", if (event.type == "audio") "sound" else if (event.scientificName == "environment_context") "vegetation" else "species")
                    put("name", event.taxonName)
                    put("confidence", event.confidence.toDouble())
                    put("note", event.order ?: "")
                })
            })
            put("area_resolution_signals", JSONArray(event.areaResolutionSignals))
            put("on_device_model_base_name", event.onDeviceModelBaseName)
            put("on_device_release_stage", event.onDeviceReleaseStage)
            put("on_device_model_preference", event.onDeviceModelPreference)
            put("foreground_ai_available", event.foregroundAiAvailable)
            put("fallback_reason", event.fallbackReason)
            put("user_auth_state", event.userAuthState)
            event.monitoringContext?.let { put("monitoring_context", it) }
        }
        return try {
            post(context, "${MobileApiConfig.fieldSessionApiBase(context)}/${sessionId}/scene-digest", body)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun sendAudioEvents(context: Context, sessionId: String, events: List<DetectionEvent>): Boolean {
        if (events.isEmpty()) return true
        val body = JSONObject().apply {
            put("events", JSONArray().apply {
                events.forEach { put(it.toJSON()) }
            })
        }
        return try {
            post(context, "${MobileApiConfig.fieldSessionApiBase(context)}/${sessionId}/audio-events", body)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun end(context: Context, sessionId: String): MobileSessionRecap? {
        return try {
            val json = post(context, "${MobileApiConfig.fieldSessionApiBase(context)}/${sessionId}/end", JSONObject())
            parseRecap(json.optJSONObject("recap"))
        } catch (_: Exception) {
            null
        }
    }

    private fun post(context: Context, url: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url(url)
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .addHeader("User-Agent", "ikimon-field-companion/$APP_VERSION")
            .apply { AppAuthManager.authHeader(context)?.let { addHeader("Authorization", it) } }
            .build()
        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(responseBody.ifBlank { "mobile_field_api_failed" })
            return JSONObject(responseBody)
        }
    }

    private fun parseRecap(json: JSONObject?): MobileSessionRecap? {
        json ?: return null
        val arr = json.optJSONArray("nextLook") ?: JSONArray()
        return MobileSessionRecap(
            sceneCount = json.optInt("sceneCount", 0),
            latestDigest = json.optString("latestDigest", ""),
            nextLook = (0 until arr.length()).mapNotNull { arr.optString(it).takeIf { item -> item.isNotBlank() } },
        )
    }
}
