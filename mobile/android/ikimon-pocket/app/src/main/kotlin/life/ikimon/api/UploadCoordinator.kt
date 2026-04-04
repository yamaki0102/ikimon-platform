package life.ikimon.api

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.io.File
import java.util.concurrent.TimeUnit

object UploadCoordinator {
    private const val PENDING_DIR = "pending_uploads"

    fun pendingDirectory(context: Context): File = File(context.filesDir, PENDING_DIR).apply {
        mkdirs()
    }

    fun pendingFiles(context: Context): List<File> = pendingDirectory(context)
        .listFiles()
        ?.filter { it.isFile && it.extension == "json" }
        ?.sortedBy { it.lastModified() }
        ?: emptyList()

    fun pendingCount(context: Context): Int = pendingFiles(context).size

    fun enqueueUpload(context: Context, file: File) {
        val uploadWork = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInputData(workDataOf("file_path" to file.absolutePath))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "fieldscan-upload-${file.name}",
            ExistingWorkPolicy.KEEP,
            uploadWork,
        )
    }

    fun enqueuePendingUploads(context: Context): Int {
        val files = pendingFiles(context)
        files.forEach { enqueueUpload(context, it) }
        return files.size
    }
}
