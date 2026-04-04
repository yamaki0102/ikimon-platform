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

object DiagnosticsUploadCoordinator {
    fun enqueueSessionLogUpload(context: Context, file: File) {
        val uploadWork = OneTimeWorkRequestBuilder<DiagnosticsUploadWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInputData(workDataOf("file_path" to file.absolutePath))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "fieldscan-diagnostics-${file.name}",
            ExistingWorkPolicy.REPLACE,
            uploadWork,
        )
    }
}
