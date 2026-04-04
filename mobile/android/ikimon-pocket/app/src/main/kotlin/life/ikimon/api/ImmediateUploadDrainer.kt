package life.ikimon.api

import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

data class DrainResult(
    val uploadedCount: Int,
    val remainingCount: Int,
    val lastMessage: String,
)

object ImmediateUploadDrainer {
    private const val API_BASE = "https://ikimon.life/api/v2/passive_event.php"
    private const val APP_VERSION = "0.8.1"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun drain(context: Context, maxUploads: Int = 3): DrainResult {
        if (!NetworkState.isOnline(context)) {
            return DrainResult(0, UploadCoordinator.pendingCount(context), "オフラインのため端末保管を継続")
        }

        val files = UploadCoordinator.pendingFiles(context).take(maxUploads)
        if (files.isEmpty()) {
            return DrainResult(0, 0, "未送信セッションはない")
        }

        val installId = InstallIdentityManager.getOrCreateInstallId(context)
        if (installId.isBlank()) {
            return DrainResult(0, UploadCoordinator.pendingCount(context), "端末IDを生成できないため再送できない")
        }

        var uploaded = 0
        var lastMessage = "未送信セッションを確認した"
        for (file in files) {
            lastMessage = uploadFile(context, file, installId)
            if (!lastMessage.startsWith("送信完了")) {
                break
            }
            uploaded++
        }

        return DrainResult(uploaded, UploadCoordinator.pendingCount(context), lastMessage)
    }

    private fun uploadFile(context: Context, file: File, installId: String): String {
        return try {
            UploadStatusStore.recordUploadStarted(context, file.name)
            val request = Request.Builder()
                .url("$API_BASE?install_id=$installId")
                .post(file.readText().toRequestBody("application/json".toMediaType()))
                .addHeader("User-Agent", "ikimon-fieldscan/$APP_VERSION")
                .apply {
                    AppAuthManager.authHeader(context)?.let { addHeader("Authorization", it) }
                }
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    file.delete()
                    InstallIdentityManager.markRegistered(context, "この端末は送信済み。以後そのまま反映される")
                    UploadStatusStore.recordUploadSuccess(context, file.name)
                    return "送信完了: ${file.name}"
                }

                if (response.code == 401) {
                    val legacyServer = body.contains("Register your device at ikimon.life/profile")
                    val message = if (legacyServer) {
                        "サーバーが旧版のため自動登録に未対応。新しい passive_event.php が必要"
                    } else {
                        "認証に失敗したため再送を保留"
                    }
                    UploadStatusStore.recordRetry(context, file.name, message)
                    return message
                }

                if (response.code in 400..499) {
                    file.delete()
                    val message = "送信データが不正のため破棄した (${response.code})"
                    UploadStatusStore.recordFailure(context, file.name, message)
                    return message
                }

                val message = "サーバー応答 ${response.code} のため後で再試行する"
                UploadStatusStore.recordRetry(context, file.name, message)
                message
            }
        } catch (_: Exception) {
            val message = "通信エラーのため後で再試行する"
            UploadStatusStore.recordRetry(context, file.name, message)
            message
        }
    }
}
