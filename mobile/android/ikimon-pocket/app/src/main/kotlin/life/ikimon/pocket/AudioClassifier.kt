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

/**
 * 音声分類器（BirdNET Lite ベース）
 *
 * 環境音の短い断片（5秒）を録音し、
 * TFLite モデルで鳥声・虫声を分類する。
 *
 * 初期バージョン: BirdNET Lite (TFLite)
 * 将来: Gemini Nano on-device audio
 */
class AudioClassifier(private val context: Context) {

    companion object {
        private const val TAG = "AudioClassifier"
        private const val SAMPLE_RATE = 48000
        private const val MODEL_FILE = "birdnet_lite.tflite"
        private const val LABELS_FILE = "birdnet_labels.txt"
        private const val MIN_CONFIDENCE = 0.25f  // より多くの候補を取る（サーバー側で再フィルタ）
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
            // モデルがない場合はダミーモードで動作
        }
    }

    /**
     * 指定時間（ms）だけ環境音を録音し、分類する。
     * コールバックで結果を返す。
     */
    fun classifyAmbientAudio(durationMs: Long, callback: (List<ClassificationResult>) -> Unit) {
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
     * 短時間の音声を録音する。
     * プライバシー: 録音データは推論後に破棄（保存しない）。
     */
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

    /**
     * TFLite モデルで分類を実行する。
     */
    private fun classify(audioData: FloatArray): List<ClassificationResult> {
        val interp = interpreter ?: return dummyClassify()

        // BirdNET expects 48kHz mono, 3 seconds chunks
        // Pad or trim to expected input size
        val inputShape = interp.getInputTensor(0).shape()
        val expectedLength = inputShape.last()
        val input = if (audioData.size >= expectedLength) {
            audioData.copyOf(expectedLength)
        } else {
            FloatArray(expectedLength).also { audioData.copyInto(it) }
        }

        // Run inference
        val inputBuffer = ByteBuffer.allocateDirect(expectedLength * 4).apply {
            order(ByteOrder.nativeOrder())
            for (sample in input) putFloat(sample)
            rewind()
        }

        val outputShape = interp.getOutputTensor(0).shape()
        val outputSize = outputShape.last()
        val output = Array(1) { FloatArray(outputSize) }

        interp.run(inputBuffer, output)

        // Map to results
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

    /**
     * モデル未ロード時は空を返す（偽データを記録しない）。
     */
    private fun dummyClassify(): List<ClassificationResult> {
        Log.w(TAG, "BirdNET model not loaded — skipping classification. Place birdnet_lite.tflite in assets/")
        return emptyList()
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
