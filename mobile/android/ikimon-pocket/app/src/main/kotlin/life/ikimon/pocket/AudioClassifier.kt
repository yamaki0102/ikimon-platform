package life.ikimon.pocket

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

class AudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "AudioClassifier"
        const val SAMPLE_RATE = 48000
        private const val MODEL_FILE = "birdnet_lite.tflite"
        private const val LABELS_FILE = "birdnet_labels.txt"
        private const val MIN_CONFIDENCE = 0.3f
    }

    data class ClassificationResult(
        val name: String,
        val scientificName: String,
        val confidence: Float,
    )

    private var interpreter: Interpreter? = null
    private var labels: List<String> = emptyList()

    init {
        try {
            val model = loadModelFile(MODEL_FILE)
            interpreter = Interpreter(model)
            labels = loadLabels(LABELS_FILE)
            Log.i(TAG, "Model loaded: ${labels.size} species")
        } catch (e: Exception) {
            Log.w(TAG, "Model not loaded (expected in dev): ${e.message}")
        }
    }

    /**
     * 録音 → 分類 + 生の音声データも返す（サウンドスケープ分析用）
     */
    fun classifyAmbientAudioWithRaw(
        durationMs: Long,
        callback: (List<ClassificationResult>, FloatArray?) -> Unit
    ) {
        Thread {
            try {
                val audioData = recordAudio(durationMs)
                if (audioData == null) {
                    callback(emptyList(), null)
                    return@Thread
                }

                val results = classify(audioData)
                callback(results, audioData)
            } catch (e: Exception) {
                Log.e(TAG, "Classification failed", e)
                callback(emptyList(), null)
            }
        }.start()
    }

    fun classifyAmbientAudio(durationMs: Long, callback: (List<ClassificationResult>) -> Unit) {
        classifyAmbientAudioWithRaw(durationMs) { results, _ -> callback(results) }
    }

    private fun recordAudio(durationMs: Long): FloatArray? {
        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_FLOAT,
        )

        if (bufferSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "Invalid buffer size")
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

    private fun classify(audioData: FloatArray): List<ClassificationResult> {
        val interp = interpreter ?: return dummyClassify()

        val inputShape = interp.getInputTensor(0).shape()
        val expectedLength = inputShape.last()
        val input = if (audioData.size >= expectedLength) {
            audioData.copyOf(expectedLength)
        } else {
            FloatArray(expectedLength).also { audioData.copyInto(it) }
        }

        val inputBuffer = ByteBuffer.allocateDirect(expectedLength * 4).apply {
            order(ByteOrder.nativeOrder())
            for (sample in input) putFloat(sample)
            rewind()
        }

        val outputShape = interp.getOutputTensor(0).shape()
        val outputSize = outputShape.last()
        val output = Array(1) { FloatArray(outputSize) }

        interp.run(inputBuffer, output)

        return output[0].mapIndexed { index, confidence ->
            if (confidence >= MIN_CONFIDENCE && index < labels.size) {
                val parts = labels[index].split("_", limit = 2)
                ClassificationResult(
                    name = parts.getOrElse(1) { labels[index] },
                    scientificName = parts.getOrElse(0) { "" },
                    confidence = confidence,
                )
            } else null
        }
        .filterNotNull()
        .sortedByDescending { it.confidence }
        .take(5)
    }

    private fun dummyClassify(): List<ClassificationResult> {
        val dummySpecies = listOf(
            ClassificationResult("シジュウカラ", "Parus minor", 0.85f),
            ClassificationResult("ヒヨドリ", "Hypsipetes amaurotis", 0.72f),
            ClassificationResult("メジロ", "Zosterops japonicus", 0.65f),
            ClassificationResult("ウグイス", "Horornis diphone", 0.78f),
            ClassificationResult("スズメ", "Passer montanus", 0.60f),
            ClassificationResult("ハシブトガラス", "Corvus macrorhynchos", 0.55f),
        )
        return dummySpecies.shuffled().take((0..3).random())
    }

    private fun loadModelFile(filename: String): MappedByteBuffer {
        val fd = context.assets.openFd(filename)
        val input = FileInputStream(fd.fileDescriptor)
        val channel = input.channel
        return channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
    }

    private fun loadLabels(filename: String): List<String> {
        return try {
            context.assets.open(filename).bufferedReader().readLines()
        } catch (e: Exception) {
            Log.w(TAG, "Labels file not found: $filename")
            emptyList()
        }
    }
}
