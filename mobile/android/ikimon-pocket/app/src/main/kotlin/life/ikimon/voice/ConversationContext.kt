package life.ikimon.voice

import life.ikimon.data.DetectionEvent
import org.json.JSONArray
import org.json.JSONObject

/**
 * BioScan セッション中の会話コンテキスト管理
 *
 * BirdNET 検出結果・環境情報・会話履歴を保持し、
 * Gemini API に渡すコンテキストを構築する。
 */
class ConversationContext {

    private val history = mutableListOf<Turn>()
    private val recentDetections = mutableListOf<Detection>()
    private var lat: Double? = null
    private var lng: Double? = null
    private var transportMode: String = "walk"
    private var sessionId: String? = null

    data class Turn(val role: String, val content: String)
    data class Detection(val name: String, val confidence: Float, val type: String, val timestamp: Long)

    fun setLocation(lat: Double, lng: Double) {
        this.lat = lat
        this.lng = lng
    }

    fun setTransportMode(mode: String) {
        this.transportMode = mode
    }

    fun setSessionId(id: String) {
        this.sessionId = id
    }

    fun addDetection(event: DetectionEvent) {
        val detection = Detection(
            name = event.taxonName,
            confidence = event.confidence,
            type = event.type,
            timestamp = event.timestamp,
        )
        synchronized(recentDetections) {
            recentDetections.add(0, detection)
            if (recentDetections.size > 30) {
                recentDetections.removeAt(recentDetections.lastIndex)
            }
        }
    }

    fun addUserMessage(message: String) {
        synchronized(history) {
            history.add(Turn("user", message))
            trimHistory()
        }
    }

    fun addAssistantMessage(message: String) {
        synchronized(history) {
            history.add(Turn("assistant", message))
            trimHistory()
        }
    }

    fun buildRequestBody(userMessage: String): JSONObject {
        val body = JSONObject()
        body.put("message", userMessage)

        if (lat != null && lng != null) {
            body.put("lat", lat)
            body.put("lng", lng)
        }
        body.put("transport_mode", transportMode)
        sessionId?.let { body.put("session_id", it) }

        // 会話履歴
        val historyArray = JSONArray()
        synchronized(history) {
            for (turn in history.takeLast(10)) {
                historyArray.put(JSONObject().apply {
                    put("role", turn.role)
                    put("content", turn.content)
                })
            }
        }
        body.put("history", historyArray)

        // 検出種
        val detectionsArray = JSONArray()
        synchronized(recentDetections) {
            val unique = recentDetections
                .distinctBy { it.name }
                .take(15)
            for (d in unique) {
                detectionsArray.put(JSONObject().apply {
                    put("name", d.name)
                    put("confidence", d.confidence.toDouble())
                    put("type", d.type)
                })
            }
        }
        body.put("recent_detections", detectionsArray)

        return body
    }

    fun clear() {
        synchronized(history) { history.clear() }
        synchronized(recentDetections) { recentDetections.clear() }
    }

    private fun trimHistory() {
        if (history.size > 20) {
            history.subList(0, history.size - 20).clear()
        }
    }
}
