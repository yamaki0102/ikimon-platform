package life.ikimon.pocket

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * 音声スニペット管理。
 *
 * フィールドスキャン中に録音した生PCM音声をWAVとして端末に保存する。
 * AI推論は保存後に行うため、音声に詳しいユーザーが後から確認して同定できる。
 *
 * ライフサイクル:
 *   1. セッション中: saveSnippet() で WAV 保存 → snippet_id を返す
 *   2. セッション終了後: listPending() で未確認一覧を取得
 *   3. ユーザー確認後: confirm() / skip() で処理
 *   4. 確認済み: WAV ファイルを削除 (プライバシー)
 */
object AudioSnippetStore {

    private const val TAG = "AudioSnippetStore"
    private const val SAMPLE_RATE = 32000
    private const val INDEX_FILE = "audio_snippets_index.json"

    data class Snippet(
        val id: String,
        val sessionId: String,
        val wavPath: String,
        val timestamp: Long,
        val durationSec: Float,
        val birdnetCandidates: List<Candidate>,
        val perchCandidates: List<Candidate>,
        val status: Status,
        val lat: Double?,
        val lng: Double?,
    )

    data class Candidate(
        val scientificName: String,
        val commonName: String,
        val confidence: Float,
        val engine: String,       // "birdnet" | "perch"
        val consensusLevel: String,
    )

    enum class Status { PENDING, CONFIRMED, SKIPPED }

    /**
     * FloatArray (32kHz PCM) を WAV ファイルとして保存し、Snippet を返す。
     */
    fun saveSnippet(
        context: Context,
        sessionId: String,
        audioData: FloatArray,
        dualResults: List<DualAudioClassifier.DualResult>,
        lat: Double?,
        lng: Double?,
    ): Snippet? {
        return try {
            val dir = snippetDir(context)
            dir.mkdirs()

            val id = "snp_${System.currentTimeMillis()}"
            val wavFile = File(dir, "$id.wav")

            writeWav(wavFile, audioData)

            val candidates = dualResults.flatMap { r ->
                listOfNotNull(
                    r.birdnetConfidence?.let {
                        Candidate(r.scientificName, r.taxonName, it, "birdnet", r.consensusLevel.name)
                    },
                    r.perchConfidence?.let {
                        Candidate(r.scientificName, r.taxonName, it, "perch", r.consensusLevel.name)
                    },
                )
            }

            val snippet = Snippet(
                id = id,
                sessionId = sessionId,
                wavPath = wavFile.absolutePath,
                timestamp = System.currentTimeMillis(),
                durationSec = audioData.size.toFloat() / SAMPLE_RATE,
                birdnetCandidates = candidates.filter { it.engine == "birdnet" },
                perchCandidates = candidates.filter { it.engine == "perch" },
                status = Status.PENDING,
                lat = lat,
                lng = lng,
            )

            appendIndex(context, snippet)
            Log.i(TAG, "Saved snippet: $id (${snippet.durationSec}s, ${dualResults.size} candidates)")
            snippet
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save snippet: ${e.message}")
            null
        }
    }

    fun listPending(context: Context): List<Snippet> =
        loadIndex(context).filter { it.status == Status.PENDING }

    fun confirm(context: Context, snippetId: String) =
        updateStatus(context, snippetId, Status.CONFIRMED, deleteWav = false)

    fun skip(context: Context, snippetId: String) =
        updateStatus(context, snippetId, Status.SKIPPED, deleteWav = true)

    fun deleteWav(context: Context, snippetId: String) {
        val snippets = loadIndex(context)
        snippets.find { it.id == snippetId }?.let { File(it.wavPath).delete() }
    }

    fun pendingCount(context: Context): Int = listPending(context).size

