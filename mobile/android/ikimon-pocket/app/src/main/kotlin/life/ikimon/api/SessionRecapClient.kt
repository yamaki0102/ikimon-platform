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
 * session_recap.php クライアント
 * スキャン終了直後に叩いて contribution + narrative を取得する。
 */
object SessionRecapClient {

    private const val TAG = "SessionRecapClient"
    private const val API_URL = "https://ikimon.life/api/v2/session_recap.php"

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
        detections: List<DetectionItem>,
        durationSec: Int,
        lat: Double?,
        lng: Double?,
        movementMode: String,
    ): RecapResult? {
        val installId = InstallIdentityManager.getOrCreateInstallId(context)

        // 検出種を集計（scientificName ごとに件数）
        val speciesMap = mutableMapOf<String, Pair<String, Int>>() // sciName -> (jaName, count)
        for (d in detections) {
            val key = d.scientificName.ifEmpty { d.taxonName }
            val current = speciesMap[key]
            speciesMap[key] = Pair(d.taxonName, (current?.second ?: 0) + 1)
        }

        val speciesArray = JSONArray()
        for ((sci, pair) in speciesMap) {
            speciesArray.put(JSONObject().apply {
                put("scientific_name", sci)
                put("name", pair.first)
                put("count", pair.second)
                put("confidence", detections.firstOrNull { it.scientificName == sci }?.confidence ?: 0f)
            })
        }

        val body = JSONObject().apply {
            put("species", speciesArray)
            put("duration_sec", durationSec)
            put("distance_m", 0)
            put("lat", lat ?: 0.0)
            put("lng", lng ?: 0.0)
            put("scan_mode", if (movementMode == "vehicle") "vehicle" else "walk")
            put("hour", java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY))
        }

        return try {
            val request = Request.Builder()
                .url("$API_URL?install_id=$installId")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: return null
            if (!response.isSuccessful) {
                Log.w(TAG, "recap API failed ${response.code}: $responseBody")
                return null
            }

            val json = JSONObject(responseBody)
            val contributionArr = json.optJSONArray("contribution") ?: JSONArray()
            val contributions = mutableListOf<ContributionItem>()
            var newMeshCount = 0
            var totalUserCount = 0

            for (i in 0 until contributionArr.length()) {
                val item = contributionArr.getJSONObject(i)
                val text = item.optString("text", "")
                contributions.add(ContributionItem(
                    icon = item.optString("icon", "📊"),
                    text = text,
                    highlight = item.optBoolean("highlight", false),
                ))
                // メッシュ数を text からパース
                if (text.contains("メッシュ") || text.contains("mesh")) {
                    val m = Regex("(\\d+)\\s*メッシュ").find(text)
                    newMeshCount += m?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
                }
                // 累計貢献数
                if (text.contains("累計データ")) {
                    val m = Regex("(\\d+)件").find(text)
                    totalUserCount = m?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
                }
            }

            RecapResult(
                narrative = json.optString("narrative", ""),
                contributions = contributions,
                newMeshCount = newMeshCount,
                totalUserCount = totalUserCount,
            )
        } catch (e: Exception) {
            Log.e(TAG, "recap fetch error: ${e.message}")
            null
        }
    }
}
