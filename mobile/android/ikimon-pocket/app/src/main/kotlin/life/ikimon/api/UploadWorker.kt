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

            Log.i(TAG, "Uploading: ${file.name} (${json.length} bytes)")

            val request = Request.Builder()
                .url(API_URL)
                .post(body)
                .addHeader("User-Agent", "ikimon-pocket/0.6.0-experimental")
                .addHeader("X-BioScan-Version", "0.6.0-experimental")
                .addHeader("X-Device", android.os.Build.MODEL)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful) {
                Log.i(TAG, "Upload OK: ${response.code} — $responseBody")
                file.delete()
                Result.success()
            } else {
                Log.w(TAG, "Upload failed: ${response.code} — $responseBody")
                if (response.code in 400..499) {
                    // ログは残すがリトライしない（デバッグ用にファイルも残す）
                    Log.e(TAG, "Client error — file kept for debug: ${file.name}")
                    Result.failure()
                } else {
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload exception: ${e.message}", e)
            Result.retry()
        }
    }
}
