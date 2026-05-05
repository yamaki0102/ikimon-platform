package life.ikimon.api

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class AppLoginState(
    val isLoggedIn: Boolean = false,
    val userId: String = "",
    val userName: String = "未ログイン",
    val email: String = "",
    val token: String = "",
    val detail: String = "ログインすると貢献が本人の記録として固定される",
)

data class AppLoginResult(
    val success: Boolean,
    val message: String,
)

object AppAuthManager {
    private const val PREFS_NAME = "fieldscan_app_auth"
    private const val KEY_TOKEN = "app_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_EMAIL = "email"
    private const val KEY_DETAIL = "detail"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun currentState(context: Context): AppLoginState {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_TOKEN, "") ?: ""
        return AppLoginState(
            isLoggedIn = token.isNotBlank(),
            userId = prefs.getString(KEY_USER_ID, "") ?: "",
            userName = prefs.getString(KEY_USER_NAME, "未ログイン") ?: "未ログイン",
            email = prefs.getString(KEY_EMAIL, "") ?: "",
            token = token,
            detail = prefs.getString(KEY_DETAIL, "ログインすると貢献が本人の記録として固定される")
                ?: "ログインすると貢献が本人の記録として固定される",
        )
    }

    fun authHeader(context: Context): String? {
        val token = currentState(context).token
        return if (token.isBlank()) null else "Bearer $token"
    }

    fun login(context: Context, email: String, password: String, appVersion: String): AppLoginResult {
        val installId = InstallIdentityManager.getOrCreateInstallId(context)
        val payload = JSONObject().apply {
            put("email", email.trim())
            put("password", password)
            put("install_id", installId)
            put("device", Build.MODEL ?: "Android")
            put("platform", "android")
            put("app_version", appVersion)
        }

        return try {
            val request = Request.Builder()
                .url(MobileApiConfig.mobileLoginUrl(context))
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .addHeader("User-Agent", "ikimon-fieldscan/$appVersion")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string().orEmpty()
            val json = JSONObject(body)
            if (!response.isSuccessful || !json.optBoolean("success")) {
                val message = json.optJSONObject("error")?.optString("message")
                    ?: json.optString("message", "ログインに失敗した")
                save(context, "", "", "未ログイン", email.trim(), message)
                return AppLoginResult(false, message)
            }

            val data = json.optJSONObject("data") ?: json
            val token = data.optString("token", data.optString("rawToken", ""))
            val user = data.optJSONObject("user") ?: data.optJSONObject("session")
            val userId = user?.optString("userId", user.optString("user_id", "")) ?: ""
            val userName = user?.optString("name", user.optString("displayName", user.optString("display_name", "ikimon user")))
                ?: "ikimon user"
            save(context, token, userId, userName, email.trim(), "ikimon.life アカウントでログイン済み。以後の貢献はこのアカウントに紐づく")
            AppLoginResult(true, "ログイン済み: $userName")
        } catch (_: Exception) {
            AppLoginResult(false, "通信エラーでログインできなかった")
        }
    }

    fun launchGoogleLogin(context: Context, appVersion: String) {
        val installId = InstallIdentityManager.getOrCreateInstallId(context)
        val uri = Uri.parse(MobileApiConfig.appOAuthStartUrl(context)).buildUpon()
            .appendQueryParameter("provider", "google")
            .appendQueryParameter("install_id", installId)
            .appendQueryParameter("platform", "android")
            .appendQueryParameter("app_version", appVersion)
            .appendQueryParameter("return_uri", "ikimonfieldscan://auth/callback")
            .build()

        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun handleOAuthCallback(context: Context, uri: Uri): AppLoginResult? {
        if (uri.scheme != "ikimonfieldscan" || uri.host != "auth") {
            return null
        }

        val error = uri.getQueryParameter("error")
        if (!error.isNullOrBlank()) {
            val message = uri.getQueryParameter("message") ?: "ソーシャルログインに失敗した"
            save(context, "", "", "未ログイン", "", message)
            return AppLoginResult(false, message)
        }

        val token = uri.getQueryParameter("token").orEmpty()
        if (token.isBlank()) {
            return AppLoginResult(false, "ソーシャルログイン結果を受け取れなかった")
        }

        val userName = uri.getQueryParameter("name").orEmpty().ifBlank { "ikimon user" }
        val email = uri.getQueryParameter("email").orEmpty()
        val message = uri.getQueryParameter("message")
            ?: "ソーシャルログインが完了した。この端末の本番記録はアカウントへ紐づく"

        save(context, token, uri.getQueryParameter("user_id").orEmpty(), userName, email, message)
        InstallIdentityManager.markRegistered(
            context,
            "この端末は送信済み。以後そのまま反映される"
        )
        return AppLoginResult(true, "ログイン済み: $userName")
    }

    fun logout(context: Context) {
        save(context, "", "", "未ログイン", "", "ログインすると貢献が本人の記録として固定される")
    }

    private fun save(context: Context, token: String, userId: String, userName: String, email: String, detail: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_EMAIL, email)
            .putString(KEY_DETAIL, detail)
            .apply()
    }
}
