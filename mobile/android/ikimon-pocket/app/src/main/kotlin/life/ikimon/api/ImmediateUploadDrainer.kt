package life.ikimon.api

import android.content.Context

data class DrainResult(
    val uploadedCount: Int,
    val remainingCount: Int,
    val lastMessage: String,
)

object ImmediateUploadDrainer {
    fun drain(context: Context, maxUploads: Int = 3): DrainResult {
        val pending = UploadCoordinator.pendingCount(context)
        return DrainResult(
            uploadedCount = 0,
            remainingCount = pending,
            lastMessage = if (pending > 0) {
                "旧形式の未送信セッションは端末内に保持。Field Companionの新規記録はcurrent runtimeへ直接同期する"
            } else {
                "未送信セッションはない"
            },
        )
    }
}
