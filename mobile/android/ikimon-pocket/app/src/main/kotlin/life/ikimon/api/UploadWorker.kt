package life.ikimon.api

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.io.File

/**
 * バックグラウンドアップロード Worker。
 * 旧 EventBuffer JSON は current runtime の mobile session flow に置き換え済み。
 * Field Companion の本線は FieldSessionCoordinator -> MobileFieldSessionClient が担う。
 */
class UploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "UploadWorker"
    }

    override suspend fun doWork(): Result {
        val filePath = inputData.getString("file_path") ?: return Result.failure()
        val file = File(filePath)
        if (!file.exists()) {
            Log.w(TAG, "File not found: $filePath")
            UploadStatusStore.recordFailure(applicationContext, file.name, "未送信ファイルが見つからない")
            return Result.failure()
        }

        UploadStatusStore.recordFailure(
            applicationContext,
            file.name,
            "旧形式の端末バッチ送信は停止中。新しいField Companionはcurrent runtimeへ直接同期する",
        )
        Log.w(TAG, "Legacy upload worker disabled; kept local file: ${file.absolutePath}")
        return Result.failure()
    }
}
