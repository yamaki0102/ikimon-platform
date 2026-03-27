package life.ikimon.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.util.Locale

/**
 * Android SpeechRecognizer ラッパー (PTT モード)
 *
 * Push-to-Talk: startListening() で開始、発話完了を自動検出して停止。
 * 日本語音声認識。
 */
class SpeechInputManager(private val context: Context) {

    private val TAG = "SpeechInput"
    private var recognizer: SpeechRecognizer? = null
    private var callback: ((Result) -> Unit)? = null
    private var isListening = false

    data class Result(
        val text: String,
        val confidence: Float,
        val isPartial: Boolean,
    )

    enum class State { IDLE, LISTENING, PROCESSING, ERROR }

    var state: State = State.IDLE
        private set

    var onStateChanged: ((State) -> Unit)? = null

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun startListening(onResult: (Result) -> Unit) {
        if (isListening) return
        if (!isAvailable()) {
            Log.w(TAG, "SpeechRecognizer not available")
            onResult(Result("", 0f, false))
            return
        }

        callback = onResult
        isListening = true
        updateState(State.LISTENING)

        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(listener)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.JAPANESE.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }

        recognizer?.startListening(intent)
        Log.i(TAG, "Listening started")
    }

    fun stopListening() {
        if (!isListening) return
        isListening = false
        recognizer?.stopListening()
        updateState(State.IDLE)
        Log.i(TAG, "Listening stopped")
    }

    fun destroy() {
        isListening = false
        recognizer?.destroy()
        recognizer = null
        updateState(State.IDLE)
    }

    private fun updateState(newState: State) {
        state = newState
        onStateChanged?.invoke(newState)
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            Log.d(TAG, "Ready for speech")
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "Speech began")
        }

        override fun onRmsChanged(rmsdB: Float) {}

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {
            Log.d(TAG, "Speech ended")
            updateState(State.PROCESSING)
        }

        override fun onError(error: Int) {
            val errorMsg = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH -> "no_match"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "timeout"
                SpeechRecognizer.ERROR_NETWORK -> "network"
                SpeechRecognizer.ERROR_AUDIO -> "audio"
                else -> "error_$error"
            }
            Log.w(TAG, "Recognition error: $errorMsg")
            isListening = false
            updateState(State.ERROR)
            callback?.invoke(Result("", 0f, false))
        }

        override fun onResults(results: Bundle?) {
            isListening = false
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val confidences = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

            val text = matches?.firstOrNull() ?: ""
            val confidence = confidences?.firstOrNull() ?: 0f

            Log.i(TAG, "Result: '$text' (confidence: $confidence)")
            updateState(State.IDLE)
            callback?.invoke(Result(text, confidence, false))
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val text = matches?.firstOrNull() ?: return
            if (text.isNotBlank()) {
                callback?.invoke(Result(text, 0f, true))
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }
}
