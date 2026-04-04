package life.ikimon.data

import org.json.JSONObject

/**
 * 検出イベントのデータモデル（iOS/Android 共通フォーマット）
 * サーバーの passive_event.php / scan_detection.php に送信する形式。
 */
data class DetectionEvent(
    val type: String,              // "audio" | "visual" | "sensor"
    val taxonName: String,         // 種名（和名）
    val scientificName: String,    // 学名
    val confidence: Float,         // fused confidence 0.0 - 1.0
    val lat: Double?,
    val lng: Double?,
    val timestamp: Long,           // Unix ms
    val model: String,             // 使用モデル名
    val audioSnippetHash: String? = null,
    val audioSnippetId: String? = null,   // AudioSnippetStore の ID
    val photoRef: String? = null,
    val taxonomicClass: String? = null,
    val order: String? = null,
    val taxonRank: String = "species",
    val aiVersion: String = "v0.8.1",
    // トリプルエンジン情報
    val birdnetConfidence: Float? = null,
    val perchConfidence: Float? = null,
    val gemmaConfidence: Float? = null,    // null = Gemma 未使用 or AICore 未対応
    val consensusLevel: String? = null,   // "TRIPLE_CONSENSUS" | "DUAL_CONSENSUS" | "SINGLE_STRONG" | "SINGLE_WEAK"
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
        put("ai_version", aiVersion)
        audioSnippetHash?.let { put("audio_snippet_hash", it) }
        audioSnippetId?.let { put("audio_snippet_id", it) }
        photoRef?.let { put("photo_ref", it) }
        taxonomicClass?.let { put("taxonomic_class", it) }
        order?.let { put("taxonomic_order", it) }
        put("taxon_rank", taxonRank)
        birdnetConfidence?.let { put("birdnet_confidence", it.toDouble()) }
        perchConfidence?.let { put("perch_confidence", it.toDouble()) }
        gemmaConfidence?.let { put("gemma_confidence", it.toDouble()) }
        consensusLevel?.let { put("consensus_level", it) }
    }
}
