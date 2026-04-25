package life.ikimon.context

import android.content.Context
import android.os.Debug
import android.os.PowerManager
import android.util.Log

/**
 * Phase 1 計測用: ContextRetainer のメモリ・Thermal・バッテリーを30分連続でサンプリング。
 *
 * Go/No-Go ゲート判定:
 *   - ヒープ増加 < 20MB (30分連続)
 *   - Thermal STATUS ≤ MODERATE を維持
 *   - バッテリー消費 < 15%/時
 */
class ContextRetainerStats(private val context: Context) {

    companion object {
        private const val TAG = "ContextRetainerStats"
    }

    data class StatsSnapshot(
        val timestampMs: Long,
        val heapUsedMb: Float,
        val nativeHeapMb: Float,
        val retainerBytes: Long,
        val retainerEntries: Int,
        val thermalStatus: String,
        val batteryPct: Int,
    )

    private val snapshots = mutableListOf<StatsSnapshot>()
    private var baselineHeapMb: Float = 0f
    private var baselineBatteryPct: Int = 100
    private var startTimeMs: Long = 0L

    fun start() {
        snapshots.clear()
        baselineHeapMb = currentHeapMb()
        baselineBatteryPct = currentBatteryPct()
        startTimeMs = System.currentTimeMillis()
        Log.i(TAG, "Stats baseline: heap=${baselineHeapMb}MB battery=${baselineBatteryPct}%")
    }

    fun sample(retainer: ContextRetainer): StatsSnapshot {
        val snap = StatsSnapshot(
            timestampMs    = System.currentTimeMillis(),
            heapUsedMb     = currentHeapMb(),
            nativeHeapMb   = (Debug.getNativeHeapAllocatedSize() / 1024f / 1024f),
            retainerBytes  = retainer.estimatedMemoryBytes(),
            retainerEntries = retainer.size(),
            thermalStatus  = thermalStatus(),
            batteryPct     = currentBatteryPct(),
        )
        snapshots.add(snap)
        Log.d(TAG, "heap=${snap.heapUsedMb}MB " +
            "retainer=${snap.retainerBytes / 1024}KB(${snap.retainerEntries}entries) " +
            "thermal=${snap.thermalStatus} battery=${snap.batteryPct}%")
        return snap
    }

    fun generateReport(): String {
        if (snapshots.isEmpty()) return "No data — call start() and sample() first"

        val elapsedMin = (System.currentTimeMillis() - startTimeMs) / 60_000f
        val heapDelta = snapshots.last().heapUsedMb - baselineHeapMb
        val batteryDelta = baselineBatteryPct - snapshots.last().batteryPct
        val batteryPerHour = if (elapsedMin > 0) batteryDelta * 60f / elapsedMin else 0f
        val maxHeapDelta = snapshots.maxOf { it.heapUsedMb } - baselineHeapMb
        val thermalCounts = snapshots.groupingBy { it.thermalStatus }.eachCount()
        val maxEntries = snapshots.maxOf { it.retainerEntries }

        val heapGate    = if (maxHeapDelta < 20f) "✅ PASS" else "❌ FAIL"
        val thermalGate = if (thermalCounts.keys.none { it == "SEVERE" || it == "CRITICAL" }) "✅ PASS" else "❌ FAIL"
        val batteryGate = if (batteryPerHour < 15f) "✅ PASS" else "❌ FAIL"

        return """
            ===== ContextRetainer Phase 1 Stats Report =====
            Duration      : ${"%.1f".format(elapsedMin)} min
            Samples       : ${snapshots.size}

            [Memory]
            Heap delta    : +${"%.1f".format(maxHeapDelta)} MB (max) $heapGate  (gate: < 20MB)
            Final heap    : ${"%.1f".format(snapshots.last().heapUsedMb)} MB
            Retainer peak : ${snapshots.maxOf { it.retainerBytes } / 1024} KB (${maxEntries} entries)

            [Thermal]
            Distribution  : $thermalCounts $thermalGate  (gate: no SEVERE/CRITICAL)

            [Battery]
            Consumed      : ${batteryDelta}% in ${"%.0f".format(elapsedMin)} min
            Rate/hour     : ${"%.1f".format(batteryPerHour)}% $batteryGate  (gate: < 15%/h)

            [Go/No-Go]
            HEAP   : $heapGate
            THERMAL: $thermalGate
            BATTERY: $batteryGate
            ================================================
        """.trimIndent()
    }

    private fun currentHeapMb(): Float {
        val runtime = Runtime.getRuntime()
        return (runtime.totalMemory() - runtime.freeMemory()) / 1024f / 1024f
    }

    private fun currentBatteryPct(): Int {
        return try {
            val intent = context.registerReceiver(
                null,
                android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED)
            )
            val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level >= 0 && scale > 0) (level * 100 / scale) else -1
        } catch (e: Exception) { -1 }
    }

    private fun thermalStatus(): String {
        return try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            // Android 10+ (API 29+)
            when (pm.currentThermalStatus) {
                PowerManager.THERMAL_STATUS_NONE       -> "NONE"
                PowerManager.THERMAL_STATUS_LIGHT      -> "LIGHT"
                PowerManager.THERMAL_STATUS_MODERATE   -> "MODERATE"
                PowerManager.THERMAL_STATUS_SEVERE     -> "SEVERE"
                PowerManager.THERMAL_STATUS_CRITICAL   -> "CRITICAL"
                PowerManager.THERMAL_STATUS_EMERGENCY  -> "EMERGENCY"
                PowerManager.THERMAL_STATUS_SHUTDOWN   -> "SHUTDOWN"
                else -> "UNKNOWN"
            }
        } catch (e: Exception) { "UNKNOWN" }
    }
}
