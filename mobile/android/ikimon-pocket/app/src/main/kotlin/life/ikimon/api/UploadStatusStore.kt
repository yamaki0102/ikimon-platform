package life.ikimon.api

import android.content.Context
import android.content.Intent

data class UploadStatusSnapshot(
    val state: String = "idle",
    val detail: String = "まだセッションは保存されていない",
    val pendingCount: Int = 0,
    val isOnline: Boolean = false,
    val installIdPresent: Boolean = false,
    val installRegistered: Boolean = false,
    val installDetail: String = "この端末はまだ反映準備ができていない",
    val lastSessionIntent: String = "official",
    val lastOfficialRecord: Boolean = true,
    val lastFileName: String = "",
    val updatedAt: Long = 0L,
)

object UploadStatusStore {
    const val ACTION_STATUS_CHANGED = "life.ikimon.fieldscan.UPLOAD_STATUS_CHANGED"

    private const val PREFS_NAME = "fieldscan_upload_status"
    private const val INSTALL_PREFS_NAME = "field_observation_install_identity"
    private const val INSTALL_ID_KEY = "install_id"
    private const val KEY_STATE = "state"
    private const val KEY_DETAIL = "detail"
    private const val KEY_PENDING_COUNT = "pending_count"
    private const val KEY_LAST_SESSION_INTENT = "last_session_intent"
    private const val KEY_LAST_OFFICIAL_RECORD = "last_official_record"
    private const val KEY_LAST_FILE_NAME = "last_file_name"
    private const val KEY_UPDATED_AT = "updated_at"

    fun snapshot(context: Context): UploadStatusSnapshot {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val (installRegistered, installDetail) = InstallIdentityManager.registrationStatus(context)
        return UploadStatusSnapshot(
            state = prefs.getString(KEY_STATE, "idle") ?: "idle",
            detail = prefs.getString(KEY_DETAIL, "まだセッションは保存されていない")
                ?: "まだセッションは保存されていない",
            pendingCount = prefs.getInt(KEY_PENDING_COUNT, UploadCoordinator.pendingCount(context)),
            isOnline = NetworkState.isOnline(context),
            installIdPresent = hasInstallId(context),
            installRegistered = installRegistered,
            installDetail = installDetail,
            lastSessionIntent = prefs.getString(KEY_LAST_SESSION_INTENT, "official") ?: "official",
            lastOfficialRecord = prefs.getBoolean(KEY_LAST_OFFICIAL_RECORD, true),
            lastFileName = prefs.getString(KEY_LAST_FILE_NAME, "") ?: "",
            updatedAt = prefs.getLong(KEY_UPDATED_AT, 0L),
        )
    }

    fun recordQueued(
        context: Context,
        fileName: String,
        sessionIntent: String,
        officialRecord: Boolean,
    ) {
        save(
            context = context,
            state = if (NetworkState.isOnline(context)) "queued" else "offline_saved",
            detail = if (NetworkState.isOnline(context)) {
                if (officialRecord) {
                    "この端末に保存した。通信できれば本番へ反映する"
                } else {
                    "この端末に保存した。動作チェックとして隔離したまま送信する"
                }
            } else {
                "オフラインなのでこの端末に保存した。接続が戻れば自動で再送する"
            },
            fileName = fileName,
            sessionIntent = sessionIntent,
            officialRecord = officialRecord,
        )
    }

    fun recordUploadStarted(context: Context, fileName: String) {
        save(
            context = context,
            state = "uploading",
            detail = "サーバーへ送信している",
            fileName = fileName,
        )
    }

    fun recordUploadSuccess(context: Context, fileName: String) {
        save(
            context = context,
            state = "uploaded",
            detail = "送信が完了した。この端末の観測はサーバーへ渡った",
            fileName = fileName,
        )
    }

    fun recordRetry(context: Context, fileName: String, reason: String) {
        save(
            context = context,
            state = "retrying",
            detail = reason,
            fileName = fileName,
        )
    }

    fun recordFailure(context: Context, fileName: String, reason: String) {
        save(
            context = context,
            state = "failed",
            detail = reason,
            fileName = fileName,
        )
    }

    fun recordManualRetryQueued(context: Context, queuedCount: Int) {
        save(
            context = context,
            state = if (queuedCount > 0) "retrying" else snapshot(context).state,
            detail = if (queuedCount > 0) {
                "${queuedCount}件の未送信セッションを再試行キューに積んだ"
            } else {
                "未送信セッションはない"
            },
            fileName = snapshot(context).lastFileName,
        )
    }

    private fun save(
        context: Context,
        state: String,
        detail: String,
        fileName: String,
        sessionIntent: String? = null,
        officialRecord: Boolean? = null,
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = snapshot(context)
        prefs.edit()
            .putString(KEY_STATE, state)
            .putString(KEY_DETAIL, detail)
            .putInt(KEY_PENDING_COUNT, UploadCoordinator.pendingCount(context))
            .putString(KEY_LAST_SESSION_INTENT, sessionIntent ?: current.lastSessionIntent)
            .putBoolean(KEY_LAST_OFFICIAL_RECORD, officialRecord ?: current.lastOfficialRecord)
            .putString(KEY_LAST_FILE_NAME, fileName)
            .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
            .apply()

        context.sendBroadcast(Intent(ACTION_STATUS_CHANGED))
    }

    private fun hasInstallId(context: Context): Boolean = !context
        .getSharedPreferences(INSTALL_PREFS_NAME, Context.MODE_PRIVATE)
        .getString(INSTALL_ID_KEY, null)
        .isNullOrBlank()
}