    // ─── WAV 書き込み ───────────────────────────────────────────
    private fun writeWav(file: File, audioData: FloatArray) {
        // Float → 16bit PCM
        val pcm16 = ShortArray(audioData.size) { i ->
            (audioData[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
        }
        val dataSize = pcm16.size * 2
        val totalSize = 44 + dataSize

        RandomAccessFile(file, "rw").use { raf ->
            val buf = ByteBuffer.allocate(totalSize).order(ByteOrder.LITTLE_ENDIAN)
            // RIFF header
            buf.put("RIFF".toByteArray())
            buf.putInt(36 + dataSize)
            buf.put("WAVE".toByteArray())
            // fmt chunk
            buf.put("fmt ".toByteArray())
            buf.putInt(16)
            buf.putShort(1)          // PCM
            buf.putShort(1)          // mono
            buf.putInt(SAMPLE_RATE)
            buf.putInt(SAMPLE_RATE * 2)
            buf.putShort(2)
            buf.putShort(16)
            // data chunk
            buf.put("data".toByteArray())
            buf.putInt(dataSize)
            for (s in pcm16) buf.putShort(s)
            raf.write(buf.array())
        }
    }

    // ─── インデックス管理 ────────────────────────────────────────
    private fun snippetDir(context: Context) =
        File(context.filesDir, "audio_snippets")

    private fun indexFile(context: Context) =
        File(context.filesDir, INDEX_FILE)

    private fun loadIndex(context: Context): MutableList<Snippet> {
        val file = indexFile(context)
        if (!file.exists()) return mutableListOf()
        return try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).map { parseSnippet(arr.getJSONObject(it)) }.toMutableList()
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    private fun appendIndex(context: Context, snippet: Snippet) {
        val list = loadIndex(context)
        list.add(snippet)
        saveIndex(context, list)
    }

    private fun updateStatus(context: Context, id: String, status: Status, deleteWav: Boolean) {
        val list = loadIndex(context)
        val idx = list.indexOfFirst { it.id == id }
        if (idx < 0) return
        val updated = list[idx].copy(status = status)
        if (deleteWav) File(updated.wavPath).delete()
        list[idx] = updated
        saveIndex(context, list)
    }

    private fun saveIndex(context: Context, list: List<Snippet>) {
        val arr = JSONArray()
        list.forEach { arr.put(toJson(it)) }
        indexFile(context).writeText(arr.toString())
    }

    private fun toJson(s: Snippet): JSONObject = JSONObject().apply {
        put("id", s.id)
        put("session_id", s.sessionId)
        put("wav_path", s.wavPath)
        put("timestamp", s.timestamp)
        put("duration_sec", s.durationSec)
        put("status", s.status.name)
        s.lat?.let { put("lat", it) }
        s.lng?.let { put("lng", it) }
        put("birdnet", candidatesToJson(s.birdnetCandidates))
        put("perch", candidatesToJson(s.perchCandidates))
    }

    private fun candidatesToJson(list: List<Candidate>): JSONArray {
        val arr = JSONArray()
        list.forEach { c ->
            arr.put(JSONObject().apply {
                put("scientific_name", c.scientificName)
                put("common_name", c.commonName)
                put("confidence", c.confidence)
                put("engine", c.engine)
                put("consensus_level", c.consensusLevel)
            })
        }
        return arr
    }

    private fun parseSnippet(j: JSONObject): Snippet {
        fun parseCandidates(arr: JSONArray) = (0 until arr.length()).map {
            val c = arr.getJSONObject(it)
            Candidate(
                scientificName = c.optString("scientific_name"),
                commonName = c.optString("common_name"),
                confidence = c.optDouble("confidence").toFloat(),
                engine = c.optString("engine"),
                consensusLevel = c.optString("consensus_level"),
            )
        }
        return Snippet(
            id = j.getString("id"),
            sessionId = j.getString("session_id"),
            wavPath = j.getString("wav_path"),
            timestamp = j.getLong("timestamp"),
            durationSec = j.optDouble("duration_sec").toFloat(),
            birdnetCandidates = parseCandidates(j.optJSONArray("birdnet") ?: JSONArray()),
            perchCandidates = parseCandidates(j.optJSONArray("perch") ?: JSONArray()),
            status = Status.valueOf(j.optString("status", "PENDING")),
            lat = if (j.has("lat")) j.getDouble("lat") else null,
            lng = if (j.has("lng")) j.getDouble("lng") else null,
        )
    }
}
