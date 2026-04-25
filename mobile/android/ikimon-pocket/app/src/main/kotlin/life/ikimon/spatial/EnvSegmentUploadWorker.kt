package life.ikimon.spatial

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import life.ikimon.api.AppAuthManager
import life.ikimon.api.InstallIdentityManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 確定した EnvSegment を /api/v2/env_segment.php に送信する WorkManager Worker。
 *
 * - セグメント確定のたびに即時キュー（セッション終了を待たない）
 * - segment_id でべき等: 重複送信しても上書きにならない
 * - Wi-Fi 不要（任意ネットワーク許可）。バッテリー低下時は自動 retry
 */
class EnvSegmentUploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "EnvSegmentUploadWorker"
        private const val API_URL = "https://ikimon.life/api/v2/env_segment.php"
        private const val APP_VERSION = "0.9.0"
        private const val KEY_SEGMENT_JSON = "segment_json"

        /**
         * 単一 EnvSegment をキューに追加する。
         * SpatialSegmentBuilder.push() が境界を返したタイミングで呼ぶ。
         */
        fun enqueue(context: Context, segment: EnvSegment) {
            val json = JSONObject().apply {
                put("segments", JSONArray().put(segment.toJSONObject()))
            }.toString()

            val request = OneTimeWorkRequestBuilder<EnvSegmentUploadWorker>()
                .setInputData(workDataOf(KEY_SEGMENT_JSON to json))
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .addTag("env_segment_${segment.segmentId}")
                .build()

            WorkManager.getInstance(context).enqueue(request)
            Log.d(TAG, "Enqueued segment ${segment.segmentId} " +
                "entries=${segment.observationCount} dist=${"%.0f".format(segment.distanceMeters)}m")
        }
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val segmentJson = inputData.getString(KEY_SEGMENT_JSON) ?: run {
            Log.e(TAG, "Missing segment_json in inputData")
            return Result.failure()
        }

        val installId = InstallIdentityManager.getOrCreateInstallId(applicationContext)
        if (installId.isBlank()) {
            Log.w(TAG, "install_id not ready — retry later")
            return Result.retry()
        }

        val apiUrl = "$API_URL?install_id=$installId"

        return try {
            val body = segmentJson.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(apiUrl)
                .post(body)
                .addHeader("User-Agent", "ikimon-fieldscan/$APP_VERSION")
                .apply {
                    AppAuthManager.authHeader(applicationContext)?.let { addHeader("Authorization", it) }
                }
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()

            when {
                response.isSuccessful -> {
                    Log.i(TAG, "EnvSegment uploaded: ${response.code}")
                    Result.success()
                }
                response.code == 429 -> {
                    Log.w(TAG, "Rate limited — retry")
                    Result.retry()
                }
                response.code in 400..499 -> {
                    Log.w(TAG, "Client error ${response.code}: $responseBody — drop segment")
                    Result.failure()
                }
                else -> {
                    Log.w(TAG, "Server error ${response.code} — retry")
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload exception — retry", e)
            Result.retry()
        }
    }
}
