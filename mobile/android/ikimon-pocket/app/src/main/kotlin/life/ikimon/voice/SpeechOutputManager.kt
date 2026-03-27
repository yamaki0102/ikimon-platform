package life.ikimon.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale

/**
 * Android TextToSpeech ラッパー
 *
 * 日本語音声で AI 応答を読み上げる。
 */
class SpeechOutputManager(context: Context) {

    private val TAG = "SpeechOutput"
    private var tts: TextToSpeech? = null
    private var isReady = false
    private var utteranceCounter = 0
    var onSpeakingChanged: ((Boolean) -> Unit)? = null

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = tts?.setLanguage(Locale.JAPANESE)
                isReady = result != TextToSpeech.LANG_MISSING_DATA
                    && result != TextToSpeech.LANG_NOT_SUPPORTED

                tts?.setSpeechRate(1.1f)
                tts?.setPitch(1.0f)

                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        onSpeakingChanged?.invoke(true)
                    }

                    override fun onDone(utteranceId: String?) {
                        onSpeakingChanged?.invoke(false)
                    }

                    @Deprecated("Deprecated")
                    override fun onError(utteranceId: String?) {
                        onSpeakingChanged?.invoke(false)
                    }
                })

                Log.i(TAG, "TTS initialized: ready=$isReady")
            } else {
                Log.e(TAG, "TTS init failed: status=$status")
            }
        }
    }

    fun speak(text: String) {
        if (!isReady || text.isBlank()) return

        utteranceCounter++
        val utteranceId = "ai_reply_$utteranceCounter"

        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        Log.i(TAG, "Speaking: ${text.take(50)}...")
    }

    fun stop() {
        tts?.stop()
        onSpeakingChanged?.invoke(false)
    }

    val isSpeaking: Boolean
        get() = tts?.isSpeaking == true

    fun destroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isReady = false
    }
}
