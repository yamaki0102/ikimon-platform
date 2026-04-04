package life.ikimon.api

import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

class DiagnosticsUploadWorker(
    context: android.content.Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "DiagnosticsUpload"
        private const val API_BASE = "https://ikimon.life/api/v2/fieldscan_diag_session.php"
        private const val APP_VERSION = "0.8.1"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val filePath = inputData.getString("file_path") ?: return Result.failure()
        val file = File(filePath)
        if (!file.exists()) {
            Log.w(TAG, "Diagnostics file not found: $filePath")
            return Result.failure()
        }

        val installId = InstallIdentityManager.getOrCreateInstallId(applicationContext)
        if (installId.isBlank()) {
            Log.w(TAG, "install_id missing for diagnostics upload")
            return Result.retry()
        }

        return try {
            val body = file.readText().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$API_BASE?install_id=$installId")
                .post(body)
                .addHeader("User-Agent", "ikimon-fieldscan/$APP_VERSION")
                .apply {
                    AppAuthManager.authHeader(applicationContext)?.let { addHeader("Authorization", it) }
                }
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Log.i(TAG, "Diagnostics upload success: ${file.name}")
                    Result.success()
                } else {
                    Log.w(TAG, "Diagnostics upload failed: ${response.code} ${response.body?.string().orEmpty()}")
                    when (response.code) {
                        401, 403, in 500..599 -> Result.retry()
                        else -> Result.failure()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Diagnostics upload exception", e)
            Result.retry()
        }
    }
}
