package life.ikimon.pocket

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.flex.FlexDelegate
import java.io.File
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Perch v1 音声分類器（Google Bird Vocalization Classifier / TFLite + Flex Delegate）
 *
 * BirdNET+ V3.0 と並列で動かすことで、デュアルエンジンコンセンサスを実現する。
 * 入力: 32kHz, 5秒 (160,000 samples)
 * 出力: logits [1, 10932]
 *
 * モデルファイルが存在しない場合は初回起動時に自動ダウンロード。
 * ダウンロード完了まで isReady() = false で graceful degradation。
 */
class PerchClassifier(private val context: Context) {

    companion object {
        private const val TAG = "PerchClassifier"
        private const val MODEL_FILE = "perch_v1.tflite"
        private const val LABELS_FILE = "perch_v1_labels.csv"
        private const val MODEL_URL = "https://ikimon.life/static/models/perch_v1.tflite"
        private const val LABELS_URL = "https://ikimon.life/static/models/perch_v1_labels.csv"
        private const val SAMPLE_RATE = 32000
        private const val WINDOW_SEC = 5
        private const val WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SEC   // 160,000
        private const val MIN_CONFIDENCE = 0.20f
        private const val MAX_RESULTS = 5
        private const val SPECIES_OUTPUT_INDEX = 5
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
        val modelFile = File(context.cacheDir, MODEL_FILE)
        val modelComplete = modelFile.exists() && modelFile.length() > 20_000_000L  // 24MB expected
        if (modelComplete) {
            loadModel(modelFile)
        } else {
            if (modelFile.exists()) {
                Log.w(TAG, "Perch model incomplete (${modelFile.length()} bytes) — re-downloading")
                modelFile.delete()
            } else {
                Log.i(TAG, "Perch model not found — downloading from server")
            }
            CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
                if (downloadModel(modelFile)) loadModel(modelFile)
            }
        }
    }

    private fun downloadModel(modelFile: File): Boolean {
        return try {
            Log.i(TAG, "Downloading Perch model (~25MB)...")
            URL(MODEL_URL).openStream().use { input ->
                modelFile.outputStream().use { output -> input.copyTo(output) }
            }
            val labelsFile = File(context.cacheDir, LABELS_FILE)
            URL(LABELS_URL).openStream().use { input ->
                labelsFile.outputStream().use { output -> input.copyTo(output) }
            }
            Log.i(TAG, "Perch model downloaded: ${modelFile.length() / 1024 / 1024}MB")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Perch download failed: ${e.message}")
            modelFile.delete()
            false
        }
    }

    private fun loadModel(modelFile: File) {
        try {
            val flexDelegate = FlexDelegate()
            val opts = Interpreter.Options().apply {
                numThreads = 4
                addDelegate(flexDelegate)
            }
            interpreter = Interpreter(modelFile, opts)
            validateSpeciesOutput(interpreter!!)
            labels = loadLabels()
            modelLoaded = true
            Log.i(TAG, "Perch v1 loaded: ${labels.size} species, TFLite + Flex")
        } catch (e: Throwable) {
            Log.e(TAG, "Perch loadModel failed: ${e::class.simpleName}: ${e.message}")
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

        return try {
            val outputTensor = interp.getOutputTensor(SPECIES_OUTPUT_INDEX)
            val outputShape = outputTensor.shape()

            val logits = when (outputShape.size) {
                2 -> {
                    val outputBuf = Array(outputShape[0]) { FloatArray(outputShape[1]) }
                    val outputs = hashMapOf<Int, Any>(SPECIES_OUTPUT_INDEX to outputBuf)
                    interp.runForMultipleInputsOutputs(arrayOf(inputBuf), outputs)
                    outputBuf[0]
                }
                3 -> {
                    val outputBuf = Array(outputShape[0]) { Array(outputShape[1]) { FloatArray(outputShape[2]) } }
                    val outputs = hashMapOf<Int, Any>(SPECIES_OUTPUT_INDEX to outputBuf)
                    interp.runForMultipleInputsOutputs(arrayOf(inputBuf), outputs)
                    val flattened = outputBuf[0].flatMap { it.asList() }.toFloatArray()
                    flattened
                }
                else -> {
                    Log.e(TAG, "Unsupported Perch output shape: ${outputShape.contentToString()}")
                    return emptyList()
                }
            }

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

    private fun validateSpeciesOutput(interpreter: Interpreter) {
        try {
            val tensor = interpreter.getOutputTensor(SPECIES_OUTPUT_INDEX)
            val shape = tensor.shape()
            if (shape.size != 2 || shape.getOrNull(1) != 10932) {
                Log.w(TAG, "Unexpected Perch species output: index=$SPECIES_OUTPUT_INDEX name=${tensor.name()} shape=${shape.contentToString()}")
            }
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to validate Perch output tensor: ${e::class.simpleName}: ${e.message}")
        }
    }

    private fun loadLabels(): List<LabelEntry> {
        // cacheDir 優先、なければ assets fallback
        val cacheFile = File(context.cacheDir, LABELS_FILE)
        val lines = if (cacheFile.exists()) {
            cacheFile.readLines()
        } else {
            try { context.assets.open(LABELS_FILE).bufferedReader().readLines() }
            catch (e: Exception) { emptyList() }
        }
        return lines.drop(1)  // ヘッダー行 (ebird2021) をスキップ
            .mapNotNull { line ->
                val code = line.trim()
                if (code.isNotBlank()) LabelEntry(sciName = code, comName = code) else null
            }
            .also { Log.d(TAG, "Perch labels loaded: ${it.size}") }
    }

    fun close() {
        isClosed = true
        interpreter?.close()
    }
}
