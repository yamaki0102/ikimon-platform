package life.ikimon.api

import android.content.Context
import android.util.Log
import life.ikimon.ui.DetectionItem
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Session recap client for current-runtime mobile field sessions.
 */
object SessionRecapClient {

    private const val TAG = "SessionRecapClient"

    data class ContributionItem(
        val icon: String,
        val text: String,
        val highlight: Boolean = false,
    )

    data class RecapResult(
        val narrative: String,
        val contributions: List<ContributionItem>,
        val newMeshCount: Int = 0,
        val totalUserCount: Int = 0,
    )

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun fetch(
        context: Context,
        sessionId: String,
        detections: List<DetectionItem>,
        durationSec: Int,
        lat: Double?,
        lng: Double?,
        movementMode: String,
    ): RecapResult? {
        val body = JSONObject().apply {
            put("duration_sec", durationSec)
            put("movement_mode", movementMode)
            put("lat", lat)
            put("lng", lng)
            put("local_detection_count", detections.size)
        }

        return try {
            val request = Request.Builder()
                .url("${MobileApiConfig.fieldSessionApiBase(context)}/$sessionId/end")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .apply {
                    AppAuthManager.authHeader(context)?.let { addHeader("Authorization", it) }
                }
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: return null
            if (!response.isSuccessful) {
                Log.w(TAG, "recap API failed ${response.code}: $responseBody")
                return null
            }

            val json = JSONObject(responseBody)
            val recap = json.optJSONObject("recap") ?: JSONObject()
            val nextLook = recap.optJSONArray("nextLook") ?: JSONArray()
            val contributions = mutableListOf<ContributionItem>()
            for (i in 0 until nextLook.length()) {
                val text = nextLook.optString(i)
                if (text.isNotBlank()) contributions.add(ContributionItem("↗", text, highlight = i == 0))
            }

            RecapResult(
                narrative = recap.optString("latestDigest", "").ifBlank {
                    "${recap.optInt("sceneCount", 0)}件のフィールド手がかりをGuide/Mapへ保存しました。"
                },
                contributions = contributions,
                newMeshCount = recap.optInt("sceneCount", 0),
                totalUserCount = detections.size,
            )
        } catch (e: Exception) {
            Log.e(TAG, "recap fetch error: ${e.message}")
            null
        }
    }
}
