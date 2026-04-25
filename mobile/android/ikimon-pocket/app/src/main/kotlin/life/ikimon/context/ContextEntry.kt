package life.ikimon.context

import life.ikimon.data.HabitatSignals

/**
 * ContextRetainer の1エントリ（15秒相当）。
 *
 * HabitatSignals[7] + GPS + sensor をまとめたタイムスタンプ付きスナップショット。
 * Phase 2 で rawFeatures が EnvironmentalTransformer の出力 (256次元) に置き換わる。
 */
data class ContextEntry(
    val timestamp: Long,
    val lat: Double?,
    val lng: Double?,
    val signals: HabitatSignals,
    // Phase 1: signals.toFloatArray() (7次元)
    // Phase 2: EnvironmentalTransformer の出力 (256次元)
    val rawFeatures: FloatArray,
    val pressure: Float = 0f,
    val isStationary: Boolean = false,
    val gpsSpeedMs: Float = 0f,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ContextEntry) return false
        return timestamp == other.timestamp
    }

    override fun hashCode(): Int = timestamp.hashCode()
}
