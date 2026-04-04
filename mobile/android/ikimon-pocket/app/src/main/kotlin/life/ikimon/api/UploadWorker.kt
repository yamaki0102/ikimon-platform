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
        private const val APP_VERSION = "0.8.1"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val filePath = inputData.getString("file_path") ?: return Result.failure()
        val file = File(filePath)
        UploadStatusStore.recordUploadStarted(applicationContext, file.name)

        if (!file.exists()) {
            Log.w(TAG, "File not found: $filePath")
            UploadStatusStore.recordFailure(applicationContext, file.name, "未送信ファイルが見つからない")
            return Result.failure()
        }

        val installId = InstallIdentityManager.getOrCreateInstallId(applicationContext)
        if (installId.isBlank()) {
            Log.e(TAG, "install_id not ready — cannot authenticate")
            UploadStatusStore.recordRetry(
                applicationContext,
                file.name,
                "端末IDの生成に失敗したため後で再試行する"
            )
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
                .apply {
                    AppAuthManager.authHeader(applicationContext)?.let { addHeader("Authorization", it) }
                }
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful) {
                Log.i(TAG, "Upload successful: ${response.code}")
                file.delete()
                InstallIdentityManager.markRegistered(applicationContext, "この端末は送信済み。以後そのまま反映される")
                UploadStatusStore.recordUploadSuccess(applicationContext, file.name)
                Result.success()
            } else {
                Log.w(TAG, "Upload failed: ${response.code} $responseBody")
                when (response.code) {
                    401 -> {
                        Log.w(TAG, "Auth failed — retrying later")
                        val legacyServer = responseBody?.contains("Register your device at ikimon.life/profile") == true
                        UploadStatusStore.recordRetry(
                            applicationContext,
                            file.name,
                            if (legacyServer) {
                                "サーバーが旧版のため自動登録に未対応。新しい passive_event.php が必要"
                            } else {
                                "認証に失敗した。接続復帰後に自動で再試行する"
                            }
                        )
                        Result.retry()
                    }
                    in 400..499 -> {
                        // その他クライアントエラー（400/422等）→ 不正データなので削除
                        file.delete()
                        UploadStatusStore.recordFailure(
                            applicationContext,
                            file.name,
                            "送信データが不正のため破棄した (${response.code})"
                        )
                        Result.failure()
                    }
                    else -> {
                        UploadStatusStore.recordRetry(
                            applicationContext,
                            file.name,
                            "サーバー応答 ${response.code} のため後で再試行する"
                        )
                        Result.retry()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload exception", e)
            UploadStatusStore.recordRetry(
                applicationContext,
                file.name,
                "通信エラーのため後で再試行する"
            )
            Result.retry()
        }
    }
}
