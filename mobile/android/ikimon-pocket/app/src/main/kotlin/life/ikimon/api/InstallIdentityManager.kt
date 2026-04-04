package life.ikimon.api

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.util.UUID
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class InstallRegistrationResult(
    val success: Boolean,
    val installId: String,
    val registered: Boolean,
    val detail: String,
)

object InstallIdentityManager {
    private const val PREFS_NAME = "field_observation_install_identity"
    private const val KEY_INSTALL_ID = "install_id"
    private const val KEY_REGISTERED = "install_registered"
    private const val KEY_LAST_DETAIL = "install_last_detail"
    private const val INSTALL_API = "https://ikimon.life/api/v2/fieldscan_install.php"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun getOrCreateInstallId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_INSTALL_ID, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }

        val installId = "fsi_" + UUID.randomUUID().toString().replace("-", "")
        prefs.edit()
            .putString(KEY_INSTALL_ID, installId)
            .putBoolean(KEY_REGISTERED, false)
            .putString(KEY_LAST_DETAIL, "端末IDを発行した。接続時に登録する")
            .apply()
        return installId
    }

    fun isRegistered(context: Context): Boolean = context
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getBoolean(KEY_REGISTERED, false)

    fun markRegistered(context: Context, detail: String = "端末登録が完了した") {
        val installId = getOrCreateInstallId(context)
        saveState(context, installId, true, detail)
    }

    fun ensureRegistered(context: Context, appVersion: String): InstallRegistrationResult {
        val installId = getOrCreateInstallId(context)

        if (isRegistered(context)) {
            return InstallRegistrationResult(true, installId, true, "端末登録は完了している")
        }

        if (!NetworkState.isOnline(context)) {
            return InstallRegistrationResult(false, installId, false, "オフラインのため端末登録は保留")
        }

        return try {
            val payload = JSONObject().apply {
                put("install_id", installId)
                put("device", Build.MODEL ?: "Android")
                put("platform", "android")
                put("app_version", appVersion)
            }

            val request = Request.Builder()
                .url(INSTALL_API)
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .addHeader("User-Agent", "ikimon-fieldscan/$appVersion")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                saveState(context, installId, false, "端末登録に失敗した (${response.code})")
                return InstallRegistrationResult(false, installId, false, "端末登録に失敗した (${response.code})")
            }

            saveState(context, installId, true, "端末登録が完了した")
            InstallRegistrationResult(true, installId, true, responseBody)
        } catch (_: Exception) {
            saveState(context, installId, false, "端末登録に失敗した。接続復帰後に再試行する")
            InstallRegistrationResult(false, installId, false, "端末登録に失敗した。接続復帰後に再試行する")
        }
    }

    fun registrationStatus(context: Context): Pair<Boolean, String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_REGISTERED, false) to
            (prefs.getString(KEY_LAST_DETAIL, "端末登録はまだない") ?: "端末登録はまだない")
    }

    private fun saveState(context: Context, installId: String, registered: Boolean, detail: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_INSTALL_ID, installId)
            .putBoolean(KEY_REGISTERED, registered)
            .putString(KEY_LAST_DETAIL, detail)
            .apply()
    }
}
