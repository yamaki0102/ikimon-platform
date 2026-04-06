package life.ikimon.pocket

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlin.math.*

/**
 * Gemma 4 E4B 音声分類器 — スペクトログラム視覚化 + Gemini Nano on-device
 *
 * AudioPart APIが未公開のため、音声 → スペクトログラム画像変換を介して
 * ML Kit Prompt API (ImagePart) 経由でオンデバイス種同定を行う。
 *
 * パイプライン:
 *   FloatArray (32kHz PCM)
 *     → STFT → メル周波数スペクトログラム Bitmap
 *       → ImagePart + Gemini Nano on-device
 *         → 種名 JSON
 *
 * BirdNET/Perch と同一の ClassificationResult を返すため、DualAudioClassifier に
 * そのまま組み込める。
 */
class GemmaAudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "GemmaAudioClassifier"
        private const val FEATURE_AVAILABLE = 1
        private const val FEATURE_DOWNLOADABLE = 3
        private const val MIN_CONFIDENCE = 0.25f
        private const val MAX_RESULTS = 5
        private const val TIMEOUT_COLD_MS = 20_000L  // 初回ウォームアップ込み
        private const val TIMEOUT_WARM_MS = 10_000L  // 2回目以降

        // STFT パラメータ（32kHz 入力）
        private const val FFT_SIZE = 256          // 8ms 窓
        private const val HOP_SIZE = 128          // 4ms ホップ
        private const val FREQ_BINS = FFT_SIZE / 2 // 128 周波数ビン
        private const val SPEC_WIDTH = 256        // 出力画像の幅（時間軸）
        private const val SPEC_HEIGHT = FREQ_BINS  // 出力画像の高さ（周波数軸）

        private const val SPECTROGRAM_PROMPT = """This image is an audio spectrogram (x=time, y=frequency low→high, color=intensity).
Identify bird or wildlife vocalizations. Birds appear as harmonic stacks, frequency sweeps, or repeated motifs.
Return ONLY valid JSON array:
[{"scientific_name":"Parus minor","japanese_name":"シジュウカラ","confidence":0.85,"class":"Aves","order":"Passeriformes"}]
Multiple species: list all. No vocalization detected: []
ONLY JSON, no explanation."""
    }

    private var generativeModel: GenerativeModel? = null
    private var isAvailable = false
    @Volatile private var isClosed = false
    @Volatile private var isWarmedUp = false

    // Hann 窓関数（初期化時に一度だけ計算）
    private val hannWindow = FloatArray(FFT_SIZE) { i ->
        (0.5 * (1.0 - cos(2.0 * PI * i / (FFT_SIZE - 1)))).toFloat()
    }

    init {
        initModel()
    }

    private fun initModel() {
        try {
            val model = Generation.getClient()
            generativeModel = model
            CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
                try {
                    val status = model.checkStatus()
                    when (status) {
                        FEATURE_AVAILABLE -> {
                            isAvailable = true
                            Log.i(TAG, "GemmaAudioClassifier ready: status=AVAILABLE")
                            warmUp(model)
                        }
                        FEATURE_DOWNLOADABLE -> {
                            Log.i(TAG, "GemmaAudioClassifier: status=DOWNLOADABLE — starting download")
                            model.download().collect { ds ->
                                Log.d(TAG, "Gemma download: $ds")
                            }
                            isAvailable = true
                            Log.i(TAG, "GemmaAudioClassifier: download complete — available=true")
                            warmUp(model)
                        }
                        else -> {
                            Log.w(TAG, "GemmaAudioClassifier: status=UNKNOWN($status) — unavailable")
                            isAvailable = false
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "GemmaAudioClassifier checkStatus failed: ${e.message}")
                    isAvailable = false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "GemmaAudioClassifier init failed: ${e.message}")
            isAvailable = false
        }
    }

    fun isReady(): Boolean = isAvailable && !isClosed

    /** モデルを空プロンプトで叩いてNPUをウォームアップ */
    private suspend fun warmUp(model: GenerativeModel) {
        try {
            model.generateContent(".")
            isWarmedUp = true
            Log.i(TAG, "GemmaAudioClassifier: warmup complete")
        } catch (e: Exception) {
            Log.w(TAG, "GemmaAudioClassifier: warmup failed (non-fatal): ${e.message}")
        }
    }

    /**
     * BirdNET/Perch と同一インターフェース。
     * PCM → スペクトログラム → Gemini Nano → ClassificationResult
     */
    suspend fun classify(audioData: FloatArray): List<AudioClassifier.ClassificationResult> {
        if (isClosed || !isAvailable) return emptyList()
        val model = generativeModel ?: return emptyList()

        val timeoutMs = if (isWarmedUp) TIMEOUT_WARM_MS else TIMEOUT_COLD_MS
        return try {
            withTimeout(timeoutMs) {
                val t0 = System.currentTimeMillis()
                val bitmap = pcmToSpectrogramBitmap(audioData)
                val tSpec = System.currentTimeMillis()
                Log.d(TAG, "spectrogram generated: ${tSpec - t0}ms size=${bitmap.width}x${bitmap.height}")

                val request = generateContentRequest(ImagePart(bitmap), TextPart(SPECTROGRAM_PROMPT)) {
                    temperature = 0.1f
                    topK = 5
                }
                val response = model.generateContent(request)
                val tInfer = System.currentTimeMillis()
                val rawText = response.candidates.firstOrNull()?.text?.trim() ?: ""
                Log.d(TAG, "inference done: ${tInfer - tSpec}ms raw=\"$rawText\"")

                if (rawText.isEmpty()) return@withTimeout emptyList()
                val results = parseResponse(rawText)
                Log.i(TAG, "gemma results: ${results.size} species — " +
                    results.joinToString { "${it.name}(${(it.confidence*100).toInt()}%)" })
                results
            }
        } catch (e: Exception) {
            Log.e(TAG, "classify failed: ${e.javaClass.simpleName} ${e.message}")
            emptyList()
        }
    }

    /**
     * PCM FloatArray → カラースペクトログラム Bitmap
     *
     * FFT_SIZE=256 の Hann 窓 STFT を計算し、
     * 対数スケール強度を blue→green→yellow の疑似カラーで描画する。
     * 鳥の鳴き声固有のパターン（倍音列・周波数スイープ）を視覚化。
     */
    private fun pcmToSpectrogramBitmap(pcm: FloatArray): Bitmap {
        val numFrames = maxOf(1, (pcm.size - FFT_SIZE) / HOP_SIZE + 1)
        val step = maxOf(1, numFrames / SPEC_WIDTH)

        val magnitudes = Array(SPEC_WIDTH) { frame ->
            val srcFrame = frame * step
            val offset = srcFrame * HOP_SIZE
            val real = FloatArray(FFT_SIZE) { i ->
                if (offset + i < pcm.size) pcm[offset + i] * hannWindow[i] else 0f
            }
            val imag = FloatArray(FFT_SIZE)
            fft(real, imag)
            FloatArray(FREQ_BINS) { f ->
                sqrt(real[f] * real[f] + imag[f] * imag[f])
            }
        }

        // 全フレームの最大値を求めて正規化
        val maxMag = magnitudes.maxOf { it.max() }.takeIf { it > 1e-10f } ?: 1e-10f

        val pixels = IntArray(SPEC_WIDTH * SPEC_HEIGHT) { idx ->
            val frame = idx % SPEC_WIDTH
            val freqIdx = FREQ_BINS - 1 - (idx / SPEC_WIDTH)  // 低周波数を下に
            val logMag = log10((magnitudes[frame][freqIdx] / maxMag * 99f + 1f).toDouble()).toFloat()
            val norm = (logMag / log10(100.0).toFloat()).coerceIn(0f, 1f)
            val v = (norm * 255).toInt()
            // blue(低) → cyan → green → yellow(高) カラーマップ
            val r = if (v > 128) ((v - 128) * 2).coerceIn(0, 255) else 0
            val g = when {
                v < 64  -> 0
                v < 192 -> ((v - 64) * 2).coerceIn(0, 255)
                else    -> 255
            }
            val b = when {
                v < 128 -> 255
                v < 192 -> (255 - (v - 128) * 4).coerceIn(0, 255)
                else    -> 0
            }
            (0xFF shl 24) or (r shl 16) or (g shl 8) or b
        }

        return Bitmap.createBitmap(pixels, SPEC_WIDTH, SPEC_HEIGHT, Bitmap.Config.ARGB_8888)
    }

    /**
     * Cooley-Tukey 基数-2 FFT（インプレース、FFT_SIZE は 2 の冪を前提）
     */
    private fun fft(real: FloatArray, imag: FloatArray) {
        val n = real.size

        // ビット逆順置換
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }
            j = j xor bit
            if (i < j) {
                var t = real[i]; real[i] = real[j]; real[j] = t
                t = imag[i]; imag[i] = imag[j]; imag[j] = t
            }
        }

        // バタフライ演算
        var len = 2
        while (len <= n) {
            val ang = (-2.0 * PI / len)
            val wRe = cos(ang).toFloat()
            val wIm = sin(ang).toFloat()
            var i = 0
            while (i < n) {
                var curRe = 1f; var curIm = 0f
                for (jj in 0 until len / 2) {
                    val uRe = real[i + jj];         val uIm = imag[i + jj]
                    val vRe = real[i + jj + len/2] * curRe - imag[i + jj + len/2] * curIm
                    val vIm = real[i + jj + len/2] * curIm + imag[i + jj + len/2] * curRe
                    real[i + jj]         = uRe + vRe;  imag[i + jj]         = uIm + vIm
                    real[i + jj + len/2] = uRe - vRe;  imag[i + jj + len/2] = uIm - vIm
                    val nr = curRe * wRe - curIm * wIm
                    curIm = curRe * wIm + curIm * wRe
                    curRe = nr
                }
                i += len
            }
            len = len shl 1
        }
    }

    /**
     * Gemini Nano のテキスト出力を ClassificationResult リストに変換する。
     */
    private fun parseResponse(raw: String): List<AudioClassifier.ClassificationResult> {
        val json = extractJsonArray(raw)
        if (json.isBlank() || json == "[]") return emptyList()

        return try {
            val array = org.json.JSONArray(json)
            (0 until array.length()).mapNotNull { i ->
                val obj = array.getJSONObject(i)
                val confidence = obj.optDouble("confidence", 0.0).toFloat()
                if (confidence < MIN_CONFIDENCE) return@mapNotNull null
                val sciName = obj.optString("scientific_name", "")
                if (sciName.isBlank()) return@mapNotNull null

                AudioClassifier.ClassificationResult(
                    name = obj.optString("japanese_name", sciName),
                    scientificName = sciName,
                    confidence = confidence,
                    taxonomicClass = obj.optString("class", ""),
                    order = obj.optString("order", ""),
                )
            }
                .sortedByDescending { it.confidence }
                .take(MAX_RESULTS)
        } catch (e: Exception) {
            Log.w(TAG, "parseResponse failed: ${e.message} raw=$raw")
            emptyList()
        }
    }

    private fun extractJsonArray(raw: String): String {
        val codeBlock = Regex("```(?:json)?\\s*([\\s\\S]*?)```").find(raw)
        if (codeBlock != null) return codeBlock.groupValues[1].trim()
        val start = raw.indexOf('[')
        val end = raw.lastIndexOf(']')
        return if (start != -1 && end > start) raw.substring(start, end + 1).trim() else "[]"
    }

    fun close() {
        isClosed = true
        generativeModel?.close()
    }
}
