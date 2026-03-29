package life.ikimon.pocket

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer

/**
 * 音声分類器（BirdNET+ V3.0 ONNX ベース）
 *
 * 環境音を録音し、ONNX Runtime で鳥声・虫声・カエル声を分類する。
 * BirdNET+ V3.0 DP3: 11,560種、32kHz入力、可変長対応。
 *
 * Pixel 10 Pro (Tensor G5) のNNAPI/GPU delegate でハードウェア加速。
 */
class AudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "AudioClassifier"
        private const val SAMPLE_RATE = 32000  // V3.0: 32kHz（V2.4は48kHz）
        private const val MODEL_FILE = "birdnet_v3.onnx"
        private const val LABELS_FILE = "birdnet_v3_labels.csv"
        private const val MIN_CONFIDENCE = 0.15f  // V3.0推奨閾値
        private const val MAX_RESULTS = 10
    }

    data class ClassificationResult(
        val name: String,
        val scientificName: String,
        val confidence: Float,
        val taxonomicClass: String = "",
        val order: String = "",
    )

    private var ortEnv: OrtEnvironment? = null
    private var session: OrtSession? = null
    private var labels: List<LabelEntry> = emptyList()
    private var modelLoaded = false

    private data class LabelEntry(
        val idx: Int,
        val sciName: String,
        val comName: String,
        val taxClass: String,
        val order: String,
    )

    init {
        try {
            ortEnv = OrtEnvironment.getEnvironment()

            // 541MBモデルをヒープに載せずファイルパスで直接読み込む
            val modelFile = java.io.File(context.cacheDir, MODEL_FILE)
            if (!modelFile.exists()) {
                Log.i(TAG, "Extracting ONNX model to cache (first launch)...")
                context.assets.open(MODEL_FILE).use { input ->
                    modelFile.outputStream().use { output -> input.copyTo(output) }
                }
            }

            val opts = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(4)  // Tensor G5マルチコア活用
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT)
            }
            // NNAPIは541MBモデルで不安定なためCPU推論を使用
            session = ortEnv?.createSession(modelFile.absolutePath, opts)
            labels = loadLabels(LABELS_FILE)
            modelLoaded = true
            Log.i(TAG, "BirdNET+ V3.0 loaded: ${labels.size} species, ONNX Runtime (file-backed)")
        } catch (e: Exception) {
            Log.e(TAG, "Model load failed: ${e.message}", e)
            modelLoaded = false
        }
    }

    fun isReady(): Boolean = modelLoaded

    /**
     * 指定時間（ms）だけ環境音を録音し、分類する。
     */
    fun classifyAmbientAudio(durationMs: Long, callback: (List<ClassificationResult>) -> Unit) {
        if (!modelLoaded) {
            Log.w(TAG, "Model not loaded — skipping classification")
            callback(emptyList())
            return
        }

        Thread {
            try {
                val audioData = recordAudio(durationMs)
                if (audioData == null) {
                    callback(emptyList())
                    return@Thread
                }

                val results = classify(audioData)
                callback(results)
            } catch (e: Exception) {
                Log.e(TAG, "Classification failed", e)
                callback(emptyList())
            }
        }.start()
    }

    /**
     * 32kHz モノラルで録音。プライバシー: 推論後に破棄。
     */
    private fun recordAudio(durationMs: Long): FloatArray? {
        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_FLOAT,
        )

        if (bufferSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "Invalid buffer size for ${SAMPLE_RATE}Hz")
            return null
        }

        val recorder = try {
            AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_FLOAT,
                bufferSize,
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Microphone permission denied")
            return null
        }

        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialize")
            return null
        }

        val totalSamples = (SAMPLE_RATE * durationMs / 1000).toInt()
        val audioData = FloatArray(totalSamples)
        var readTotal = 0

        recorder.startRecording()
        while (readTotal < totalSamples) {
            val remaining = totalSamples - readTotal
            val toRead = minOf(remaining, bufferSize / 4)
            val read = recorder.read(audioData, readTotal, toRead, AudioRecord.READ_BLOCKING)
            if (read > 0) readTotal += read
            else break
        }
        recorder.stop()
        recorder.release()

        return if (readTotal > SAMPLE_RATE) audioData.copyOf(readTotal) else null
    }

    /**
     * ONNX Runtime で分類実行。V3.0は可変長入力対応。
     */
    private fun classify(audioData: FloatArray): List<ClassificationResult> {
        val env = ortEnv ?: return emptyList()
        val sess = session ?: return emptyList()

        // V3.0: 入力テンソル shape [1, samples] — 可変長
        val inputShape = longArrayOf(1, audioData.size.toLong())
        val inputBuffer = FloatBuffer.wrap(audioData)
        val inputTensor = OnnxTensor.createTensor(env, inputBuffer, inputShape)

        val output = sess.run(mapOf("input" to inputTensor))
        inputTensor.close()

        // 出力テンソルから確率を取得
        val outputTensor = output[0].value
        val probabilities = when (outputTensor) {
            is Array<*> -> {
                @Suppress("UNCHECKED_CAST")
                (outputTensor as Array<FloatArray>)[0]
            }
            is FloatArray -> outputTensor
            else -> {
                Log.e(TAG, "Unexpected output type: ${outputTensor?.javaClass}")
                output.close()
                return emptyList()
            }
        }

        // 上位N件を抽出（MIN_CONFIDENCE以上）
        val results = probabilities
            .mapIndexed { index, confidence ->
                if (confidence >= MIN_CONFIDENCE && index < labels.size) {
                    val label = labels[index]
                    ClassificationResult(
                        name = label.comName,
                        scientificName = label.sciName,
                        confidence = confidence,
                        taxonomicClass = label.taxClass,
                        order = label.order,
                    )
                } else null
            }
            .filterNotNull()
            .sortedByDescending { it.confidence }
            .take(MAX_RESULTS)

        output.close()

        if (results.isNotEmpty()) {
            Log.i(TAG, "Top detection: ${results[0].name} (${results[0].scientificName}) " +
                "${(results[0].confidence * 100).toInt()}%")
        }

        return results
    }

    /**
     * CSVラベル読み込み。形式: idx;id;sci_name;com_name;class;order
     */
    private fun loadLabels(filename: String): List<LabelEntry> {
        return try {
            context.assets.open(filename).bufferedReader().useLines { lines ->
                lines.drop(1)  // ヘッダースキップ
                    .mapNotNull { line ->
                        val parts = line.split(";")
                        if (parts.size >= 6) {
                            LabelEntry(
                                idx = parts[0].toIntOrNull() ?: 0,
                                sciName = parts[2],
                                comName = parts[3],
                                taxClass = parts[4],
                                order = parts[5],
                            )
                        } else null
                    }
                    .toList()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Labels file not found: $filename")
            emptyList()
        }
    }

    fun close() {
        session?.close()
        ortEnv?.close()
    }
}
