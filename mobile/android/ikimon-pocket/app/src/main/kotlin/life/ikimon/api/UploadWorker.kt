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
        private const val API_URL = "https://ikimon.life/api/v2/passive_event.php"
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

        return try {
            val json = file.readText()
            val body = json.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url(API_URL)
                .post(body)
                .addHeader("User-Agent", "ikimon-pocket/0.1.0")
                // TODO: Add auth cookie/token
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                Log.i(TAG, "Upload successful: ${response.code}")
                // アップロード成功 → ファイル削除
                file.delete()
                Result.success()
            } else {
                Log.w(TAG, "Upload failed: ${response.code} ${response.body?.string()}")
                if (response.code in 400..499) {
                    // クライアントエラー → リトライしない
                    file.delete()
                    Result.failure()
                } else {
                    // サーバーエラー → リトライ
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload exception", e)
            Result.retry()
        }
    }
}
