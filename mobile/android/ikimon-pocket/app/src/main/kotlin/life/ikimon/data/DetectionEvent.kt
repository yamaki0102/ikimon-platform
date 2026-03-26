package life.ikimon.data

import org.json.JSONObject

data class DetectionEvent(
    val type: String,              // "audio" | "visual" | "sensor" | "soundscape"
    val taxonName: String,
    val scientificName: String,
    val confidence: Float,
    val lat: Double?,
    val lng: Double?,
    val timestamp: Long,
    val model: String,
    val audioSnippetHash: String? = null,
    val photoRef: String? = null,
    val environmentSnapshot: EnvironmentSnapshot? = null,
    val speedKmh: Float? = null,
    val aiVersion: String = "v0.5.1",
) {
    fun toJSON(): JSONObject = JSONObject().apply {
        put("type", type)
        put("taxon_name", taxonName)
        put("scientific_name", scientificName)
        put("confidence", confidence.toDouble())
        put("lat", lat)
        put("lng", lng)
        put("timestamp", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US)
            .format(java.util.Date(timestamp)))
        put("model", model)
        audioSnippetHash?.let { put("audio_snippet_hash", it) }
        photoRef?.let { put("photo_ref", it) }
        environmentSnapshot?.let { put("environment_snapshot", it.toJSON()) }
        speedKmh?.let { put("speed_kmh", it.toDouble()) }
        put("ai_version", aiVersion)
    }
}
