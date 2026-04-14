package life.ikimon.store

import android.content.Context
import android.util.Log
import life.ikimon.data.EmbeddingSnapshot
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * Crash-safe embedding 永続化ストア。
 *
 * EmbeddingSnapshot を 60秒間隔で filesDir/embeddings/{sessionId}/chunk_NNN.bin に書き出す。
 * OS kill/クラッシュ時の損失は最大60秒分のみ。
 *
 * Phase 2 の EnvironmentalTransformer 学習データとして、BirdNET probs[11560] と
 * Perch logits[10932] の生ベクトルを蓄積する。
 */
class EmbeddingStore(
    private val context: Context,
    private val sessionId: String,
    private val flushIntervalMs: Long = 60_000L,
) {
    companion object {
        private const val TAG = "EmbeddingStore"
        private const val EMBEDDINGS_DIR = "embeddings"
        private const val MANIFEST_FILE = "manifest.json"
        private const val CHUNK_PREFIX = "chunk_"
    }

    private val sessionDir: File = File(context.filesDir, "$EMBEDDINGS_DIR/$sessionId").apply { mkdirs() }
    private val buffer = mutableListOf<EmbeddingSnapshot>()
    private var chunkIndex = 0
    private var lastFlushTime = System.currentTimeMillis()
    private var totalEntries = 0L
    private var totalBytesWritten = 0L

    init {
        writeManifest()
        Log.i(TAG, "EmbeddingStore initialized: ${sessionDir.absolutePath}")
    }

    /**
     * EmbeddingSnapshot をバッファに追加。
     * flushIntervalMs 経過していたら自動的にディスクに書き出す。
     */
    @Synchronized
    fun append(snapshot: EmbeddingSnapshot) {
        buffer.add(snapshot)
        totalEntries++

        val now = System.currentTimeMillis()
        if (now - lastFlushTime >= flushIntervalMs) {
            flush()
        }
    }

    /**
     * バッファ内の全エントリをディスクに書き出す。
     */
    @Synchronized
    fun flush() {
        if (buffer.isEmpty()) return

        val chunkFile = File(sessionDir, "${CHUNK_PREFIX}${"%03d".format(chunkIndex)}.bin")
        try {
            BufferedOutputStream(FileOutputStream(chunkFile)).use { out ->
                // Chunk header: magic(4) + entryCount(4) + version(2)
                out.write(byteArrayOf('E'.code.toByte(), 'M'.code.toByte(), 'B'.code.toByte(), 'D'.code.toByte()))
                out.write(intToBytes(buffer.size))
                out.write(byteArrayOf(0, 1)) // version 0.1

                for (snapshot in buffer) {
                    val bytes = snapshot.toByteArray()
                    out.write(intToBytes(bytes.size)) // entry length prefix
                    out.write(bytes)
                }
            }

            val bytesWritten = chunkFile.length()
            totalBytesWritten += bytesWritten
            Log.i(TAG, "Chunk $chunkIndex flushed: ${buffer.size} entries, ${bytesWritten / 1024}KB " +
                "(total: ${totalEntries} entries, ${totalBytesWritten / 1024}KB)")

            chunkIndex++
            buffer.clear()
            lastFlushTime = System.currentTimeMillis()
            updateManifest()
        } catch (e: Exception) {
            Log.e(TAG, "Chunk flush failed: ${e.message}", e)
        }
    }

    /**
     * セッション終了時に呼ぶ。残りバッファをフラッシュしてマニフェストを更新。
     */
    @Synchronized
    fun finalize() {
        flush()
        updateManifest(finalized = true)
        Log.i(TAG, "EmbeddingStore finalized: $totalEntries entries, ${totalBytesWritten / 1024}KB total")
    }

    fun estimateMemoryBytes(): Long {
        // バッファ内の snapshot 数 × 概算サイズ (HabitatSignals + metadata ≒ 200 bytes in-memory)
        return buffer.size * 200L
    }

    fun getTotalEntries(): Long = totalEntries
    fun getTotalBytesWritten(): Long = totalBytesWritten

    private fun writeManifest() {
        val manifest = JSONObject().apply {
            put("session_id", sessionId)
            put("created_at", System.currentTimeMillis())
            put("version", "0.9.0")
            put("flush_interval_ms", flushIntervalMs)
        }
        File(sessionDir, MANIFEST_FILE).writeText(manifest.toString(2))
    }

    private fun updateManifest(finalized: Boolean = false) {
        try {
            val manifestFile = File(sessionDir, MANIFEST_FILE)
            val manifest = if (manifestFile.exists()) {
                JSONObject(manifestFile.readText())
            } else {
                JSONObject()
            }
            manifest.put("total_entries", totalEntries)
            manifest.put("total_bytes", totalBytesWritten)
            manifest.put("chunk_count", chunkIndex)
            manifest.put("updated_at", System.currentTimeMillis())
            if (finalized) manifest.put("finalized", true)
            manifestFile.writeText(manifest.toString(2))
        } catch (e: Exception) {
            Log.e(TAG, "Manifest update failed: ${e.message}")
        }
    }

    private fun intToBytes(value: Int): ByteArray {
        return byteArrayOf(
            (value and 0xFF).toByte(),
            ((value shr 8) and 0xFF).toByte(),
            ((value shr 16) and 0xFF).toByte(),
            ((value shr 24) and 0xFF).toByte(),
        )
    }

    /**
     * 古いセッションのembeddingデータを削除する。
     * @param keepDays この日数以内のセッションは保持
     */
    fun cleanOldSessions(keepDays: Int = 30) {
        val cutoff = System.currentTimeMillis() - keepDays * 86_400_000L
        val embeddingsDir = File(context.filesDir, EMBEDDINGS_DIR)
        if (!embeddingsDir.exists()) return

        embeddingsDir.listFiles()?.forEach { dir ->
            if (!dir.isDirectory) return@forEach
            val manifest = File(dir, MANIFEST_FILE)
            if (!manifest.exists()) return@forEach
            try {
                val json = JSONObject(manifest.readText())
                val createdAt = json.optLong("created_at", 0L)
                if (createdAt > 0 && createdAt < cutoff) {
                    dir.deleteRecursively()
                    Log.i(TAG, "Cleaned old session: ${dir.name}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to check session age: ${dir.name}")
            }
        }
    }
}
