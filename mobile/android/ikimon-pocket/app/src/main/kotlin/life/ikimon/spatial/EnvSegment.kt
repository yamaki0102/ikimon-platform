package life.ikimon.spatial

import life.ikimon.data.HabitatSignals
import org.json.JSONObject

/**
 * 環境的に均質な GPS ルート区間。
 *
 * SpatialSegmentBuilder が生成し、EnvSegmentUploadWorker が
 * /api/v2/env_segment.php に送信する。
 * 「Google Earth では見えない地上環境レイヤー」として蓄積される。
 */
data class EnvSegment(
    val segmentId: String,
    val sessionId: String,
    val startLat: Double,
    val startLng: Double,
    val endLat: Double,
    val endLng: Double,
    val startTimestamp: Long,
    val endTimestamp: Long,
    val distanceMeters: Float,
    val dominantSignals: HabitatSignals,
    /** セグメント境界のコサイン距離（0=内部遷移なし、高いほど境界が明確） */
    val segmentDelta: Float,
    val observationCount: Int,
    val aiVersion: String = "v0.9.0",
) {
    fun toJSONObject(): JSONObject = JSONObject().apply {
        put("segment_id",        segmentId)
        put("session_id",        sessionId)
        put("start_lat",         startLat)
        put("start_lng",         startLng)
        put("end_lat",           endLat)
        put("end_lng",           endLng)
        put("start_timestamp",   startTimestamp)
        put("end_timestamp",     endTimestamp)
        put("distance_meters",   distanceMeters.toDouble())
        put("signals",           dominantSignals.toJSONObject())
        put("segment_delta",     segmentDelta.toDouble())
        put("observation_count", observationCount)
        put("ai_version",        aiVersion)
        put("schema_version",    "1.0")
    }
}
