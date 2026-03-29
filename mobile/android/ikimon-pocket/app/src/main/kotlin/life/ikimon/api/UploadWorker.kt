package life.ikimon.api

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * バックグラウンドアップロード Worker。
 * Wi-Fi 接続時に EventBuffer のJSON を passive_event.php に送信する。
 */
class UploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "UploadWorker"
        private const val API_BASE = "https://ikimon.life/api/v2/passive_event.php"
        private const val PREFS_NAME = "field_observation_install_identity"
        private const val PREF_INSTALL_ID = "install_id"
        private const val APP_VERSION = "0.6.0"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val filePath = inputData.getString("file_path") ?: return Result.failure()
        val file = File(filePath)

        if (!file.exists()) {
            Log.w(TAG, "File not found: $filePath")
            return Result.failure()
        }

        val installId = applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREF_INSTALL_ID, null)

        if (installId == null) {
            Log.e(TAG, "install_id not found — cannot authenticate")
            return Result.retry()
        }

        val apiUrl = "$API_BASE?install_id=$installId"

        return try {
            val json = file.readText()
            val body = json.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url(apiUrl)
                .post(body)
                .addHeader("User-Agent", "ikimon-fieldscan/$APP_VERSION")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful) {
                Log.i(TAG, "Upload successful: ${response.code}")
                file.delete()
                Result.success()
            } else {
                Log.w(TAG, "Upload failed: ${response.code} $responseBody")
                when (response.code) {
                    401 -> {
                        // 認証エラー → ファイルは消さずリトライ（install_idが未登録の可能性）
                        Log.w(TAG, "Auth failed — retrying later. Register device at ikimon.life/profile")
                        Result.retry()
                    }
                    in 400..499 -> {
                        // その他クライアントエラー（400/422等）→ 不正データなので削除
                        file.delete()
                        Result.failure()
                    }
                    else -> Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload exception", e)
            Result.retry()
        }
    }
}
