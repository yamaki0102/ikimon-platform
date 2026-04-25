package life.ikimon.context

import life.ikimon.data.HabitatSignals
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * 直近N件の ContextEntry を指数加重平均で集約する。
 *
 * Phase 1 実装: 新しいエントリほど重みが大きい指数減衰。
 * Phase 2 でこのクラスが EnvironmentalTransformer に置き換わる。
 *
 * @param decayFactor 1エントリ前の重み係数 (0 < decay < 1)。
 *   0.85 = 直近15s が最も重く、1分前 (4エントリ前) は 0.52 の重み。
 */
class SlidingWindowAggregator(
    private val decayFactor: Float = 0.85f,
) {

    /**
     * 直近エントリ群を加重平均して HabitatSignals を返す。
     * entriesは古い順（先頭=最古）で渡す。
     */
    fun aggregate(entries: List<ContextEntry>): HabitatSignals {
        if (entries.isEmpty()) return HabitatSignals.ZERO

        var weightSum = 0f
        var water = 0f; var canopy = 0f; var veg = 0f
        var anthropo = 0f; var edge = 0f; var dist = 0f; var aci = 0f

        // 末尾（最新）から指数減衰
        entries.asReversed().forEachIndexed { i, entry ->
            val w = decayFactor_pow(i)
            weightSum += w
            val s = entry.signals
            water  += s.waterProximity         * w
            canopy += s.canopyCover             * w
            veg    += s.vegetationDensity       * w
            anthropo += s.anthropogenicPressure * w
            edge   += s.edgeStructure           * w
            dist   += s.disturbanceLevel        * w
            aci    += s.acousticComplexity      * w
        }

        return HabitatSignals(
            waterProximity        = water   / weightSum,
            canopyCover           = canopy  / weightSum,
            vegetationDensity     = veg     / weightSum,
            anthropogenicPressure = anthropo / weightSum,
            edgeStructure         = edge    / weightSum,
            disturbanceLevel      = dist    / weightSum,
            acousticComplexity    = aci     / weightSum,
        )
    }

    /**
     * 2つの HabitatSignals のコサイン距離を返す。
     * 0 = 同一環境、1 = 完全に異なる環境。
     * SpatialSegmentBuilder の境界判定に使用。
     */
    fun cosineDelta(a: HabitatSignals, b: HabitatSignals): Float {
        val va = a.toFloatArray()
        val vb = b.toFloatArray()
        var dot = 0f; var na = 0f; var nb = 0f
        for (i in va.indices) {
            dot += va[i] * vb[i]
            na  += va[i] * va[i]
            nb  += vb[i] * vb[i]
        }
        val denom = sqrt(na) * sqrt(nb)
        if (denom < 1e-6f) return 0f
        return (1f - dot / denom).coerceIn(0f, 1f)
    }

    /**
     * 直近N件の変化率（環境状態の移動速度）を返す。
     * 静止/緩やか/急変を判定するのに使う。
     */
    fun changeRate(entries: List<ContextEntry>): Float {
        if (entries.size < 2) return 0f
        var totalDelta = 0f
        for (i in 1 until entries.size) {
            totalDelta += cosineDelta(entries[i - 1].signals, entries[i].signals)
        }
        return totalDelta / (entries.size - 1)
    }

    private fun decayFactor_pow(n: Int): Float {
        var result = 1f
        repeat(n) { result *= decayFactor }
        return result
    }
}
