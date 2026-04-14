package life.ikimon.spatial

import android.location.Location
import android.util.Log
import life.ikimon.context.ContextEntry
import life.ikimon.context.SlidingWindowAggregator
import java.util.UUID

/**
 * GPS ルートを環境潜在ベクトルのコサイン距離でセグメント化する。
 *
 * アルゴリズム:
 *   1. ContextEntry が push されるたびに現セグメントの集約状態と比較
 *   2. コサイン距離 ≥ threshold かつ最低 minEntries エントリが溜まっていたらセグメント境界
 *   3. 各セグメントの支配的な HabitatSignals を加重平均で算出
 *
 * Phase 1 の threshold (0.25) は実地テスト後に校正する。
 * F1 ≥ 0.6（既知環境遷移との一致率）が Phase 2 進行の条件。
 */
class SpatialSegmentBuilder(
    private val sessionId: String,
    private var deltaThreshold: Float = 0.25f,
    private val minEntries: Int = 2,            // 最短セグメント: 30秒
    private val maxSegments: Int = 500,         // セッション上限
) {
    companion object {
        private const val TAG = "SpatialSegmentBuilder"
    }

    private val aggregator = SlidingWindowAggregator()
    private val completedSegments = mutableListOf<EnvSegment>()
    private val currentEntries = mutableListOf<ContextEntry>()

    /**
     * 新しい ContextEntry を受け取り、セグメント境界を検出したら EnvSegment を返す。
     *
     * GPS ロストエントリ (lat=null) はバッファに追加するが境界判定をスキップ。
     */
    fun push(entry: ContextEntry): EnvSegment? {
        if (completedSegments.size >= maxSegments) return null

        if (currentEntries.isEmpty()) {
            currentEntries.add(entry)
            return null
        }

        // GPS ロスト → 境界判定スキップ、バッファには積む
        if (entry.lat == null || entry.lng == null) {
            currentEntries.add(entry)
            return null
        }

        // 現セグメントの集約状態と新エントリのコサイン距離
        val currentAggregated = aggregator.aggregate(currentEntries)
        val delta = aggregator.cosineDelta(currentAggregated, entry.signals)

        return if (delta >= deltaThreshold && currentEntries.size >= minEntries) {
            // セグメント境界を確定
            val segment = buildSegment(currentEntries, delta)
            completedSegments.add(segment)
            Log.i(TAG, "Segment[${completedSegments.size}] boundary: delta=${"%.3f".format(delta)} " +
                "entries=${currentEntries.size} dist=${"%.0f".format(segment.distanceMeters)}m " +
                "water=${"%.2f".format(segment.dominantSignals.waterProximity)} " +
                "canopy=${"%.2f".format(segment.dominantSignals.canopyCover)}")
            currentEntries.clear()
            currentEntries.add(entry)
            segment
        } else {
            currentEntries.add(entry)
            null
        }
    }

    /**
     * セッション終了時に残りエントリをセグメントとして確定する。
     */
    fun finalize(): EnvSegment? {
        if (currentEntries.size < minEntries) return null
        val segment = buildSegment(currentEntries, 0f)
        completedSegments.add(segment)
        Log.i(TAG, "Segment[${completedSegments.size}] finalized: " +
            "entries=${currentEntries.size} dist=${"%.0f".format(segment.distanceMeters)}m")
        currentEntries.clear()
        return segment
    }

    fun getCompletedSegments(): List<EnvSegment> = completedSegments.toList()

    fun pendingEntryCount(): Int = currentEntries.size

    /**
     * Phase 1 テスト中に閾値を動的に調整する。
     * F1 スコアに基づいて開発者が手動キャリブレーション。
     */
    fun calibrateThreshold(newThreshold: Float) {
        require(newThreshold in 0.05f..0.8f) { "threshold must be 0.05-0.8" }
        deltaThreshold = newThreshold
        Log.i(TAG, "Threshold calibrated: $newThreshold")
    }

    fun currentThreshold(): Float = deltaThreshold

    private fun buildSegment(entries: List<ContextEntry>, delta: Float): EnvSegment {
        val first = entries.first()
        val last  = entries.last()
        val aggregated = aggregator.aggregate(entries)

        // GPS 距離計算（GPS ロストエントリは除外して計算）
        val gpsEntries = entries.filter { it.lat != null && it.lng != null }
        val distanceM = if (gpsEntries.size >= 2) {
            val results = FloatArray(1)
            Location.distanceBetween(
                gpsEntries.first().lat!!, gpsEntries.first().lng!!,
                gpsEntries.last().lat!!,  gpsEntries.last().lng!!,
                results,
            )
            results[0]
        } else 0f

        val startLat = gpsEntries.firstOrNull()?.lat ?: first.lat ?: 0.0
        val startLng = gpsEntries.firstOrNull()?.lng ?: first.lng ?: 0.0
        val endLat   = gpsEntries.lastOrNull()?.lat  ?: last.lat  ?: 0.0
        val endLng   = gpsEntries.lastOrNull()?.lng  ?: last.lng  ?: 0.0

        return EnvSegment(
            segmentId        = "seg_${UUID.randomUUID()}",
            sessionId        = sessionId,
            startLat         = startLat,
            startLng         = startLng,
            endLat           = endLat,
            endLng           = endLng,
            startTimestamp   = first.timestamp,
            endTimestamp     = last.timestamp,
            distanceMeters   = distanceM,
            dominantSignals  = aggregated,
            segmentDelta     = delta,
            observationCount = entries.size,
        )
    }
}
