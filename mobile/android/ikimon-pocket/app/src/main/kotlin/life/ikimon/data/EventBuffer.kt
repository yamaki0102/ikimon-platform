package life.ikimon.data

import android.content.Context
import android.util.Log
import androidx.work.*
import life.ikimon.api.UploadWorker
import life.ikimon.pocket.LocationTracker
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class EventBuffer {

    private val events = mutableListOf<DetectionEvent>()
    private val speciesSeen = mutableSetOf<String>()
    private var sessionStartTime: Long = System.currentTimeMillis()
    private var batchNumber = 0

    var sessionId: String = ""

    // 現在位置
    private var currentLat: Double? = null
    private var currentLng: Double? = null
    private var currentAlt: Double? = null
    private var currentGpsAccuracy: Float? = null
    private var currentSpeedKmh: Float? = null

    fun add(event: DetectionEvent) {
        synchronized(events) {
            events.add(event)
        }
        speciesSeen.add(event.taxonName)
        Log.d("EventBuffer", "Buffered: ${event.taxonName} (total: ${events.size})")
    }

    fun updateLocation(lat: Double, lng: Double, alt: Double) {
        currentLat = lat
        currentLng = lng
        currentAlt = alt
    }

    fun updateGpsAccuracy(accuracy: Float) {
        currentGpsAccuracy = accuracy
    }

    fun updateSpeed(speedKmh: Float) {
        currentSpeedKmh = speedKmh
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
     * インクリメンタルアップロード — セッション中に定期的に呼ばれる
     *
     * 前回フラッシュ以降のイベントだけを送信し、
     * セッションメタデータ（ルート・環境ログ）を添付する。
     */
    fun scheduleIncrementalUpload(
        context: Context,
        envHistory: List<EnvironmentSnapshot> = emptyList(),
        routePoints: List<LocationTracker.RoutePoint> = emptyList(),
        distanceM: Float = 0f,
        isFinal: Boolean = false,
    ) {
        val eventsToSend: List<DetectionEvent>
        synchronized(events) {
            if (events.isEmpty() && envHistory.isEmpty()) return
            eventsToSend = events.toList()
            if (!isFinal) events.clear() // ファイナル以外はバッファクリア
        }

        batchNumber++

        val json = toIncrementalJSON(
            events = eventsToSend,
            envHistory = envHistory,
            routePoints = routePoints,
            distanceM = distanceM,
            isFinal = isFinal,
        )

        val dir = File(context.filesDir, "pending_uploads")
        dir.mkdirs()
        val file = File(dir, "session_${sessionId}_batch_${batchNumber}.json")
        file.writeText(json.toString(2))

        Log.i("EventBuffer", "Saved batch #$batchNumber: ${eventsToSend.size} events, " +
            "${envHistory.size} env logs → ${file.name}")

        val uploadWork = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInputData(workDataOf("file_path" to file.absolutePath))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueue(uploadWork)
        Log.i("EventBuffer", "Upload enqueued for batch #$batchNumber")
    }

    /**
     * 旧API互換の scheduleUpload（セッション終了時用）
     */
    fun scheduleUpload(context: Context) {
        scheduleIncrementalUpload(context, isFinal = true)
    }

    private fun toIncrementalJSON(
        events: List<DetectionEvent>,
        envHistory: List<EnvironmentSnapshot>,
        routePoints: List<LocationTracker.RoutePoint>,
        distanceM: Float,
        isFinal: Boolean,
    ): JSONObject {
        val eventsArray = JSONArray()
        for (event in events) {
            eventsArray.put(event.toJSON())
        }

        val envArray = JSONArray()
        for (env in envHistory) {
            envArray.put(env.toJSON())
        }

        val routeArray = JSONArray()
        for (point in routePoints) {
            routeArray.put(JSONObject().apply {
                put("lat", point.lat)
                put("lng", point.lng)
                put("altitude", point.altitude)
                put("timestamp", point.timestamp)
            })
        }

        return JSONObject().apply {
            put("events", eventsArray)
            put("session", JSONObject().apply {
                put("session_id_client", sessionId)
                put("duration_sec", (System.currentTimeMillis() - sessionStartTime) / 1000)
                put("distance_m", distanceM.toDouble())
                put("device", android.os.Build.MODEL)
                put("app_version", "0.6.0-experimental")
                put("scan_mode", "eternal_scan")
                put("is_incremental", !isFinal)
                put("is_final", isFinal)
                put("batch_number", batchNumber)
            })
            if (envArray.length() > 0) {
                put("env_history", envArray)
            }
            if (routeArray.length() > 0) {
                put("route_points", routeArray)
            }
        }
    }
}
