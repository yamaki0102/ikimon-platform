package life.ikimon.data

import org.json.JSONObject

/**
 * 環境観測レコード — DetectionEvent とは独立したデータモデル。
 *
 * Layer 2 の種同定結果を「この場所の生態系環境状態」に変換した7次元表現。
 * Phase 1 では ContextRetainer のエントリ、Phase 2 では EnvironmentalTransformer の入力になる。
 */
data class HabitatSignals(
    val waterProximity: Float,         // 水域近接度 0-1
    val canopyCover: Float,            // 樹冠被覆率 0-1
    val vegetationDensity: Float,      // 植生密度 0-1
    val anthropogenicPressure: Float,  // 人工的圧力 0-1
    val edgeStructure: Float,          // エッジ構造 0=開放 1=閉鎖
    val disturbanceLevel: Float,       // 撹乱レベル 0-1
    val acousticComplexity: Float,     // 音響複雑性指数 0-1
) {
    fun toFloatArray(): FloatArray = floatArrayOf(
        waterProximity, canopyCover, vegetationDensity,
        anthropogenicPressure, edgeStructure, disturbanceLevel,
        acousticComplexity,
    )

    fun toJSONObject(): JSONObject = JSONObject().apply {
        put("water_proximity", waterProximity.toDouble())
        put("canopy_cover", canopyCover.toDouble())
        put("vegetation_density", vegetationDensity.toDouble())
        put("anthropogenic_pressure", anthropogenicPressure.toDouble())
        put("edge_structure", edgeStructure.toDouble())
        put("disturbance_level", disturbanceLevel.toDouble())
        put("acoustic_complexity", acousticComplexity.toDouble())
    }

    companion object {
        val ZERO = HabitatSignals(0f, 0f, 0f, 0f, 0f, 0f, 0f)
    }
}

data class EnvObservation(
    val sessionId: String,
    val timestamp: Long,
    val lat: Double?,
    val lng: Double?,
    val altitude: Double?,
    val signals: HabitatSignals,
    val aiVersion: String = "v0.9.0",
) {
    fun toJSONObject(): JSONObject = JSONObject().apply {
        put("session_id", sessionId)
        put("timestamp", timestamp)
        lat?.let { put("lat", it) }
        lng?.let { put("lng", it) }
        altitude?.let { put("altitude", it) }
        put("signals", signals.toJSONObject())
        put("ai_version", aiVersion)
    }
}
