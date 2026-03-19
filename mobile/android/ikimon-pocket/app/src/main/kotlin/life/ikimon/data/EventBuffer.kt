package life.ikimon.data

import android.content.Context
import android.util.Log
import androidx.work.*
import life.ikimon.api.UploadWorker
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 検出イベントのローカルバッファ。
 * メモリ + ファイルの二重バッファで、セッション中のイベントを蓄積する。
 * Wi-Fi 接続時に WorkManager でサーバーへバッチ送信。
 */
class EventBuffer {

    private val events = mutableListOf<DetectionEvent>()
    private val speciesSeen = mutableSetOf<String>()
    private var sessionStartTime: Long = System.currentTimeMillis()

    // 現在位置（PocketService から更新される）
    private var currentLat: Double? = null
    private var currentLng: Double? = null
    private var currentAlt: Double? = null

    fun add(event: DetectionEvent) {
        events.add(event)
        speciesSeen.add(event.taxonName)
        Log.d("EventBuffer", "Buffered: ${event.taxonName} (total: ${events.size})")
    }

    fun updateLocation(lat: Double, lng: Double, alt: Double) {
        currentLat = lat
        currentLng = lng
        currentAlt = alt
    }

    fun isNewSpecies(name: String): Boolean = !speciesSeen.contains(name)

    fun getSummary(): Summary {
        val duration = (System.currentTimeMillis() - sessionStartTime) / 1000 / 60
        return Summary(
            totalDetections = events.size,
            speciesCount = speciesSeen.size,
            speciesNames = speciesSeen.toList(),
            durationMinutes = duration.toInt(),
        )
    }

    data class Summary(
        val totalDetections: Int,
        val speciesCount: Int,
        val speciesNames: List<String>,
        val durationMinutes: Int,
    )

    /**
     * バッファの内容をファイルに保存し、WorkManager でアップロードをスケジュール。
     */
    fun scheduleUpload(context: Context) {
        if (events.isEmpty()) return

        // JSON ファイルに保存
        val json = toJSON()
        val dir = File(context.filesDir, "pending_uploads")
        dir.mkdirs()
        val file = File(dir, "session_${System.currentTimeMillis()}.json")
        file.writeText(json.toString(2))

        Log.i("EventBuffer", "Saved ${events.size} events to ${file.name}")

        // WorkManager でアップロード
        val uploadWork = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInputData(workDataOf("file_path" to file.absolutePath))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueue(uploadWork)

        Log.i("EventBuffer", "Upload scheduled via WorkManager")
    }

    private fun toJSON(): JSONObject {
        val eventsArray = JSONArray()
        for (event in events) {
            eventsArray.put(event.toJSON())
        }

        return JSONObject().apply {
            put("events", eventsArray)
            put("session", JSONObject().apply {
                put("duration_sec", (System.currentTimeMillis() - sessionStartTime) / 1000)
                put("device", android.os.Build.MODEL)
                put("app_version", "0.1.0")
            })
        }
    }
}
