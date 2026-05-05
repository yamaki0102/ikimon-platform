package life.ikimon.data

import android.content.Context
import android.util.Log
import life.ikimon.api.AppAuthManager
import life.ikimon.api.InstallIdentityManager
import life.ikimon.api.UploadCoordinator
import life.ikimon.api.UploadStatusStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 検出イベントのローカルバッファ。
 * メモリ + ファイルの二重バッファで、セッション中のイベントを蓄積する。
 * Wi-Fi 接続時に WorkManager でサーバーへバッチ送信。
 */
class EventBuffer {

    private val events = mutableListOf<DetectionEvent>()
    private val speciesSeen = mutableSetOf<String>()
    private var sessionStartTime: Long = System.currentTimeMillis()
    private var sessionIntent: String = "official"
    private var officialRecord: Boolean = true
    private var testProfile: String = "field"

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

    fun setSessionMode(sessionIntent: String, officialRecord: Boolean, testProfile: String = "field") {
        this.sessionIntent = if (sessionIntent == "test") "test" else "official"
        this.officialRecord = officialRecord
        this.testProfile = if (this.sessionIntent == "test") testProfile else "field"
    }

    fun isNewSpecies(name: String): Boolean = !speciesSeen.contains(name)

    fun getSummary(): Summary {
        val durationSec = (System.currentTimeMillis() - sessionStartTime) / 1000
        val audioCount = events.count { it.type == "audio" }
        val visualCount = events.count { it.type == "visual" }
        return Summary(
            totalDetections = events.size,
            speciesCount = speciesSeen.size,
            speciesNames = speciesSeen.toList(),
            durationMinutes = (durationSec / 60).toInt(),
            durationSeconds = durationSec.toInt(),
            audioDetections = audioCount,
            visualDetections = visualCount,
            sessionIntent = sessionIntent,
            officialRecord = officialRecord,
            testProfile = testProfile,
        )
    }

    data class Summary(
        val totalDetections: Int,
        val speciesCount: Int,
        val speciesNames: List<String>,
        val durationMinutes: Int,
        val durationSeconds: Int = 0,
        val audioDetections: Int = 0,
        val visualDetections: Int = 0,
        val sessionIntent: String = "official",
        val officialRecord: Boolean = true,
        val testProfile: String = "field",
    )

    fun persistSessionLog(
        context: Context,
        sessionId: String,
        mode: String,
        metadata: Map<String, Any?> = emptyMap(),
    ): File {
        val dir = context.getExternalFilesDir("session_logs")
            ?: File(context.filesDir, "session_logs")
        dir.mkdirs()

        val logFile = File(dir, "${sessionId}_summary.json")
        val latestFile = File(dir, "latest_session_summary.json")
        val payload = toSessionLogJson(sessionId, mode, metadata)
        val body = payload.toString(2)
        logFile.writeText(body)
        latestFile.writeText(body)
        Log.i("EventBuffer", "Saved session log to ${logFile.absolutePath}")
        return logFile
    }

    /**
     * バッファの内容をファイルに保存し、WorkManager でアップロードをスケジュール。
     */
    fun scheduleUpload(context: Context) {
        if (events.isEmpty()) return

        // JSON ファイルに保存
        val json = toJSON(context)
        val dir = UploadCoordinator.pendingDirectory(context)
        dir.mkdirs()
        val file = File(dir, "session_${System.currentTimeMillis()}.json")
        file.writeText(json.toString(2))

        Log.i("EventBuffer", "Saved ${events.size} events to ${file.name}")
        UploadStatusStore.recordQueued(context, file.name, sessionIntent, officialRecord)

        UploadCoordinator.enqueueUpload(context, file)

        Log.i("EventBuffer", "Upload scheduled via WorkManager")
    }

    private fun toJSON(context: Context): JSONObject {
        val eventsArray = JSONArray()
        for (event in events) {
            eventsArray.put(event.toJSON())
        }
        val login = AppAuthManager.currentState(context)
        val installId = InstallIdentityManager.getOrCreateInstallId(context)

        return JSONObject().apply {
            put("events", eventsArray)
            put("session", JSONObject().apply {
                put("duration_sec", (System.currentTimeMillis() - sessionStartTime) / 1000)
                put("device", android.os.Build.MODEL)
                put("app_version", "0.8.1")
                put("session_intent", sessionIntent)
                put("official_record", officialRecord)
                put("test_profile", testProfile)
                put("user_auth_state", if (login.isLoggedIn) "logged_in" else "anonymous")
                put("ikimon_user_id", login.userId)
                put("install_id", installId)
            })
        }
    }

    private fun toSessionLogJson(
        sessionId: String,
        mode: String,
        metadata: Map<String, Any?>,
    ): JSONObject {
        val summary = getSummary()
        val topEvents = events
            .sortedByDescending { it.confidence }
            .take(10)
        val engineCounts = linkedMapOf<String, Int>()
        for (event in events) {
            engineCounts[event.model] = (engineCounts[event.model] ?: 0) + 1
        }

        return JSONObject().apply {
            put("saved_at", System.currentTimeMillis())
            put("session_id", sessionId)
            put("mode", mode)
            put("summary", JSONObject().apply {
                put("total_detections", summary.totalDetections)
                put("species_count", summary.speciesCount)
                put("species_names", JSONArray(summary.speciesNames))
                put("duration_minutes", summary.durationMinutes)
                put("duration_seconds", summary.durationSeconds)
                put("audio_detections", summary.audioDetections)
                put("visual_detections", summary.visualDetections)
                put("session_intent", summary.sessionIntent)
                put("official_record", summary.officialRecord)
                put("test_profile", summary.testProfile)
            })
            put("current_location", JSONObject().apply {
                put("lat", currentLat)
                put("lng", currentLng)
                put("alt", currentAlt)
            })
            put("engine_counts", JSONObject(engineCounts as Map<*, *>))
            put("top_events", JSONArray().apply {
                topEvents.forEach { event ->
                    put(JSONObject().apply {
                        put("type", event.type)
                        put("taxon_name", event.taxonName)
                        put("scientific_name", event.scientificName)
                        put("confidence", event.confidence)
                        put("model", event.model)
                        put("timestamp", event.timestamp)
                        put("birdnet_confidence", event.birdnetConfidence)
                        put("perch_confidence", event.perchConfidence)
                        put("gemma_confidence", event.gemmaConfidence)
                        put("consensus_level", event.consensusLevel)
                    })
                }
            })
            put("metadata", JSONObject().apply {
                metadata.forEach { (key, value) -> put(key, value) }
            })
        }
    }
}
