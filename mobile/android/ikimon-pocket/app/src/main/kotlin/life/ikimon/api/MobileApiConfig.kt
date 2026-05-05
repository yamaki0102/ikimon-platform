package life.ikimon.api

import android.content.Context
import android.util.Log
import life.ikimon.pocket.BuildConfig

object MobileApiConfig {
    private const val TAG = "MobileApiConfig"
    private const val PREFS = "mobile_api_config"
    private const val KEY_FIELD_SESSION_API_BASE = "field_session_api_base"
    const val EXTRA_FIELD_SESSION_API_BASE = "ikimon_field_session_api_base"

    fun fieldSessionApiBase(context: Context): String {
        val override = if (BuildConfig.DEBUG) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_FIELD_SESSION_API_BASE, null)
                ?.trim()
                ?.takeIf { it.isNotBlank() }
        } else {
            null
        }
        return (override ?: BuildConfig.FIELD_SESSION_API_BASE).trimEnd('/')
    }

    fun currentRuntimeOrigin(context: Context): String {
        val base = fieldSessionApiBase(context)
        return base
            .removeSuffix("/api/v1/mobile/field-sessions")
            .trimEnd('/')
            .ifBlank { "https://ikimon.life" }
    }

    fun mobileLoginUrl(context: Context): String {
        return "${currentRuntimeOrigin(context)}/api/v1/mobile/auth/login"
    }

    fun appOAuthStartUrl(context: Context): String {
        return "${currentRuntimeOrigin(context)}/app_oauth_start.php"
    }

    fun applyDebugOverrideFromIntent(context: Context, rawBase: String?): Boolean {
        if (!BuildConfig.DEBUG) return false
        val normalized = rawBase?.trim()?.trimEnd('/') ?: return false
        if (!isAllowedDebugBase(normalized)) {
            Log.w(TAG, "Ignored invalid debug API base: $normalized")
            return false
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FIELD_SESSION_API_BASE, normalized)
            .apply()
        Log.i(TAG, "Debug field session API base set to $normalized")
        return true
    }

    private fun isAllowedDebugBase(value: String): Boolean {
        return value.startsWith("http://127.0.0.1:")
            || value.startsWith("http://localhost:")
            || value.startsWith("https://staging.ikimon.life/")
            || value == "https://staging.ikimon.life/api/v1/mobile/field-sessions"
    }
}
