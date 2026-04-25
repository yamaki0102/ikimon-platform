package life.ikimon.context

import android.util.Log
import life.ikimon.data.HabitatSignals
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * 直近 windowMinutes 分の環境観測を保持するローリングバッファ。
 *
 * Phase 1 実装:
 *   - ArrayDeque リングバッファ（ConcurrentLinkedDeque より割当コスト低）
 *   - synchronized ブロックでスレッドセーフを保証
 *   - SlidingWindowAggregator で直近5エントリ（75秒）を加重平均
 *   - StateFlow で Compose UI にリアクティブ配信
 *
 * メモリ:
 *   120 entries × (HabitatSignals[7] × 4bytes + metadata ≒ 200bytes) = 24KB
 */
class ContextRetainer(
    val windowMinutes: Int = 30,
    val intervalSeconds: Int = 15,
) {
    companion object {
        private const val TAG = "ContextRetainer"
    }

    private val maxEntries = (windowMinutes * 60) / intervalSeconds  // 120

    private val buffer = ArrayDeque<ContextEntry>(maxEntries + 1)
    private val aggregator = SlidingWindowAggregator()

    private val _envState = MutableStateFlow<HabitatSignals?>(null)
    /** 直近75秒の加重平均環境状態。UI観察・境界判定に使う。 */
    val envState: StateFlow<HabitatSignals?> = _envState

    @Synchronized
    fun add(entry: ContextEntry) {
        buffer.addLast(entry)
        if (buffer.size > maxEntries) buffer.removeFirst()

        // 直近5エントリ（75秒）で集約して StateFlow 更新
        val recent = getRecentEntries(5)
        _envState.value = aggregator.aggregate(recent)

        Log.v(TAG, "buf=${buffer.size}/$maxEntries " +
            "water=${"%.2f".format(_envState.value?.waterProximity ?: 0f)} " +
            "canopy=${"%.2f".format(_envState.value?.canopyCover ?: 0f)}")
    }

    /** 現在の集約環境状態を返す */
    fun getEnvState(): HabitatSignals? = _envState.value

    /**
     * 直近 count 件を返す（古い順）。
     * SpatialSegmentBuilder のセグメント集約に使用。
     */
    @Synchronized
    fun getRecentEntries(count: Int): List<ContextEntry> {
        val n = minOf(count, buffer.size)
        return buffer.toList().takeLast(n)
    }

    /**
     * 全バッファを返す（古い順）。
     * セッション終了後の最終セグメント生成などに使用。
     */
    @Synchronized
    fun getAllEntries(): List<ContextEntry> = buffer.toList()

    @Synchronized
    fun size(): Int = buffer.size

    @Synchronized
    fun clear() {
        buffer.clear()
        _envState.value = null
    }

    /** Phase 1 メモリ計測用 */
    fun estimatedMemoryBytes(): Long = buffer.size.toLong() * 200L

    /**
     * 動的窓サイズを返す。
     * GPS速度 > 5m/s (自転車以上) → 7.5s、静止中 → 30s、それ以外 → 15s。
     */
    fun adaptiveIntervalSeconds(gpsSpeedMs: Float, isStationary: Boolean): Int = when {
        isStationary        -> 30
        gpsSpeedMs > 5f     -> 8  // 7.5s を 8s に丸め
        else                -> intervalSeconds
    }
}
