package life.ikimon.data

import life.ikimon.pocket.VisionClassifier
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Phase 2 学習データの核 — Layer 2 の全出力を1レコードに束ねる。
 *
 * Perch logits[10932] + BirdNET probs[11560] + EnvironmentResult + sensor を
 * バイナリ永続化し、将来の EnvironmentalTransformer 学習データとして蓄積する。
 *
 * EmbeddingStore が 60秒間隔で filesDir/embeddings/{sessionId}/chunk_NNN.bin に書き出す。
 */
data class EmbeddingSnapshot(
    val timestamp: Long,
    val lat: Double?,
    val lng: Double?,
    val perchLogits: FloatArray?,          // [10932] 生logits (null = Perch未稼働)
    val birdnetProbs: FloatArray?,         // [11560] softmax済み (null = BirdNET未稼働)
    val envResult: VisionClassifier.EnvironmentResult?,
    val pressure: Float,
    val isStationary: Boolean,
    val gpsSpeedMs: Float,
    val signals: HabitatSignals,
) {
    companion object {
        // バイナリヘッダサイズ: timestamp(8) + lat(8) + lng(8) + flags(4) + pressure(4) + speed(4) + signals(28) = 64 bytes
        private const val HEADER_SIZE = 64
        private const val PERCH_DIM = 10932
        private const val BIRDNET_DIM = 11560
    }

    /**
     * バイナリ形式にシリアライズ。
     *
     * フォーマット:
     *   [header: 64 bytes]
     *     timestamp: Long (8)
     *     lat: Double (8) — NaN if null
     *     lng: Double (8) — NaN if null
     *     flags: Int (4) — bit0=hasPerch, bit1=hasBirdnet, bit2=hasEnvResult, bit3=isStationary
     *     pressure: Float (4)
     *     gpsSpeedMs: Float (4)
     *     signals: Float×7 (28)
     *   [perch logits: 10932×4 bytes] — optional
     *   [birdnet probs: 11560×4 bytes] — optional
     *   [envResult: variable] — optional, compact encoding
     */
    fun toByteArray(): ByteArray {
        val hasPerch = perchLogits != null
        val hasBirdnet = birdnetProbs != null
        val hasEnv = envResult != null
        val flags = (if (hasPerch) 1 else 0) or
            (if (hasBirdnet) 2 else 0) or
            (if (hasEnv) 4 else 0) or
            (if (isStationary) 8 else 0)

        val perchBytes = if (hasPerch) PERCH_DIM * 4 else 0
        val birdnetBytes = if (hasBirdnet) BIRDNET_DIM * 4 else 0
        val envBytes = if (hasEnv) encodeEnvResult(envResult!!).size else 0
        val totalSize = HEADER_SIZE + perchBytes + birdnetBytes + envBytes

        val buf = ByteBuffer.allocate(totalSize).order(ByteOrder.LITTLE_ENDIAN)

        // Header
        buf.putLong(timestamp)
        buf.putDouble(lat ?: Double.NaN)
        buf.putDouble(lng ?: Double.NaN)
        buf.putInt(flags)
        buf.putFloat(pressure)
        buf.putFloat(gpsSpeedMs)
        for (v in signals.toFloatArray()) buf.putFloat(v)

        // Perch logits
        if (hasPerch) {
            for (v in perchLogits!!) buf.putFloat(v)
        }

        // BirdNET probs
        if (hasBirdnet) {
            for (v in birdnetProbs!!) buf.putFloat(v)
        }

        // EnvironmentResult
        if (hasEnv) {
            buf.put(encodeEnvResult(envResult!!))
        }

        return buf.array()
    }

    private fun encodeEnvResult(env: VisionClassifier.EnvironmentResult): ByteArray {
        // Compact: habitat(1 byte index) + vegetation(1) + ground(1) + water(1) + canopyCoverPct(1) + disturbance(1) = 6 bytes
        return byteArrayOf(
            habitatIndex(env.habitat).toByte(),
            vegetationIndex(env.vegetation).toByte(),
            groundIndex(env.ground).toByte(),
            waterIndex(env.water).toByte(),
            env.canopyCoverPct.coerceIn(0, 100).toByte(),
            disturbanceIndex(env.disturbance).toByte(),
        )
    }

    private fun habitatIndex(h: String): Int = when {
        h.contains("forest") -> 1
        h.contains("grassland") -> 2
        h.contains("wetland") -> 3
        h.contains("urban") -> 4
        h.contains("park") -> 5
        h.contains("river") || h.contains("stream") -> 6
        h.contains("farm") || h.contains("agricultural") -> 7
        h.contains("coast") || h.contains("shore") -> 8
        else -> 0
    }

    private fun vegetationIndex(v: String): Int = when {
        v.contains("canopy") -> 3
        v.contains("shrub") -> 2
        v.contains("grass") -> 1
        v.contains("sparse") || v.contains("none") -> 0
        else -> 0
    }

    private fun groundIndex(g: String): Int = when {
        g.contains("litter") || g.contains("leaf") -> 1
        g.contains("grass") -> 2
        g.contains("soil") || g.contains("mud") -> 3
        g.contains("concrete") || g.contains("asphalt") -> 4
        g.contains("rock") || g.contains("gravel") -> 5
        g.contains("sand") -> 6
        else -> 0
    }

    private fun waterIndex(w: String): Int = when {
        w.contains("none") -> 0
        w.contains("stream") -> 1
        w.contains("river") -> 2
        w.contains("pond") -> 3
        w.contains("lake") -> 4
        w.contains("ocean") || w.contains("sea") -> 5
        else -> 0
    }

    private fun disturbanceIndex(d: String): Int = when {
        d.contains("low") -> 0
        d.contains("medium") || d.contains("moderate") -> 1
        d.contains("high") -> 2
        else -> 0
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is EmbeddingSnapshot) return false
        return timestamp == other.timestamp
    }

    override fun hashCode(): Int = timestamp.hashCode()
}
