package life.ikimon.pocket

import android.content.Context
import android.util.Log
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Perch v2 音声分類器（Google Bird Vocalization Classifier v4 / TFLite）
 *
 * BirdNET+ V3.0 と並列で動かすことで、デュアルエンジンコンセンサスを実現する。
 * 入力: 32kHz, 5秒 (160,000 samples)
 * 出力: logits [1, 10932] + embeddings [1, 1280]
 *
 * モデルファイルが存在しない場合は isReady() = false で graceful degradation。
 */
class PerchClassifier(private val context: Context) {

    companion object {
        private const val TAG = "PerchClassifier"
        private const val MODEL_FILE = "perch_v2.tflite"
        private const val LABELS_FILE = "perch_v2_labels.csv"
        private const val SAMPLE_RATE = 32000
        private const val WINDOW_SEC = 5
        private const val WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SEC   // 160,000
        private const val MIN_CONFIDENCE = 0.20f
        private const val MAX_RESULTS = 5
    }

    data class PerchResult(
        val scientificName: String,
        val commonName: String,
        val confidence: Float,
        val logit: Float,
    )

    private var interpreter: Interpreter? = null
    private var labels: List<LabelEntry> = emptyList()
    private var modelLoaded = false
    @Volatile private var isClosed = false

    private data class LabelEntry(
        val sciName: String,
        val comName: String,
    )

    init {
        try {
            val modelFile = File(context.cacheDir, MODEL_FILE)
            if (!modelFile.exists()) {
                // assets から取り出す（モデルが bundled されている場合）
                try {
                    context.assets.open(MODEL_FILE).use { input ->
                        modelFile.outputStream().use { output -> input.copyTo(output) }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Perch model not found in assets — running BirdNET-only mode")
                    throw e
                }
            }

            val opts = Interpreter.Options().apply {
                numThreads = 4
                try {
                    addDelegate(org.tensorflow.lite.nnapi.NnApiDelegate())
                } catch (e: Exception) {
                    Log.w(TAG, "NNAPI delegate not available: ${e.message}")
                }
            }
            interpreter = Interpreter(modelFile, opts)
            labels = loadLabels()
            modelLoaded = true
            Log.i(TAG, "Perch v2 loaded: ${labels.size} species, TFLite (NNAPI)")
        } catch (e: Exception) {
            Log.e(TAG, "Perch init failed: ${e.message}")
            modelLoaded = false
        }
    }

    fun isReady(): Boolean = modelLoaded && !isClosed

    /**
     * 音声データを受け取って分類結果を返す。
     * BirdNET と同じ 32kHz フォーマットを期待する。
     * 5秒窓に満たない場合はゼロパディング。
     */
    fun classify(audioData: FloatArray): List<PerchResult> {
        if (isClosed || !modelLoaded) return emptyList()
        val interp = interpreter ?: return emptyList()

        // 5秒窓に合わせてパディングまたはトリミング
        val input = FloatArray(WINDOW_SAMPLES).also { buf ->
            audioData.copyInto(buf, 0, 0, minOf(audioData.size, WINDOW_SAMPLES))
        }

        val inputBuf = ByteBuffer.allocateDirect(WINDOW_SAMPLES * 4).apply {
            order(ByteOrder.nativeOrder())
            for (f in input) putFloat(f)
            rewind()
        }

        // 出力テンソル: [1, num_classes]
        val numClasses = labels.size.takeIf { it > 0 } ?: 10932
        val outputBuf = Array(1) { FloatArray(numClasses) }

        return try {
            interp.run(inputBuf, outputBuf)
            val logits = outputBuf[0]

            // softmax
            val maxLogit = logits.max()
            val exps = logits.map { Math.exp((it - maxLogit).toDouble()).toFloat() }
            val sumExp = exps.sum()
            val probs = exps.map { it / sumExp }

            probs.indices
                .filter { probs[it] >= MIN_CONFIDENCE }
                .sortedByDescending { probs[it] }
                .take(MAX_RESULTS)
                .mapNotNull { i ->
                    val label = labels.getOrNull(i) ?: return@mapNotNull null
                    PerchResult(
                        scientificName = label.sciName,
                        commonName = label.comName,
                        confidence = probs[i],
                        logit = logits[i],
                    )
                }
        } catch (e: Exception) {
            Log.e(TAG, "Perch inference failed: ${e.message}")
            emptyList()
        }
    }

    private fun loadLabels(): List<LabelEntry> {
        return try {
            context.assets.open(LABELS_FILE).bufferedReader().readLines()
                .mapNotNull { line ->
                    val parts = line.split(",")
                    if (parts.size >= 2) LabelEntry(
                        sciName = parts[0].trim(),
                        comName = parts.getOrElse(1) { "" }.trim(),
                    ) else null
                }
        } catch (e: Exception) {
            Log.w(TAG, "Perch labels not found: ${e.message}")
            emptyList()
        }
    }

    fun close() {
        isClosed = true
        interpreter?.close()
    }
}
